import sys
import json

# Curated list of famous/iconic NBA games
# gameId format: 004 = playoffs, next 2 digits = season year, rest = series/game
SUGGESTED_GAMES = [
    {
        "gameId": "0041500407",
        "title": "2016 Finals Game 7 — The Block, The Shot",
        "description": "Cavs complete the 3-1 comeback. LeBron's chasedown block, Kyrie's dagger three.",
    },
    {
        "gameId": "0040900407",
        "title": "2010 Finals Game 7 — Lakers vs Celtics",
        "description": "Kobe's 5th ring. Lakers rally from 13 down against their greatest rivals.",
    },
    {
        "gameId": "0041200734",
        "title": "2013 Finals Game 6 — Ray Allen's Shot",
        "description": "Headband off, no timeouts. Ray Allen's corner three saves the Heat's season.",
    },
    {
        "gameId": "0029600063",
        "title": "Jordan's 55-point return at MSG (1995)",
        "description": "The 'double-nickel' game. MJ's statement after returning from baseball.",
    },
    {
        "gameId": "0021500660",
        "title": "Kobe's Final Game — 60 Points (2016)",
        "description": "Mamba Out. 60 points on 50 shots in his farewell at Staples Center.",
    },
    {
        "gameId": "0020500768",
        "title": "Kobe's 81-Point Game (2006)",
        "description": "Second-highest scoring game in NBA history vs the Raptors.",
    },
    {
        "gameId": "0041800406",
        "title": "2019 Finals Game 6 — Raptors win it all",
        "description": "Kawhi and the Raptors close out the dynasty Warriors at Oracle.",
    },
    {
        "gameId": "0042100407",
        "title": "2022 Finals Game 6 — Curry's 4th ring",
        "description": "Steph seals Finals MVP with 34 in Boston.",
    },
    {
        "gameId": "0041900406",
        "title": "2020 Finals Game 6 — Lakers title in the Bubble",
        "description": "LeBron's 4th ring with a 3rd franchise, for Kobe.",
    },
    {
        "gameId": "0022200063",
        "title": "Warriors 73-win record breaker (2016)",
        "description": "Golden State passes the 95-96 Bulls with win #73.",
    },
]

if __name__ == "__main__":
    print(json.dumps(SUGGESTED_GAMES))