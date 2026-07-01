import express from "express"
import { toggleFollow } from "../controllers/followController.js"
import { authenticate } from "../middleware/authenticate.js"

const router = express.Router()

router.post("/:userId", authenticate, toggleFollow)

export default router