import { prisma } from "../../lib/prisma.js"
import { NbaUnavailableError, resilient } from "../../lib/nba.js"
import { fetchAndSaveGame } from "./gameController.js"

const MIN = 60 * 1000
const MAX_REVIEW_LENGTH = 10000
const MAX_COMMENT_LENGTH = 2000

const isGameId = (id) => typeof id === "string" && /^\d{10}$/.test(id)

const NBA_UNAVAILABLE = {
  error: "Couldn't load this game from the NBA right now. Try again in a few minutes.",
  retryable: true,
}

const REVIEW_INCLUDE = {
  user: { select: { id: true, username: true } },
  likes: { select: { userId: true } },
  comments: {
    include: { user: { select: { id: true, username: true } } },
    orderBy: { createdAt: "asc" },
  },
}

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

  if (!isGameId(gameId)) return res.status(400).json({ error: "A valid gameId is required" })
  if (typeof rating !== "number" || rating < 1 || rating > 10) {
    return res.status(400).json({ error: "rating must be a number between 1 and 10" })
  }
  if (review != null && typeof review !== "string") {
    return res.status(400).json({ error: "review must be text" })
  }
  if (review && review.length > MAX_REVIEW_LENGTH) {
    return res.status(400).json({ error: `Reviews can be at most ${MAX_REVIEW_LENGTH} characters` })
  }

  try {
    // Reviewing a game that isn't saved yet: fetch it from the NBA first.
    // (Runs in the background, so other visitors aren't kept waiting, and a
    // failure isn't retried for 2 minutes.)
    const exists = await prisma.game.findUnique({ where: { id: gameId }, select: { id: true } })
    if (!exists) {
      try {
        await resilient(`review-fetch:${gameId}`, { ttl: 2 * MIN, failTtl: 2 * MIN }, () =>
          fetchAndSaveGame(gameId)
        )
      } catch (err) {
        if (err instanceof NbaUnavailableError) return res.status(503).json(NBA_UNAVAILABLE)
        console.error(`upsertReview: could not fetch game ${gameId}:`, err.message)
        return res.status(404).json({ error: "Game not found" })
      }
    }

    const data = {
      rating,
      review: review?.trim() || null,
      watchedAt: watchedAt ? new Date(watchedAt) : null,
      watchedBefore: watchedBefore ?? false,
    }
    if (data.watchedAt && Number.isNaN(data.watchedAt.getTime())) {
      return res.status(400).json({ error: "watchedAt is not a valid date" })
    }

    const result = await prisma.gameReview.upsert({
      where: { userId_gameId: { userId, gameId } },
      update: data,
      create: { userId, gameId, ...data },
      include: REVIEW_INCLUDE,
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
      include: REVIEW_INCLUDE,
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
      include: REVIEW_INCLUDE,
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
 * Post a comment on a game, review, pyramid, or list.
 * Body: { content, gameId?, reviewId?, pyramidId?, listId? }
 * At least one of gameId / reviewId / pyramidId / listId must be provided.
 */
export const createComment = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  const { content, gameId, reviewId, pyramidId, listId } = req.body

  if (typeof content !== "string" || !content.trim()) {
    return res.status(400).json({ error: "content is required" })
  }
  if (content.length > MAX_COMMENT_LENGTH) {
    return res.status(400).json({ error: `Comments can be at most ${MAX_COMMENT_LENGTH} characters` })
  }
  if (!gameId && !reviewId && !pyramidId && !listId) {
    return res.status(400).json({
      error: "Provide at least one of gameId, reviewId, pyramidId, or listId",
    })
  }

  try {
    const comment = await prisma.comment.create({
      data: {
        userId,
        content: content.trim(),
        gameId: gameId ?? null,
        reviewId: reviewId ?? null,
        pyramidId: pyramidId ?? null,
        listId: listId ?? null,
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
      where: { gameId, reviewId: null, pyramidId: null, listId: null },
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

export const getCommentsByPyramid = async (req, res) => {
  const { pyramidId } = req.params

  try {
    const comments = await prisma.comment.findMany({
      where: { pyramidId, gameId: null, reviewId: null, listId: null },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        likes: { select: { userId: true } },
      },
    })
    return res.json(comments)
  } catch (err) {
    console.error("getCommentsByPyramid error:", err)
    return res.status(500).json({ error: "Failed to fetch comments" })
  }
}

export const getCommentsByList = async (req, res) => {
  const { listId } = req.params

  try {
    const comments = await prisma.comment.findMany({
      where: { listId, gameId: null, reviewId: null, pyramidId: null },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        likes: { select: { userId: true } },
      },
    })
    return res.json(comments)
  } catch (err) {
    console.error("getCommentsByList error:", err)
    return res.status(500).json({ error: "Failed to fetch comments" })
  }
}

export const toggleCommentLike = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  const { commentId } = req.params

  try {
    const existing = await prisma.commentLike.findUnique({
      where: { userId_commentId: { userId, commentId } },
    })

    if (existing) {
      await prisma.commentLike.delete({
        where: { userId_commentId: { userId, commentId } },
      })
      return res.json({ liked: false })
    }

    await prisma.commentLike.create({ data: { userId, commentId } })
    return res.json({ liked: true })
  } catch (err) {
    console.error("toggleCommentLike error:", err)
    return res.status(500).json({ error: "Failed to toggle like" })
  }
}