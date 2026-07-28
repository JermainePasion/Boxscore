import express from "express"
import {
  getUserProfile,
  updateMyProfile,
  setMyFavoriteGames,
  getUserReviews,
} from "../controllers/userController.js"
import {
  getFollowers,
  getFollowing,
  followUser,
  unfollowUser,
} from "../controllers/followController.js"
import { authenticate } from "../middleware/authenticate.js"
import { optionalAuth } from "../middleware/optionalAuth.js"

const router = express.Router()

router.patch("/me", authenticate, updateMyProfile)
router.put("/me/favorite-games", authenticate, setMyFavoriteGames)

router.post("/:username/follow", authenticate, followUser)
router.delete("/:username/follow", authenticate, unfollowUser)

router.get("/:username", optionalAuth, getUserProfile)
router.get("/:username/reviews", getUserReviews)
router.get("/:username/followers", getFollowers)
router.get("/:username/following", getFollowing)

export default router