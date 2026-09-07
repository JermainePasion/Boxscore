import express from "express"
import {
  createComment,
  getCommentsByGame,
  getCommentsByPyramid,
  toggleCommentLike,
  deleteComment,
} from "../controllers/reviewController.js"
import { authenticate } from "../middleware/authenticate.js"

const router = express.Router()

router.post("/", authenticate, createComment)
router.get("/game/:gameId", getCommentsByGame)
router.get("/pyramid/:pyramidId", getCommentsByPyramid)
router.post("/:commentId/like", authenticate, toggleCommentLike)
router.delete("/:commentId", authenticate, deleteComment)

export default router