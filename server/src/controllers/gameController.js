import { prisma } from "../../lib/prisma.js"
import { exec } from "child_process"
import { cached } from "../../lib/cache.js"
import { promisify } from "util"
import { findAndSaveHighlight } from "../../lib/youtube.js"
import path from "path"

const execAsync = promisify(exec)
const GAME_SEARCH_CACHE_TTL = 5 * 60 * 1000  // 5 minutes

const HEADSHOT_URL = (playerId) =>
  `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`

// Shared include so early-return and fresh-fetch responses have the same shape
const GAME_INCLUDE = {
  homeTeam: true,
  awayTeam: true,
  stats: {
    include: { player: { select: { id: true, name: true, headshotUrl: true } } },
    orderBy: { points: "desc" }
  },
  reviews: {
    include: { user: { select: { id: true, username: true } } },
    orderBy: { createdAt: "desc" },
  },
  _count: { select: { reviews: true } }
}

// Build lightweight card data: per-team leaders + totals
const buildCardData = (game) => {
  const forTeam = (teamId) => {
    const teamStats = game.stats.filter(s => s.teamId === teamId)
    const leader = (key) => {
      const top = [...teamStats].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))[0]
      return top
        ? { playerId: top.playerId, value: top[key] ?? 0, headshotUrl: top.player?.headshotUrl }
        : null
    }
    return {
      total: teamStats.reduce((sum, s) => sum + (s.points ?? 0), 0),
      points: leader("points"),
      rebounds: leader("rebounds"),
      assists: leader("assists"),
    }
  }

  const { stats, ...rest } = game
  return {
    ...rest,
    home: forTeam(game.homeTeamId),
    away: forTeam(game.awayTeamId),
  }
}

export const getGameById = async (req, res) => {
  const { id } = req.params
  const scriptPath = path.resolve("python", "fetchSingleGame.py")

  try {

    const existingGame = await prisma.game.findUnique({
      where: { id },
      include: GAME_INCLUDE
    })

    // Only early-return when the game is complete AND has a real date
    if (existingGame && existingGame.stats.length > 0 && existingGame.date) {
      if (!existingGame.youtubeId) {
        existingGame.youtubeId = await findAndSaveHighlight(existingGame)
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
                    headshotUrl: HEADSHOT_URL(s.playerId)
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
        include: GAME_INCLUDE
      })

      if (!game.youtubeId) {
        game.youtubeId = await findAndSaveHighlight(game)
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


export const smartSearch = async (req, res) => {
  const { q } = req.query
  if (!q?.trim()) return res.status(400).json({ error: "Query required" })

  const key = `games:smart:${q.toLowerCase().trim()}`
  const scriptPath = path.resolve("python", "smartSearch.py")

  try {
    const results = await cached(key, GAME_SEARCH_CACHE_TTL, async () => {
      const { stdout } = await execAsync(`python "${scriptPath}" "${q.replace(/"/g, "")}"`)
      const parsed = JSON.parse(stdout.trim())
      if (parsed.error) throw new Error(parsed.error)
      return parsed
    })
    return res.json(results)
  } catch (err) {
    console.error("SMART SEARCH ERROR:", err)
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

    for (const s of suggestions) {
      try {
        const fetchPath = path.resolve("python", "fetchSingleGame.py")
        const { execSync } = await import("child_process")
        const gameStdout = execSync(`python "${fetchPath}" ${s.gameId}`, { timeout: 60000 }).toString()
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
            youtubeId: s.youtubeId ?? null,
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
                      headshotUrl: HEADSHOT_URL(st.playerId)
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
        _count: { select: { reviews: true } },
        stats: {
          select: {
            teamId: true, playerId: true,
            points: true, rebounds: true, assists: true,
            player: { select: { headshotUrl: true } }
          }
        }
      }
    })
    return res.json(games.map(buildCardData))
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
        _count: { select: { reviews: true } },
        stats: {
          select: {
            teamId: true, playerId: true,
            points: true, rebounds: true, assists: true,
            player: { select: { headshotUrl: true } }
          }
        }
      },
      orderBy: { reviews: { _count: "desc" } },
      take: 10
    })
    return res.json(games.map(buildCardData))
  } catch (err) {
    console.error("getPopularGames error:", err)
    return res.status(500).json({ error: "Failed to fetch popular games" })
  }
}

export const getGameShots = async (req, res) => {
  const { id } = req.params
  const key = `games:shots:${id}`

  try {
    const shots = await cached(key, 24 * 60 * 60 * 1000, async () => {
      const scriptPath = path.resolve("python", "shotChart.py")
      const { stdout } = await execAsync(`python "${scriptPath}" ${id}`, { timeout: 90000 })
      const parsed = JSON.parse(stdout.trim())
      if (parsed.error) throw new Error(parsed.error)
      return parsed
    })
    return res.json(shots)
  } catch (err) {
    console.error("SHOT CHART ERROR:", err)
    return res.status(500).json({ error: "Failed to fetch shot chart" })
  }
}

// GET /api/games/recent — last 10 played NBA games
// GET /api/games/recent — last 10 played NBA games, fully hydrated
export const getRecentGames = async (req, res) => {
  const key = "games:recent"
  const listScript = path.resolve("python", "recentGames.py")
  const fetchScript = path.resolve("python", "fetchSingleGame.py")

  try {
    const games = await cached(key, 30 * 60 * 1000, async () => {
      const { stdout } = await execAsync(`python "${listScript}" 10`, { timeout: 120000 })
      const raw = JSON.parse(stdout.trim())
      if (raw.error) throw new Error(raw.error)

      const ids = raw.map(r => r.gameId)

      // What's already in the DB?
      const existing = await prisma.game.findMany({
        where: { id: { in: ids } },
        select: { id: true, date: true, _count: { select: { stats: true } } }
      })
      const complete = new Set(
        existing.filter(g => g.date && g._count.stats > 0).map(g => g.id)
      )

      // Fetch missing games sequentially (rate-limit friendly)
      for (const r of raw) {
        if (complete.has(r.gameId)) continue
        try {
          const { stdout: gameOut } = await execAsync(
            `python "${fetchScript}" ${r.gameId}`,
            { timeout: 120000 }
          )
          const data = JSON.parse(gameOut.trim())
          if (data.error || !data.homeTeam?.id) continue

          const gameDate = data.date ? new Date(data.date) : null

          await prisma.game.upsert({
            where: { id: r.gameId },
            update: {
              date: gameDate ?? undefined,
              season: "20" + r.gameId.slice(3, 5),
              status: (data.stats?.length ?? 0) > 0 ? "final" : "no_data",
            },
            create: {
              id: r.gameId,
              date: gameDate,
              season: "20" + r.gameId.slice(3, 5),
              status: (data.stats?.length ?? 0) > 0 ? "final" : "no_data",
              homeTeam: {
                connectOrCreate: {
                  where: { id: data.homeTeam.id },
                  create: { id: data.homeTeam.id, name: data.homeTeam.name || "Unknown Team" }
                }
              },
              awayTeam: {
                connectOrCreate: {
                  where: { id: data.awayTeam.id },
                  create: { id: data.awayTeam.id, name: data.awayTeam.name || "Unknown Team" }
                }
              },
              stats: {
                create: (data.stats ?? []).map(s => ({
                  player: {
                    connectOrCreate: {
                      where: { id: s.playerId },
                      create: {
                        id: s.playerId,
                        name: s.name || "Unknown Player",
                        headshotUrl: HEADSHOT_URL(s.playerId)
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
            }
          })
        } catch (e) {
          console.error(`recent: failed to hydrate ${r.gameId}:`, e.message)
          // continue — a failed game just renders as stub
        }
      }

      // Re-read everything with full card includes
      const dbGames = await prisma.game.findMany({
        where: { id: { in: ids } },
        include: {
          homeTeam: { select: { id: true, name: true, abbreviation: true } },
          awayTeam: { select: { id: true, name: true, abbreviation: true } },
          _count: { select: { reviews: true } },
          stats: {
            select: {
              teamId: true, playerId: true,
              points: true, rebounds: true, assists: true,
              player: { select: { headshotUrl: true } }
            }
          }
        }
      })
      const byId = new Map(dbGames.map(g => [g.id, buildCardData(g)]))

      // Preserve API order; stub only for games that failed to hydrate
      return raw.map(r => byId.get(r.gameId) ?? {
        id: r.gameId,
        date: r.date ? new Date(r.date).toISOString() : null,
        title: r.matchup,
        matchup: r.matchup,
        stub: true,
      })
    })

    return res.json(games)
  } catch (err) {
    console.error("getRecentGames error:", err)
    return res.status(500).json({ error: "Failed to fetch recent games" })
  }
}

// GET /api/games/random?count=10 — random sample from the DB
export const getRandomGames = async (req, res) => {
  const count = Math.min(20, Number(req.query.count) || 10)

  try {
    // Prisma has no native random; sample ids in JS
    const ids = await prisma.game.findMany({
      where: { status: "final" },
      select: { id: true }
    })
    const shuffled = ids.sort(() => Math.random() - 0.5).slice(0, count)

    const games = await prisma.game.findMany({
      where: { id: { in: shuffled.map(g => g.id) } },
      include: {
        homeTeam: { select: { id: true, name: true, abbreviation: true } },
        awayTeam: { select: { id: true, name: true, abbreviation: true } },
        _count: { select: { reviews: true } },
        stats: {
          select: {
            teamId: true, playerId: true,
            points: true, rebounds: true, assists: true,
            player: { select: { headshotUrl: true } }
          }
        }
      }
    })

    return res.json(games.map(buildCardData))
  } catch (err) {
    console.error("getRandomGames error:", err)
    return res.status(500).json({ error: "Failed to fetch random games" })
  }
}