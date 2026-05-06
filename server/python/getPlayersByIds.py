import sys
import json
from nba_api.stats.static import players

def get_by_ids(ids):
    all_players = players.get_players()
    id_set = set(ids)

    results = []
    for p in all_players:
        if p["id"] in id_set:
            results.append({
                "id": p["id"],
                "name": p["full_name"],
                "isActive": p["is_active"],
                "headshotUrl": f"https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/260x190/{p['id']}.png"
            })

    print(json.dumps(results))

if __name__ == "__main__":
    ids = [int(i) for i in sys.argv[1:]]
    get_by_ids(ids)