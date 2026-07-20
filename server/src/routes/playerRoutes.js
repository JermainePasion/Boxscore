import express from "express"
import { searchPlayers, getSuggestedPlayers, getPlayerHeadshots } from "../controllers/playerController.js"

const router = express.Router()

router.get("/search", searchPlayers)
router.get("/suggested", getSuggestedPlayers)
router.get("/:playerId/headshots", getPlayerHeadshots)

export default router