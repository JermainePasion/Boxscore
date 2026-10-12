import { execFile } from "child_process"
import fs from "fs/promises"
import net from "net"
import path from "path"

/*
 * Helpers for everything that depends on NBA data.
 *
 *   runNbaScript(script, args)   run a python/ script safely and parse its JSON
 *   resilient(key, opts, fn)     in-memory cache that remembers failures and
 *                                serves the last good value when the NBA is down
 *   readJsonCache / writeJsonCache   small on-disk JSON cache for data that never
 *                                changes (e.g. a finished game's shot chart)
 *   nbaStatus()                  is the relay up / are NBA requests paused (for /api/health/nba)
 *
 * Works together with python/nba_guard.py: when the NBA blocks us, nba_guard
 * pauses NBA requests and records until when in its state file. Node reads the
 * same file, so while paused it doesn't even start a Python process.
 *
 * It also watches the relay (NBA_PROXY, the laptop). If the laptop is off or
 * asleep, requests fail fast with NbaUnavailableError instead of each one
 * hanging and then showing a generic error, and the relay isn't tried again
 * for RELAY_DOWN_MS.
 */

const GUARD_DIR = process.env.NBA_GUARD_DIR || "/tmp/nba_guard"
const DATA_DIR = process.env.DATA_CACHE_DIR || path.resolve("cache", "data")

// The NBA is blocking us.
const BLOCK_RE = /NBA requests paused|pausing NBA requests|Access Denied/i
// Can't reach the relay at all (laptop off, asleep, offline, proxy not running).
const RELAY_DOWN_RE = /ProxyError|Unable to connect to proxy|Connection refused|NewConnectionError|ConnectTimeout/i
// Reached it, but the NBA didn't answer in time.
const NBA_TIMEOUT_RE = /Read timed out|ReadTimeout|timed out|RemoteDisconnected|Connection aborted|Connection reset|Max retries exceeded/i

const MIN = 60 * 1000
const RELAY_CHECK_MS = 30 * 1000 // re-check the relay at most this often
const RELAY_DOWN_MS = 2 * MIN // after a failure, don't try the relay for this long

/** The NBA can't be reached right now (blocked, paused, relay down, or timed out). Maps to HTTP 503. */
export class NbaUnavailableError extends Error {
  constructor(message, { blocked = false } = {}) {
    super(message)
    this.name = "NbaUnavailableError"
    this.blocked = blocked
  }
}

/** Milliseconds left in an nba_guard pause, or 0 if not paused. */
export async function nbaPausedFor() {
  try {
    const state = JSON.parse(await fs.readFile(path.join(GUARD_DIR, "state.json"), "utf8"))
    return Math.max(0, (state.blocked_until ?? 0) * 1000 - Date.now())
  } catch {
    return 0
  }
}

/* ---------------- relay (laptop) ---------------- */

function parseProxy(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    return { host: u.hostname, port: Number(u.port) || (u.protocol === "https:" ? 443 : 80) }
  } catch {
    return null
  }
}

const RELAY = parseProxy(process.env.NBA_PROXY)
let relayDownUntil = 0
let relayCheckedAt = 0
let relayProbe = null

/** Can a TCP connection be opened to host:port within timeoutMs? */
function canConnect({ host, port }, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port })
    const done = (ok) => {
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(timeoutMs, () => done(false))
    socket.once("connect", () => done(true))
    socket.once("error", () => done(false))
  })
}

function markRelayDown() {
  if (Date.now() >= relayDownUntil) console.warn("NBA relay unreachable; pausing NBA lookups for 2 min")
  relayDownUntil = Date.now() + RELAY_DOWN_MS
}

const relayUnavailable = () => new NbaUnavailableError("NBA relay unreachable")

/** Throws if the relay is down. Probes it at most every RELAY_CHECK_MS (a few ms when it's up). */
async function ensureRelay() {
  if (!RELAY) return // no relay configured (local development)
  if (Date.now() < relayDownUntil) throw relayUnavailable()

  if (!relayProbe && Date.now() - relayCheckedAt >= RELAY_CHECK_MS) {
    relayProbe = canConnect(RELAY)
      .then((ok) => {
        relayCheckedAt = Date.now()
        if (!ok) markRelayDown()
        return ok
      })
      .finally(() => {
        relayProbe = null
      })
  }
  const probe = relayProbe
  if (probe && !(await probe)) throw relayUnavailable()
  if (Date.now() < relayDownUntil) throw relayUnavailable()
}

/** For the health check: is the relay reachable, and is nba_guard pausing requests? */
export async function nbaStatus() {
  const pausedMs = await nbaPausedFor()
  let relay = null // null = no relay configured
  if (RELAY) {
    relay = await canConnect(RELAY)
    relayCheckedAt = Date.now()
    if (relay) relayDownUntil = 0
    else markRelayDown()
  }
  return {
    ok: pausedMs === 0 && relay !== false,
    relay,
    pausedMinutes: Math.ceil(pausedMs / MIN),
  }
}

/** Turn a script failure into NbaUnavailableError when it's an NBA/relay problem. */
function unavailableFrom(message, details = "") {
  const text = `${message}\n${details}`
  if (BLOCK_RE.test(text)) return new NbaUnavailableError(message, { blocked: true })
  if (RELAY_DOWN_RE.test(text)) {
    if (RELAY) markRelayDown()
    return new NbaUnavailableError("NBA relay unreachable")
  }
  if (NBA_TIMEOUT_RE.test(text)) return new NbaUnavailableError("NBA did not respond in time")
  return null
}

/* ---------------- running scripts ---------------- */

/**
 * Run python/<script> with arguments and return its parsed JSON output.
 * Arguments are passed directly (no shell), so user input like a search query
 * can't be interpreted as a command.
 */
export async function runNbaScript(script, args = [], { timeout = 120000 } = {}) {
  const paused = await nbaPausedFor()
  if (paused > 0) {
    throw new NbaUnavailableError(`NBA requests paused for ~${Math.ceil(paused / MIN)} min`, {
      blocked: true,
    })
  }
  await ensureRelay()

  const file = path.resolve("python", script)
  const { stdout, stderr, error } = await new Promise((resolve) => {
    execFile(
      "python",
      [file, ...args.map(String)],
      { timeout, maxBuffer: 20 * 1024 * 1024 },
      (err, out, errOut) => {
        if (errOut?.trim()) console.error(`[${script}]`, errOut.trim().slice(-1000))
        resolve({ stdout: out ?? "", stderr: errOut ?? "", error: err })
      }
    )
  })

  let data
  try {
    data = JSON.parse(stdout.trim())
  } catch {
    if (error?.killed) throw new NbaUnavailableError(`${script} timed out`)
    const message = `${script} returned invalid output${error ? `: ${error.message}` : ""}`
    throw unavailableFrom(message, stderr) ?? new Error(message)
  }

  if (data && !Array.isArray(data) && data.error) {
    if (data.blocked === true) throw new NbaUnavailableError(data.error, { blocked: true })
    throw unavailableFrom(String(data.error), stderr) ?? new Error(data.error)
  }
  if (error) {
    const message = `${script} failed: ${error.message}`
    throw unavailableFrom(message, stderr) ?? new Error(message)
  }
  return data
}

/* ---------------- resilient cache ---------------- */

const store = new Map() // key -> { value, freshUntil, retryAfter, error }
const inFlight = new Map()
const MAX_ENTRIES = 2000

/**
 * Cache with failure memory.
 *  - Fresh value: returned immediately.
 *  - After a failure, `fn` isn't retried until `failTtl` passes (or the nba_guard
 *    pause ends, whichever is later), so a broken NBA isn't asked again on every
 *    page load.
 *  - If a previous good value exists, it's returned instead of the error.
 *  - Simultaneous calls for the same key share one run of `fn`.
 */
export async function resilient(key, { ttl, failTtl = 2 * MIN }, fn) {
  const now = Date.now()
  const entry = store.get(key)

  if (entry?.value !== undefined && entry.freshUntil > now) return entry.value
  if (entry?.retryAfter > now) {
    if (entry.value !== undefined) return entry.value
    throw entry.error
  }
  if (inFlight.has(key)) return inFlight.get(key)

  const run = (async () => {
    try {
      const value = await fn()
      store.delete(key) // re-insert so the newest entries are kept when trimming
      store.set(key, { value, freshUntil: Date.now() + ttl })
      if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value)
      return value
    } catch (err) {
      const pause =
        err instanceof NbaUnavailableError && err.blocked
          ? Math.max(failTtl, await nbaPausedFor())
          : failTtl
      const prev = store.get(key)
      store.set(key, { ...prev, retryAfter: Date.now() + pause, error: err })
      if (prev?.value !== undefined) {
        console.warn(`serving last good "${key}": ${err.message}`)
        return prev.value
      }
      throw err
    }
  })().finally(() => inFlight.delete(key))

  inFlight.set(key, run)
  return run
}

/* ---------------- disk cache ---------------- */

export async function readJsonCache(name) {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, `${name}.json`), "utf8"))
  } catch {
    return undefined
  }
}

export async function writeJsonCache(name, value) {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const file = path.join(DATA_DIR, `${name}.json`)
  const tmp = `${file}.${process.pid}.tmp`
  await fs.writeFile(tmp, JSON.stringify(value))
  await fs.rename(tmp, file)
}