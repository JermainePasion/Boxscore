import { execFile } from "child_process"
import fs from "fs/promises"
import path from "path"

/*
 * Helpers for everything that depends on NBA data.
 *
 *   runNbaScript(script, args)   run a python/ script safely and parse its JSON
 *   resilient(key, opts, fn)     in-memory cache that remembers failures and
 *                                serves the last good value when the NBA is down
 *   readJsonCache / writeJsonCache   small on-disk JSON cache for data that never
 *                                changes (e.g. a finished game's shot chart)
 *
 * Works together with python/nba_guard.py: when the NBA blocks us, nba_guard
 * pauses NBA requests and records until when in its state file. Node reads the
 * same file, so while paused it doesn't even start a Python process.
 */

const GUARD_DIR = process.env.NBA_GUARD_DIR || "/tmp/nba_guard"
const DATA_DIR = process.env.DATA_CACHE_DIR || path.resolve("cache", "data")
const BLOCK_RE = /NBA requests paused|pausing NBA requests|Access Denied/i

/** The NBA can't be reached right now (blocked, paused, or timed out). Maps to HTTP 503. */
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

/**
 * Run python/<script> with arguments and return its parsed JSON output.
 * Arguments are passed directly (no shell), so user input like a search query
 * can't be interpreted as a command.
 */
export async function runNbaScript(script, args = [], { timeout = 120000 } = {}) {
  const paused = await nbaPausedFor()
  if (paused > 0) {
    throw new NbaUnavailableError(`NBA requests paused for ~${Math.ceil(paused / 60000)} min`, {
      blocked: true,
    })
  }

  const file = path.resolve("python", script)
  const { stdout, error } = await new Promise((resolve) => {
    execFile(
      "python",
      [file, ...args.map(String)],
      { timeout, maxBuffer: 20 * 1024 * 1024 },
      (err, out, stderr) => {
        if (stderr?.trim()) console.error(`[${script}]`, stderr.trim().slice(-1000))
        resolve({ stdout: out ?? "", error: err })
      }
    )
  })

  let data
  try {
    data = JSON.parse(stdout.trim())
  } catch {
    if (error?.killed) throw new NbaUnavailableError(`${script} timed out`)
    throw new Error(`${script} returned invalid output${error ? `: ${error.message}` : ""}`)
  }

  if (data && !Array.isArray(data) && data.error) {
    const blocked = data.blocked === true || BLOCK_RE.test(String(data.error))
    if (blocked) throw new NbaUnavailableError(data.error, { blocked: true })
    throw new Error(data.error)
  }
  if (error) throw new Error(`${script} failed: ${error.message}`)
  return data
}

/* ------------------------------------------------------------------ */

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
export async function resilient(key, { ttl, failTtl = 2 * 60 * 1000 }, fn) {
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

/* ------------------------------------------------------------------ */

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