import { prisma } from "../../lib/prisma.js"
import { findAndSaveHighlight } from "../../lib/youtube.js"
import {
  NbaUnavailableError,
  runNbaScript,
  resilient,
  readJsonCache,
  writeJsonCache,
} from "../../lib/nba.js"

const MIN = 60 * 1000
const GAME_SEARCH_CACHE_TTL = 5 * MIN

const isGameId = (id) => /^\d{10}$/.test(id)

const HEADSHOT_URL = (playerId) =>
  `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`

const seasonOf = (gameId) => "20" + gameId.slice(3, 5)

const NBA_UNAVAILABLE = {
  error: "NBA data is temporarily unavailable. Try again in a few minutes.",
  retryable: true,
}

// Shared include so early-return and fresh-fetch responses have the same shape
const GAME_INCLUDE = {
  homeTeam: true,
  awayTeam: true,
  stats: {
    include: { player: { select: { id: true, name: true, headshotUrl: true } } },
    orderBy: { points: "desc" },
  },
  reviews: {
    include: { user: { select: { id: true, username: true } } },
    orderBy: { createdAt: "desc" },
  },
  _count: { select: { reviews: true } },
}

const CARD_INCLUDE = {
  homeTeam: { select: { id: true, name: true, abbreviation: true } },
  awayTeam: { select: { id: true, name: true, abbreviation: true } },
  _count: { select: { reviews: true } },
  stats: {
    select: {
      teamId: true,
      playerId: true,
      points: true,
      rebounds: true,
      assists: true,
      player: { select: { headshotUrl: true } },
    },
  },
}

// Build lightweight card data: per-team leaders + totals
const buildCardData = (game) => {
  const forTeam = (teamId) => {
    const teamStats = game.stats.filter((s) => s.teamId === teamId)
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

const withRatingDistribution = async (game) => {
  const distribution = await prisma.gameReview.groupBy({
    by: ["rating"],
    where: { gameId: game.id },
    _count: { rating: true },
  })

  game.ratingDistribution = distribution.map((d) => ({
    rating: d.rating,
    count: d._count.rating,
  }))

  const total = distribution.reduce((s, d) => s + d._count.rating, 0)
  game.averageRating = total
    ? distribution.reduce((s, d) => s + d.rating * d._count.rating, 0) / total
    : 0

  return game
}

/* ---------- saving NBA data (one place instead of three copies) ---------- */

const connectTeam = (team) => ({
  connectOrCreate: {
    where: { id: team.id },
    create: { id: team.id, name: team.name || "Unknown Team" },
  },
})

const statCreate = (s) => ({
  player: {
    connectOrCreate: {
      where: { id: s.playerId },
      create: {
        id: s.playerId,
        name: s.name || "Unknown Player",
        position: s.position || null,
        headshotUrl: HEADSHOT_URL(s.playerId),
      },
    },
  },
  teamId: s.teamId,
  points: s.points ?? 0,
  rebounds: s.rebounds ?? 0,
  assists: s.assists ?? 0,
  steals: s.steals ?? 0,
  blocks: s.blocks ?? 0,
  minutes: s.minutes || null,
})

/**
 * Save fetchSingleGame.py output. If the game already exists, its box score is
 * replaced with the new one (only when the NBA actually returned stats), so a
 * game first saved without data gets filled in instead of being re-fetched forever.
 */
const saveNbaGame = (data, { update = {}, create = {}, include } = {}) => {
  const { gameId, homeTeam, awayTeam, stats = [] } = data
  const date = data.date ? new Date(data.date) : null
  const status = stats.length > 0 ? "final" : "no_data"

  return prisma.game.upsert({
    where: { id: gameId },
    update: {
      date: date ?? undefined,
      season: seasonOf(gameId),
      status,
      ...(stats.length ? { stats: { deleteMany: {}, create: stats.map(statCreate) } } : {}),
      ...update,
    },
    create: {
      id: gameId,
      date,
      season: seasonOf(gameId),
      status,
      homeTeam: connectTeam(homeTeam),
      awayTeam: connectTeam(awayTeam),
      stats: { create: stats.map(statCreate) },
      ...create,
    },
    include,
  })
}

/** Fetch one game from the NBA and save it. */
export const fetchAndSaveGame = async (gameId, options) => {
  const data = await runNbaScript("fetchSingleGame.py", [gameId], { timeout: 120000 })
  if (!data?.homeTeam?.id || !data?.awayTeam?.id) {
    throw new NbaUnavailableError(data?.reason || "The NBA has no data for this game yet")
  }
  return saveNbaGame(data, options)
}

/* ---------- endpoints ---------- */

// GET /api/games/:id
export const getGameById = async (req, res) => {
  const { id } = req.params
  if (!isGameId(id)) return res.status(400).json({ error: "Invalid game id" })

  let existing = null
  try {
    existing = await prisma.game.findUnique({ where: { id }, include: GAME_INCLUDE })

    // Complete in our database: no NBA request needed.
    if (existing && existing.stats.length > 0 && existing.date) {
      if (!existing.youtubeId) existing.youtubeId = await findAndSaveHighlight(existing)
      return res.json(await withRatingDistribution(existing))
    }

    // Not saved yet (or saved without a box score): fetch it once. Simultaneous
    // visitors share one fetch, and a failure isn't retried for 2 minutes.
    const game = await resilient(`game:${id}`, { ttl: 2 * MIN, failTtl: 2 * MIN }, () =>
      fetchAndSaveGame(id, { include: GAME_INCLUDE })
    )

    if (!game.youtubeId) game.youtubeId = await findAndSaveHighlight(game)
    return res.json(await withRatingDistribution(game))
  } catch (err) {
    if (err instanceof NbaUnavailableError) {
      // Show what we have (e.g. reviews) rather than an error page.
      if (existing) return res.json(await withRatingDistribution(existing))
      return res.status(503).json(NBA_UNAVAILABLE)
    }
    console.error("getGameById error:", err)
    return res.status(500).json({ error: "Server error" })
  }
}

// GET /api/games/search?q=
export const searchGames = async (req, res) => {
  const q = String(req.query.q ?? "").trim()
  if (!q) return res.status(400).json({ error: "Query is required" })

  try {
    const games = await resilient(`games:search:${q.toLowerCase()}`, { ttl: GAME_SEARCH_CACHE_TTL }, () =>
      runNbaScript("searchGames.py", [q])
    )
    return res.json(games)
  } catch (err) {
    if (err instanceof NbaUnavailableError) return res.status(503).json(NBA_UNAVAILABLE)
    console.error("GAME SEARCH ERROR:", err)
    return res.status(500).json({ error: "Search failed" })
  }
}

// GET /api/games/smart-search?q=
export const smartSearch = async (req, res) => {
  const q = String(req.query.q ?? "").trim()
  if (!q) return res.status(400).json({ error: "Query required" })

  try {
    const results = await resilient(`games:smart:${q.toLowerCase()}`, { ttl: GAME_SEARCH_CACHE_TTL }, () =>
      runNbaScript("smartSearch.py", [q])
    )
    return res.json(results)
  } catch (err) {
    if (err instanceof NbaUnavailableError) return res.status(503).json(NBA_UNAVAILABLE)
    console.error("SMART SEARCH ERROR:", err)
    return res.status(500).json({ error: "Search failed" })
  }
}

// POST /api/games/seed-suggested (admin)
export const seedSuggestedGames = async (req, res) => {
  try {
    const suggestions = await runNbaScript("seedSuggestedGames.py", [], { timeout: 300000 })
    const results = []

    for (const s of suggestions) {
      try {
        await fetchAndSaveGame(s.gameId, {
          update: {
            isSuggested: true,
            title: s.title,
            description: s.description,
            youtubeId: s.youtubeId ?? undefined,
          },
          create: {
            status: "final",
            isSuggested: true,
            title: s.title,
            description: s.description,
            youtubeId: s.youtubeId ?? null,
          },
        })
        results.push({ gameId: s.gameId, status: "ok", title: s.title })
      } catch (e) {
        results.push({ gameId: s.gameId, status: "failed", reason: e.message })
        if (e instanceof NbaUnavailableError && e.blocked) break // stop; the rest would fail too
      }
    }

    return res.json({ seeded: results })
  } catch (err) {
    if (err instanceof NbaUnavailableError) return res.status(503).json(NBA_UNAVAILABLE)
    console.error("seedSuggestedGames error:", err)
    return res.status(500).json({ error: "Seed failed" })
  }
}

// GET /api/games/suggested — for the homepage
export const getSuggestedGames = async (req, res) => {
  try {
    const games = await prisma.game.findMany({ where: { isSuggested: true }, include: CARD_INCLUDE })
    return res.json(games.map(buildCardData))
  } catch (err) {
    console.error("getSuggestedGames error:", err)
    return res.status(500).json({ error: "Failed to fetch suggested games" })
  }
}

export const getPopularGames = async (req, res) => {
  try {
    const games = await prisma.game.findMany({
      include: CARD_INCLUDE,
      orderBy: { reviews: { _count: "desc" } },
      take: 10,
    })
    return res.json(games.map(buildCardData))
  } catch (err) {
    console.error("getPopularGames error:", err)
    return res.status(500).json({ error: "Failed to fetch popular games" })
  }
}

// GET /api/games/:id/shots
export const getGameShots = async (req, res) => {
  const { id } = req.params
  if (!isGameId(id)) return res.status(400).json({ error: "Invalid game id" })

  try {
    // A finished game's shots never change, so they're kept on disk permanently.
    const saved = await readJsonCache(`shots-${id}`)
    if (saved) return res.json(saved)

    const shots = await resilient(`games:shots:${id}`, { ttl: 24 * 60 * MIN, failTtl: 5 * MIN }, () =>
      runNbaScript("shotChart.py", [id], { timeout: 90000 })
    )

    // Only keep it permanently once the game is safely over.
    const game = await prisma.game.findUnique({ where: { id }, select: { date: true } })
    const finished = game?.date && Date.now() - new Date(game.date).getTime() > 12 * 60 * MIN
    if (finished && Array.isArray(shots) && shots.length) {
      writeJsonCache(`shots-${id}`, shots).catch((e) => console.error("shots cache write:", e.message))
    }

    return res.json(shots)
  } catch (err) {
    if (err instanceof NbaUnavailableError) return res.status(503).json(NBA_UNAVAILABLE)
    console.error("SHOT CHART ERROR:", err)
    return res.status(500).json({ error: "Failed to fetch shot chart" })
  }
}

/* ---------- recent games ---------- */

const RECENT_LIMIT = 10

async function buildRecentGames() {
  const raw = await runNbaScript("recentGames.py", [RECENT_LIMIT], { timeout: 180000 })
  const ids = raw.map((r) => r.gameId)

  const existing = await prisma.game.findMany({
    where: { id: { in: ids } },
    select: { id: true, date: true, _count: { select: { stats: true } } },
  })
  const complete = new Set(existing.filter((g) => g.date && g._count.stats > 0).map((g) => g.id))

  // Fetch missing games one by one; nba_guard spaces the requests out.
  for (const r of raw) {
    if (complete.has(r.gameId)) continue
    try {
      await fetchAndSaveGame(r.gameId)
    } catch (e) {
      console.error(`recent: failed to load ${r.gameId}:`, e.message)
      if (e instanceof NbaUnavailableError && e.blocked) break // the rest would fail too
    }
  }

  const dbGames = await prisma.game.findMany({ where: { id: { in: ids } }, include: CARD_INCLUDE })
  const byId = new Map(dbGames.map((g) => [g.id, buildCardData(g)]))

  // Preserve the NBA's order; games that couldn't be loaded show as stubs.
  return raw.map(
    (r) =>
      byId.get(r.gameId) ?? {
        id: r.gameId,
        date: r.date ? new Date(r.date).toISOString() : null,
        title: r.matchup,
        matchup: r.matchup,
        stub: true,
      }
  )
}

/** Fallback when the NBA can't be reached: the newest games we already have. */
async function recentFromDb() {
  const games = await prisma.game.findMany({
    where: { status: "final", date: { not: null } },
    orderBy: { date: "desc" },
    take: RECENT_LIMIT,
    include: CARD_INCLUDE,
  })
  return games.map(buildCardData)
}

// GET /api/games/recent
export const getRecentGames = async (req, res) => {
  try {
    const games = await resilient("games:recent", { ttl: 30 * MIN, failTtl: 5 * MIN }, buildRecentGames)
    return res.json(games)
  } catch (err) {
    if (!(err instanceof NbaUnavailableError)) console.error("getRecentGames error:", err)
    try {
      return res.json(await recentFromDb())
    } catch (dbErr) {
      console.error("getRecentGames fallback error:", dbErr)
      return res.status(500).json({ error: "Failed to fetch recent games" })
    }
  }
}

// GET /api/games/random?count=10 — random sample from the DB
export const getRandomGames = async (req, res) => {
  const count = Math.min(20, Number(req.query.count) || 10)

  try {
    // Let Postgres pick the sample instead of loading every game id.
    const rows = await prisma.$queryRaw`
      SELECT id FROM "Game" WHERE status = 'final' ORDER BY random() LIMIT ${count}`

    const games = await prisma.game.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      include: CARD_INCLUDE,
    })
    return res.json(games.map(buildCardData))
  } catch (err) {
    console.error("getRandomGames error:", err)
    return res.status(500).json({ error: "Failed to fetch random games" })
  }
}