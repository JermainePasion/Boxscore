import axios from "axios"
import { prisma } from "./prisma.js"
import { cached } from "./cache.js"

/*
 * Highlight lookup, cheapest first:
 *   1. Recent games  -> match against the NBA channel's recent uploads
 *                       (playlistItems.list: 1 unit per 50 videos, cached 30 min)
 *   2. Older games   -> search.list fallback (~100 calls/day), at most once per game
 * A background job (startHighlightSync) fills recent games so they're ready before
 * anyone opens them.
 */

const YT_KEY = process.env.YOUTUBE_API_KEY
const YT = "https://www.googleapis.com/youtube/v3"

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

const UPLOADS_LOOKBACK_DAYS = 4       // how far back to page through NBA uploads
const UPLOADS_MAX_PAGES = 10          // hard cap: 10 units per refresh
const UPLOADS_CACHE_MS = 30 * 60 * 1000
const RECENT_RETRY_MS = 6 * HOUR      // recent games may get uploaded late: retry search after this
const MIN_SEARCH_SCORE = 40

let uploadsPlaylistId = process.env.NBA_UPLOADS_PLAYLIST_ID || null
let searchBlockedUntil = 0            // set when the daily search quota runs out

/* ---------- small helpers ---------- */

const errMsg = (err) => err.response?.data?.error?.message ?? err.message

const isQuotaError = (err) => {
  const reason = err.response?.data?.error?.errors?.[0]?.reason ?? ""
  return /quotaExceeded|dailyLimitExceeded/i.test(reason)
}

// ms until the YouTube quota resets (midnight Pacific)
const msUntilPacificMidnight = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date())
  const get = (type) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const elapsed = (get("hour") * 3600 + get("minute") * 60 + get("second")) * 1000
  return DAY - elapsed
}

const isRecentGame = (game) =>
  !!game.date && Date.now() - new Date(game.date).getTime() < (UPLOADS_LOOKBACK_DAYS + 1) * DAY

// Search each game once. Exception: games from the last few days, where the NBA
// may simply not have uploaded yet, get a retry every RECENT_RETRY_MS.
const shouldSearch = (game) => {
  if (!game.highlightCheckedAt) return true
  const sinceCheck = Date.now() - new Date(game.highlightCheckedAt).getTime()
  return isRecentGame(game) && sinceCheck > RECENT_RETRY_MS
}

const saveHighlight = (gameId, videoId) =>
  prisma.game.update({
    where: { id: gameId },
    data: { youtubeId: videoId, highlightCheckedAt: new Date() },
  })

const markChecked = (gameId) =>
  prisma.game.update({ where: { id: gameId }, data: { highlightCheckedAt: new Date() } })

/* ---------- scoring (your original rules, shared by both paths) ---------- */

const titleHasDate = (title, d) => {
  const month = d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" }).toLowerCase()
  const day = String(d.getUTCDate())
  const year = String(d.getUTCFullYear())
  return (
    title.toLowerCase().includes(month) &&
    new RegExp(`\\b${day}\\b`).test(title) &&
    title.includes(year)
  )
}

const scoreCandidate = (title, channelTitle, game) => {
  const away = (game.awayTeam?.name ?? "").toLowerCase()
  const home = (game.homeTeam?.name ?? "").toLowerCase()
  const t = title.toLowerCase()
  const d = game.date ? new Date(game.date) : null
  let score = 0

  const bothTeams = !!away && !!home && t.includes(away) && t.includes(home)
  if (!bothTeams) score -= 100

  if (channelTitle === "NBA") score += 50

  // "FULL GAME ... HIGHLIGHTS" with anything in between (covers "FULL GAME 6 NBA FINALS HIGHLIGHTS")
  const fullGame = /full game.*highlights/i.test(title)
  if (fullGame) score += 30
  else if (/highlights/i.test(title)) score += 10

  // NBA format: "TEAM at TEAM" — away team appearing before home team
  const awayIdx = away ? t.indexOf(away) : -1
  const homeIdx = home ? t.indexOf(home) : -1
  if (awayIdx !== -1 && homeIdx !== -1 && awayIdx < homeIdx) score += 15

  // Titles use the US Eastern game date; a late tip-off stored in UTC can land a
  // day later, so the previous day also counts as a date match.
  let nearDate = false
  if (d) {
    const month = d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" }).toLowerCase()
    const year = String(d.getUTCFullYear())
    const hasMonth = t.includes(month)
    const hasYear = title.includes(year)
    const exact = titleHasDate(title, d)
    nearDate = exact || titleHasDate(title, new Date(d.getTime() - DAY))

    if (exact) score += 60
    else if (hasMonth && hasYear) score += 25
    else if (hasYear) score += 10
    else score -= 40
  }

  if (/reaction|breakdown|top 10|mix|trailer|preview|prediction/i.test(title)) score -= 50

  return { score, bothTeams, fullGame, nearDate }
}

/* ---------- YouTube calls ---------- */

// public + embeddable, checked in batches of 50 (1 unit per batch)
const embeddableIds = async (ids) => {
  const ok = new Set()
  for (let i = 0; i < ids.length; i += 50) {
    const { data } = await axios.get(`${YT}/videos`, {
      params: { key: YT_KEY, id: ids.slice(i, i + 50).join(","), part: "status" },
    })
    for (const v of data.items ?? []) {
      if (v.status?.embeddable && v.status?.privacyStatus === "public") ok.add(v.id)
    }
  }
  return ok
}

// the NBA channel's uploads playlist (1 unit, once per process)
const getUploadsPlaylistId = async () => {
  if (uploadsPlaylistId) return uploadsPlaylistId
  const { data } = await axios.get(`${YT}/channels`, {
    params: { key: YT_KEY, part: "contentDetails", forHandle: "@NBA" },
  })
  uploadsPlaylistId = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null
  return uploadsPlaylistId
}

// recent NBA uploads, newest first; shared 30-min cache
const getRecentUploads = () =>
  cached("yt:nba-uploads", UPLOADS_CACHE_MS, async () => {
    const playlistId = await getUploadsPlaylistId()
    if (!playlistId) throw new Error("NBA uploads playlist not found")

    const cutoff = Date.now() - UPLOADS_LOOKBACK_DAYS * DAY
    const uploads = []
    let pageToken

    for (let page = 0; page < UPLOADS_MAX_PAGES; page++) {
      const { data } = await axios.get(`${YT}/playlistItems`, {
        params: {
          key: YT_KEY,
          part: "snippet,contentDetails",
          playlistId,
          maxResults: 50,
          pageToken,
        },
      })
      const items = data.items ?? []
      for (const it of items) {
        const videoId = it.contentDetails?.videoId
        if (videoId) uploads.push({ videoId, title: it.snippet?.title ?? "" })
      }

      const last = items[items.length - 1]
      const lastTime = new Date(
        last?.contentDetails?.videoPublishedAt ?? last?.snippet?.publishedAt ?? 0
      ).getTime()
      if (!data.nextPageToken || lastTime < cutoff) break
      pageToken = data.nextPageToken
    }
    return uploads
  })

// strict match only: both teams + full-game highlights + game date
const bestUploadFor = (game, uploads, taken = new Set()) => {
  let best = null
  for (const u of uploads) {
    if (taken.has(u.videoId)) continue
    const s = scoreCandidate(u.title, "NBA", game)
    if (!(s.bothTeams && s.fullGame && s.nearDate)) continue
    if (!best || s.score > best.score) best = { ...u, score: s.score }
  }
  return best
}

/* ---------- search fallback (expensive) ---------- */

const searchForHighlight = async (game) => {
  const away = game.awayTeam.name
  const home = game.homeTeam.name
  const d = game.date ? new Date(game.date) : null
  const dateStr = d
    ? d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    : ""

  // Mirrors the NBA channel title format:
  // "WARRIORS at CELTICS | FULL GAME 6 NBA FINALS HIGHLIGHTS | June 16, 2022"
  const query = `${away} at ${home} highlights ${dateStr}`
  console.log("YT SEARCH:", query)

  try {
    const { data } = await axios.get(`${YT}/search`, {
      params: {
        key: YT_KEY,
        part: "snippet",
        q: query,
        type: "video",
        maxResults: 15,
        videoEmbeddable: "true",
      },
    })

    const scored = (data.items ?? [])
      .map((i) => ({
        videoId: i.id.videoId,
        title: i.snippet.title,
        ...scoreCandidate(i.snippet.title, i.snippet.channelTitle, game),
      }))
      .sort((a, b) => b.score - a.score)

    console.log("YT TOP 3:", scored.slice(0, 3).map((s) => `[${s.score}] ${s.title}`))

    const confident = scored.filter((s) => s.score >= MIN_SEARCH_SCORE).slice(0, 3)
    if (!confident.length) {
      console.log("YT: no confident match")
      await markChecked(game.id)
      return null
    }

    const ok = await embeddableIds(confident.map((c) => c.videoId))
    const pick = confident.find((c) => ok.has(c.videoId))
    if (!pick) {
      console.log("YT: no embeddable match")
      await markChecked(game.id)
      return null
    }

    await saveHighlight(game.id, pick.videoId)
    return pick.videoId
  } catch (err) {
    if (isQuotaError(err)) {
      searchBlockedUntil = Date.now() + msUntilPacificMidnight()
      console.warn("YT: search quota used up, pausing searches until midnight Pacific")
    } else {
      console.error("YouTube search failed:", errMsg(err))
    }
    return null // not a real miss, so the game stays eligible
  }
}

/* ---------- public API ---------- */

export const findAndSaveHighlight = async (game) => {
  if (game.youtubeId) return game.youtubeId
  if (!YT_KEY) return null
  if (!game.awayTeam?.name || !game.homeTeam?.name) return null

  // 1. cheap: recent NBA uploads
  if (isRecentGame(game)) {
    try {
      const hit = bestUploadFor(game, await getRecentUploads())
      if (hit && (await embeddableIds([hit.videoId])).has(hit.videoId)) {
        await saveHighlight(game.id, hit.videoId)
        return hit.videoId
      }
    } catch (err) {
      console.error("YT uploads lookup failed:", errMsg(err))
    }
  }

  // 2. expensive: search, once per game, and not while the quota is out
  if (!shouldSearch(game)) return null
  if (Date.now() < searchBlockedUntil) return null
  return searchForHighlight(game)
}

// Match recent games already in the DB against recent NBA uploads.
export const syncNbaHighlights = async () => {
  if (!YT_KEY) return { skipped: "no YOUTUBE_API_KEY" }

  const since = new Date(Date.now() - (UPLOADS_LOOKBACK_DAYS + 1) * DAY)
  const games = await prisma.game.findMany({
    where: { youtubeId: null, date: { gte: since } },
    include: { homeTeam: true, awayTeam: true },
  })
  if (!games.length) return { candidates: 0, matched: 0 }

  const uploads = await getRecentUploads()
  const taken = new Set()
  const picks = []
  for (const g of games) {
    const hit = bestUploadFor(g, uploads, taken)
    if (hit) {
      taken.add(hit.videoId)
      picks.push({ gameId: g.id, videoId: hit.videoId })
    }
  }
  if (!picks.length) return { candidates: games.length, matched: 0 }

  const ok = await embeddableIds(picks.map((p) => p.videoId))
  let matched = 0
  for (const p of picks) {
    if (!ok.has(p.videoId)) continue
    await saveHighlight(p.gameId, p.videoId)
    matched++
  }
  return { candidates: games.length, matched }
}

let syncRunning = false

// Call once at startup. Runs a minute after boot, then every `everyHours`.
export const startHighlightSync = ({ everyHours = 3 } = {}) => {
  if (!YT_KEY) {
    console.warn("Highlight sync disabled: no YOUTUBE_API_KEY")
    return
  }
  const run = async () => {
    if (syncRunning) return
    syncRunning = true
    try {
      console.log("Highlight sync:", await syncNbaHighlights())
    } catch (err) {
      console.error("Highlight sync failed:", errMsg(err))
    } finally {
      syncRunning = false
    }
  }
  setTimeout(run, 60 * 1000)
  setInterval(run, everyHours * HOUR)
}