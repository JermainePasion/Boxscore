import express from "express"
import {
  upsertReview,
  getReviewsByGame,
  getReviewById,
  deleteReview,
  toggleReviewLike,
  createComment,
  getCommentsByGame,
  deleteComment,
} from "../controllers/reviewController.js"
import { authenticate } from "../middleware/authenticate.js" // your existing JWT middleware

const router = express.Router()

// ── Reviews ──────────────────────────────────────────────────────────────────
router.post("/", authenticate, upsertReview)
router.get("/game/:gameId", getReviewsByGame)
router.get("/:reviewId", getReviewById)
router.delete("/:reviewId", authenticate, deleteReview)
router.post("/:reviewId/like", authenticate, toggleReviewLike)

// ── Comments ─────────────────────────────────────────────────────────────────
router.post("/comments", authenticate, createComment)
router.get("/comments/game/:gameId", getCommentsByGame)
router.delete("/comments/:commentId", authenticate, deleteComment)

export default router