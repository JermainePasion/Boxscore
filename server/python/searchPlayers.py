import sys
import json
from nba_api.stats.static import players

def search_players(query):
    q = query.lower()
    
    all_players = players.get_players()
    
    results = []
    for p in all_players:
        full_name = p["full_name"]
        if q in full_name.lower():
            player_id = p["id"]
            results.append({
                "id": player_id,
                "name": full_name,
                "isActive": p["is_active"],
                "headshotUrl": f"https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/260x190/{player_id}.png"
            })
            if len(results) >= 15:
                break

    print(json.dumps(results))

if __name__ == "__main__":
    query = sys.argv[1] if len(sys.argv) > 1 else ""
    search_players(query)