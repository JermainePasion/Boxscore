import axios from "axios"
import { prisma } from "./prisma.js"

const YT_KEY = process.env.YOUTUBE_API_KEY

export const findAndSaveHighlight = async (game) => {
  if (game.youtubeId) return game.youtubeId
  if (!YT_KEY) return null

  const away = game.awayTeam?.name ?? ""
  const home = game.homeTeam?.name ?? ""
  if (!away || !home) return null

  const d = game.date ? new Date(game.date) : null
  const dateStr = d
    ? d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    : ""

  // Mirror the NBA channel title format exactly:
  // "WARRIORS at CELTICS | FULL GAME 6 NBA FINALS HIGHLIGHTS | June 16, 2022"
  const query = `${away} at ${home} highlights ${dateStr}`
  console.log("YT QUERY:", query)

  try {
    const { data } = await axios.get("https://www.googleapis.com/youtube/v3/search", {
      params: {
        key: YT_KEY,
        part: "snippet",
        q: query,
        type: "video",
        maxResults: 15,
        videoEmbeddable: "true",
      },
    })

    const items = data.items ?? []
    if (items.length === 0) return null

    const scored = items.map(i => {
      const title = i.snippet.title
      const t = title.toLowerCase()
      let score = 0

      const hasAway = t.includes(away.toLowerCase())
      const hasHome = t.includes(home.toLowerCase())
      if (!hasAway || !hasHome) score -= 100

      if (i.snippet.channelTitle === "NBA") score += 50

      // "FULL GAME ... HIGHLIGHTS" with anything in between (covers "FULL GAME 6 NBA FINALS HIGHLIGHTS")
      if (/full game.*highlights/i.test(title)) score += 30
      else if (/highlights/i.test(title)) score += 10

      // NBA format: "TEAM at TEAM" — away team appearing before home team
      const awayIdx = t.indexOf(away.toLowerCase())
      const homeIdx = t.indexOf(home.toLowerCase())
      if (awayIdx !== -1 && homeIdx !== -1 && awayIdx < homeIdx) score += 15

      if (d) {
        const month = d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })
        const day = String(d.getUTCDate())
        const year = String(d.getUTCFullYear())
        const hasMonth = t.includes(month.toLowerCase())
        const hasDay = new RegExp(`\\b${day}\\b`).test(title)
        const hasYear = title.includes(year)

        if (hasMonth && hasDay && hasYear) score += 60
        else if (hasMonth && hasYear) score += 25
        else if (hasYear) score += 10
        else score -= 40
      }

      if (/reaction|breakdown|top 10|mix|trailer|preview|prediction/i.test(title)) score -= 50

      return { item: i, score, title }
    })

    scored.sort((a, b) => b.score - a.score)
    console.log("YT TOP 3:", scored.slice(0, 3).map(s => `[${s.score}] ${s.title}`))

    const best = scored[0]
    if (!best || best.score < 40) {
      console.log("YT: no confident match, skipping")
      return null
    }

    const videoId = best.item.id.videoId

    const { data: check } = await axios.get("https://www.googleapis.com/youtube/v3/videos", {
      params: { key: YT_KEY, id: videoId, part: "status" },
    })
    if (!check.items?.[0]?.status?.embeddable) {
      console.log("YT: best match not embeddable, trying runner-up")
      const second = scored[1]
      if (second && second.score >= 40) {
        const { data: check2 } = await axios.get("https://www.googleapis.com/youtube/v3/videos", {
          params: { key: YT_KEY, id: second.item.id.videoId, part: "status" },
        })
        if (check2.items?.[0]?.status?.embeddable) {
          await prisma.game.update({
            where: { id: game.id },
            data: { youtubeId: second.item.id.videoId },
          })
          return second.item.id.videoId
        }
      }
      return null
    }

    await prisma.game.update({
      where: { id: game.id },
      data: { youtubeId: videoId },
    })

    return videoId
  } catch (err) {
    console.error("YouTube search failed:", err.response?.data?.error?.message ?? err.message)
    return null
  }
}