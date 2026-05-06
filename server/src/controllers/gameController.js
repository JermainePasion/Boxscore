import { prisma } from "../../lib/prisma.js"
import { exec } from "child_process"
import path from "path"


export const getGameById = async (req, res) => {
  const { id } = req.params
  const scriptPath = path.resolve("python", "fetchSingleGame.py")

  try {

    const existingGame = await prisma.game.findUnique({
      where: { id },
      include: { stats: true }
    })

    if (existingGame && existingGame.stats.length > 0) {
      return res.json(existingGame)
    }

    exec(`python "${scriptPath}" ${id}`, async (err, stdout, stderr) => {
      if (err) {
        console.error("PYTHON ERROR:", stderr)
        return res.status(500).json({ error: "Python fetch failed" })
      }

      console.log("RAW PYTHON STDOUT:\n", stdout)

      let data
      try {
        data = JSON.parse(stdout.trim())
      } catch (parseError) {
        console.error("PARSE ERROR:", parseError)
        return res.status(500).json({
          error: "Invalid Python response",
          raw: stdout
        })
      }

      if (data.error) {
        return res.status(400).json({ error: data.error })
      }

      const {
        gameId,
        homeTeam,
        awayTeam,
        stats = []
      } = data

      const homeTeamId = homeTeam?.id
      const awayTeamId = awayTeam?.id
      const homeTeamName = homeTeam?.name
      const awayTeamName = awayTeam?.name

      if (!homeTeamId || !awayTeamId) {
        console.error(" INVALID TEAM DATA:", data)
        return res.status(500).json({
          error: "Missing team data from Python",
          data
        })
      }

      const game = await prisma.game.upsert({
        where: { id: gameId },
        update: {
          season: "20" + gameId.slice(3, 5),
          status: stats.length > 0 ? "final" : "no_data"
        },
        create: {
          id: gameId,
          date: new Date(),

          season: "20" + gameId.slice(3, 5),
          status: stats.length > 0 ? "final" : "no_data",

          homeTeam: {
            connectOrCreate: {
              where: { id: homeTeamId },
              create: {
                id: homeTeamId,
                name: homeTeamName || "Unknown Team"
              }
            }
          },

          awayTeam: {
            connectOrCreate: {
              where: { id: awayTeamId },
              create: {
                id: awayTeamId,
                name: awayTeamName || "Unknown Team"
              }
            }
          },

          stats: {
            create: stats.map((s) => ({
              player: {
                connectOrCreate: {
                  where: { id: s.playerId },
                  create: {
                    id: s.playerId,
                    name: s.name || "Unknown Player",
                    position: s.position || null,
                    headshotUrl: `https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/260x190/${s.playerId}.png`
                  }
                }
              },
              teamId: s.teamId,
              points: s.points ?? 0,
              rebounds: s.rebounds ?? 0,
              assists: s.assists ?? 0,
              steals: s.steals ?? 0,
              blocks: s.blocks ?? 0,
              minutes: s.minutes || null
            }))
          }
        },
        include: { stats: true }
      })

      return res.json(game)
    })

  } catch (error) {
    console.error("SERVER ERROR:", error)
    return res.status(500).json({ error: "Server error" })
  }
}

export const searchGames = (req, res) => {
  const { q } = req.query
  const scriptPath = path.resolve("python/searchGames.py")

  if (!q) {
    return res.status(400).json({ error: "Query is required" })
  }

  exec(`python "${scriptPath}" "${q}"`, (err, stdout) => {
    if (err) {
      console.error(err)
      return res.status(500).json({ error: "Search failed" })
    }

    try {
      const data = JSON.parse(stdout)
      res.json(data)
    } catch (parseError) {
      console.error(parseError)
      res.status(500).json({ error: "Invalid response from Python" })
    }
  })
}

