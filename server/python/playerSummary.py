
import sys
import os
import json

_HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(_HERE, "champions.json"), encoding="utf-8") as _f:
    CHAMPIONS = json.load(_f)

OVERRIDE_RINGS = {}


def count_rings(player_id, seasons):
    """Rings = distinct seasons where the player's team won the title."""
    if int(player_id) in OVERRIDE_RINGS:
        return OVERRIDE_RINGS[int(player_id)]
    won = {
        r.get("SEASON_ID")
        for r in seasons
        if CHAMPIONS.get(r.get("SEASON_ID")) == r.get("TEAM_ABBREVIATION")
    }
    return len(won)


def per_game(row):
    gp = row.get("GP") or 0
    if not gp:
        return {k: None for k in ("pts", "reb", "ast", "stl", "blk")}
    return {
        "pts": round(row["PTS"] / gp, 1),
        "reb": round(row["REB"] / gp, 1),
        "ast": round(row["AST"] / gp, 1),
        "stl": round(row["STL"] / gp, 1),
        "blk": round(row["BLK"] / gp, 1),
    }


def season_label(start_year):
    y = int(start_year)
    return f"{y}-{str(y + 1)[-2:]}"  


def main():
    if len(sys.argv) < 2 or not sys.argv[1].isdigit():
        print(json.dumps({"error": "player_id required"}))
        return

    player_id = sys.argv[1]
    season_start = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2].isdigit() else None

    try:
        from nba_api.stats.endpoints import playercareerstats, playerawards
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"error": f"nba_api import failed: {e}"}))
        return

    try:
        career = playercareerstats.PlayerCareerStats(
            player_id=player_id
        ).get_normalized_dict()
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"error": f"stats fetch failed: {e}"}))
        return

    seasons = career.get("SeasonTotalsRegularSeason", [])
    career_rows = career.get("CareerTotalsRegularSeason", [])
    career_row = career_rows[0] if career_rows else None

    if not seasons and not career_row:
        print(json.dumps({"error": "no stats"}))
        return

    # best single-season 3P% (API gives FG3_PCT as 0..1)
    best3 = max((r.get("FG3_PCT") or 0.0) for r in seasons) if seasons else 0.0

    # pick requested season, else fall back to career totals
    chosen, label = None, None
    if season_start:
        want = season_label(season_start)
        chosen = next((r for r in seasons if r.get("SEASON_ID") == want), None)
        if chosen:
            label = want

    source = "season" if chosen else "career"
    stat_row = chosen or career_row or {}

    # MVPs from PlayerAwards; championships derived from CHAMPIONS (see count_rings)
    mvp = 0
    try:
        awards = playerawards.PlayerAwards(
            player_id=player_id
        ).get_normalized_dict().get("PlayerAwards", [])
        mvp = sum(
            1 for a in awards
            if a.get("DESCRIPTION") == "NBA Most Valuable Player"
        )
    except Exception:  # noqa: BLE001
        mvp = 0

    print(json.dumps({
        "statsSource": source,
        "seasonLabel": label,
        "perGame": per_game(stat_row),
        "bestThreePct": round(best3 * 100, 1),
        "accolades": {"mvp": mvp, "championships": count_rings(player_id, seasons)},
    }))


if __name__ == "__main__":
    main()