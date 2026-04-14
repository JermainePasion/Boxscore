from nba_api.stats.endpoints import leaguegamefinder
import json
import sys
from teamMap import TEAM_MAP

def search_games(query):
    gamefinder = leaguegamefinder.LeagueGameFinder(league_id_nullable='00')
    data = gamefinder.get_dict()

    rows = data['resultSets'][0]['rowSet']
    headers = data['resultSets'][0]['headers']

    results = []

    for row in rows:
        game = dict(zip(headers, row))

        matchup = game["MATCHUP"] 

        teams = matchup.replace("vs", "@").split("@")
        teams = [t.strip() for t in teams]

        for team in teams:
            if (
                query.lower() in team.lower() or
                any(query.lower() in name for name in TEAM_MAP.get(team, []))
            ):
                results.append({
                    "gameId": game["GAME_ID"],
                    "date": game["GAME_DATE"],
                    "matchup": matchup
                })
                break
        if len(results) >= 20:
            break

    return results


if __name__ == "__main__":
    query = sys.argv[1]

    games = search_games(query)

    print(json.dumps(games))