import { prisma } from "../../lib/prisma.js"
import { cached } from "../../lib/cache.js"
import { exec } from "child_process"
import path from "path"
import { promisify } from "util"

const execAsync = promisify(exec)

const PLAYER_CACHE_TTL = 60 * 60 * 1000  // 1 hour

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