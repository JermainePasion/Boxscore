from nba_api.stats.endpoints import leaguegamefinder
import json
import sys
import time


def get_career_teams(player_id):
    for attempt in range(2):
        try:
            gf = leaguegamefinder.LeagueGameFinder(
                player_id_nullable=player_id,
                player_or_team_abbreviation="P",
                league_id_nullable="00",
                timeout=75,
            )
            d = gf.get_dict()
            headers = d["resultSets"][0]["headers"]
            rows = d["resultSets"][0]["rowSet"]
            idx = {h: i for i, h in enumerate(headers)}

            seen = set()
            out = []
            for r in rows:
                team_id = r[idx["TEAM_ID"]]
                abbr = r[idx["TEAM_ABBREVIATION"]]
                date = r[idx["GAME_DATE"]]          # "2016-06-19"
                if not team_id or not (1610612737 <= team_id <= 1610612766):
                    continue
                y, m = int(date[:4]), int(date[5:7])
                season = y if m >= 10 else y - 1     # Oct+ starts the new season
                key = (team_id, season)
                if key in seen:
                    continue
                seen.add(key)
                out.append({"teamId": team_id, "season": str(season), "abbr": abbr})
            return out
        except Exception as e:
            print(f"career teams attempt {attempt+1} failed: {e}", file=sys.stderr)
            time.sleep(1)
    return {"error": "career fetch failed"}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Player ID required"}))
        sys.exit(1)
    print(json.dumps(get_career_teams(sys.argv[1])))