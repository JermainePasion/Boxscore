from nba_api.stats.endpoints import leaguegamefinder
import json
import sys
import time


def get_recent_games(limit=10):
    for attempt in range(2):
        try:
            gf = leaguegamefinder.LeagueGameFinder(
                league_id_nullable="00",
                timeout=60,
            )
            d = gf.get_dict()
            headers = d["resultSets"][0]["headers"]
            rows = d["resultSets"][0]["rowSet"]
            idx = {h: i for i, h in enumerate(headers)}

            seen = set()
            results = []
            for row in rows:  # already sorted newest first
                gid = row[idx["GAME_ID"]]
                if gid in seen:
                    continue
                seen.add(gid)
                results.append({
                    "gameId": gid,
                    "date": row[idx["GAME_DATE"]],
                    "matchup": row[idx["MATCHUP"]],
                })
                if len(results) >= limit:
                    break
            return results
        except Exception as e:
            print(f"recent games attempt {attempt+1} failed: {e}", file=sys.stderr)
            time.sleep(1)
    return {"error": "recent games fetch failed"}


if __name__ == "__main__":
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    print(json.dumps(get_recent_games(limit)))