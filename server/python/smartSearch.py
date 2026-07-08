import sys
import json
import re
import unicodedata
from nba_api.stats.endpoints import leaguegamefinder
from nba_api.stats.static import players, teams

MONTHS = {m.lower(): i for i, m in enumerate(
    ["January","February","March","April","May","June",
     "July","August","September","October","November","December"], 1)}

STAT_WORDS = {
    "points": "PTS", "pts": "PTS", "pt": "PTS",
    "rebounds": "REB", "reb": "REB", "boards": "REB",
    "assists": "AST", "ast": "AST", "dimes": "AST",
}


def normalize(s):
    """Lowercase and strip accents: 'Dončić' → 'doncic'"""
    return unicodedata.normalize("NFKD", s.lower()).encode("ascii", "ignore").decode()


def parse_query(q):
    q_norm = normalize(q)
    tokens = q_norm.split()
    parsed = {"team_ids": [], "player": None, "month": None, "year": None,
              "stat": None, "stat_value": None}

    # find stat like "73 points"
    for i, t in enumerate(tokens):
        if t in STAT_WORDS and i > 0 and tokens[i-1].isdigit():
            parsed["stat"] = STAT_WORDS[t]
            parsed["stat_value"] = int(tokens[i-1])

    # months and years
    for t in tokens:
        if t in MONTHS:
            parsed["month"] = MONTHS[t]
        elif re.fullmatch(r"(19|20)\d{2}", t):
            parsed["year"] = int(t)

    # teams (match nickname, city, or abbreviation)
    for team in teams.get_teams():
        for name in [normalize(team["nickname"]), normalize(team["city"]), normalize(team["abbreviation"])]:
            if name in q_norm:
                parsed["team_ids"].append(team["id"])
                break

    # players: full-name substring → last-name token → first-name token
    best = None
    for p in players.get_players():
        full = normalize(p["full_name"])
        parts = full.split()
        if full in q_norm:
            best = p
            break
        last = parts[-1]
        first = parts[0]
        if len(last) > 3 and last in tokens:
            if best is None or (p["is_active"] and not best.get("is_active")):
                best = p
        elif len(first) > 3 and first in tokens:
            if best is None or (p["is_active"] and not best.get("is_active")):
                best = p
    parsed["player"] = best
    return parsed


def search(q):
    p = parse_query(q)
    results = []

    if p["player"] and p["stat"]:
        gf = leaguegamefinder.LeagueGameFinder(
            player_id_nullable=p["player"]["id"],
            player_or_team_abbreviation="P",
            league_id_nullable="00",
            timeout=60,
        )
        d = gf.get_dict()
        headers = d["resultSets"][0]["headers"]
        gid, date, mu = headers.index("GAME_ID"), headers.index("GAME_DATE"), headers.index("MATCHUP")
        stat_idx = headers.index(p["stat"])
        for row in d["resultSets"][0]["rowSet"]:
            if row[stat_idx] == p["stat_value"]:
                results.append({
                    "gameId": row[gid], "date": row[date], "matchup": row[mu],
                    "label": f'{p["player"]["full_name"]} — {row[stat_idx]} {p["stat"].lower()}',
                })
            if len(results) >= 20:
                break
        return results

    if p["team_ids"]:
        seasons = None
        if p["year"]:
            seasons = [f'{p["year"]-1}-{str(p["year"])[2:]}', f'{p["year"]}-{str(p["year"]+1)[2:]}']
        gf_kwargs = dict(team_id_nullable=p["team_ids"][0], league_id_nullable="00", timeout=60)
        rows_all = []
        for season in (seasons or [None]):
            if season:
                gf = leaguegamefinder.LeagueGameFinder(season_nullable=season, **gf_kwargs)
            else:
                gf = leaguegamefinder.LeagueGameFinder(**gf_kwargs)
            d = gf.get_dict()
            headers = d["resultSets"][0]["headers"]
            rows_all.extend((headers, row) for row in d["resultSets"][0]["rowSet"])

        seen = set()
        for headers, row in rows_all:
            gid, date, mu = headers.index("GAME_ID"), headers.index("GAME_DATE"), headers.index("MATCHUP")
            game_id = row[gid]
            if game_id in seen:
                continue
            row_date = row[date]
            y, m = int(row_date[:4]), int(row_date[5:7])
            if p["year"] and y != p["year"]:
                continue
            if p["month"] and m != p["month"]:
                continue
            if len(p["team_ids"]) > 1:
                other = [t for t in teams.get_teams() if t["id"] == p["team_ids"][1]][0]
                if other["abbreviation"] not in row[mu]:
                    continue
            seen.add(game_id)
            results.append({"gameId": game_id, "date": row_date, "matchup": row[mu], "label": row[mu]})
            if len(results) >= 20:
                break
        return results

    return results


if __name__ == "__main__":
    q = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        print(json.dumps(search(q)))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)