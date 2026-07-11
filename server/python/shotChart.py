from nba_api.stats.endpoints import shotchartdetail
import json
import sys
import time


def get_shots(game_id):
    # derive season from game id: chars 3-5 = season start year's last two digits
    yy = int(game_id[3:5])
    season = f"20{yy:02d}-{(yy + 1) % 100:02d}"          # e.g. "2025-26"
    season_type = "Playoffs" if game_id.startswith("004") else "Regular Season"

    for attempt in range(2):
        try:
            sc = shotchartdetail.ShotChartDetail(
                team_id=0,
                player_id=0,
                context_measure_simple="FGA",
                game_id_nullable=game_id,
                season_nullable=season,
                season_type_all_star=season_type,
                timeout=75,
            )
            d = sc.get_dict()
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
        except Exception as e:
            print(f"shot chart attempt {attempt+1} failed: {e}", file=sys.stderr)
            time.sleep(1)
    return {"error": "shot chart fetch failed"}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Game ID required"}))
        sys.exit(1)
    print(json.dumps(get_shots(sys.argv[1])))