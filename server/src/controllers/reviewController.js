import { prisma } from "../../lib/prisma.js"

// ─── REVIEWS ────────────────────────────────────────────────────────────────

/**
 * POST /api/reviews
 * Create or update a review for a game.
 * Body: { gameId, rating, review?, watchedAt?, watchedBefore? }
 */
export const upsertReview = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  const { gameId, rating, review, watchedAt, watchedBefore } = req.body

  if (!gameId) return res.status(400).json({ error: "gameId is required" })
  if (typeof rating !== "number" || rating < 1 || rating > 10) {
    return res.status(400).json({ error: "rating must be a number between 1 and 10" })
  }

  try {
    // Confirm the game exists
    const game = await prisma.game.findUnique({ where: { id: gameId } })
    if (!game) return res.status(404).json({ error: "Game not found" })

    const data = {
      rating,
      review: review ?? null,
      watchedAt: watchedAt ? new Date(watchedAt) : null,
      watchedBefore: watchedBefore ?? false,
    }

    const result = await prisma.gameReview.upsert({
      where: { userId_gameId: { userId, gameId } },
      update: data,
      create: { userId, gameId, ...data },
      include: {
        user: { select: { id: true, username: true } },
        likes: { select: { userId: true } },
        comments: {
          include: { user: { select: { id: true, username: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    })

    return res.json(result)
  } catch (err) {
    console.error("upsertReview error:", err)
    return res.status(500).json({ error: "Failed to save review" })
  }
}

/**
 * GET /api/reviews/game/:gameId
 * Fetch all reviews for a game, newest first.
 */
export const getReviewsByGame = async (req, res) => {
  const { gameId } = req.params

  try {
    const reviews = await prisma.gameReview.findMany({
      where: { gameId },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, username: true } },
        likes: { select: { userId: true } },
        comments: {
          include: { user: { select: { id: true, username: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    })

    return res.json(reviews)
  } catch (err) {
    console.error("getReviewsByGame error:", err)
    return res.status(500).json({ error: "Failed to fetch reviews" })
  }
}

/**
 * GET /api/reviews/:reviewId
 * Fetch a single review by its ID.
 */
export const getReviewById = async (req, res) => {
  const { reviewId } = req.params

  try {
    const review = await prisma.gameReview.findUnique({
      where: { id: reviewId },
      include: {
        user: { select: { id: true, username: true } },
        likes: { select: { userId: true } },
        comments: {
          include: { user: { select: { id: true, username: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    })

    if (!review) return res.status(404).json({ error: "Review not found" })

    return res.json(review)
  } catch (err) {
    console.error("getReviewById error:", err)
    return res.status(500).json({ error: "Failed to fetch review" })
  }
}

/**
 * DELETE /api/reviews/:reviewId
 * Delete the authenticated user's review.
 */
export const deleteReview = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  const { reviewId } = req.params

  try {
    const review = await prisma.gameReview.findUnique({ where: { id: reviewId } })
    if (!review) return res.status(404).json({ error: "Review not found" })
    if (review.userId !== userId) return res.status(403).json({ error: "Forbidden" })

    // Delete related likes and comments first (cascade not set in schema)
    await prisma.$transaction([
      prisma.reviewLike.deleteMany({ where: { reviewId } }),
      prisma.comment.deleteMany({ where: { reviewId } }),
      prisma.gameReview.delete({ where: { id: reviewId } }),
    ])

    return res.json({ message: "Review deleted" })
  } catch (err) {
    console.error("deleteReview error:", err)
    return res.status(500).json({ error: "Failed to delete review" })
  }
}

// ─── REVIEW LIKES ───────────────────────────────────────────────────────────

/**
 * POST /api/reviews/:reviewId/like
 * Toggle like on a review.
 */
export const toggleReviewLike = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  const { reviewId } = req.params

  try {
    const existing = await prisma.reviewLike.findUnique({
      where: { userId_reviewId: { userId, reviewId } },
    })

    if (existing) {
      await prisma.$transaction([
        prisma.reviewLike.delete({ where: { userId_reviewId: { userId, reviewId } } }),
        prisma.gameReview.update({
          where: { id: reviewId },
          data: { likeCount: { decrement: 1 } },
        }),
      ])
      return res.json({ liked: false })
    } else {
      await prisma.$transaction([
        prisma.reviewLike.create({ data: { userId, reviewId } }),
        prisma.gameReview.update({
          where: { id: reviewId },
          data: { likeCount: { increment: 1 } },
        }),
      ])
      return res.json({ liked: true })
    }
  } catch (err) {
    console.error("toggleReviewLike error:", err)
    return res.status(500).json({ error: "Failed to toggle like" })
  }
}

// ─── COMMENTS ───────────────────────────────────────────────────────────────

/**
 * POST /api/comments
 * Post a comment on a game, review, or pyramid.
 * Body: { content, gameId?, reviewId?, pyramidId? }
 * At least one of gameId / reviewId / pyramidId must be provided.
 */
export const createComment = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  const { content, gameId, reviewId, pyramidId } = req.body

  if (!content?.trim()) return res.status(400).json({ error: "content is required" })
  if (!gameId && !reviewId && !pyramidId) {
    return res.status(400).json({ error: "Provide at least one of gameId, reviewId, or pyramidId" })
  }

  try {
    const comment = await prisma.comment.create({
      data: {
        userId,
        content: content.trim(),
        gameId: gameId ?? null,
        reviewId: reviewId ?? null,
        pyramidId: pyramidId ?? null,
      },
      include: { user: { select: { id: true, username: true } } },
    })

    return res.status(201).json(comment)
  } catch (err) {
    console.error("createComment error:", err)
    return res.status(500).json({ error: "Failed to post comment" })
  }
}

/**
 * GET /api/comments/game/:gameId
 * Fetch all top-level game comments.
 */
export const getCommentsByGame = async (req, res) => {
  const { gameId } = req.params

  try {
    const comments = await prisma.comment.findMany({
      where: { gameId, reviewId: null, pyramidId: null },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, username: true } } },
    })
    return res.json(comments)
  } catch (err) {
    console.error("getCommentsByGame error:", err)
    return res.status(500).json({ error: "Failed to fetch comments" })
  }
}

/**
 * DELETE /api/comments/:commentId
 * Delete the authenticated user's comment.
 */
export const deleteComment = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  const { commentId } = req.params

  try {
    const comment = await prisma.comment.findUnique({ where: { id: commentId } })
    if (!comment) return res.status(404).json({ error: "Comment not found" })
    if (comment.userId !== userId) return res.status(403).json({ error: "Forbidden" })

    await prisma.comment.delete({ where: { id: commentId } })
    return res.json({ message: "Comment deleted" })
  } catch (err) {
    console.error("deleteComment error:", err)
    return res.status(500).json({ error: "Failed to delete comment" })
  }
}