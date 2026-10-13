import express from "express"
import {
  getGameById,
  searchGames,
  getSuggestedGames,
  getPopularGames,
  smartSearch,
  getGameShots,
  getRecentGames,
  getRandomGames,
} from "../controllers/gameController.js"

const router = express.Router()

router.get("/search", searchGames)
router.get("/smart-search", smartSearch)
router.get("/suggested", getSuggestedGames)
router.get("/popular", getPopularGames)
router.get("/:id/shots", getGameShots)
router.get("/recent", getRecentGames)
router.get("/random", getRandomGames)
router.get("/:id", getGameById)

export default router