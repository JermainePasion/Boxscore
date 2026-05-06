import express from "express"
import { searchPlayers } from "../controllers/playerController.js"

const router = express.Router()

router.get("/search", searchPlayers)

export default router