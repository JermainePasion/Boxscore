// Must be the first import: loads .env before any other module reads process.env.
// (With `import`, everything is loaded before the file's own code runs, so a
// dotenv.config() call further down would come too late for modules that read
// env values when they load, like imgRoutes.js, nba.js and youtube.js.)
import "dotenv/config"

import express from "express"
import cors from "cors"

import authRoutes from "./src/routes/authRoutes.js"
import gameRoutes from "./src/routes/gameRoutes.js"
import reviewRoutes from "./src/routes/reviewRoutes.js"
import playerRoutes from "./src/routes/playerRoutes.js"
import pyramidRoutes from "./src/routes/pyramidRoutes.js"

import userRoutes from "./src/routes/userRoutes.js"
import followRoutes from "./src/routes/followRoutes.js"
import feedRoutes from "./src/routes/feedRoutes.js"
import imgRoutes from "./src/routes/imgRoutes.js"
import watchlistRoutes from "./src/routes/watchlistRoutes.js"
import listRoutes from "./src/routes/listRoutes.js"
import commentRoutes from "./src/routes/commentRoutes.js"
import pyramidReviewRoutes from "./src/routes/pyramidReviewRoutes.js"
import listReviewRoutes from "./src/routes/listReviewRoutes.js"
import matchupRoutes from "./src/routes/matchupRoutes.js"
import settingsRoutes from "./src/routes/settingsRoutes.js"

import { startHighlightSync } from "./lib/youtube.js"
import { startGameSync } from "./lib/gameSync.js"

const app = express()

// FRONTEND_URL set (comma-separated for several): only those sites may call the API.
// Not set (local development): any site may.
const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean)
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true }))

app.use(express.json())

app.use("/api/auth", authRoutes)
app.use("/api/games", gameRoutes)
app.use("/api/reviews", reviewRoutes)
app.use("/api/players", playerRoutes)
app.use("/api/pyramid", pyramidRoutes)
app.use("/api/pyramid-reviews", pyramidReviewRoutes)
app.use("/api/matchups", matchupRoutes)
app.use("/api/comments", commentRoutes)
app.use("/api/watchlist", watchlistRoutes)
app.use("/api/lists", listRoutes)
app.use("/api/list-reviews", listReviewRoutes)

app.use("/api/users", userRoutes)
app.use("/api/users", followRoutes)
app.use("/api/feed", feedRoutes)
app.use("/api/settings", settingsRoutes)

app.use("/api/img", imgRoutes)

const PORT = process.env.PORT || 5000

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`)
  startHighlightSync() 
  startGameSync() 
})