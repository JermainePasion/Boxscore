import { prisma } from "../../lib/prisma.js"

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
        avatarUrl: true,
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

    // Aggregate rating info
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

    // Recent reviews
    const recentReviews = await prisma.gameReview.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        game: {
          include: {
            homeTeam: { select: { id: true, name: true, abbreviation: true } },
            awayTeam: { select: { id: true, name: true, abbreviation: true } }
          }
        }
      }
    })

    // Has a pyramid?
    const pyramid = await prisma.goatPyramid.findUnique({
      where: { userId: user.id },
      select: { id: true, createdAt: true, _count: { select: { players: true } } }
    })

    return res.json({
      ...user,
      isFollowing,
      isSelf: viewerId === user.id,
      stats: {
        reviewCount: ratingAgg._count.rating,
        averageRating: ratingAgg._avg.rating ? Number(ratingAgg._avg.rating.toFixed(2)) : null,
        followerCount: user._count.followers,
        followingCount: user._count.following
      },
      recentReviews,
      pyramid
    })
  } catch (err) {
    console.error("getUserProfile error:", err)
    return res.status(500).json({ error: "Failed to fetch profile" })
  }
}

// ── PATCH /api/users/me — update own profile ──────────────────────────────
export const updateMyProfile = async (req, res) => {
  console.log("req.user from token:", req.user)
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  const { bio, avatarUrl, favoriteTeamId } = req.body

  const check = await prisma.user.findUnique({ where: { id: userId } })
  console.log("user exists in DB?", !!check)
  
  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(bio !== undefined && { bio }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(favoriteTeamId !== undefined && { favoriteTeamId })
      },
      select: {
        id: true, username: true, bio: true, avatarUrl: true,
        favoriteTeamId: true
      }
    })

    return res.json(updated)
  } catch (err) {
    console.error("updateMyProfile error:", err)
    return res.status(500).json({ error: "Failed to update profile" })
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
      include: {
        game: {
          include: {
            homeTeam: { select: { id: true, name: true, abbreviation: true } },
            awayTeam: { select: { id: true, name: true, abbreviation: true } }
          }
        }
      }
    })

    return res.json({ page, limit, reviews })
  } catch (err) {
    console.error("getUserReviews error:", err)
    return res.status(500).json({ error: "Failed to fetch reviews" })
  }
}