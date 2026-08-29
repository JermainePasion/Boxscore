import express from "express"
import {
  getMyWatchlist,
  getWatchlistStatus,
  addToWatchlist,
  removeFromWatchlist,
} from "../controllers/watchlistController.js"
import { authenticate } from "../middleware/authenticate.js"

const router = express.Router()

// All watchlist routes are personal — auth required.
router.get("/", authenticate, getMyWatchlist)
router.get("/:gameId/status", authenticate, getWatchlistStatus)
router.post("/:gameId", authenticate, addToWatchlist)
router.delete("/:gameId", authenticate, removeFromWatchlist)

export default router