"""
finishedGames.py: list NBA games that have finished in the last few days.

    python finishedGames.py [days] [types]

    days   how many days back to look (default 3)
    types  comma-separated game id prefixes to keep (default 002,004,005,006)
             001 preseason, 002 regular season, 004 playoffs,
             005 play-in, 006 NBA Cup final

One NBA request, however many days you ask for. Prints a JSON list, oldest first:
    [{"gameId": "0022600123", "date": "2026-11-03", "matchup": "LAL vs. BOS"}, ...]
"""
import json
import sys
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import nba_guard  # noqa: F401  throttle + proxy + block protection for every nba_api call
from nba_guard import NBABlockedError
from nba_api.stats.endpoints import leaguegamefinder

DEFAULT_TYPES = "002,004,005,006"


def finished_games(days, types):
    # The NBA schedules by US Eastern date.
    today = datetime.now(ZoneInfo("America/New_York")).date()
    start = today - timedelta(days=days)

    d = leaguegamefinder.LeagueGameFinder(
        league_id_nullable="00",
        date_from_nullable=start.strftime("%m/%d/%Y"),
        date_to_nullable=today.strftime("%m/%d/%Y"),
        timeout=60,
    ).get_dict()
    headers = d["resultSets"][0]["headers"]
    rows = d["resultSets"][0]["rowSet"]
    idx = {h: i for i, h in enumerate(headers)}

    seen, games = set(), []
    for row in rows:  # each game appears twice (once per team)
        gid = row[idx["GAME_ID"]]
        if gid in seen or gid[:3] not in types:
            continue
        if not row[idx["WL"]]:  # no result yet: still being played
            continue
        seen.add(gid)
        games.append({
            "gameId": gid,
            "date": row[idx["GAME_DATE"]],
            "matchup": row[idx["MATCHUP"]],
        })

    games.sort(key=lambda g: (g["date"] or "", g["gameId"]))
    return games


def main():
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    types = set((sys.argv[2] if len(sys.argv) > 2 else DEFAULT_TYPES).split(","))

    for attempt in range(2):
        try:
            return finished_games(days, types)
        except NBABlockedError as e:
            return {"error": str(e), "blocked": True}
        except Exception as e:  # noqa: BLE001
            print(f"finished games attempt {attempt + 1} failed: {e}", file=sys.stderr)
            time.sleep(3)
    return {"error": "finished games fetch failed"}


if __name__ == "__main__":
    print(json.dumps(main()))