import { prisma } from "../../lib/prisma.js"
import { exec } from "child_process"
import { promisify } from "util"
import path from "path"

const execAsync = promisify(exec)

const TIER_LIMITS = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 }

const PYRAMID_INCLUDE = {
  players: {
    include: { player: { select: { id: true, name: true, headshotUrl: true } } },
    orderBy: [{ tier: "asc" }],
  },
  user: { select: { id: true, username: true } },
}

// GET /api/pyramid/me — all of the signed-in user's pyramids
export const getMyPyramids = async (req, res) => {
  try {
    const pyramids = await prisma.goatPyramid.findMany({
      where: { userId: req.user.userId },
      include: PYRAMID_INCLUDE,
      orderBy: { createdAt: "asc" },
    })
    return res.json(pyramids)
  } catch (err) {
    console.error("getMyPyramids error:", err)
    return res.status(500).json({ error: "Failed to fetch pyramids" })
  }
}

// GET /api/pyramid/user/:userId — someone else's pyramids (public)
export const getPyramidsByUser = async (req, res) => {
  try {
    const pyramids = await prisma.goatPyramid.findMany({
      where: { userId: req.params.userId },
      include: PYRAMID_INCLUDE,
      orderBy: { createdAt: "asc" },
    })
    return res.json(pyramids)
  } catch (err) {
    console.error("getPyramidsByUser error:", err)
    return res.status(500).json({ error: "Failed to fetch pyramids" })
  }
}

// GET /api/pyramid/:id — a single pyramid (public)
export const getPyramidById = async (req, res) => {
  try {
    const pyramid = await prisma.goatPyramid.findUnique({
      where: { id: req.params.id },
      include: PYRAMID_INCLUDE,
    })
    if (!pyramid) return res.status(404).json({ error: "Pyramid not found" })
    return res.json(pyramid)
  } catch (err) {
    console.error("getPyramidById error:", err)
    return res.status(500).json({ error: "Failed to fetch pyramid" })
  }
}

// POST /api/pyramid — create a new empty pyramid
export const createPyramid = async (req, res) => {
  const title = (req.body.title ?? "").trim() || "My GOAT Pyramid"

  try {
    const count = await prisma.goatPyramid.count({ where: { userId: req.user.userId } })
    if (count >= 20) {
      return res.status(400).json({ error: "Pyramid limit reached (20)" })
    }

    const pyramid = await prisma.goatPyramid.create({
      data: { userId: req.user.userId, title },
      include: PYRAMID_INCLUDE,
    })
    return res.status(201).json(pyramid)
  } catch (err) {
    console.error("createPyramid error:", err)
    return res.status(500).json({ error: "Failed to create pyramid" })
  }
}

// PUT /api/pyramid/:id — replace title + players
export const savePyramid = async (req, res) => {
  const { id } = req.params
  const { title, players = [] } = req.body

  if (!Array.isArray(players)) {
    return res.status(400).json({ error: "players must be an array" })
  }

  // validate tiers + duplicates
  const counts = {}
  const seen = new Set()
  for (const p of players) {
    const tier = Number(p.tier)
    if (!TIER_LIMITS[tier]) {
      return res.status(400).json({ error: `Invalid tier: ${p.tier}` })
    }
    counts[tier] = (counts[tier] ?? 0) + 1
    if (counts[tier] > TIER_LIMITS[tier]) {
      return res.status(400).json({ error: `Tier ${tier} allows only ${TIER_LIMITS[tier]} players` })
    }
    if (seen.has(p.playerId)) {
      return res.status(400).json({ error: "A player can only appear once" })
    }
    seen.add(p.playerId)
  }

  try {
    const existing = await prisma.goatPyramid.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: "Pyramid not found" })
    if (existing.userId !== req.user.userId) {
      return res.status(403).json({ error: "Not your pyramid" })
    }

    // make sure every player exists in the DB
    const ids = [...seen]
    if (ids.length) {
      const known = await prisma.player.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      })
      const missing = ids.filter(pid => !known.some(k => k.id === pid))
      if (missing.length) {
        const scriptPath = path.resolve("python", "getPlayersByIds.py")
        const { stdout } = await execAsync(`python "${scriptPath}" ${missing.join(" ")}`, { timeout: 60000 })
        const fetched = JSON.parse(stdout.trim())
        if (Array.isArray(fetched)) {
          await Promise.all(fetched.map(f =>
            prisma.player.upsert({
              where: { id: f.id },
              update: { name: f.name },
              create: {
                id: f.id,
                name: f.name,
                headshotUrl: `https://cdn.nba.com/headshots/nba/latest/1040x760/${f.id}.png`,
              },
            })
          ))
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.goatPyramidPlayer.deleteMany({ where: { pyramidId: id } })

      if (players.length) {
        await tx.goatPyramidPlayer.createMany({
          data: players.map(p => ({
            pyramidId: id,
            playerId: p.playerId,
            tier: Number(p.tier),
            headshotTeamId: p.headshotTeamId ?? null,
            headshotSeason: p.headshotSeason ?? null,
          })),
        })
      }

      return tx.goatPyramid.update({
        where: { id },
        data: { title: (title ?? "").trim() || existing.title },
        include: PYRAMID_INCLUDE,
      })
    })

    return res.json(updated)
  } catch (err) {
    console.error("savePyramid error:", err)
    return res.status(500).json({ error: "Failed to save pyramid" })
  }
}

// DELETE /api/pyramid/:id
export const deletePyramid = async (req, res) => {
  try {
    const existing = await prisma.goatPyramid.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: "Pyramid not found" })
    if (existing.userId !== req.user.userId) {
      return res.status(403).json({ error: "Not your pyramid" })
    }

    await prisma.goatPyramidPlayer.deleteMany({ where: { pyramidId: req.params.id } })
    await prisma.goatPyramid.delete({ where: { id: req.params.id } })
    return res.json({ ok: true })
  } catch (err) {
    console.error("deletePyramid error:", err)
    return res.status(500).json({ error: "Failed to delete pyramid" })
  }
}