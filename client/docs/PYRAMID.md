# G.O.A.T. Pyramid — Feature Docs

User-built tiered rankings of the greatest players. Each user can keep multiple
named pyramids, place players into five tiers, and pin an era-specific headshot
per placement. Pyramids are browsable by everyone and, on their detail page,
open to comments and comment likes.

## Concept

A pyramid has five tiers of increasing width — a strict shape, not a free list:

| Tier | Slots |
| ---- | ----- |
| 1    | 2     |
| 2    | 3     |
| 3    | 4     |
| 4    | 5     |
| 5    | 6     |

20 slots total. Tier 1 is the apex (your two absolute GOATs), tier 5 the base.
The same player may appear more than once **only** with a different era (a
different headshot team/season), so you can rank, say, a player's peak run and
their later years as distinct entries.

## Data model

```prisma
model GoatPyramid {
  id        String   @id @default(uuid())
  userId    String
  title     String   @default("My GOAT Pyramid")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user     User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  players  GoatPyramidPlayer[]
  comments Comment[]

  @@index([userId])
}

model GoatPyramidPlayer {
  id             String  @id @default(uuid())
  pyramidId      String
  playerId       Int
  tier           Int
  headshotTeamId Int?               // chosen era: team
  headshotSeason String? @db.VarChar(10)  // chosen era: season ("2015")

  pyramid     GoatPyramid @relation(fields: [pyramidId], references: [id], onDelete: Cascade)
  player      Player      @relation(fields: [playerId], references: [id])

  @@index([pyramidId])
  @@index([playerId])
}
```

- Deleting a pyramid cascades to its placements and (via `Comment`) its comments.
- `Comment.pyramidId` is the optional link that lets a comment attach to a
  pyramid (comments are shared across games / reviews / pyramids).
- An "era" is the pair `(headshotTeamId, headshotSeason)`. `null/null` means
  the player's current headshot, labelled **Current** in the UI.

## Backend

All handlers live in `src/controllers/pyramidController.js`, routed in
`src/routes/pyramidRoutes.js`, mounted at `/api/pyramid` in `index.js`.

A shared `PYRAMID_INCLUDE` shapes every response — the author (`id`, `username`,
`avatarUrl`) and each placement's tier, era, and player (`id`, `name`,
`headshotUrl`), ordered by tier ascending.

### Endpoints

| Method | Path                       | Auth | Notes                                            |
| ------ | -------------------------- | ---- | ------------------------------------------------ |
| GET    | `/api/pyramid/me`          | Yes  | All of the signed-in user's pyramids             |
| GET    | `/api/pyramid/explore`     | No   | Paginated; only pyramids that have players        |
| GET    | `/api/pyramid/user/:userId`| No   | Another user's pyramids                          |
| POST   | `/api/pyramid`             | Yes  | Create an empty pyramid                          |
| PUT    | `/api/pyramid/:id`         | Yes  | Replace title + all placements                  |
| DELETE | `/api/pyramid/:id`         | Yes  | Delete a pyramid                                |
| GET    | `/api/pyramid/:id`         | No   | A single pyramid                                |

Route order matters: the literal paths (`/me`, `/explore`, `/user/:userId`) and
the `POST`/`PUT`/`DELETE` handlers are all registered **before** the catch-all
`GET /:id`, so `me` and `explore` aren't captured as ids.

### Create — `POST /api/pyramid`

Creates an empty pyramid with an optional `title` (defaults to
`"My GOAT Pyramid"`). Enforces a **20-pyramid-per-user** cap (returns 400 once
reached).

### Save — `PUT /api/pyramid/:id`

The workhorse. Body: `{ title, players: [{ playerId, tier, headshotTeamId?, headshotSeason? }] }`.
It fully **replaces** the pyramid's placements rather than diffing. Steps:

1. **Validate placements**
   - `players` must be an array.
   - Each `tier` must be 1–5; per-tier counts must not exceed the tier's slot
     limit (2/3/4/5/6).
   - Duplicate guard keyed on `playerId | headshotTeamId | headshotSeason` — the
     same player is allowed again only with a different era.
2. **Ownership** — 404 if the pyramid doesn't exist, 403 if it isn't the
   caller's.
3. **Backfill unknown players** — any `playerId` not already in the DB is
   fetched through the Python NBA script (`python/getPlayersByIds.py`) and
   upserted, with a default NBA CDN headshot URL. This lets the editor place
   players the DB hasn't seen yet.
4. **Transaction** — delete all existing `GoatPyramidPlayer` rows for the
   pyramid, recreate them from the payload, and update the title (falling back
   to the existing title if the new one is blank).

### Delete — `DELETE /api/pyramid/:id`

Ownership-checked, then removes the placements and the pyramid.

## Frontend

Three screens, all under `src/pages/`.

### Gallery — `Pyramid.jsx` (`/pyramid`)

Two sections:

- **Your pyramids** (signed-in) — your pyramids as cards plus a "New pyramid"
  create card. Signed-out users see a sign-in prompt instead.
- **Explore** — everyone else's pyramids (the viewer's own are filtered out so
  they don't double up).

Each card renders a silhouette of the top two tiers (era-specific headshots via
`PlayerHeadshot`), the title, fill count (`n/20`), and author/date. Clicking a
card navigates to the detail page.

### Editor — `PyramidEditor` (`/pyramid/edit?id=:id`)

Drag-and-drop tier builder: place players into tiers, pick an era per placement,
name the pyramid, and save via `PUT /api/pyramid/:id`. Reached from the create
card, the "+ New" button, and the detail page's owner **Edit** button.

### Detail — `PyramidDetail.jsx` (`/pyramid/:id`)

Full pyramid view plus the comment thread. Documented in full below.

## API reference (pyramid core)

`POST /api/pyramid` body: `{ title? }`
`PUT /api/pyramid/:id` body: `{ title, players: [{ playerId, tier, headshotTeamId?, headshotSeason? }] }`

Placement shape in responses:

```json
{
  "id": "…",
  "tier": 1,
  "headshotTeamId": 1610612739,
  "headshotSeason": "2016",
  "player": { "id": 2544, "name": "…", "headshotUrl": "…" }
}
```

---

# Detail Page — Comments & Comment Likes

Replaces the old gallery modal with the dedicated `/pyramid/:id` page and adds a
comment thread with per-comment likes.

## Overview

Clicking a pyramid card navigates to its own page instead of opening a modal.
The page shows the full pyramid (all tiers) and a comment section where
signed-in users can post comments, delete their own, and like any comment. Likes
are derived from a `likes` array on each comment (count + liked-by-me) rather
than a denormalized counter, mirroring how `getReviewsByGame` already returns
`likes: { select: { userId: true } }`.

Reviews (rating + text) are **not** part of this — pyramids have no review
model. See [Not included](#not-included).

## Data model

New `CommentLike` join table. No column is added to `Comment`; the relation
lives entirely on the new table.

```prisma
model CommentLike {
  id         String   @id @default(uuid())
  userId     String
  commentId  String
  createdAt  DateTime @default(now())

  user       User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  comment    Comment @relation(fields: [commentId], references: [id], onDelete: Cascade)

  @@unique([userId, commentId])
  @@index([commentId])
}
```

Back-relations:

```prisma
// model User
commentLikes  CommentLike[]

// model Comment
likes         CommentLike[]
```

`onDelete: Cascade` on `CommentLike.comment` is what lets a comment be deleted
without a foreign-key error on leftover likes (covers both `deleteComment` and
the `comment.deleteMany` inside `deleteReview`).

### Migration

```bash
npx prisma migrate dev --name add_comment_likes
```

Only creates the `CommentLike` table.

## Backend

Handlers live in `src/controllers/reviewController.js` (same file as the
review/comment logic).

- `getCommentsByPyramid` — `GET` top-level comments for a pyramid, oldest first.
  Public. Includes `user` (`id`, `username`, `avatarUrl`) and
  `likes: { select: { userId: true } }`.
- `toggleCommentLike` — toggles the auth user's like on a comment. Mirrors
  `toggleReviewLike`. Returns `{ liked: boolean }`.

`createComment` already accepted `pyramidId`, so posting needed no change.

### Routes

Comments got their own router mounted at `/api/comments` — there was previously
no `/api/comments` mount, which caused a 404 on the fetch.

`src/routes/commentRoutes.js`:

```javascript
import express from "express"
import {
  createComment,
  getCommentsByGame,
  getCommentsByPyramid,
  toggleCommentLike,
  deleteComment,
} from "../controllers/reviewController.js"
import { authenticate } from "../middleware/authenticate.js"

const router = express.Router()

router.post("/", authenticate, createComment)
router.get("/game/:gameId", getCommentsByGame)
router.get("/pyramid/:pyramidId", getCommentsByPyramid)
router.post("/:commentId/like", authenticate, toggleCommentLike)
router.delete("/:commentId", authenticate, deleteComment)

export default router
```

`index.js`:

```javascript
import commentRoutes from "./src/routes/commentRoutes.js"
// ...
app.use("/api/comments", commentRoutes)
```

Ordering note: `/pyramid/:pyramidId` must sit above any bare `/:id` GET in the
same router so the param route doesn't swallow `pyramid`.

## Frontend

### `src/pages/PyramidDetail.jsx`

- Fetches the pyramid (`GET /pyramid/:id`) and its comments
  (`GET /comments/pyramid/:id`) as two TanStack queries.
- Renders the full pyramid by tier, plus an owner-only **Edit** button routing
  to `/pyramid/edit?id=:id`.
- Comment section: composer (signed-in only), list, delete-own, and an
  **optimistic** like toggle (updates the cached `likes` array immediately,
  rolls back on error, invalidates on settle).
- Signed-out users get a sign-in prompt via `AuthModal`.

Assumes `useAuth()` exposes `{ isAuthed, user }` with `user.id` / `user.username`.

### Route registration

Add after the static `/pyramid/edit` route so `edit` isn't captured as an id:

```jsx
<Route path="/pyramid/:id" element={<PyramidDetail />} />
```

### Gallery change — `Pyramid.jsx`

- `PyramidModal` and its `active` state removed.
- Cards navigate: `onOpen={() => navigate(`/pyramid/${p.id}`)}`.
- Owners edit from the detail page rather than a modal.

## API reference (comments)

| Method | Path                              | Auth | Returns                    |
| ------ | --------------------------------- | ---- | -------------------------- |
| GET    | `/api/comments/pyramid/:pyramidId`| No   | `Comment[]` with `likes[]` |
| POST   | `/api/comments`                   | Yes  | created `Comment`          |
| POST   | `/api/comments/:commentId/like`   | Yes  | `{ liked: boolean }`       |
| DELETE | `/api/comments/:commentId`        | Yes  | `{ message }`              |

`POST /api/comments` body: `{ content, pyramidId }` (or `gameId` / `reviewId`).

Comment shape from the pyramid fetch:

```json
{
  "id": "…",
  "content": "…",
  "createdAt": "…",
  "user": { "id": "…", "username": "…", "avatarUrl": "…" },
  "likes": [{ "userId": "…" }]
}
```

Client derives `count = likes.length` and
`likedByMe = likes.some(l => l.userId === me)`.

## Not included

- **Rated reviews on pyramids** — would need a `PyramidReview` model
  (rating + text + its own likes) plus endpoints and a page section. Not built.
- **Pyramid-level likes** (liking the whole pyramid, Letterboxd-list style) — a
  near-clone of `CommentLike` keyed on `pyramidId`. Not built.

## Verify

```bash
curl.exe http://localhost:5000/api/comments/pyramid/<PYRAMID_ID>
```

Expect `[]` or existing comments (not 404) before the UI depends on it.