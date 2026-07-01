import express from "express"
import cors from "cors"
import dotenv from "dotenv"

dotenv.config()

import authRoutes from "./src/routes/authRoutes.js"
import gameRoutes from "./src/routes/gameRoutes.js"
import reviewRoutes from './src/routes/reviewRoutes.js'
import playerRoutes from './src/routes/playerRoutes.js'
import pyramidRoutes from './src/routes/pyramidRoutes.js'

import userRoutes from "./src/routes/userRoutes.js"
import followRoutes from "./src/routes/followRoutes.js"
import feedRoutes from "./src/routes/feedRoutes.js"

const app = express()

app.use(cors())
app.use(express.json())

app.use("/api/auth", authRoutes)
app.use("/api/games", gameRoutes)
app.use("/api/reviews", reviewRoutes)
app.use("/api/players", playerRoutes)
app.use("/api/pyramid", pyramidRoutes)

app.use("/api/users", userRoutes)
app.use("/api/follow", followRoutes)
app.use("/api/feed", feedRoutes)

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})