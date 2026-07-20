import { prisma } from "../../lib/prisma.js"
import { cached } from "../../lib/cache.js"
import { exec } from "child_process"
import path from "path"
import { promisify } from "util"
import axios from "axios"

const execAsync = promisify(exec)

const PLAYER_CACHE_TTL = 60 * 60 * 1000 

const SUGGESTED_TTL = 24 * 60 * 60 * 1000

const VARIANTS_TTL = 7 * 24 * 60 * 60 * 1000

export const searchPlayers = async (req, res) => {
  console.log("searchPlayers called with q =", req.query.q)
  const { q } = req.query
  if (!q) return res.status(400).json({ error: "Query required" })

  const key = `players:search:${q.toLowerCase().trim()}`
  console.log("about to call cached with key:", key)

  try {
    const players = await cached(key, PLAYER_CACHE_TTL, async () => {
      const scriptPath = path.resolve("python", "searchPlayers.py")
      const { stdout } = await execAsync(`python "${scriptPath}" "${q}"`)

      let list
      try {
        list = JSON.parse(stdout.trim())
      } catch {
        throw new Error("Invalid response from Python")
      }

      // Upsert into DB so pyramid can reference them
      await Promise.all(list.map(p =>
        prisma.player.upsert({
          where: { id: p.id },
          update: { name: p.name, headshotUrl: p.headshotUrl, position: p.position },
          create: {
            id: p.id,
            name: p.name,
            headshotUrl: p.headshotUrl,
            position: p.position ?? null,
            teamId: p.teamId ?? null
          }
        })
      ))

      return list
    })

    return res.json(players)
  } catch (err) {
    console.error("PLAYER SEARCH ERROR:", err)
    return res.status(500).json({ error: "Player search failed" })
  }
}

export const getSuggestedPlayers = async (req, res) => {
  const scriptPath = path.resolve("python", "suggestedPlayers.py")

  try {
    const list = await cached("players:suggested", SUGGESTED_TTL, async () => {
      const { stdout } = await execAsync(`python "${scriptPath}"`, { timeout: 60000 })
      const parsed = JSON.parse(stdout.trim())
      if (parsed.error) throw new Error(parsed.error)

      // make sure they exist in the DB so savePyramid never has to auto-fetch
      await Promise.all(parsed.map(p =>
        prisma.player.upsert({
          where: { id: p.id },
          update: { name: p.name },
          create: {
            id: p.id,
            name: p.name,
            headshotUrl: `https://cdn.nba.com/headshots/nba/latest/1040x760/${p.id}.png`,
          },
        })
      ))

      return parsed
    })

    return res.json(list)
  } catch (err) {
    console.error("getSuggestedPlayers error:", err)
    return res.status(500).json({ error: "Failed to fetch suggested players" })
  }
}

const headshotExists = async (url) => {
  try {
    const r = await axios.get(url, {
      timeout: 6000,
      responseType: "arraybuffer",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Referer": "https://www.nba.com/",
        "Range": "bytes=0-1023",
      },
      validateStatus: () => true,
    })
    return (r.status === 200 || r.status === 206)
      && (r.headers["content-type"] ?? "").startsWith("image/")
  } catch {
    return false
  }
}

export const getPlayerHeadshots = async (req, res) => {
  const { playerId } = req.params
  if (!/^\d+$/.test(playerId)) return res.status(400).json({ error: "Invalid player id" })

  try {
    const variants = await cached(`players:headshots:${playerId}`, VARIANTS_TTL, async () => {
      const scriptPath = path.resolve("python", "playerTeams.py")
      const { stdout } = await execAsync(`python "${scriptPath}" ${playerId}`, { timeout: 90000 })
      const career = JSON.parse(stdout.trim())
      if (career.error) throw new Error(career.error)

      console.log("HEADSHOTS: career entries =", career.length)      // ← add

      const found = []
      for (const c of career) {
        const url = `https://cdn.nba.com/headshots/nba/${c.teamId}/${c.season}/260x190/${playerId}.png`
        const ok = await headshotExists(url)
        console.log("HEADSHOTS probe", ok ? "HIT " : "miss", c.abbr, c.season)   // ← add
        if (ok) found.push({ teamId: c.teamId, season: c.season, abbr: c.abbr })
      }

      console.log("HEADSHOTS: found =", found.length)                // ← add
      found.sort((a, b) => Number(b.season) - Number(a.season))
      return [{ teamId: null, season: null, abbr: "Current" }, ...found]
    })

    return res.json(variants)
  } catch (err) {
    console.error("getPlayerHeadshots error:", err)
    return res.status(500).json({ error: "Failed to fetch headshot variants" })
  }
}
