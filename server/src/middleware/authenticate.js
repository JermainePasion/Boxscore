import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET

export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing token" })
    }

    const token = authHeader.split(" ")[1]

    const decoded = jwt.verify(token, JWT_SECRET)

    req.user = decoded // decoded contains { userId: ... }
    next()
  } catch (err) {
    console.error("JWT error:", err)
    return res.status(401).json({ error: "Invalid or expired token" })
  }
}