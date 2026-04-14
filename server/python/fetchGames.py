import requests
import time
from datetime import datetime
from nba_api.stats.endpoints import scoreboardv2

BACKEND_URL = "http://localhost:5000/api/games/import"


def get_today_games():
    today = datetime.today().strftime('%m/%d/%Y')

    scoreboard = scoreboardv2.ScoreboardV2(game_date=today)
    data = scoreboard.get_dict()

    games = []

    try:
        rows = data['resultSets'][0]['rowSet']

        for game in rows:
            games.append({
                "gameId": game[2],
                "date": game[0],
                "homeTeamId": game[6],
                "awayTeamId": game[7]
            })

    except:
        print("⚠️ No games today")

    return games


def main():
    games = get_today_games()

    if not games:
        print("No games to send")
        return

    print("Sending games to backend...")

    requests.post(BACKEND_URL, json=games)

    print("Done")


if __name__ == "__main__":
    main()