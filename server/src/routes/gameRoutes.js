import express from "express"
import { getGameById, searchGames} from "../controllers/gameController.js"


const router = express.Router()

router.get("/search", searchGames)
router.get("/:id", getGameById)


export default router