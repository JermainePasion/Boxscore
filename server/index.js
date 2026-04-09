import express from "express"
import cors from "cors"
import dotenv from "dotenv"

dotenv.config()

import { prisma } from "./lib/prisma.js"

const app = express()

app.use(cors())
app.use(express.json())

app.post("/users", async (req, res) => {
  try {
    const { email, name } = req.body

    const user = await prisma.user.create({
      data: { email, name },
    })

    res.json(user)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get("/users", async (req, res) => {
  const users = await prisma.user.findMany()
  res.json(users)
})

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} 🚀`)
})