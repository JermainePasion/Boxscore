import express from "express"
import axios from "axios"

const router = express.Router()

// naive in-memory cache: { key: { buffer, contentType, expiresAt } }
const imgCache = new Map()
const IMG_TTL = 24 * 60 * 60 * 1000 // 24h

const proxyImage = async (url, res) => {
  const hit = imgCache.get(url)
  if (hit && hit.expiresAt > Date.now()) {
    res.set("Content-Type", hit.contentType)
    res.set("Cache-Control", "public, max-age=86400")
    return res.send(hit.buffer)
  }

  try {
    const upstream = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Referer": "https://www.nba.com/",
      },
    })

    const contentType = upstream.headers["content-type"] ?? "image/png"
    if (!contentType.startsWith("image/")) throw new Error("not an image")

    const buffer = Buffer.from(upstream.data)
    imgCache.set(url, { buffer, contentType, expiresAt: Date.now() + IMG_TTL })

    res.set("Content-Type", contentType)
    res.set("Cache-Control", "public, max-age=86400")
    return res.send(buffer)
  } catch {
    return res.status(404).end()
  }
}

router.get("/headshot/:playerId", (req, res) => {
  const { playerId } = req.params
  if (!/^\d+$/.test(playerId)) return res.status(400).end()
  proxyImage(`https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`, res)
})

router.get("/headshot/:teamId/:season/:playerId", (req, res) => {
  const { teamId, season, playerId } = req.params
  if (![teamId, season, playerId].every(v => /^\d+$/.test(v))) return res.status(400).end()
  proxyImage(`https://cdn.nba.com/headshots/nba/${teamId}/${season}/260x190/${playerId}.png`, res)
})

router.get("/logo/:teamId", (req, res) => {
  const { teamId } = req.params
  if (!/^\d+$/.test(teamId)) return res.status(400).end()
  proxyImage(`https://cdn.nba.com/logos/nba/${teamId}/global/L/logo.svg`, res)
})

export default router