import { prisma } from "./prisma.js"
import { NbaUnavailableError, runNbaScript, readJsonCache, writeJsonCache } from "./nba.js"
import { syncNbaHighlights } from "./youtube.js"
import { fetchAndSaveGame } from "../src/controllers/gameController.js"

/*
 * Daily game sync: saves every finished game into the database in the
 * afternoon (Philippine time), after the night's NBA games are over. Visitors
 * then get games straight from the database and never wait on the NBA.
 *
 * It goes slowly on purpose: one game at a time, a pause between games, and
 * nba_guard spacing out every request. A typical night (~10-15 games) takes
 * a few minutes. If the NBA blocks us, it stops; the next run picks up
 * whatever was missed, since it always looks back a few days.
 *
 * Env:
 *   GAME_SYNC=on          turn the schedule on (off by default, so your laptop's
 *                         local server doesn't sync too; set it on the droplet)
 *   GAME_SYNC_TIMES       Manila times, default "14:30,21:00"
 *   GAME_SYNC_DAYS        days to look back, default 3
 *   GAME_SYNC_TYPES       game types, default "002,004,005,006"
 *                         (add 001 to include preseason)
 *   GAME_SYNC_GAP_MS      pause between games, default 5000
 *
 * Run it by hand any time:  node scripts/syncGames.js --days 3
 */

const MIN = 60 * 1000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const MANILA_OFFSET = 8 * HOUR // the Philippines has no daylight saving time

const DEFAULT_TIMES = "14:30,21:00"
const DEFAULT_TYPES = "002,004,005,006"
const STATE_NAME = "game-sync-last"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let running = null

/** Save every finished game from the last `days` days that isn't fully saved yet. */
export function syncFinishedGames(options = {}) {
  if (running) return running // never two syncs at once
  running = doSync(options).finally(() => {
    running = null
  })
  return running
}

async function doSync({
  days = Number(process.env.GAME_SYNC_DAYS) || 3,
  types = process.env.GAME_SYNC_TYPES || DEFAULT_TYPES,
  gapMs = Number(process.env.GAME_SYNC_GAP_MS ?? 5000),
  log = console.log,
} = {}) {
  const result = {
    startedAt: new Date().toISOString(),
    finishedAt: null,
    found: 0,
    alreadySaved: 0,
    saved: [],
    failed: [],
    stopped: null,
    highlights: null,
  }

  try {
    const games = await runNbaScript("finishedGames.py", [days, types], { timeout: 180000 })
    result.found = games.length

    const ids = games.map((g) => g.gameId)
    const existing = await prisma.game.findMany({
      where: { id: { in: ids } },
      select: { id: true, date: true, _count: { select: { stats: true } } },
    })
    const complete = new Set(existing.filter((g) => g.date && g._count.stats > 0).map((g) => g.id))
    const todo = games.filter((g) => !complete.has(g.gameId))
    result.alreadySaved = games.length - todo.length
    log(`Game sync: ${games.length} finished, ${todo.length} to save`)

    for (let i = 0; i < todo.length; i++) {
      const g = todo[i]
      try {
        await fetchAndSaveGame(g.gameId)
        result.saved.push(g.gameId)
        log(`Game sync: saved ${g.gameId} ${g.matchup} (${i + 1}/${todo.length})`)
      } catch (err) {
        result.failed.push({ gameId: g.gameId, reason: err.message })
        if (err instanceof NbaUnavailableError && err.blocked) {
          result.stopped = `NBA blocked: ${err.message}`
          break // the rest would fail too; the next run will retry them
        }
      }
      if (i < todo.length - 1) await sleep(gapMs)
    }
  } catch (err) {
    result.stopped =
      err instanceof NbaUnavailableError ? `NBA unavailable: ${err.message}` : `error: ${err.message}`
  }

  // New games: look for their highlight videos now instead of waiting for the
  // next 3-hourly highlight run.
  if (result.saved.length) {
    try {
      result.highlights = await syncNbaHighlights()
    } catch (err) {
      result.highlights = { error: err.message }
    }
  }

  result.finishedAt = new Date().toISOString()
  await writeJsonCache(STATE_NAME, result).catch(() => {})
  return result
}

/** Last sync's result (also saved to cache/data/game-sync-last.json). */
export const lastSyncResult = () => readJsonCache(STATE_NAME)

/* ---------------- schedule ---------------- */

/** Milliseconds from `now` until the next of the given "HH:MM" Manila times. */
export function msUntilNext(times, now = Date.now()) {
  const manila = new Date(now + MANILA_OFFSET) // read with UTC getters = Manila clock
  let best = Infinity
  for (const t of times) {
    const [h, m] = t.split(":").map(Number)
    let at =
      Date.UTC(manila.getUTCFullYear(), manila.getUTCMonth(), manila.getUTCDate(), h, m) - MANILA_OFFSET
    if (at <= now) at += DAY
    best = Math.min(best, at - now)
  }
  return best
}

const summary = (r) =>
  `found ${r.found}, already saved ${r.alreadySaved}, saved ${r.saved.length}, failed ${r.failed.length}` +
  (r.stopped ? `, stopped (${r.stopped})` : "")

/** Call once at startup (next to startHighlightSync). Does nothing unless GAME_SYNC=on. */
export function startGameSync() {
  if (process.env.GAME_SYNC !== "on") {
    console.log("Game sync off (set GAME_SYNC=on to enable)")
    return
  }

  const times = (process.env.GAME_SYNC_TIMES || DEFAULT_TIMES)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(s))
  if (!times.length) {
    console.error("Game sync off: GAME_SYNC_TIMES has no valid HH:MM times")
    return
  }

  const run = async () => {
    try {
      console.log("Game sync done:", summary(await syncFinishedGames()))
    } catch (err) {
      console.error("Game sync failed:", err)
    }
  }

  const scheduleNext = () => {
    const ms = msUntilNext(times)
    console.log(`Next game sync in ${Math.round(ms / MIN)} min (Manila ${times.join(", ")})`)
    setTimeout(() => run().finally(scheduleNext), ms)
  }
  scheduleNext()

  // Catch up after a restart or deploy: if the last sync is older than a day
  // (or never happened), run one shortly after boot.
  lastSyncResult().then((last) => {
    const age = last?.finishedAt ? Date.now() - new Date(last.finishedAt).getTime() : Infinity
    if (age > DAY) setTimeout(run, 2 * MIN)
  })
}