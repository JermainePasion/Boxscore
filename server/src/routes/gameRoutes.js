import express from "express"
import { getGameById, searchGames, getSuggestedGames, seedSuggestedGames, getPopularGames} from "../controllers/gameController.js"


const router = express.Router()

router.get("/search", searchGames)
router.get("/suggested", getSuggestedGames)    
router.post("/seed-suggested", seedSuggestedGames)
router.get("/popular", getPopularGames) 
router.get("/:id", getGameById)


export default router