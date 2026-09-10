import express from "express"
import {
  getReviewsByPyramid,
  upsertPyramidReview,
  deletePyramidReview,
  togglePyramidReviewLike,
} from "../controllers/pyramidReviewController.js"
import { authenticate } from "../middleware/authenticate.js"

const router = express.Router()

router.get("/pyramid/:pyramidId", getReviewsByPyramid)
router.put("/pyramid/:pyramidId", authenticate, upsertPyramidReview)
router.delete("/pyramid/:pyramidId", authenticate, deletePyramidReview)
router.post("/:reviewId/like", authenticate, togglePyramidReviewLike)

export default router
