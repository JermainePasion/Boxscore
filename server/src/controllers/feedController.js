import { prisma } from "../../lib/prisma.js"

// ── GET /api/feed — activity feed from followed users ─────────────────────
export const getFeed = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(50, Number(req.query.limit) || 20)

  try {
    // Get the list of users the current user follows
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true }
    })
    const followingIds = following.map(f => f.followingId)

    if (followingIds.length === 0) {
      return res.json({ page, limit, activities: [] })
    }

    // Fetch each activity type in parallel (over-fetch so we can merge & sort)
    const overFetch = page * limit

    const [reviews, comments, pyramids] = await Promise.all([
      prisma.gameReview.findMany({
        where: { userId: { in: followingIds } },
        orderBy: { createdAt: "desc" },
        take: overFetch,
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
          game: {
            select: {
              id: true,
              date: true,
              homeTeam: { select: { id: true, name: true, abbreviation: true } },
              awayTeam: { select: { id: true, name: true, abbreviation: true } }
            }
          }
        }
      }),
      prisma.comment.findMany({
        where: { userId: { in: followingIds } },
        orderBy: { createdAt: "desc" },
        take: overFetch,
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
          game: {
            select: {
              id: true,
              homeTeam: { select: { id: true, name: true, abbreviation: true } },
              awayTeam: { select: { id: true, name: true, abbreviation: true } }
            }
          },
          review: {
            select: {
              id: true,
              rating: true,
              user: { select: { id: true, username: true } }
            }
          }
        }
      }),
      prisma.goatPyramid.findMany({
        where: { userId: { in: followingIds } },
        orderBy: { createdAt: "desc" },
        take: overFetch,
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
          _count: { select: { players: true } }
        }
      })
    ])

    // Normalize into a single stream
    const activities = [
      ...reviews.map(r => ({
        type: "review",
        id: r.id,
        createdAt: r.createdAt,
        user: r.user,
        data: {
          rating: r.rating,
          review: r.review,
          likeCount: r.likeCount,
          game: r.game
        }
      })),
      ...comments.map(c => ({
        type: "comment",
        id: c.id,
        createdAt: c.createdAt,
        user: c.user,
        data: {
          content: c.content,
          onGame: c.game ?? null,
          onReview: c.review ?? null,
          onPyramidId: c.pyramidId ?? null
        }
      })),
      ...pyramids.map(p => ({
        type: "pyramid",
        id: p.id,
        createdAt: p.createdAt,
        user: p.user,
        data: {
          pyramidId: p.id,
          playerCount: p._count.players
        }
      }))
    ]

    // Sort by date, newest first
    activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    // Paginate the merged result
    const start = (page - 1) * limit
    const paged = activities.slice(start, start + limit)

    return res.json({ page, limit, activities: paged })
  } catch (err) {
    console.error("getFeed error:", err)
    return res.status(500).json({ error: "Failed to fetch feed" })
  }
}

// ── GET /api/feed/global — global activity feed (all users) ───────────────
export const getGlobalFeed = async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(50, Number(req.query.limit) || 20)

  try {
    const overFetch = page * limit

    const [reviews, pyramids] = await Promise.all([
      prisma.gameReview.findMany({
        orderBy: { createdAt: "desc" },
        take: overFetch,
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
          game: {
            select: {
              id: true,
              date: true,
              homeTeam: { select: { id: true, name: true, abbreviation: true } },
              awayTeam: { select: { id: true, name: true, abbreviation: true } }
            }
          }
        }
      }),
      prisma.goatPyramid.findMany({
        orderBy: { createdAt: "desc" },
        take: overFetch,
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
          _count: { select: { players: true } }
        }
      })
    ])

    const activities = [
      ...reviews.map(r => ({
        type: "review",
        id: r.id,
        createdAt: r.createdAt,
        user: r.user,
        data: { rating: r.rating, review: r.review, likeCount: r.likeCount, game: r.game }
      })),
      ...pyramids.map(p => ({
        type: "pyramid",
        id: p.id,
        createdAt: p.createdAt,
        user: p.user,
        data: { pyramidId: p.id, playerCount: p._count.players }
      }))
    ]

    activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    const start = (page - 1) * limit
    const paged = activities.slice(start, start + limit)

    return res.json({ page, limit, activities: paged })
  } catch (err) {
    console.error("getGlobalFeed error:", err)
    return res.status(500).json({ error: "Failed to fetch global feed" })
  }
}