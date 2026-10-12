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
import { rateLimit } from "./lib/rateLimit.js"
import { nbaStatus } from "./lib/nba.js"
import { prisma } from "./lib/prisma.js"

const MIN = 60 * 1000

const app = express()

// Behind Caddy: trust its X-Forwarded-For so req.ip is the visitor's real IP
// (needed for rate limiting).
app.set("trust proxy", 1)

// FRONTEND_URL set (comma-separated for several): only those sites may call the API.
// Not set (local development): any site may.
const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean)
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true }))

app.use(express.json({ limit: "100kb" }))

// Rate limits, per visitor IP:
//  - login / sign-up: 30 tries per 15 min (slows down password guessing and mass sign-ups)
//  - anything that changes data (reviews, comments, likes, lists...): 120 per minute
app.use("/api/auth", rateLimit({ windowMs: 15 * MIN, max: 30, methods: ["POST"] }))
app.use("/api", rateLimit({ windowMs: MIN, max: 120, methods: ["POST", "PUT", "PATCH", "DELETE"] }))

// Health checks for an uptime monitor.
//  /api/health      server + database are up (503 if the database can't be reached)
//  /api/health/nba  laptop relay reachable and NBA not blocking us (503 otherwise)
app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ ok: true })
  } catch {
    res.status(503).json({ ok: false, database: false })
  }
})
app.get("/api/health/nba", async (req, res) => {
  const status = await nbaStatus()
  res.status(status.ok ? 200 : 503).json(status)
})

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