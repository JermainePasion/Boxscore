from nba_api.stats.endpoints import boxscoretraditionalv3
import json
import sys

def get_game_data(game_id):
    boxscore = boxscoretraditionalv3.BoxScoreTraditionalV3(game_id=game_id)
    data = boxscore.get_dict()

    box = data.get("boxScoreTraditional")

    if not box:
        return {
            "gameId": game_id,
            "available": False,
            "reason": "No boxScoreTraditional data"
        }

    home_team = box.get("homeTeam", {})
    away_team = box.get("awayTeam", {})

    home_team_id = box.get("homeTeamId")
    away_team_id = box.get("awayTeamId")

    players = []

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

                "minutes": stats.get("minutes") or None
            })

        return team_players

    players.extend(extract_players(home_team, home_team_id))
    players.extend(extract_players(away_team, away_team_id))

    return {
        "gameId": game_id,
        "available": True,

        "homeTeam": {
            "id": home_team_id,
            "name": home_team.get("teamName"),
            "city": home_team.get("teamCity"),
            "tricode": home_team.get("teamTricode")
        },

        "awayTeam": {
            "id": away_team_id,
            "name": away_team.get("teamName"),
            "city": away_team.get("teamCity"),
            "tricode": away_team.get("teamTricode")
        },

        "playerCount": len(players),
        "stats": players
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({ "error": "Game ID required" }))
        exit(1)

    game_id = sys.argv[1]

    try:
        result = get_game_data(game_id)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({
            "gameId": game_id,
            "available": False,
            "error": str(e)
        }))
        exit(1)