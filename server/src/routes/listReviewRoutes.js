import express from "express"
import {
  getReviewsByList,
  upsertListReview,
  deleteListReview,
  toggleListReviewLike,
} from "../controllers/listReviewController.js"
import { authenticate } from "../middleware/authenticate.js"

const router = express.Router()

router.get("/list/:listId", getReviewsByList)
router.put("/list/:listId", authenticate, upsertListReview)
router.delete("/list/:listId", authenticate, deleteListReview)
router.post("/:reviewId/like", authenticate, toggleListReviewLike)

export default router

// Mount in index.js:
//   import listReviewRoutes from "./src/routes/listReviewRoutes.js"
//   app.use("/api/list-reviews", listReviewRoutes)