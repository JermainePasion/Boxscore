import { prisma } from "../../lib/prisma.js"

const TEAM_SELECT = { select: { id: true, name: true, abbreviation: true } }

const GAME_INCLUDE = {
  include: {
    homeTeam: TEAM_SELECT,
    awayTeam: TEAM_SELECT
  }
}

// ── GET /api/users/:username — public profile ─────────────────────────────
export const getUserProfile = async (req, res) => {
  const { username } = req.params
  const viewerId = req.user?.userId ?? null

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        bio: true,
        avatarUrl: true, // requires `avatarUrl String?` on User — remove if not migrated
        createdAt: true,
        favoriteTeam: {
          select: { id: true, name: true, city: true, abbreviation: true }
        },
        _count: {
          select: {
            reviews: true,
            followers: true,
            following: true
          }
        }
      }
    })

    if (!user) return res.status(404).json({ error: "User not found" })

    const ratingAgg = await prisma.gameReview.aggregate({
      where: { userId: user.id },
      _avg: { rating: true },
      _count: { rating: true }
    })

    // Is the viewer following this user?
    let isFollowing = false
    if (viewerId && viewerId !== user.id) {
      const f = await prisma.follow.findUnique({
        where: {
          followerId_followingId: { followerId: viewerId, followingId: user.id }
        }
      })
      isFollowing = !!f
    }

    const [recentReviews, pyramids, favoriteGames] = await Promise.all([
      prisma.gameReview.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { game: GAME_INCLUDE }
      }),

      // findMany, not findUnique — userId stopped being unique when the
      // multiple-pyramids migration dropped GoatPyramid_userId_key.
      prisma.goatPyramid.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        include: {
          players: {
            orderBy: { tier: "asc" },
            select: {
              id: true,
              tier: true,
              headshotSeason: true,
              headshotTeamId: true,
              player: { select: { id: true, name: true, headshotUrl: true } }
            }
          }
        }
      }),

      prisma.favoriteGame.findMany({
        where: { userId: user.id },
        orderBy: { position: "asc" },
        include: { game: GAME_INCLUDE }
      })
    ])

    return res.json({
      ...user,
      isFollowing,
      isSelf: viewerId === user.id,
      stats: {
        reviewCount: ratingAgg._count.rating,
        averageRating: ratingAgg._avg.rating
          ? Number(ratingAgg._avg.rating.toFixed(2))
          : null,
        followerCount: user._count.followers,
        followingCount: user._count.following
      },
      recentReviews,
      pyramids,
      favoriteGames
    })
  } catch (err) {
    console.error("getUserProfile error:", err)
    return res.status(500).json({ error: "Failed to fetch profile" })
  }
}

// ── PATCH /api/users/me — update own profile ──────────────────────────────
export const updateMyProfile = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  const { bio, avatarUrl, favoriteTeamId } = req.body

  if (bio !== undefined && bio !== null && bio.length > 500) {
    return res.status(400).json({ error: "Bio is limited to 500 characters" })
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(bio !== undefined && { bio }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(favoriteTeamId !== undefined && { favoriteTeamId })
      },
      select: {
        id: true,
        username: true,
        bio: true,
        avatarUrl: true,
        favoriteTeamId: true
      }
    })

    return res.json(updated)
  } catch (err) {
    console.error("updateMyProfile error:", err)
    return res.status(500).json({ error: "Failed to update profile" })
  }
}

// ── PUT /api/users/me/favorite-games — replace the whole top 5 ────────────
// Takes the full ordered list rather than add/remove endpoints. Rewriting all
// five in one transaction sidesteps the position-shuffling that add/remove
// would need, and the list is never longer than five rows.
export const setMyFavoriteGames = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  const { gameIds } = req.body

  if (!Array.isArray(gameIds)) {
    return res.status(400).json({ error: "gameIds must be an array" })
  }
  if (gameIds.length > 5) {
    return res.status(400).json({ error: "You can pick at most 5 favorite games" })
  }
  if (new Set(gameIds).size !== gameIds.length) {
    return res.status(400).json({ error: "The same game can't be picked twice" })
  }

  try {
    const found = await prisma.game.count({ where: { id: { in: gameIds } } })
    if (found !== gameIds.length) {
      return res.status(400).json({ error: "One or more games don't exist" })
    }

    await prisma.$transaction([
      prisma.favoriteGame.deleteMany({ where: { userId } }),
      prisma.favoriteGame.createMany({
        data: gameIds.map((gameId, i) => ({ userId, gameId, position: i + 1 }))
      })
    ])

    const favoriteGames = await prisma.favoriteGame.findMany({
      where: { userId },
      orderBy: { position: "asc" },
      include: { game: GAME_INCLUDE }
    })

    return res.json({ favoriteGames })
  } catch (err) {
    console.error("setMyFavoriteGames error:", err)
    return res.status(500).json({ error: "Failed to save favorite games" })
  }
}

// ── GET /api/users/:username/reviews — paginated reviews ──────────────────
export const getUserReviews = async (req, res) => {
  const { username } = req.params
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(50, Number(req.query.limit) || 20)

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true }
    })
    if (!user) return res.status(404).json({ error: "User not found" })

    const reviews = await prisma.gameReview.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { game: GAME_INCLUDE }
    })

    return res.json({ page, limit, reviews })
  } catch (err) {
    console.error("getUserReviews error:", err)
    return res.status(500).json({ error: "Failed to fetch reviews" })
  }
}