import json
import sys
import unicodedata
from nba_api.stats.static import players

LEGENDS = [
    "Michael Jordan", "LeBron James", "Kareem Abdul-Jabbar", "Magic Johnson",
    "Bill Russell", "Wilt Chamberlain", "Larry Bird", "Tim Duncan",
    "Kobe Bryant", "Shaquille O'Neal", "Stephen Curry", "Hakeem Olajuwon",
    "Oscar Robertson", "Jerry West", "Kevin Durant", "Moses Malone",
    "Giannis Antetokounmpo", "Nikola Jokic", "Dirk Nowitzki", "Julius Erving",
    "Karl Malone", "Charles Barkley", "David Robinson", "Kevin Garnett",
    "Scottie Pippen", "Dwyane Wade", "Allen Iverson", "John Stockton",
    "Isiah Thomas", "Steve Nash", "Elgin Baylor", "Rick Barry",
    "Patrick Ewing", "Clyde Drexler", "Jason Kidd", "Ray Allen",
    "Chris Paul", "Russell Westbrook", "James Harden", "Anthony Davis",
    "Damian Lillard", "Kawhi Leonard", "Joel Embiid", "Luka Doncic",
    "Jayson Tatum", "Victor Wembanyama", "Shai Gilgeous-Alexander",
]


def normalize(s):
    return unicodedata.normalize("NFKD", s.lower()).encode("ascii", "ignore").decode()


def build():
    all_players = players.get_players()
    by_name = {normalize(p["full_name"]): p for p in all_players}

    out = []
    for name in LEGENDS:
        p = by_name.get(normalize(name))
        if p:
            out.append({
                "id": p["id"],
                "name": p["full_name"],
                "isActive": p["is_active"],
            })
    return out


if __name__ == "__main__":
    try:
        print(json.dumps(build()))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)