import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET

export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith("Bearer ")) return next()

  const token = authHeader.slice(7)

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
  } catch {
    // Ignore invalid tokens — just proceed without user
  }

  next()
}