import express from "express"
import { searchPlayers, getSuggestedPlayers, getPlayerHeadshots, getPlayerSummary } from "../controllers/playerController.js"

const router = express.Router()

router.get("/search", searchPlayers)
router.get("/suggested", getSuggestedPlayers)
router.get("/:playerId/headshots", getPlayerHeadshots)
router.get("/:playerId/summary", getPlayerSummary)

export default router