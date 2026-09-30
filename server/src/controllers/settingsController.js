import { prisma } from "../../lib/prisma.js"

const THEMES = ["dark", "light"]
const SETTINGS_SELECT = { theme: true, hideScores: true }

// GET /api/settings — the signed-in user's settings
export const getMySettings = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  try {
    const settings = await prisma.user.findUnique({
      where: { id: userId },
      select: SETTINGS_SELECT,
    })
    if (!settings) return res.status(404).json({ error: "User not found" })
    return res.json(settings)
  } catch (err) {
    console.error("getMySettings error:", err)
    return res.status(500).json({ error: "Failed to load settings" })
  }
}

// PATCH /api/settings — partial update: { theme?: "dark"|"light", hideScores?: boolean }
export const updateMySettings = async (req, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: "Unauthorized" })

  const body = req.body ?? {}
  const data = {}

  if ("theme" in body) {
    if (!THEMES.includes(body.theme)) {
      return res.status(400).json({ error: `theme must be one of: ${THEMES.join(", ")}` })
    }
    data.theme = body.theme
  }

  if ("hideScores" in body) {
    if (typeof body.hideScores !== "boolean") {
      return res.status(400).json({ error: "hideScores must be true or false" })
    }
    data.hideScores = body.hideScores
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: "No settings to update" })
  }

  try {
    const settings = await prisma.user.update({
      where: { id: userId },
      data,
      select: SETTINGS_SELECT,
    })
    return res.json(settings)
  } catch (err) {
    console.error("updateMySettings error:", err)
    return res.status(500).json({ error: "Failed to save settings" })
  }
}