import { prisma } from "../../lib/prisma.js"

const TEAM_SELECT = { select: { id: true, name: true, abbreviation: true } }

const GAME_INCLUDE = {
  include: {
    homeTeam: TEAM_SELECT,
    awayTeam: TEAM_SELECT,
  },
}

// ── GET /api/watchlist — the signed-in user's watchlist ───────────────────
export const getMyWatchlist = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  try {
    const items = await prisma.watchlistItem.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }, // newest saved first
      include: { game: GAME_INCLUDE },
    })
    return res.json({ items })
  } catch (err) {
    console.error("getMyWatchlist error:", err)
    return res.status(500).json({ error: "Failed to fetch watchlist" })
  }
}

// ── GET /api/watchlist/:gameId/status — is this game on my watchlist? ──────
// Lets GameDetail show the correct button state on load.
export const getWatchlistStatus = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  try {
    const item = await prisma.watchlistItem.findUnique({
      where: { userId_gameId: { userId, gameId: req.params.gameId } },
      select: { id: true },
    })
    return res.json({ watchlisted: !!item })
  } catch (err) {
    console.error("getWatchlistStatus error:", err)
    return res.status(500).json({ error: "Failed to fetch status" })
  }
}

// ── POST /api/watchlist/:gameId — add ─────────────────────────────────────
export const addToWatchlist = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  const { gameId } = req.params

  try {
    const game = await prisma.game.findUnique({ where: { id: gameId }, select: { id: true } })
    if (!game) return res.status(404).json({ error: "Game not found" })

    // Idempotent: upsert so a double-tap doesn't 500 on the unique constraint.
    await prisma.watchlistItem.upsert({
      where: { userId_gameId: { userId, gameId } },
      update: {},
      create: { userId, gameId },
    })

    return res.status(201).json({ watchlisted: true })
  } catch (err) {
    console.error("addToWatchlist error:", err)
    return res.status(500).json({ error: "Failed to add to watchlist" })
  }
}

// ── DELETE /api/watchlist/:gameId — remove ────────────────────────────────
export const removeFromWatchlist = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  const { gameId } = req.params

  try {
    // deleteMany, not delete — no throw when the row isn't there, so remove
    // stays idempotent just like add.
    await prisma.watchlistItem.deleteMany({ where: { userId, gameId } })
    return res.json({ watchlisted: false })
  } catch (err) {
    console.error("removeFromWatchlist error:", err)
    return res.status(500).json({ error: "Failed to remove from watchlist" })
  }
}