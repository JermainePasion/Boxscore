import express from "express"
import { getFeed, getGlobalFeed } from "../controllers/feedController.js"
import { authenticate } from "../middleware/authenticate.js"

const router = express.Router()

router.get("/", authenticate, getFeed)
router.get("/global", getGlobalFeed)

export default router