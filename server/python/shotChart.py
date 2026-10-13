"""
shotChart.py: every shot attempt in one game.

    python shotChart.py <gameId>

The NBA only returns a game's shots when asked with the right season type, and
that comes from the game id's first three digits:

    001 preseason   002 regular season   003 All-Star
    004 playoffs    005 play-in          006 NBA Cup final

If the first season type comes back empty, the next one in the list is tried
(only matters for the rarer game types).
"""
import json
import sys
import time

import nba_guard  # noqa: F401  throttle + proxy + block protection for every nba_api call
from nba_guard import NBABlockedError
from nba_api.stats.endpoints import shotchartdetail

SEASON_TYPES = {
    "001": ["Pre Season"],
    "002": ["Regular Season"],
    "003": ["All Star"],
    "004": ["Playoffs"],
    "005": ["PlayIn", "Playoffs"],
    "006": ["IST", "Regular Season"],
}


def season_for(game_id):
    """'0012600039' -> '2026-27' (characters 3-5 are the season's start year)."""
    yy = int(game_id[3:5])
    return f"20{yy:02d}-{(yy + 1) % 100:02d}"


def fetch(game_id, season, season_type):
    d = shotchartdetail.ShotChartDetail(
        team_id=0,
        player_id=0,
        context_measure_simple="FGA",
        game_id_nullable=game_id,
        season_nullable=season,
        season_type_all_star=season_type,
        timeout=75,
    ).get_dict()
    headers = d["resultSets"][0]["headers"]
    rows = d["resultSets"][0]["rowSet"]
    idx = {h: i for i, h in enumerate(headers)}
    return [{
        "playerId": r[idx["PLAYER_ID"]],
        "playerName": r[idx["PLAYER_NAME"]],
        "teamId": r[idx["TEAM_ID"]],
        "period": r[idx["PERIOD"]],
        "x": r[idx["LOC_X"]],
        "y": r[idx["LOC_Y"]],
        "made": r[idx["SHOT_MADE_FLAG"]] == 1,
    } for r in rows]


def get_shots(game_id):
    season = season_for(game_id)
    season_types = SEASON_TYPES.get(game_id[:3], ["Regular Season"])

    for season_type in season_types:
        for attempt in range(2):
            try:
                shots = fetch(game_id, season, season_type)
                if shots:
                    return shots
                break  # an empty answer is an answer: try the next season type
            except NBABlockedError as e:
                return {"error": str(e), "blocked": True}
            except Exception as e:  # noqa: BLE001
                print(f"shot chart ({season_type}) attempt {attempt + 1} failed: {e}", file=sys.stderr)
                if attempt == 0:
                    time.sleep(1)
                else:
                    return {"error": f"shot chart fetch failed: {e}"}
    return []  # the NBA has no shot data for this game


if __name__ == "__main__":
    if len(sys.argv) < 2 or not sys.argv[1].isdigit() or len(sys.argv[1]) != 10:
        print(json.dumps({"error": "A 10-digit game id is required"}))
        sys.exit(1)
    print(json.dumps(get_shots(sys.argv[1])))