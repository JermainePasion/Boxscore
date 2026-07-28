import express from "express"
import { followUser, unfollowUser } from "../controllers/followController.js"
import { authenticate } from "../middleware/authenticate.js"

const router = express.Router()

router.post("/:username/follow", authenticate, followUser)
router.delete("/:username/follow", authenticate, unfollowUser)

export default router