import express from "express"
import axios from "axios"
import fs from "fs/promises"
import path from "path"
import httpsProxyAgent from "https-proxy-agent"

// Works with both older (CommonJS) and newer versions of https-proxy-agent.
const HttpsProxyAgent = httpsProxyAgent.HttpsProxyAgent ?? httpsProxyAgent

/*
 * NBA images, fetched once and then served from disk.
 *
 * The NBA CDN blocks datacenter IPs (the droplet) and won't serve its images to
 * other websites, so images go: CDN -> IMG_PROXY (DataImpulse) -> this server ->
 * saved on disk -> browser. Each image goes through the proxy only once.
 *
 * Env:
 *   IMG_PROXY      proxy URL for cdn.nba.com (unset locally = direct)
 *   IMG_CACHE_DIR  where images are saved (default ./cache/img)
 */

const router = express.Router()

const CACHE_DIR = process.env.IMG_CACHE_DIR || path.resolve("cache", "img")
const agent = process.env.IMG_PROXY ? new HttpsProxyAgent(process.env.IMG_PROXY) : undefined

const MISSING_RECHECK_MS = 7 * 24 * 60 * 60 * 1000 // look again for a missing image after a week
const BROWSER_MAX_AGE = 7 * 24 * 60 * 60 // seconds the browser may reuse an image

const TYPES = { ".png": "image/png", ".svg": "image/svg+xml" }

const inFlight = new Map() // key -> promise, so simultaneous requests share one fetch

async function fetchAndStore(url, file, missingFile) {
  const upstream = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 20000,
    httpsAgent: agent,
    proxy: false, // proxying is done by httpsAgent
    validateStatus: (s) => s < 500,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      Referer: "https://www.nba.com/",
    },
  })

  const contentType = upstream.headers["content-type"] ?? ""
  await fs.mkdir(CACHE_DIR, { recursive: true })

  if (upstream.status === 200 && contentType.startsWith("image/")) {
    const buf = Buffer.from(upstream.data)
    const tmp = `${file}.${process.pid}.tmp`
    await fs.writeFile(tmp, buf)
    await fs.rename(tmp, file)
    await fs.rm(missingFile, { force: true })
    return { buf }
  }

  // An Akamai "Access Denied" page means we're blocked, not that the image is
  // missing. Don't remember it as missing, so it's retried once the block lifts.
  const body = Buffer.from(upstream.data ?? "").toString("utf8", 0, 2000)
  if (body.includes("edgesuite") || body.includes("Access Denied")) {
    return { blocked: true }
  }

  // Genuinely missing (common for era headshots): remember for a week.
  await fs.writeFile(missingFile, "")
  return { missing: true }
}

async function getImage(key, ext, url) {
  const file = path.join(CACHE_DIR, key + ext)
  const missingFile = path.join(CACHE_DIR, key + ".missing")

  try {
    return { buf: await fs.readFile(file) }
  } catch {
    /* not saved yet */
  }

  try {
    const st = await fs.stat(missingFile)
    if (Date.now() - st.mtimeMs < MISSING_RECHECK_MS) return { missing: true }
  } catch {
    /* no missing marker */
  }

  if (!inFlight.has(key)) {
    inFlight.set(key, fetchAndStore(url, file, missingFile).finally(() => inFlight.delete(key)))
  }
  return inFlight.get(key)
}

async function serveImage(res, key, ext, url) {
  try {
    const result = await getImage(key, ext, url)

    if (result.buf) {
      res.set("Content-Type", TYPES[ext])
      res.set("Cache-Control", `public, max-age=${BROWSER_MAX_AGE}`)
      return res.send(result.buf)
    }
    if (result.missing) {
      res.set("Cache-Control", "public, max-age=3600")
      return res.status(404).end()
    }
    res.set("Cache-Control", "no-store") // blocked: try again later
    return res.status(503).end()
  } catch (err) {
    console.error("image fetch failed:", url, err.message)
    res.set("Cache-Control", "no-store")
    return res.status(502).end()
  }
}

const isId = (v) => /^\d+$/.test(v)

// current headshot (260x190 is plenty for the UI and far smaller than 1040x760)
router.get("/headshot/:playerId", (req, res) => {
  const { playerId } = req.params
  if (!isId(playerId)) return res.status(400).end()
  serveImage(
    res,
    `headshot-${playerId}`,
    ".png",
    `https://cdn.nba.com/headshots/nba/latest/260x190/${playerId}.png`
  )
})

// era-specific headshot
router.get("/headshot/:teamId/:season/:playerId", (req, res) => {
  const { teamId, season, playerId } = req.params
  if (![teamId, season, playerId].every(isId)) return res.status(400).end()
  serveImage(
    res,
    `headshot-${teamId}-${season}-${playerId}`,
    ".png",
    `https://cdn.nba.com/headshots/nba/${teamId}/${season}/260x190/${playerId}.png`
  )
})

// logos now ship with the frontend (/logos/<teamId>.svg); kept for anything still using it
router.get("/logo/:teamId", (req, res) => {
  const { teamId } = req.params
  if (!isId(teamId)) return res.status(400).end()
  serveImage(res, `logo-${teamId}`, ".svg", `https://cdn.nba.com/logos/nba/${teamId}/global/L/logo.svg`)
})

export default router