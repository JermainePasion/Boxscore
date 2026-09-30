import { prisma } from "../../lib/prisma.js"

const THEMES = ["dark", "light"]


export const getMySettings = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { theme: true },
    })
    if (!user) return res.status(404).json({ error: "User not found" })
    return res.json({ theme: user.theme })
  } catch (err) {
    console.error("getMySettings error:", err)
    return res.status(500).json({ error: "Failed to load settings" })
  }
}

export const updateMySettings = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  const { theme } = req.body
  if (!THEMES.includes(theme)) {
    return res.status(400).json({ error: `theme must be one of: ${THEMES.join(", ")}` })
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { theme },
      select: { theme: true },
    })
    return res.json({ theme: user.theme })
  } catch (err) {
    console.error("updateMySettings error:", err)
    return res.status(500).json({ error: "Failed to save settings" })
  }
}