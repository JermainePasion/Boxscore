import fetch from "node-fetch"

export const getGames = async (req, res) => {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000) // 5s timeout

    const response = await fetch(
      "https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json",
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json"
        },
        signal: controller.signal
      }
    )

    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    const games = data.scoreboard.games.map((game) => ({
      gameId: game.gameId,
      date: game.gameEt,
      homeTeam: game.homeTeam.teamName,
      awayTeam: game.awayTeam.teamName,
      homeScore: game.homeTeam.score,
      awayScore: game.awayTeam.score,
      status: game.gameStatusText
    }))

    res.json({
      success: true,
      count: games.length,
      games
    })

  } catch (error) {
    console.error("ERROR:", error.message)

    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch games"
    })
  }
}