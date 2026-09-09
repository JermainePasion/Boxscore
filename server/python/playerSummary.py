"""
python/playerSummary.py

Usage:  python playerSummary.py <playerId> [seasonStartYear]
        python playerSummary.py 201939 2015
        python playerSummary.py 201939            # -> career

Prints ONE JSON object to stdout (matching your other scripts' contract):

    {
      "statsSource": "season" | "career",
      "seasonLabel": "2015-16" | null,
      "perGame": {"pts":30.1,"reb":5.4,"ast":6.7,"stl":2.1,"blk":0.2},
      "bestThreePct": 45.4,              # career-high single-season 3P%, 0-100
      "accolades": {"mvp": 2, "championships": 4}
    }

  or  {"error": "..."} on failure, which the controller turns into a 500.

The controller adds playerId / name (from Prisma) / imageUrl, so they're not
here. requires: pip install nba_api

------------------------------------------------------------------
Two fields aren't clean from nba_api (same caveats as before):
  - CHAMPIONSHIPS: not in the stats API. Read from the curated RINGS map
    below (ring counts are fixed history, so a hand-kept map is fine).
    If you'd rather store them, add a column to Player and read it in the
    controller instead.
  - FULL-BODY PHOTO: no public NBA source, so the controller returns
    imageUrl=null and the card falls back to your season headshot.
------------------------------------------------------------------
"""

import sys
import json

# NBA player id -> championships won. Extend as your pyramids need.
RINGS = {
    201939: 4,   # Stephen Curry
    2544: 4,     # LeBron James
    977: 5,      # Kobe Bryant
    893: 6,      # Michael Jordan
    # ...
}


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
    return f"{y}-{str(y + 1)[-2:]}"   # 2015 -> "2015-16"


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

    # MVPs from PlayerAwards; championships from the curated map
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
        "accolades": {"mvp": mvp, "championships": RINGS.get(int(player_id), 0)},
    }))


if __name__ == "__main__":
    main()