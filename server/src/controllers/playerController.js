import { prisma } from "../../lib/prisma.js"
import { exec } from "child_process"
import path from "path"

export const searchPlayers = (req, res) => {
  const { q } = req.query
  if (!q) return res.status(400).json({ error: "Query required" })

  const scriptPath = path.resolve("python", "searchPlayers.py")

  exec(`python "${scriptPath}" "${q}"`, async (err, stdout, stderr) => {
    if (err) {
      console.error("PYTHON ERROR:", stderr)
      return res.status(500).json({ error: "Player search failed" })
    }

    let players
    try {
      players = JSON.parse(stdout.trim())
    } catch {
      return res.status(500).json({ error: "Invalid response from Python" })
    }

    await Promise.all(players.map(p =>
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

    return res.json(players)
  })
}