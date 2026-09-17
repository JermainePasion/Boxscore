import express from "express"
import { getPlayerMatchup } from "../controllers/matchupController.js"

const router = express.Router()

// public — anyone can look up a rivalry
router.get("/:aId/vs/:bId", getPlayerMatchup)

export default router

// Mount in index.js:
//   import matchupRoutes from "./src/routes/matchupRoutes.js"
//   app.use("/api/matchups", matchupRoutes)