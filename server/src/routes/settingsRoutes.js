import express from "express"
import { getMySettings, updateMySettings } from "../controllers/settingsController.js"
import { authenticate } from "../middleware/authenticate.js"

const router = express.Router()

router.get("/", authenticate, getMySettings)
router.patch("/", authenticate, updateMySettings)

export default router
