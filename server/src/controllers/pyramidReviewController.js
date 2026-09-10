import { prisma } from "../../lib/prisma.js"

/*
 * Pyramid reviews. Mirrors the review/comment controllers.
 */

const REVIEW_INCLUDE = {
  user: { select: { id: true, username: true, avatarUrl: true } },
  likes: { select: { userId: true } },
}

// GET /api/pyramid-reviews/pyramid/:pyramidId  — public, newest first
export const getReviewsByPyramid = async (req, res) => {
  const { pyramidId } = req.params
  try {
    const reviews = await prisma.pyramidReview.findMany({
      where: { pyramidId },
      include: REVIEW_INCLUDE,
      orderBy: { createdAt: "desc" },
    })
    return res.json(reviews)
  } catch (err) {
    console.error("getReviewsByPyramid error:", err)
    return res.status(500).json({ error: "Failed to fetch reviews" })
  }
}

// PUT /api/pyramid-reviews/pyramid/:pyramidId  — create or update MY review.
// Body: { rating: 1..10, review?: string }. A quick-rate omits `review` and
// therefore leaves any existing text untouched.
export const upsertPyramidReview = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  const { pyramidId } = req.params
  const { rating, review } = req.body

  const r = Number(rating)
  if (!Number.isInteger(r) || r < 1 || r > 10) {
    return res.status(400).json({ error: "Rating must be an integer 1–10" })
  }

  try {
    const pyramid = await prisma.goatPyramid.findUnique({
      where: { id: pyramidId },
      select: { id: true },
    })
    if (!pyramid) return res.status(404).json({ error: "Pyramid not found" })

    const update = { rating: r }
    if (review !== undefined) update.review = review?.trim() || null

    const saved = await prisma.pyramidReview.upsert({
      where: { userId_pyramidId: { userId, pyramidId } },
      update,
      create: { userId, pyramidId, rating: r, review: review?.trim() || null },
      include: REVIEW_INCLUDE,
    })
    return res.json(saved)
  } catch (err) {
    console.error("upsertPyramidReview error:", err)
    return res.status(500).json({ error: "Failed to save review" })
  }
}

// DELETE /api/pyramid-reviews/pyramid/:pyramidId  — remove MY review
export const deletePyramidReview = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  const { pyramidId } = req.params
  try {
    await prisma.pyramidReview.deleteMany({ where: { userId, pyramidId } })
    return res.json({ message: "Review deleted" })
  } catch (err) {
    console.error("deletePyramidReview error:", err)
    return res.status(500).json({ error: "Failed to delete review" })
  }
}

// POST /api/pyramid-reviews/:reviewId/like  — toggle my like
export const togglePyramidReviewLike = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  const { reviewId } = req.params
  try {
    const existing = await prisma.pyramidReviewLike.findUnique({
      where: { userId_reviewId: { userId, reviewId } },
    })
    if (existing) {
      await prisma.pyramidReviewLike.delete({
        where: { userId_reviewId: { userId, reviewId } },
      })
      return res.json({ liked: false })
    }
    await prisma.pyramidReviewLike.create({ data: { userId, reviewId } })
    return res.json({ liked: true })
  } catch (err) {
    console.error("togglePyramidReviewLike error:", err)
    return res.status(500).json({ error: "Failed to toggle like" })
  }
}