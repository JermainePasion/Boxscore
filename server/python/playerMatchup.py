import sys
import json
import time
import nba_guard

STAT_KEYS = ("pts", "reb", "ast", "stl", "blk")


def num(v, d=0.0):
    try:
        return float(v) if v is not None else d
    except (TypeError, ValueError):
        return d


def game_score(r):
    """Hollinger Game Score from a LeagueGameFinder player row."""
    return (
        num(r.get("PTS"))
        + 0.4 * num(r.get("FGM"))
        - 0.7 * num(r.get("FGA"))
        - 0.4 * (num(r.get("FTA")) - num(r.get("FTM")))
        + 0.7 * num(r.get("OREB"))
        + 0.3 * num(r.get("DREB"))
        + num(r.get("STL"))
        + 0.7 * num(r.get("AST"))
        + 0.7 * num(r.get("BLK"))
        - 0.4 * num(r.get("PF"))
        - num(r.get("TOV"))
    )


def season_label(season_id):
    # SEASON_ID looks like "22023" -> last 4 digits are the start year
    s = str(season_id or "")
    try:
        y = int(s[-4:])
        return f"{y}-{str(y + 1)[-2:]}"
    except ValueError:
        return s


def line(r):
    return {
        "teamId": r.get("TEAM_ID"),
        "teamAbbr": r.get("TEAM_ABBREVIATION"),
        "wl": r.get("WL"),
        "min": r.get("MIN"),
        "pts": num(r.get("PTS")),
        "reb": num(r.get("REB")),
        "ast": num(r.get("AST")),
        "stl": num(r.get("STL")),
        "blk": num(r.get("BLK")),
        "fgPct": r.get("FG_PCT"),
        "fg3Pct": r.get("FG3_PCT"),
        "plusMinus": r.get("PLUS_MINUS"),
        "gameScore": round(game_score(r), 1),
    }


def fetch_games(pid, lgf):
    """All of a player's games keyed by GAME_ID, tagged with season type."""
    out, name = {}, None
    for stype in ("Regular Season", "Playoffs"):
        rows = (
            lgf.LeagueGameFinder(
                player_or_team_abbreviation="P",
                player_id_nullable=pid,
                league_id_nullable="00",       # NBA only (no G League / WNBA rows)
                season_type_nullable=stype,
                timeout=60,
            )
            .get_normalized_dict()
            .get("LeagueGameFinderResults", [])
        )
        for r in rows:
            r["_seasonType"] = "playoffs" if stype == "Playoffs" else "regular"
            out[r.get("GAME_ID")] = r
            name = name or r.get("PLAYER_NAME")
        time.sleep(0.6)  # be polite to stats.nba.com
    return out, name


def main():
    if len(sys.argv) < 3 or not sys.argv[1].isdigit() or not sys.argv[2].isdigit():
        print(json.dumps({"error": "two player ids required"}))
        return
    a_id, b_id = sys.argv[1], sys.argv[2]
    if a_id == b_id:
        print(json.dumps({"error": "pick two different players"}))
        return

    try:
        from nba_api.stats.endpoints import leaguegamefinder as lgf
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"error": f"nba_api import failed: {e}"}))
        return

    try:
        a_games, a_name = fetch_games(a_id, lgf)
        b_games, b_name = fetch_games(b_id, lgf)
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"error": f"game finder failed: {e}"}))
        return

    games = []
    for gid in set(a_games) & set(b_games):
        ra, rb = a_games[gid], b_games[gid]
        if ra.get("TEAM_ID") == rb.get("TEAM_ID"):
            continue  # teammates that night, not a matchup
        la, lb = line(ra), line(rb)
        if la["gameScore"] > lb["gameScore"]:
            verdict = "a"
        elif lb["gameScore"] > la["gameScore"]:
            verdict = "b"
        else:
            verdict = "tie"
        games.append({
            "gameId": gid,
            "date": ra.get("GAME_DATE"),
            "seasonLabel": season_label(ra.get("SEASON_ID")),
            "seasonType": ra["_seasonType"],
            "home": "a" if "vs." in (ra.get("MATCHUP") or "") else "b",
            "verdict": verdict,
            "a": la,
            "b": lb,
        })

    games.sort(key=lambda g: g["date"] or "", reverse=True)

    def avg(side):
        n = len(games)
        return {
            k: (round(sum(g[side][k] for g in games) / n, 1) if n else None)
            for k in STAT_KEYS
        }

    print(json.dumps({
        "meetings": len(games),
        "regular": sum(1 for g in games if g["seasonType"] == "regular"),
        "playoffs": sum(1 for g in games if g["seasonType"] == "playoffs"),
        "firstMeeting": games[-1]["date"] if games else None,
        "lastMeeting": games[0]["date"] if games else None,
        "record": {
            "aWins": sum(1 for g in games if g["a"]["wl"] == "W"),
            "bWins": sum(1 for g in games if g["b"]["wl"] == "W"),
        },
        "duels": {
            "a": sum(1 for g in games if g["verdict"] == "a"),
            "b": sum(1 for g in games if g["verdict"] == "b"),
            "tie": sum(1 for g in games if g["verdict"] == "tie"),
        },
        "averages": {"a": avg("a"), "b": avg("b")},
        "names": {"a": a_name, "b": b_name},
        "games": games,
    }))


if __name__ == "__main__":
    main()