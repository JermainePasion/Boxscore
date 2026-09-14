import { prisma } from "../../lib/prisma.js"

/*
 * List reviews. Mirrors pyramidReviewController.
 * Rating is an integer 1–10 (BasketballRating emits 1–10; each ball = 2 units).
 * Auth uses req.user?.userId, the app-wide convention.
 */

const REVIEW_INCLUDE = {
  user: { select: { id: true, username: true, avatarUrl: true } },
  likes: { select: { userId: true } },
}

// GET /api/list-reviews/list/:listId — public, newest first
export const getReviewsByList = async (req, res) => {
  const { listId } = req.params
  try {
    const reviews = await prisma.listReview.findMany({
      where: { listId },
      include: REVIEW_INCLUDE,
      orderBy: { createdAt: "desc" },
    })
    return res.json(reviews)
  } catch (err) {
    console.error("getReviewsByList error:", err)
    return res.status(500).json({ error: "Failed to fetch reviews" })
  }
}

// PUT /api/list-reviews/list/:listId — create or update MY review.
// Body: { rating: 1..10, review?: string }. Quick-rate omits `review`,
// so existing text is left untouched.
export const upsertListReview = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  const { listId } = req.params
  const { rating, review } = req.body

  const r = Number(rating)
  if (!Number.isInteger(r) || r < 1 || r > 10) {
    return res.status(400).json({ error: "Rating must be an integer 1–10" })
  }

  try {
    const list = await prisma.gameList.findUnique({
      where: { id: listId },
      select: { id: true },
    })
    if (!list) return res.status(404).json({ error: "List not found" })

    const update = { rating: r }
    if (review !== undefined) update.review = review?.trim() || null

    const saved = await prisma.listReview.upsert({
      where: { userId_listId: { userId, listId } },
      update,
      create: { userId, listId, rating: r, review: review?.trim() || null },
      include: REVIEW_INCLUDE,
    })
    return res.json(saved)
  } catch (err) {
    console.error("upsertListReview error:", err)
    return res.status(500).json({ error: "Failed to save review" })
  }
}

// DELETE /api/list-reviews/list/:listId — remove MY review
export const deleteListReview = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  const { listId } = req.params
  try {
    await prisma.listReview.deleteMany({ where: { userId, listId } })
    return res.json({ message: "Review deleted" })
  } catch (err) {
    console.error("deleteListReview error:", err)
    return res.status(500).json({ error: "Failed to delete review" })
  }
}

// POST /api/list-reviews/:reviewId/like — toggle my like
export const toggleListReviewLike = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  const { reviewId } = req.params
  try {
    const existing = await prisma.listReviewLike.findUnique({
      where: { userId_reviewId: { userId, reviewId } },
    })
    if (existing) {
      await prisma.listReviewLike.delete({
        where: { userId_reviewId: { userId, reviewId } },
      })
      return res.json({ liked: false })
    }
    await prisma.listReviewLike.create({ data: { userId, reviewId } })
    return res.json({ liked: true })
  } catch (err) {
    console.error("toggleListReviewLike error:", err)
    return res.status(500).json({ error: "Failed to toggle like" })
  }
}