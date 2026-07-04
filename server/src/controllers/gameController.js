import { prisma } from "../../lib/prisma.js"
import { exec } from "child_process"
import { cached } from "../../lib/cache.js"
import { promisify } from "util"
import { findAndSaveHighlight } from "../../lib/youtube.js"
import path from "path"

const execAsync = promisify(exec)
const GAME_SEARCH_CACHE_TTL = 5 * 60 * 1000  // 5 minutes


export const getGameById = async (req, res) => {
  const { id } = req.params
  const scriptPath = path.resolve("python", "fetchSingleGame.py")

  try {

    const existingGame = await prisma.game.findUnique({
      where: { id },
      include: {
        homeTeam: true,
        awayTeam: true,
        stats: {
          include: { player: { select: { id: true, name: true, headshotUrl: true } } },
          orderBy: { points: "desc" }
        },
        _count: { select: { reviews: true } }
      }
    })


    if (existingGame && existingGame.stats.length > 0) {
      if (!existingGame.youtubeId) {
        const videoId = await findAndSaveHighlight(existingGame)
        existingGame.youtubeId = videoId
      }
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
        date,  
        stats = []
      } = data

      const homeTeamId = homeTeam?.id
      const awayTeamId = awayTeam?.id
      const homeTeamName = homeTeam?.name
      const awayTeamName = awayTeam?.name
      const gameDate = date ? new Date(date) : null

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
          date: gameDate ?? undefined,
          season: "20" + gameId.slice(3, 5),
          status: stats.length > 0 ? "final" : "no_data"
        },
        create: {
          id: gameId,
          date: gameDate,   
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
      
      if (!game.youtubeId) {
        game.youtubeId = await findAndSaveHighlight({
          ...game,
          homeTeam: { name: homeTeamName },
          awayTeam: { name: awayTeamName },
        })
      }

      return res.json(game)
    })

  } catch (error) {
    console.error("SERVER ERROR:", error)
    return res.status(500).json({ error: "Server error" })
  }
}

export const searchGames = async (req, res) => {
  const { q } = req.query
  const scriptPath = path.resolve("python/searchGames.py")

  if (!q) return res.status(400).json({ error: "Query is required" })

  const key = `games:search:${q.toLowerCase().trim()}`

  try {
    const games = await cached(key, GAME_SEARCH_CACHE_TTL, async () => {
      const { stdout } = await execAsync(`python "${scriptPath}" "${q}"`)
      return JSON.parse(stdout)
    })

    return res.json(games)
  } catch (err) {
    console.error("GAME SEARCH ERROR:", err)
    return res.status(500).json({ error: "Search failed" })
  }
}


export const seedSuggestedGames = async (req, res) => {
  const scriptPath = path.resolve("python", "seedSuggestedGames.py")

  exec(`python "${scriptPath}"`, async (err, stdout) => {
    if (err) return res.status(500).json({ error: "Seed script failed" })

    let suggestions
    try {
      suggestions = JSON.parse(stdout.trim())
    } catch {
      return res.status(500).json({ error: "Invalid seed data" })
    }

    const results = []

    // Fetch each game's full data via your existing single-game script
    for (const s of suggestions) {
      try {
        const fetchPath = path.resolve("python", "fetchSingleGame.py")
        const { execSync } = await import("child_process")
        const gameStdout = execSync(`python "${fetchPath}" ${s.gameId}`, { timeout: 30000 }).toString()
        const data = JSON.parse(gameStdout.trim())

        if (data.error || !data.homeTeam?.id) {
          results.push({ gameId: s.gameId, status: "failed", reason: "no data" })
          continue
        }

        await prisma.game.upsert({
          where: { id: s.gameId },
          update: {                                              
            date: data.date ? new Date(data.date) : undefined,
            isSuggested: true,
            title: s.title,
            description: s.description,
            youtubeId: s.youtubeId ?? undefined,
          },
          create: {
            id: s.gameId,
            date: data.date ? new Date(data.date) : null,     
            season: "20" + s.gameId.slice(3, 5),
            status: "final",
            isSuggested: true,
            title: s.title,
            description: s.description,
            homeTeam: {
              connectOrCreate: {
                where: { id: data.homeTeam.id },
                create: { id: data.homeTeam.id, name: data.homeTeam.name || "Unknown" }
              }
            },
            awayTeam: {
              connectOrCreate: {
                where: { id: data.awayTeam.id },
                create: { id: data.awayTeam.id, name: data.awayTeam.name || "Unknown" }
              }
            },
            stats: {
              create: (data.stats || []).map(st => ({
                player: {
                  connectOrCreate: {
                    where: { id: st.playerId },
                    create: {
                      id: st.playerId,
                      name: st.name || "Unknown Player",
                      headshotUrl: `https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/260x190/${st.playerId}.png`
                    }
                  }
                },
                teamId: st.teamId,
                points: st.points ?? 0,
                rebounds: st.rebounds ?? 0,
                assists: st.assists ?? 0,
                steals: st.steals ?? 0,
                blocks: st.blocks ?? 0,
                minutes: st.minutes || null
              }))
            }
          }
        })

        results.push({ gameId: s.gameId, status: "ok", title: s.title })
      } catch (e) {
        console.error(`Failed to seed ${s.gameId}:`, e.message)
        results.push({ gameId: s.gameId, status: "failed", reason: e.message })
      }
    }

    return res.json({ seeded: results })
  })
}

// GET /api/games/suggested — for the homepage
export const getSuggestedGames = async (req, res) => {
  try {
    const games = await prisma.game.findMany({
      where: { isSuggested: true },
      include: {
        homeTeam: { select: { id: true, name: true, abbreviation: true } },
        awayTeam: { select: { id: true, name: true, abbreviation: true } },
        _count: { select: { reviews: true } }
      }
    })
    return res.json(games)
  } catch (err) {
    console.error("getSuggestedGames error:", err)
    return res.status(500).json({ error: "Failed to fetch suggested games" })
  }
}


export const getPopularGames = async (req, res) => {
  try {
    const games = await prisma.game.findMany({
      include: {
        homeTeam: { select: { id: true, name: true, abbreviation: true } },
        awayTeam: { select: { id: true, name: true, abbreviation: true } },
        _count: { select: { reviews: true } }
      },
      orderBy: { reviews: { _count: "desc" } },
      take: 10
    })
    return res.json(games)
  } catch (err) {
    console.error("getPopularGames error:", err)
    return res.status(500).json({ error: "Failed to fetch popular games" })
  }
}