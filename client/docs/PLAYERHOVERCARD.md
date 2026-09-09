# PlayerHoverCard

A hover/click popover that shows an NBA player's season (or career) stats and
accolades. It wraps a player headshot; hovering or clicking the headshot opens
a floating card next to it. Currently used on the GOAT‑pyramid detail view
(`PyramidDetail.jsx`), on every headshot in both the compact sidebar pyramid
and the enlarged modal.

File: `src/components/PlayerHoverCard.jsx`

---

## What it renders

The card is two columns under a header:

- **Header** — the player's name and the period the stats cover
  (`"2015-16 season"` when a specific season is shown, otherwise
  `"Career averages"`).
- **Left column** — per‑game averages stacked vertically: PTS, REB, AST, STL,
  BLK, and best single‑season 3P% (`3P%*`).
- **Right column** — two accolade tiles with emojis: 👑 **MVPs** and 🏆 **Titles**.
- **Footnote** — clarifies that the 3P% figure is the player's highest in any
  single season, not the shown period's.

The name comes from the `name` prop, so it appears instantly; everything else
is fetched when the card opens.

---

## Usage

Wrap the element that should trigger the card (usually the headshot). The
`className` you pass becomes the trigger/anchor element's class, so put the
avatar's sizing and shape classes there.

```jsx
<PlayerHoverCard
  playerId={entry.player.id}
  teamId={entry.headshotTeamId}
  season={entry.headshotSeason}   // start year as a string, e.g. "2015"
  name={entry.player.name}
  className="aspect-square w-full cursor-pointer overflow-hidden rounded-full bg-primary"
>
  <PlayerHeadshot
    playerId={entry.player.id}
    teamId={entry.headshotTeamId}
    season={entry.headshotSeason}
    className="h-full w-full"
  />
</PlayerHoverCard>
```

### Props

| Prop        | Type              | Purpose                                                                 |
|-------------|-------------------|-------------------------------------------------------------------------|
| `playerId`  | number \| string  | NBA player id. Drives the fetch; required for the card to load stats.   |
| `teamId`    | number \| null    | Passed through for context; not used by the card itself anymore.        |
| `season`    | string \| null    | Season **start year** (`"2015"`). Null/absent → career averages.        |
| `name`      | string            | Shown immediately in the header and used for the trigger's aria‑label.  |
| `className` | string            | Applied to the trigger/anchor element (the thing you hover).            |
| `children`  | node              | The visible trigger content (the headshot).                             |

---

## Interaction model

The trigger is a focusable element (`role="button"`, `tabIndex={0}`) that
supports mouse, keyboard, and touch:

- **Hover** opens the card after a short delay (`OPEN_DELAY`, 120 ms). The delay
  keeps a burst of fetches from firing when the pointer sweeps across many
  headshots in the pyramid. Leaving the trigger schedules a close after
  `CLOSE_DELAY` (160 ms); moving onto the card itself cancels that, so you can
  hover into the card.
- **Click** (or Enter/Space) opens the card **pinned**. A pinned card ignores
  mouse‑leave and stays until you click outside it or press **Escape**. This is
  what makes it usable on touch devices, where hover doesn't exist.
- **Focus** opens the card too, so keyboard users get the same information.

State is two booleans: `open` (is it showing) and `pinned` (click‑opened, so
don't auto‑close on leave). Timers for the open/close delays are held in refs
and cleared on unmount.

---

## Positioning

The card is rendered through a **React portal into `document.body`** with
`position: fixed`. This matters because the trigger lives inside an
`overflow-hidden` round avatar and, in the sidebar, a narrow column — a normally
positioned popover would be clipped. The portal escapes all of that.

`computePos()` reads the trigger's `getBoundingClientRect()` and:

- centers the card horizontally over the trigger, then **clamps** it to the
  viewport with an 8 px margin so it never runs off the left/right edge;
- places it **below** the trigger by default, but **flips above** when there
  isn't `EST_H` (≈240 px estimated card height) of room below.

While the card is open it recomputes on `scroll` (capture phase, to catch
scrolling containers) and `resize`, so it stays anchored to the headshot.

Because the portal sits on `document.body` at `z-index: 60`, the card also
renders correctly on top of the enlarged‑pyramid modal (`z-50`).

---

## Data fetching

Fetching uses TanStack Query through the shared `api` (axios) instance:

```js
useQuery({
  queryKey: ["player-summary", playerId, season ?? "career"],
  queryFn: () => api.get(`/players/${playerId}/summary`, {
    params: season ? { season } : {},
  }).then((r) => r.data),
  enabled: open && !!playerId,   // only fetch once the card actually opens
  staleTime: 10 * 60 * 1000,     // 10 min
  retry: 1,
})
```

Key points:

- **Lazy** — `enabled: open` means nothing is requested until the first
  hover/click. No cost for players you never look at.
- **Cached & de‑duped** — the query key includes `playerId` and the season, so
  each player+season is fetched once and reused on subsequent hovers, even
  after the card closes. The 10‑minute `staleTime` avoids refetch churn.
- The endpoint path assumes the player router is mounted at `/api/players`
  (same base as `/:playerId/headshots`). If your mount differs, change the one
  path in `queryFn`.

### Expected response (the contract)

```jsonc
GET /api/players/:playerId/summary?season=2015
{
  "playerId": 201939,
  "name": "Stephen Curry",            // optional; card falls back to the name prop
  "imageUrl": null,                    // reserved for a full-body photo; unused for now
  "statsSource": "season" | "career",  // backend decides the season→career fallback
  "seasonLabel": "2015-16" | null,
  "perGame": { "pts": 30.1, "reb": 5.4, "ast": 6.7, "stl": 2.1, "blk": 0.2 },
  "bestThreePct": 45.4,                // career-high single-season 3P%, 0–100
  "accolades": { "mvp": 2, "championships": 4 }
}
```

The **season→career fallback lives on the backend** — if the requested season
isn't found (or the player is retired/legacy), it returns career totals with
`statsSource: "career"`, and the card just relabels itself. The card never has
to decide that.

---

## Render states

- **Loading** — a skeleton that mirrors the real layout (six placeholder stat
  rows on the left, two accolade tiles on the right, a footnote bar), all under
  one `animate-pulse`. It matches the loaded dimensions closely so the card
  doesn't jump when data arrives. The header name still shows during loading;
  only its period sublabel is skeletoned.
- **Error** — a small centered `"Stats unavailable."` message.
- **Success** — the two‑column stats + accolades described above.

Numbers are formatted by two helpers: `fmt()` (one decimal, `—` for
null/undefined) and `pct()` (one decimal with a `%`).

---

## Internal structure

Everything lives in one file:

- `PlayerHoverCard` (default export) — the trigger wrapper + portal + all the
  open/close/position logic and the query.
- `PlayerStatsCard({ name, query })` — the presentational card; reads
  `query.data` and renders header / skeleton / error / content.
- `StatRow({ label, value })` — one left‑column line (label left, value right).
- `Accolade({ emoji, count, label })` — one right‑column tile.

Styling uses the app's design tokens (`surface`, `line`, `primary`,
`text-muted`, `gold`, etc.), so it inherits the site theme.

---

## Backend dependency

The endpoint is served by:

- `controllers/playerController.js` → `getPlayerSummary` — validates the id,
  wraps the result in `cached()`, shells out to the Python script, and adds
  `playerId` / `name` (from Prisma) / `imageUrl`.
- `python/playerSummary.py` — pulls per‑game averages and best‑season 3P% from
  `nba_api` (`playercareerstats`), MVP count from `playerawards`, and derives
  championships by matching the player's team‑seasons against
  `python/champions.json`.

See those files' own comments for the championship‑derivation logic and its
edge cases (pre‑1980 coverage, mid‑season trades, the `OVERRIDE_RINGS` escape
hatch). MVP counts come live from the awards endpoint; titles are computed, not
fetched, because `nba_api` doesn't expose ring counts.

---

## Customization knobs

- **Emojis** — change `👑` / `🏆` in the two `Accolade` calls (e.g. 💍 for
  titles, 🏅 for MVP), or swap in MUI icons for consistency with the rest of
  the app.
- **Card width** — the `CARD_W` constant (280) plus the `w-[280px]` on the card
  root; keep them in sync.
- **Timing** — `OPEN_DELAY` / `CLOSE_DELAY` tune the hover feel.
- **Flip threshold** — `EST_H` is the assumed card height used to decide
  above/below placement.
- **Skeleton shade** — skeleton bars use `bg-line` (visible on the card's
  `surface` background); bump to `bg-line/80` or `bg-primary/50` if too subtle.

---

## Gotchas

- The `className` you pass is the **anchor**, not an inner wrapper — its box is
  what the popover measures and positions against.
- `imageUrl` is currently always `null` from the backend; the card no longer
  renders a photo, so it's ignored. (Kept in the contract in case a full‑body
  source is added later.)
- The fetch path (`/players/...`) must match your Express router mount.