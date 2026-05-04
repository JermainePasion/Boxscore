import express from "express"
import cors from "cors"
import dotenv from "dotenv"

dotenv.config()

import authRoutes from "./src/routes/authRoutes.js"
import gameRoutes from "./src/routes/gameRoutes.js"
import reviewRoutes from './src/routes/reviewRoutes.js'

const app = express()

app.use(cors())
app.use(express.json())

app.use("/api/auth", authRoutes)
app.use("/api/games", gameRoutes)
app.use("/api/reviews", reviewRoutes)

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})