import { prisma } from "../../lib/prisma.js"
import { execSync } from "child_process"
import path from "path"

const TIER_LIMITS = {
  1: 2,
  2: 3,
  3: 4,
  4: 5,
  5: 6,
}

const VALID_TIERS = Object.keys(TIER_LIMITS).map(Number)

// ── GET /api/pyramid/me — get the current user's pyramid ──────────────────
export const getMyPyramid = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  try {
    const pyramid = await prisma.goatPyramid.findUnique({
      where: { userId },
      include: {
        players: {
          include: { player: true },
          orderBy: { tier: "asc" }
        }
      }
    })

    return res.json(pyramid ?? null)
  } catch (err) {
    console.error("getMyPyramid error:", err)
    return res.status(500).json({ error: "Failed to fetch pyramid" })
  }
}

// ── GET /api/pyramid/:userId — get any user's pyramid ─────────────────────
export const getPyramidByUser = async (req, res) => {
  const { userId } = req.params

  try {
    const pyramid = await prisma.goatPyramid.findUnique({
      where: { userId },
      include: {
        players: {
          include: { player: true },
          orderBy: { tier: "asc" }
        },
        user: { select: { id: true, username: true } }
      }
    })

    if (!pyramid) return res.status(404).json({ error: "Pyramid not found" })

    return res.json(pyramid)
  } catch (err) {
    console.error("getPyramidByUser error:", err)
    return res.status(500).json({ error: "Failed to fetch pyramid" })
  }
}

// ── PUT /api/pyramid — save the full pyramid in one request ───────────────
// Body: { players: [{ playerId, tier }, ...] }
export const savePyramid = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  const { players } = req.body

  if (!Array.isArray(players)) {
    return res.status(400).json({ error: "players must be an array" })
  }

  // ── Validate all entries up front ────────────────────────────────────────

  for (const entry of players) {
    const tierNum = Number(entry.tier)
    if (!VALID_TIERS.includes(tierNum)) {
      return res.status(400).json({
        error: `Invalid tier ${entry.tier} — must be between 1 and 5`
      })
    }
    if (!entry.playerId) {
      return res.status(400).json({ error: "Each entry must have a playerId" })
    }
  }

  // Check for duplicate players
  const playerIds = players.map(p => p.playerId)
  if (new Set(playerIds).size !== playerIds.length) {
    return res.status(400).json({ error: "Duplicate players are not allowed" })
  }

  // Check tier limits
  for (const tier of VALID_TIERS) {
    const count = players.filter(p => Number(p.tier) === tier).length
    if (count > TIER_LIMITS[tier]) {
      return res.status(400).json({
        error: `Tier ${tier} has too many players (max ${TIER_LIMITS[tier]}, got ${count})`
      })
    }
  }

  // Check which players are already in DB
  const existingPlayers = await prisma.player.findMany({
    where: { id: { in: playerIds } },
    select: { id: true }
  })
  const foundIds = new Set(existingPlayers.map(p => p.id))

  // Auto-upsert any missing players via nba_api
  const missing = playerIds.filter(id => !foundIds.has(id))
  if (missing.length > 0) {
    const scriptPath = path.resolve("python", "getPlayersByIds.py")
    try {
      const stdout = execSync(`python "${scriptPath}" ${missing.join(" ")}`).toString()
      const fetchedPlayers = JSON.parse(stdout.trim())

      await prisma.player.createMany({
        data: fetchedPlayers.map(p => ({
          id: p.id,
          name: p.name,
          headshotUrl: p.headshotUrl,
          position: p.position ?? null,
        })),
        skipDuplicates: true
      })
    } catch (e) {
      console.error("Auto-fetch players failed:", e)
      return res.status(400).json({
        error: `Players not found and could not be auto-fetched: ${missing.join(", ")}`
      })
    }
  }

  try {
    // Upsert pyramid + replace all players in one transaction
    const pyramid = await prisma.$transaction(async (tx) => {
      // Get or create pyramid
      const existing = await tx.goatPyramid.upsert({
        where: { userId },
        update: {},
        create: { userId },
      })

      // Wipe existing players
      await tx.goatPyramidPlayer.deleteMany({
        where: { pyramidId: existing.id }
      })

      // Insert the new full set
      await tx.goatPyramidPlayer.createMany({
        data: players.map(p => ({
          pyramidId: existing.id,
          playerId: p.playerId,
          tier: Number(p.tier)
        }))
      })

      // Return full pyramid
      return tx.goatPyramid.findUnique({
        where: { id: existing.id },
        include: {
          players: {
            include: { player: true },
            orderBy: { tier: "asc" }
          }
        }
      })
    })

    return res.json(pyramid)
  } catch (err) {
    console.error("savePyramid error:", err)
    return res.status(500).json({ error: "Failed to save pyramid" })
  }
}

// ── DELETE /api/pyramid — delete the whole pyramid ────────────────────────
export const deletePyramid = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  try {
    const pyramid = await prisma.goatPyramid.findUnique({ where: { userId } })
    if (!pyramid) return res.status(404).json({ error: "Pyramid not found" })

    await prisma.$transaction([
      prisma.goatPyramidPlayer.deleteMany({ where: { pyramidId: pyramid.id } }),
      prisma.comment.deleteMany({ where: { pyramidId: pyramid.id } }),
      prisma.goatPyramid.delete({ where: { id: pyramid.id } })
    ])

    return res.json({ message: "Pyramid deleted" })
  } catch (err) {
    console.error("deletePyramid error:", err)
    return res.status(500).json({ error: "Failed to delete pyramid" })
  }
}