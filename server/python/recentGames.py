import json
import sys
import time
from datetime import datetime
from zoneinfo import ZoneInfo

import nba_guard  # noqa: F401  throttle + proxy + block protection for every nba_api call
from nba_guard import NBABlockedError
from nba_api.stats.endpoints import leaguegamefinder


def season_string(d):
    """NBA season containing date d, e.g. 2026-11-03 -> '2026-27', 2026-05-10 -> '2025-26'."""
    start = d.year if d.month >= 10 else d.year - 1
    return f"{start}-{str(start + 1)[-2:]}"


def games_in_season(season):
    """One request: every game of one season, newest first, one entry per game."""
    d = leaguegamefinder.LeagueGameFinder(
        league_id_nullable="00",
        season_nullable=season,
        timeout=60,
    ).get_dict()
    headers = d["resultSets"][0]["headers"]
    rows = d["resultSets"][0]["rowSet"]
    idx = {h: i for i, h in enumerate(headers)}

    rows.sort(key=lambda r: r[idx["GAME_DATE"]] or "", reverse=True)

    seen, games = set(), []
    for row in rows:  # each game appears twice (once per team)
        gid = row[idx["GAME_ID"]]
        if gid in seen:
            continue
        seen.add(gid)
        games.append({
            "gameId": gid,
            "date": row[idx["GAME_DATE"]],
            "matchup": row[idx["MATCHUP"]],
        })
    return games


def get_recent_games(limit=10):
    # Use the US Eastern date, since that's the date the NBA schedules by.
    today = datetime.now(ZoneInfo("America/New_York")).date()
    season = season_string(today)
    prev_start = int(season[:4]) - 1
    previous = f"{prev_start}-{str(prev_start + 1)[-2:]}"

    for attempt in range(2):
        try:
            # Filtering by season keeps the response small. Early in a season there
            # may be fewer than `limit` games, so top up from last season.
            games = games_in_season(season)
            if len(games) < limit:
                games += games_in_season(previous)
            return games[:limit]
        except NBABlockedError as e:
            return {"error": str(e), "blocked": True}
        except Exception as e:  # noqa: BLE001
            print(f"recent games attempt {attempt + 1} failed: {e}", file=sys.stderr)
            time.sleep(2)
    return {"error": "recent games fetch failed"}


if __name__ == "__main__":
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    print(json.dumps(get_recent_games(limit)))