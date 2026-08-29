# Watchlist Feature

A personal backlog of games a user wants to watch. Users mark a game from its detail page, and their saved games appear on a dedicated Watchlist page reached from the navbar user dropdown. The watchlist is private — always the signed-in user's own — and holds each game at most once.

## Overview

- **Route (client):** `/watchlist`
- **Routes (API):** mounted at `/api/watchlist` (all require auth)
- **Page component:** `Watchlist.jsx`
- **Mark button:** in the Rate panel on `GameDetail.jsx`
- **Backing model:** new `WatchlistItem`
- **Entry point:** navbar user dropdown (`NavUserMenu`) → "Watchlist"

## Data model

New model in `schema.prisma`:

```prisma
model WatchlistItem {
  id        String   @id @default(uuid())
  userId    String
  gameId    String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  game Game @relation(fields: [gameId], references: [id])

  @@unique([userId, gameId])   // a game is on the list once, or not at all
  @@index([userId])
}
```

Back-relations:

```prisma
// on User
watchlist       WatchlistItem[]

// on Game
watchlistedBy   WatchlistItem[]
```

The `@@unique([userId, gameId])` is what makes add/remove idempotent and guarantees a game can't be double-saved.

### Migration

Run inside the Docker container so it uses the app's DB credentials and network hostname (running from the host hits `localhost:5433` with a credential mismatch → `P1000`):

```bash
docker compose exec web npx prisma migrate dev --name watchlist
```

`migrate dev` regenerates the Prisma client automatically, so `prisma.watchlistItem` is available afterward. Other Prisma commands should use the same prefix (e.g. `docker compose exec web npx prisma studio`).

## API

All routes require authentication (`authenticate` middleware) — a watchlist is inherently personal. Mounted with `app.use("/api/watchlist", watchlistRoutes)`.

| Method + path                      | Purpose                                   | Returns                       |
| ---------------------------------- | ----------------------------------------- | ----------------------------- |
| `GET /api/watchlist`               | The user's watchlist, newest saved first  | `{ items: [...] }`            |
| `GET /api/watchlist/:gameId/status`| Is this game on the user's watchlist?     | `{ watchlisted: boolean }`    |
| `POST /api/watchlist/:gameId`      | Add (idempotent via upsert)               | `{ watchlisted: true }`       |
| `DELETE /api/watchlist/:gameId`    | Remove (idempotent via deleteMany)        | `{ watchlisted: false }`      |

**List item shape** (`GET /api/watchlist`): each item is `{ id, userId, gameId, createdAt, game }`, where `game` includes `homeTeam` and `awayTeam` (id, name, abbreviation) plus the game's scalar fields (including `date`).

### Design notes

- **Idempotent add/remove.** `POST` uses `upsert` and `DELETE` uses `deleteMany`, so a double-tap or a remove of an absent row never 500s on the unique constraint or a missing record. The toggle stays safe regardless of client state drift.
- **Status is its own endpoint**, not baked into the game payload. This keeps `GET /games/:id` auth-optional and shared-cacheable; the per-user watchlist state is fetched separately by `GameDetail`. Trade-off: one extra request per game load.
- **Private, not per-profile.** Unlike the diary (`/user/:username/diary`, public), the watchlist has no username in the path — it's always the signed-in user's. To expose other users' watchlists later, add a public `GET /api/users/:username/watchlist` and a profile section.

## Frontend

### Mark button — `GameDetail.jsx`

Lives in the Rate panel, under "Review / Log". Backed by a small status query and a toggle mutation kept separate from the `["game", id]` cache:

- `useQuery(["watchlist", "status", id])` → drives the button's on/off state, correct on load.
- `useMutation` toggles: `DELETE` when on the list, `POST` when not. On success it `setQueryData` on the status key (immediate reflection) and invalidates `["watchlist", "me"]` (so the list page refreshes).
- Gated on `isAuthed` — an unauthenticated tap opens the `AuthModal` instead of erroring, matching the rating control.

Button label/state:
- On list → filled bookmark, "On your watchlist", gold-outlined.
- Not on list → outline bookmark, "Add to watchlist".

### Watchlist page — `Watchlist.jsx` (`/watchlist`)

- Fetches `["watchlist", "me"]` from `GET /api/watchlist`, enabled only when authed.
- Renders game cards in the same grid as favorites (2 / 3 / 5 columns), newest saved first, each linking to the game and showing a remove (×) control.
- **Optimistic remove:** the card disappears immediately (`onMutate` filters the cached list and flips the game's status key), rolls back on error, and reconciles on settle.
- States: loading skeleton, error with retry, empty ("Open a game and tap Add to watchlist"), and a signed-out prompt to sign in.
- Cards are rating-free by design — a watchlist is games not yet watched. `game.date` shows the played date.

### Client route

```jsx
<Route path="/watchlist" element={<Watchlist />} />
```

### Navbar

In `NavUserMenu`, a "Watchlist" link sits between Profile and Diary. It's a fixed path (not username-scoped — always your own), so a plain `<NavLink to="/watchlist">`. The mobile menu lists it alongside Profile and Diary in the account section.

## Wiring checklist

In dependency order:

1. Add `WatchlistItem` + the two back-relations to `schema.prisma`; migrate (see above).
2. Add `watchlistController.js` and `routes/watchlist.js`; mount with `app.use("/api/watchlist", watchlistRoutes)`.
3. Add the status query + toggle mutation and the button to `GameDetail`'s Rate panel (imports: `BookmarkRoundedIcon`, `BookmarkBorderRoundedIcon`).
4. Register the `/watchlist` client route and add `Watchlist.jsx`.
5. Add the dropdown + mobile links.

Restart the server after mounting the router. The most common first snag is a `404` on `POST /api/watchlist/:gameId` — that means the router isn't mounted yet.

## Known follow-ups

- **Shared rating primitives.** `TeamMark`, `gameLabel`, `shortDate` are now duplicated across `Profile.jsx`, `Diary.jsx`, and `Watchlist.jsx` — three surfaces, the point where extracting into a shared `utils/ratings.js` + `components/Ratings.jsx` starts to pay off.
- **Public watchlists.** Currently private only. Add a `GET /api/users/:username/watchlist` endpoint and a profile section if others' backlogs should be visible.
- **Watched → auto-remove.** Optionally remove a game from the watchlist when the user logs/reviews it, mirroring how Letterboxd drops a film from the watchlist once it's in the diary.
- **Pagination.** The list endpoint returns everything; add `page`/`limit` like `getUserReviews` if watchlists grow large.