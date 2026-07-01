import express from "express"
import {
  getUserProfile,
  updateMyProfile,
  getUserReviews
} from "../controllers/userController.js"
import {
  getFollowers,
  getFollowing
} from "../controllers/followController.js"
import { authenticate } from "../middleware/authenticate.js"
import { optionalAuth } from "../middleware/optionalAuth.js" // see note below

const router = express.Router()

router.patch("/me", authenticate, updateMyProfile)
router.get("/:username", optionalAuth, getUserProfile)
router.get("/:username/reviews", getUserReviews)
router.get("/:username/followers", getFollowers)
router.get("/:username/following", getFollowing)

export default router