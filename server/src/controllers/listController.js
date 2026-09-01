import { prisma } from "../../lib/prisma.js"

const TEAM_SELECT = { select: { id: true, name: true, abbreviation: true } }

const LIST_INCLUDE = {
  user: { select: { id: true, username: true } },
  items: {
    orderBy: { position: "asc" },
    include: {
      game: {
        include: { homeTeam: TEAM_SELECT, awayTeam: TEAM_SELECT },
      },
    },
  },
  _count: { select: { items: true } },
}

// ── GET /api/lists/me — the signed-in user's lists ────────────────────────
export const getMyLists = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  try {
    const lists = await prisma.gameList.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: LIST_INCLUDE,
    })
    return res.json(lists)
  } catch (err) {
    console.error("getMyLists error:", err)
    return res.status(500).json({ error: "Failed to fetch lists" })
  }
}

// ── GET /api/lists/user/:username — someone's public lists ────────────────
export const getListsByUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: { id: true },
    })
    if (!user) return res.status(404).json({ error: "User not found" })

    const lists = await prisma.gameList.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: LIST_INCLUDE,
    })
    return res.json(lists)
  } catch (err) {
    console.error("getListsByUser error:", err)
    return res.status(500).json({ error: "Failed to fetch lists" })
  }
}

// ── GET /api/lists/explore — browse everyone's lists ──────────────────────
export const getExploreLists = async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(48, Number(req.query.limit) || 24)

  try {
    const lists = await prisma.gameList.findMany({
      where: { items: { some: {} } }, // hide empty lists from browse
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: LIST_INCLUDE,
    })
    return res.json({ page, limit, lists })
  } catch (err) {
    console.error("getExploreLists error:", err)
    return res.status(500).json({ error: "Failed to fetch lists" })
  }
}

// ── GET /api/lists/:id — a single list (public) ───────────────────────────
export const getListById = async (req, res) => {
  try {
    const list = await prisma.gameList.findUnique({
      where: { id: req.params.id },
      include: LIST_INCLUDE,
    })
    if (!list) return res.status(404).json({ error: "List not found" })
    return res.json(list)
  } catch (err) {
    console.error("getListById error:", err)
    return res.status(500).json({ error: "Failed to fetch list" })
  }
}

// ── POST /api/lists — create an empty list ────────────────────────────────
export const createList = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  const title = (req.body.title ?? "").trim() || "Untitled list"
  const ranked = !!req.body.ranked

  try {
    const count = await prisma.gameList.count({ where: { userId } })
    if (count >= 50) {
      return res.status(400).json({ error: "List limit reached (50)" })
    }

    const list = await prisma.gameList.create({
      data: { userId, title, ranked, description: req.body.description ?? null },
      include: LIST_INCLUDE,
    })
    return res.status(201).json(list)
  } catch (err) {
    console.error("createList error:", err)
    return res.status(500).json({ error: "Failed to create list" })
  }
}

// ── PUT /api/lists/:id — replace title/description/ranked + items ──────────
// Full replace, same shape as savePyramid: validate the incoming games, then
// wipe and recreate items in a transaction so ordering is always consistent.
export const saveList = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  const { id } = req.params
  const { title, description, ranked, gameIds = [] } = req.body

  if (!Array.isArray(gameIds)) {
    return res.status(400).json({ error: "gameIds must be an array" })
  }
  if (gameIds.length > 250) {
    return res.status(400).json({ error: "Lists are capped at 250 games" })
  }
  if (new Set(gameIds).size !== gameIds.length) {
    return res.status(400).json({ error: "A game can only appear once in a list" })
  }

  try {
    const existing = await prisma.gameList.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: "List not found" })
    if (existing.userId !== userId) {
      return res.status(403).json({ error: "Not your list" })
    }

    // Every game must exist in the DB.
    if (gameIds.length) {
      const found = await prisma.game.count({ where: { id: { in: gameIds } } })
      if (found !== gameIds.length) {
        return res.status(400).json({ error: "One or more games don't exist" })
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.gameListItem.deleteMany({ where: { listId: id } })

      if (gameIds.length) {
        await tx.gameListItem.createMany({
          data: gameIds.map((gameId, i) => ({ listId: id, gameId, position: i + 1 })),
        })
      }

      return tx.gameList.update({
        where: { id },
        data: {
          title: (title ?? "").trim() || existing.title,
          description: description ?? existing.description,
          ranked: ranked ?? existing.ranked,
        },
        include: LIST_INCLUDE,
      })
    })

    return res.json(updated)
  } catch (err) {
    console.error("saveList error:", err)
    return res.status(500).json({ error: "Failed to save list" })
  }
}

// ── DELETE /api/lists/:id ─────────────────────────────────────────────────
export const deleteList = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  try {
    const existing = await prisma.gameList.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: "List not found" })
    if (existing.userId !== userId) {
      return res.status(403).json({ error: "Not your list" })
    }

    // items cascade via onDelete: Cascade on the relation
    await prisma.gameList.delete({ where: { id: req.params.id } })
    return res.json({ ok: true })
  } catch (err) {
    console.error("deleteList error:", err)
    return res.status(500).json({ error: "Failed to delete list" })
  }
}