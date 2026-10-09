import json
import sys
import time

import nba_guard  # noqa: F401  throttle + proxy + block protection for every nba_api call
from nba_guard import NBABlockedError
from nba_api.stats.endpoints import boxscoretraditionalv3, boxscoresummaryv3


def with_retry(fn, label, attempts=2):
    """Retry ordinary failures; give up immediately if the NBA is blocking us."""
    for attempt in range(attempts):
        try:
            return fn()
        except NBABlockedError:
            raise
        except Exception as e:  # noqa: BLE001
            print(f"{label} attempt {attempt + 1} failed: {e}", file=sys.stderr)
            if attempt + 1 < attempts:
                time.sleep(2)
    return None


def get_game_date(game_id):
    def fetch():
        box = boxscoresummaryv3.BoxScoreSummaryV3(game_id=game_id, timeout=60).get_dict()
        summary = box.get("boxScoreSummary", {})
        return summary.get("gameEt") or summary.get("gameTimeUTC") or None

    return with_retry(fetch, "date fetch")


def get_game_data(game_id):
    boxscore = with_retry(
        lambda: boxscoretraditionalv3.BoxScoreTraditionalV3(game_id=game_id, timeout=60),
        "boxscore",
    )
    if boxscore is None:
        return {"gameId": game_id, "available": False, "reason": "boxscore fetch failed"}

    box = boxscore.get_dict().get("boxScoreTraditional")
    if not box:
        return {"gameId": game_id, "available": False, "reason": "No boxScoreTraditional data"}

    home_team = box.get("homeTeam", {})
    away_team = box.get("awayTeam", {})
    home_team_id = box.get("homeTeamId")
    away_team_id = box.get("awayTeamId")

    def extract_players(team, team_id):
        team_players = []
        for player in team.get("players", []):
            stats = player.get("statistics", {})
            team_players.append({
                "playerId": player.get("personId"),
                "name": f"{player.get('firstName', '')} {player.get('familyName', '')}".strip(),
                "teamId": team_id,
                "points": stats.get("points", 0),
                "rebounds": stats.get("reboundsTotal", 0),
                "assists": stats.get("assists", 0),
                "steals": stats.get("steals", 0),
                "blocks": stats.get("blocks", 0),
                "minutes": stats.get("minutes") or None,
            })
        return team_players

    players = extract_players(home_team, home_team_id) + extract_players(away_team, away_team_id)

    return {
        "gameId": game_id,
        "available": True,
        "date": get_game_date(game_id),
        "homeTeam": {
            "id": home_team_id,
            "name": home_team.get("teamName"),
            "city": home_team.get("teamCity"),
            "tricode": home_team.get("teamTricode"),
        },
        "awayTeam": {
            "id": away_team_id,
            "name": away_team.get("teamName"),
            "city": away_team.get("teamCity"),
            "tricode": away_team.get("teamTricode"),
        },
        "playerCount": len(players),
        "stats": players,
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Game ID required"}))
        sys.exit(1)

    game_id = sys.argv[1]

    try:
        print(json.dumps(get_game_data(game_id)))
    except NBABlockedError as e:
        print(json.dumps({"gameId": game_id, "available": False, "error": str(e), "blocked": True}))
        sys.exit(1)
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"gameId": game_id, "available": False, "error": str(e)}))
        sys.exit(1)