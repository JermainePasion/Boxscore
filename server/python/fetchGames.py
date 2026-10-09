import os
from datetime import datetime
from zoneinfo import ZoneInfo

import requests

import nba_guard  # noqa: F401  throttle + proxy + block protection for every nba_api call
from nba_guard import NBABlockedError
from nba_api.stats.endpoints import scoreboardv2

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:5000") + "/api/games/import"


def get_today_games():
    # The NBA schedules by US Eastern date; the server's own clock is UTC.
    today = datetime.now(ZoneInfo("America/New_York")).strftime("%m/%d/%Y")
    data = scoreboardv2.ScoreboardV2(game_date=today, timeout=60).get_dict()

    games = []
    try:
        for game in data["resultSets"][0]["rowSet"]:
            games.append({
                "gameId": game[2],
                "date": game[0],
                "homeTeamId": game[6],
                "awayTeamId": game[7],
            })
    except (KeyError, IndexError):
        print("No games today")
    return games


def main():
    try:
        games = get_today_games()
    except NBABlockedError as e:
        print(f"Skipped: {e}")
        return

    if not games:
        print("No games to send")
        return

    print(f"Sending {len(games)} games to backend...")
    requests.post(BACKEND_URL, json=games, timeout=30)
    print("Done")


if __name__ == "__main__":
    main()