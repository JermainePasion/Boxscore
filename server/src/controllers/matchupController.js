import { prisma } from "../../lib/prisma.js"
import { cached } from "../../lib/cache.js"
import { exec } from "child_process"
import { promisify } from "util"
import path from "path"

const execAsync = promisify(exec)

const MATCHUP_TTL = 24 * 60 * 60 * 1000

// GET /api/matchups/:aId/vs/:bId
export const getPlayerMatchup = async (req, res) => {
  const { aId, bId } = req.params
  if (!/^\d+$/.test(aId) || !/^\d+$/.test(bId)) {
    return res.status(400).json({ error: "Invalid player id" })
  }
  if (aId === bId) {
    return res.status(400).json({ error: "Pick two different players" })
  }

  try {

    const data = await cached(`matchup:${aId}:${bId}`, MATCHUP_TTL, async () => {
      const scriptPath = path.resolve("python", "playerMatchup.py")
      const { stdout } = await execAsync(`python "${scriptPath}" ${aId} ${bId}`, {
        timeout: 120000,               // 4 LeagueGameFinder calls; cold runs take 10-20s
        maxBuffer: 10 * 1024 * 1024,   // long rivalries produce a big JSON payload
      })
      const parsed = JSON.parse(stdout.trim())
      if (parsed.error) throw new Error(parsed.error)
      return parsed
    })

    const idA = Number(aId)
    const idB = Number(bId)
    const [players, siteGames] = await Promise.all([
      prisma.player.findMany({
        where: { id: { in: [idA, idB] } },
        select: { id: true, name: true, headshotUrl: true },
      }),
      prisma.game.findMany({
        where: { id: { in: data.games.map((g) => g.gameId) } },
        select: { id: true, youtubeId: true, title: true },
      }),
    ])
    const byId = Object.fromEntries(players.map((p) => [p.id, p]))
    const siteById = Object.fromEntries(siteGames.map((g) => [g.id, g]))

    const player = (id, fallbackName) => ({
      id,
      name: byId[id]?.name ?? fallbackName ?? `#${id}`,
      headshotUrl: byId[id]?.headshotUrl ?? null,
    })

    return res.json({
      ...data,
      players: {
        a: player(idA, data.names?.a),
        b: player(idB, data.names?.b),
      },
      games: data.games.map((g) => ({
        ...g,
        onSite: !!siteById[g.gameId],
        youtubeId: siteById[g.gameId]?.youtubeId ?? null,
        title: siteById[g.gameId]?.title ?? null,
      })),
    })
  } catch (err) {
    console.error("getPlayerMatchup error:", err)
    return res.status(500).json({ error: "Failed to build matchup" })
  }
}