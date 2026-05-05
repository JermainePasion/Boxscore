import express from "express"
import { getGameById, searchGames, searchPlayers } from "../controllers/gameController.js"


const router = express.Router()

router.get("/search", searchGames)
router.get("/:id", getGameById)
router.get("/players/search", searchPlayers)

export default router