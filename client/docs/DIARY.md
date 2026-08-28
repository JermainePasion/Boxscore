# Diary Feature

A Letterboxd-style diary for BoxScore. It shows a user's history of logged games, ordered by the date each game was watched and grouped by month. Each entry shows the game (matchup + played date) and the user's rating only — review text is deliberately excluded, both in the UI and at the data layer.

## Overview

The diary reuses existing `GameReview` records. A review becomes a diary entry when it has a `watchedAt` date; ratings logged without a watched date are treated as reviews, not diary entries, and do not appear here.

- **Route (client):** `/user/:username/diary`
- **Route (API):** `GET /api/users/:username/diary`
- **Page component:** `Diary.jsx`
- **Backing model:** `GameReview` (no schema changes required)

## Data model

No new tables. The diary reads from the existing `GameReview` model:

| Field           | Use in diary                                              |
| --------------- | -------------------------------------------------------- |
| `rating`        | Shown as 0.5–5 stars (stored 1–10, halved for display).  |
| `watchedAt`     | The diary date. Entries without it are excluded.         |
| `createdAt`     | Fallback sort key on the client if `watchedAt` is null.  |
| `watchedBefore` | Renders a "Rewatch" tag.                                 |
| `game`          | Matchup logos, title, and the game's played date.        |

Ratings are stored on a 1–10 scale and displayed as 0.5–5 stars via `toFive(stored) = clamp(stored, 0, 10) / 2`.

## API

### `GET /api/users/:username/diary`

Public (no auth). Returns entries for the user, newest watched date first, filtered to those with a `watchedAt`. Review text is never selected, so it does not leave the server for this endpoint.

**Response**

```json
{
  "username": "mainejerms",
  "entries": [
    {
      "id": "…",
      "gameId": "0042500224",
      "rating": 8,
      "watchedAt": "2026-08-29T00:00:00.000Z",
      "createdAt": "2026-08-28T22:41:54.630Z",
      "watchedBefore": false,
      "game": {
        "id": "0042500224",
        "title": null,
        "date": "2026-05-11T22:30:00.000Z",
        "homeTeam": { "id": 1610612747, "name": "Lakers", "abbreviation": "LAL" },
        "awayTeam": { "id": 1610612760, "name": "Thunder", "abbreviation": "OKC" }
      }
    }
  ]
}
```

**Controller** (`userController.js`)

```js
export const getUserDiary = async (req, res) => {
  const { username } = req.params
  try {
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    })
    if (!user) return res.status(404).json({ error: "User not found" })

    const entries = await prisma.gameReview.findMany({
      where: { userId: user.id, watchedAt: { not: null } },
      orderBy: [{ watchedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        gameId: true,
        rating: true,
        watchedAt: true,
        createdAt: true,
        watchedBefore: true,
        game: GAME_INCLUDE, // { include: { homeTeam, awayTeam } } — game scalars (incl. date) come through
      },
    })

    return res.json({ username, entries })
  } catch (err) {
    console.error("getUserDiary error:", err)
    return res.status(500).json({ error: "Failed to fetch diary" })
  }
}
```

**Route** (`routes/users.js`)

```js
router.get("/:username/diary", getUserDiary)
```

Registered after the static `/me/...` routes, alongside `/:username/reviews`.

### Design notes

- **`watchedAt: { not: null }`** enforces true diary semantics — only dated logs appear. Drop this filter to show every rating and let the client fall back to `createdAt`.
- **`select` omits `review`** so review text is excluded server-side, not just hidden in the UI.
- **`game: GAME_INCLUDE` inside a `select`** works because `GAME_INCLUDE` is `{ include: {...} }`; a nested relation with its own `include` is allowed inside a parent `select`. All game scalar fields (including `date`) are returned by default.

## Frontend

### `Diary.jsx` (`/user/:username/diary`)

- Fetches with React Query (`["diary", username]`), accepts either `{ entries: [...] }` or a bare array.
- Sorts newest-first by `watchedAt || createdAt`, groups into month sections (e.g. "August 2026") with a per-section count.
- Each row: flat matchup thumbnail, game title, the **game's played date** (`game.date`) beside the title, star rating, and a "Rewatch" tag when `watchedBefore` is true. No review text.
- Self-contained: `Rating`, `Ball`, `TeamMark`, `toFive`, `gameLabel`, and `shortDate` are duplicated locally from `Profile.jsx`.

### Client route

```jsx
<Route path="/user/:username/diary" element={<Diary />} />
```

### Entry points

- **Navbar:** the authenticated username dropdown (`NavUserMenu`) links to Profile and Diary; the mobile menu lists both in its account section.
- **Profile page:** a "Diary" button beside the "Recent reviews" section header.

## Known follow-ups

- **Shared rating primitives.** `Rating`, `Ball`, `TeamMark`, `toFive`, `gameLabel` are duplicated across `Profile.jsx` and `Diary.jsx`. Extract into a shared module (e.g. `components/Ratings.jsx` + `utils/ratings.js`) once a third surface needs them.
- **Pagination.** The endpoint returns all entries. If diaries grow large, add `page`/`limit` like `getUserReviews`.
- **Null `watchedAt`.** Currently excluded from the diary. Revisit if "log without a date" should still appear.