# BoxScore

A Letterboxd-style web app for NBA games. Log the games you watch, rate them, write reviews, and build your own G.O.A.T. pyramid.

Instead of cataloguing films, BoxScore catalogues basketball games — every game gets a page with a box score, game leaders, an interactive shot chart, highlights, and community reviews.

---

## Features

### Games

- **Game pages** with a highlight-thumbnail hero banner, real box score, and game metadata pulled live from the NBA's stats API
- **Four tabs per game** — Box Score, Game Leaders, Game Charts, and Reviews
- **Interactive shot chart** — every field-goal attempt plotted on a detailed NBA half-court diagram, filterable by quarter, player, and made/missed, with the home team's logo painted at center court
- **Automatic highlight matching** — each game is matched to its official YouTube highlight video by a scoring algorithm that weighs channel, title format, team order, and exact date agreement, and verifies embeddability before saving
- **Curated suggested games** — a hand-picked set of iconic games (Kobe's 81, MJ's double-nickel, the 2016 Finals Game 7) seeded with titles and descriptions
- **Latest & Discover** — the most recent NBA games, hydrated on demand, plus a random sample for browsing

### Reviews & Ratings

- **Half-step basketball ratings** — five basketballs, rated in halves (stored 1–10, displayed 0.5–5.0)
- **Quick rate** directly from the game page, or a full **review modal** with text, watch date, and a rewatch flag
- **Review feed per game** with likes, threaded comments, and sorting by recency, likes, or rating

### G.O.A.T. Pyramid

- **Five-tier pyramid** (2/3/4/5/6 slots) rendered on a stone-grey triangle
- **Drag-and-drop** placement with a tap-to-place fallback for touch devices; players can be dragged between tiers to move or swap
- **Era-specific headshots** — searching a player returns one card per season/team the NBA CDN actually has an image for, so LeBron can appear in a Cavs jersey on one pyramid and a Lakers jersey on another
- **Multiple named pyramids** per user (all-time, per-position, era-specific — whatever you want)
- **View / edit modes** — viewing shows only filled slots for a clean shareable pyramid

### Search

Natural-language game search that understands several query shapes:

| Query | Interpreted as |
| --- | --- |
| `lakers march 2026` | team + month + year |
| `celtics vs knicks 2025` | two teams + year |
| `luka 73 points` | player + stat threshold |

Accent-insensitive (Dončić → doncic), with first-name and last-name matching that prefers active players. Available as an autocomplete in the navbar (top 5 suggestions) and as a full results page.

---

## Tech Stack

**Frontend** — React (Vite), Tailwind CSS, MUI icons, TanStack Query, React Router
**Backend** — Node.js, Express, Prisma, PostgreSQL
**Data** — Python scripts using [`nba_api`](https://github.com/swar/nba_api), invoked from the Node layer
**Infra** — Docker Compose (web + postgres)

### Notable implementation details

**Image proxy.** NBA's CDN intermittently blocks browser-originated requests (ORB errors, referrer filtering, regional routing issues). All headshots and team logos are proxied through `/api/img/*`, fetched server-side with browser-like headers and cached in memory for 24 hours. The client never talks to NBA infrastructure directly, so CDN changes are a one-file fix.

**Layered caching.** NBA API responses are cached at three levels — an in-memory TTL cache on the server (5 min for searches, 24 h for shot charts, 7 days for headshot variants), persisted game data in Postgres, and TanStack Query on the client.

**Resilient fetching.** `stats.nba.com` fails transiently and often. Every Python entry point retries with generous timeouts and logs failures to stderr; game pages retry on the client with an honest "still fetching" state rather than a false "not found".

**Self-healing data.** Games missing a real date fall through the cached-response path and re-fetch on next view, so bad rows repair themselves as users browse.

---

## Project Structure

```
Boxscore/
├── docker-compose.yml
├── .env
├── server/
│   ├── index.js                  # entry point
│   ├── prisma/schema.prisma
│   ├── lib/
│   │   ├── prisma.js
│   │   ├── cache.js              # in-memory TTL cache
│   │   └── youtube.js            # highlight search + scoring
│   ├── python/                   # nba_api scripts
│   │   ├── fetchSingleGame.py
│   │   ├── smartSearch.py
│   │   ├── shotChart.py
│   │   ├── recentGames.py
│   │   ├── playerTeams.py
│   │   ├── suggestedPlayers.py
│   │   └── seedSuggestedGames.py
│   └── src/
│       ├── controllers/
│       ├── routes/
│       └── middleware/
└── client/
    └── src/
        ├── screens/              # Home, GameDetail, Games, Search, Pyramid
        ├── components/
        │   ├── GameDetail/       # BoxScore, GameLeaders, ShotChart, GameReviews
        │   ├── Pyramid/
        │   └── Search/
        ├── context/AuthContext.jsx
        ├── lib/api.js
        └── utils/teamColors.js
```

---

## Data Model

| Model | Purpose |
| --- | --- |
| `User` | Accounts, JWT auth |
| `Game` | NBA games with date, season, teams, highlight video |
| `Team` / `Player` | Reference data, populated on demand |
| `GameStat` | Per-player box score line for a game |
| `GameReview` | Rating (1–10), optional text, watch date, likes |
| `Comment` | Comments on reviews and pyramids |
| `ReviewLike` | Like join table |
| `GoatPyramid` | A named pyramid belonging to a user |
| `GoatPyramidPlayer` | A player's placement, tier, and chosen era headshot |
| `Follow` | User-to-user follows |

---

## Running Locally

### Full Docker

```bash
docker compose up -d
```

App at `http://localhost:5173`, API at `http://localhost:5000`, Postgres exposed on `5433`.

### Node locally, Postgres in Docker

```bash
docker compose up -d db
cd server && npm run dev
```

`server/.env` points at `localhost:5433` for this mode; Docker Compose injects `db:5432` for the container. Compose-provided environment variables take precedence, so both modes work from the same files.

### Environment

```env
DATABASE_URL="postgresql://postgres:<password>@db:5432/boxscore"
JWT_SECRET="<random string>"
YOUTUBE_API_KEY="<youtube data api v3 key>"
POSTGRES_PASSWORD="<password>"
PORT=5000
```

### Common tasks

```bash
docker compose restart web                                    # reload the server
docker compose exec web npx prisma migrate dev --name <name>  # schema change
docker compose exec db psql -U postgres -d boxscore           # database shell
docker compose exec web python python/<script>.py <args>      # run a data script
```

Python and JS edits are picked up through the volume mount — no rebuild needed.

---

## Roadmap

- User profiles with review history and pyramid galleries
- Follow system and an activity feed (backend built, frontend pending)
- Public pyramid pages with comments
- Lists — user-curated collections of games
- Nightly job to pre-hydrate recent games so first loads are always warm
- Deployment: environment-driven API base URL, rate limiting, tightened CORS

---

## Notes

NBA logos, headshots, and highlight thumbnails are served from public NBA and YouTube endpoints and are the property of their respective owners. BoxScore is a non-commercial fan project and is not affiliated with or endorsed by the NBA.
