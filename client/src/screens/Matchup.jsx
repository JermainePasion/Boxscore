import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded"
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded"
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded"
import PlayCircleFilledRoundedIcon from "@mui/icons-material/PlayCircleFilledRounded"

import { api } from "../lib/api"
import PlayerHeadshot from "../components/PlayerHeadshot"
import TeamLogo from "../components/TeamLogo"

/* ---------- helpers ---------- */

const fmt = (n) => (n == null ? "—" : Number(n).toFixed(1))
const pct = (p) => (p == null ? "—" : `${(Number(p) * 100).toFixed(1)}%`)
const signed = (n) => (n == null ? "—" : n > 0 ? `+${n}` : `${n}`)

const shortDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : ""

const STATS = [
  ["pts", "PTS"],
  ["reb", "REB"],
  ["ast", "AST"],
  ["stl", "STL"],
  ["blk", "BLK"],
]

// side colours: A = orange, B = blue
const SIDE = {
  a: { bar: "bg-accent-orange", text: "text-accent-orange" },
  b: { bar: "bg-[#5aa9e6]", text: "text-[#5aa9e6]" },
}

/* ---------- player search (picker) ---------- */

function PlayerSearch({ label, selected, onSelect }) {
  const [q, setQ] = useState("")
  const [debounced, setDebounced] = useState("")

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  const results = useQuery({
    queryKey: ["players", "search", debounced],
    queryFn: () => api.get("/players/search", { params: { q: debounced } }).then((r) => r.data),
    enabled: debounced.length >= 2,
    staleTime: 5 * 60 * 1000,
  })

  if (selected) {
    return (
      <div>
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">{label}</div>
        <div className="flex items-center gap-3 rounded-md border border-line bg-surface p-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-primary">
            <PlayerHeadshot playerId={selected.id} className="h-full w-full" />
          </div>
          <div className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{selected.name}</div>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-xs text-text-muted transition-colors hover:text-accent-red"
          >
            Change
          </button>
        </div>
      </div>
    )
  }

  const list = results.data ?? []
  return (
    <div className="relative">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">{label}</div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search a player…"
        className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-white placeholder:text-text-muted focus:border-primary-light focus:outline-none"
      />
      {debounced.length >= 2 ? (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-line bg-surface shadow-xl shadow-black/40">
          {results.isLoading ? (
            <div className="px-3 py-2 text-xs text-text-muted">Searching…</div>
          ) : list.length === 0 ? (
            <div className="px-3 py-2 text-xs text-text-muted">No players found.</div>
          ) : (
            list.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelect(p)
                  setQ("")
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-primary/40"
              >
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-primary">
                  <PlayerHeadshot playerId={p.id} className="h-full w-full" />
                </div>
                <span className="truncate text-sm text-white">{p.name}</span>
                {p.position ? <span className="ml-auto text-[10px] text-text-muted">{p.position}</span> : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

function Picker() {
  const navigate = useNavigate()
  const [a, setA] = useState(null)
  const [b, setB] = useState(null)
  const ready = a && b && a.id !== b.id

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-wide text-white md:text-4xl">MATCHUPS</h1>
        <p className="mt-2 text-sm text-text-muted">Pick two players. We'll find every time they faced off.</p>
      </div>

      <div className="rounded-lg border border-line bg-surface p-5 sm:p-7">
        <div className="grid items-start gap-4 sm:grid-cols-[1fr_auto_1fr]">
          <PlayerSearch label="Player one" selected={a} onSelect={setA} />
          <div className="hidden pt-7 text-center text-2xl font-black text-accent-red sm:block">VS</div>
          <PlayerSearch label="Player two" selected={b} onSelect={setB} />
        </div>

        {a && b && a.id === b.id ? (
          <p className="mt-3 text-center text-xs text-accent-red">Pick two different players.</p>
        ) : null}

        <button
          type="button"
          disabled={!ready}
          onClick={() => navigate(`/matchup/${a.id}/${b.id}`)}
          className="mt-6 w-full rounded-md bg-accent-orange py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary-dark transition-colors hover:bg-gold disabled:cursor-not-allowed disabled:opacity-50"
        >
          Compare
        </button>
      </div>
    </div>
  )
}

/* ---------- pieces ---------- */

function PlayerHero({ player, team, side, align }) {
  const right = align === "right"
  return (
    <div className={`flex items-center gap-4 ${right ? "flex-row-reverse text-right" : ""}`}>
      <div className={`h-20 w-20 shrink-0 overflow-hidden rounded-full bg-primary ring-2 sm:h-24 sm:w-24 ${side === "a" ? "ring-accent-orange" : "ring-[#5aa9e6]"}`}>
        <PlayerHeadshot playerId={player.id} className="h-full w-full" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-lg font-bold text-white sm:text-2xl">{player.name}</div>
        {team ? <div className={`text-xs font-semibold ${SIDE[side].text}`}>{team}</div> : null}
      </div>
    </div>
  )
}

function StatBar({ label, a, b }) {
  const total = (a ?? 0) + (b ?? 0)
  const aPct = total ? ((a ?? 0) / total) * 100 : 50
  return (
    <div className="grid grid-cols-[3.25rem_1fr_3.25rem] items-center gap-3">
      <span className={`text-right text-sm font-semibold tabular-nums ${a > b ? SIDE.a.text : "text-white"}`}>
        {fmt(a)}
      </span>
      <div>
        <div className="mb-1 text-center text-[10px] font-medium uppercase tracking-wider text-text-muted">{label}</div>
        <div className="flex h-2 overflow-hidden rounded-full bg-primary">
          <div className={SIDE.a.bar} style={{ width: `${aPct}%` }} />
          <div className={SIDE.b.bar} style={{ width: `${100 - aPct}%` }} />
        </div>
      </div>
      <span className={`text-sm font-semibold tabular-nums ${b > a ? SIDE.b.text : "text-white"}`}>
        {fmt(b)}
      </span>
    </div>
  )
}

function Tally({ label, a, b, tie }) {
  return (
    <div className="rounded-md border border-line bg-primary/30 px-4 py-3 text-center">
      <div className="text-[10px] font-medium uppercase tracking-wider text-text-muted">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums text-white">
        <span className={SIDE.a.text}>{a}</span>
        <span className="mx-2 text-text-muted">–</span>
        <span className={SIDE.b.text}>{b}</span>
      </div>
      {tie ? <div className="text-[10px] text-text-muted">{tie} even</div> : null}
    </div>
  )
}

const LINE_ROWS = [
  ["pts", "PTS", fmt],
  ["reb", "REB", fmt],
  ["ast", "AST", fmt],
  ["stl", "STL", fmt],
  ["blk", "BLK", fmt],
  ["min", "MIN", (v) => (v == null ? "—" : Math.round(v))],
  ["fgPct", "FG%", pct],
  ["fg3Pct", "3P%", pct],
  ["plusMinus", "+/−", signed],
  ["gameScore", "GmSc", fmt],
]

function GameRow({ game, players, open, onToggle, onLoadVideo, onRetryVideo, noHighlight }) {
  const [playing, setPlaying] = useState(false)
  const homeAway = game.home === "a" ? "vs." : "@"
  const winner = game.a.wl === "W" ? "a" : game.b.wl === "W" ? "b" : null

  // collapsing the row also stops playback, so reopening shows the poster again
  useEffect(() => {
    if (!open) setPlaying(false)
  }, [open])

  // auto-fetch highlights the moment the row opens (deduped by the parent)
  useEffect(() => {
    if (open && !game.youtubeId && !noHighlight) onLoadVideo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <div className="border-b border-line/60 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-2 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="w-24 shrink-0">
          <div className="text-xs font-medium text-white">{shortDate(game.date)}</div>
          <div className="text-[10px] text-text-muted">
            {game.seasonLabel}
            {game.seasonType === "playoffs" ? " · Playoffs" : ""}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <TeamLogo teamId={game.a.teamId} className="h-5 w-5 object-contain" />
          <span className="text-xs text-text-muted">{game.a.teamAbbr}</span>
          <span className="text-[10px] text-text-muted">{homeAway}</span>
          <span className="text-xs text-text-muted">{game.b.teamAbbr}</span>
          <TeamLogo teamId={game.b.teamId} className="h-5 w-5 object-contain" />
        </div>

        <div className="hidden min-w-0 flex-1 truncate text-xs text-text-muted sm:block">
          <span className={SIDE.a.text}>{fmt(game.a.pts)}/{fmt(game.a.reb)}/{fmt(game.a.ast)}</span>
          <span className="mx-2">·</span>
          <span className={SIDE.b.text}>{fmt(game.b.pts)}/{fmt(game.b.reb)}/{fmt(game.b.ast)}</span>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {winner ? (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${winner === "a" ? "bg-accent-orange/20 text-accent-orange" : "bg-[#5aa9e6]/20 text-[#5aa9e6]"}`}>
              {winner === "a" ? game.a.teamAbbr : game.b.teamAbbr} W
            </span>
          ) : null}
          {game.youtubeId ? <span className="text-[10px] text-gold">▶</span> : null}
          <ExpandMoreRoundedIcon
            sx={{ fontSize: 18 }}
            className={`text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {open ? (
        <div className="px-2 pb-5 pt-1">
          {/* both stat lines */}
          <div className="overflow-hidden rounded-md border border-line">
            <div className="grid grid-cols-[1fr_4rem_1fr] bg-primary px-3 py-2 text-[10px] font-semibold uppercase tracking-wider">
              <span className={`truncate ${SIDE.a.text}`}>{players.a.name}</span>
              <span />
              <span className={`truncate text-right ${SIDE.b.text}`}>{players.b.name}</span>
            </div>
            {LINE_ROWS.map(([key, label, f]) => {
              const av = game.a[key]
              const bv = game.b[key]
              const numeric = typeof av === "number" && typeof bv === "number"
              return (
                <div key={key} className="grid grid-cols-[1fr_4rem_1fr] border-t border-line/60 px-3 py-1.5 text-sm">
                  <span className={`tabular-nums ${numeric && av > bv ? "font-semibold text-white" : "text-text-muted"}`}>{f(av)}</span>
                  <span className="text-center text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
                  <span className={`text-right tabular-nums ${numeric && bv > av ? "font-semibold text-white" : "text-text-muted"}`}>{f(bv)}</span>
                </div>
              )
            })}
          </div>

          <div className="mt-2 text-center text-[11px] text-text-muted">
            Better night:{" "}
            {game.verdict === "tie" ? (
              "even"
            ) : (
              <span className={SIDE[game.verdict].text}>{players[game.verdict].name}</span>
            )}
          </div>

          {/* video — same thumbnail -> embed pattern as GameDetail */}
          {game.youtubeId ? (
            playing ? (
              <div className="mt-4 aspect-video w-full overflow-hidden rounded-lg border border-line">
                <iframe
                  className="h-full w-full"
                  src={`https://www.youtube.com/embed/${game.youtubeId}?autoplay=1`}
                  title={game.title || "Game highlights"}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                className="group relative mt-4 block aspect-video w-full overflow-hidden rounded-lg border border-line"
              >
                <img
                  src={`https://img.youtube.com/vi/${game.youtubeId}/maxresdefault.jpg`}
                  alt="Watch highlights"
                  onError={(e) => {
                    e.target.onerror = null
                    e.target.src = `https://img.youtube.com/vi/${game.youtubeId}/hqdefault.jpg`
                  }}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover:bg-black/15">
                  <PlayCircleFilledRoundedIcon className="text-white drop-shadow" sx={{ fontSize: 44 }} />
                </div>
              </button>
            )
          ) : noHighlight ? (
            <div className="mt-3 text-center">
              <p className="text-[11px] text-text-muted">No highlights found for this game.</p>
              <button
                type="button"
                onClick={onRetryVideo}
                className="mt-1 text-[11px] font-semibold text-gold transition-colors hover:underline"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-line py-8 text-xs text-text-muted">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-gold" />
              Finding highlights…
            </div>
          )}

          {game.onSite ? (
            <div className="mt-3 text-center">
              <Link to={`/games/${game.gameId}`} className="text-xs font-semibold text-gold hover:underline">
                Open full game page →
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/* ---------- screen ---------- */

export default function Matchup() {
  const { aId, bId } = useParams()
  const navigate = useNavigate()
  const [filter, setFilter] = useState("all")
  const [openId, setOpenId] = useState(null)

  const hasPair = Boolean(aId && bId)

  const q = useQuery({
    queryKey: ["matchup", aId, bId],
    queryFn: () => api.get(`/matchups/${aId}/vs/${bId}`, { timeout: 150000 }).then((r) => r.data),
    enabled: hasPair,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  })

  const qc = useQueryClient()

  // Games already auto-tried this session (so reopening a row doesn't refire the
  // expensive fetch), and games where the search came back with no highlight.
  const attempted = useRef(new Set())
  const [noHighlight, setNoHighlight] = useState(() => new Set())

  // GET /games/:id find-or-fetches the game AND runs findAndSaveHighlight — the
  // same thing opening the game page does. It returns the game (with youtubeId),
  // so we patch that straight into the cached matchup instead of refetching.
  const addGameM = useMutation({
    mutationFn: (gameId) =>
      api.get(`/games/${gameId}`, { timeout: 120000 }).then((r) => ({
        gameId,
        youtubeId: r.data?.youtubeId ?? null,
      })),
    onSuccess: ({ gameId, youtubeId }) => {
      if (youtubeId) {
        qc.setQueryData(["matchup", aId, bId], (old) =>
          old
            ? {
                ...old,
                games: old.games.map((g) =>
                  g.gameId === gameId ? { ...g, youtubeId, onSite: true } : g
                ),
              }
            : old
        )
      } else {
        setNoHighlight((prev) => new Set(prev).add(gameId))
      }
    },
  })

  const loadVideo = (gameId) => {
    if (attempted.current.has(gameId)) return
    attempted.current.add(gameId)
    addGameM.mutate(gameId)
  }

  const retryVideo = (gameId) => {
    setNoHighlight((prev) => {
      const next = new Set(prev)
      next.delete(gameId)
      return next
    })
    addGameM.mutate(gameId)
  }

  if (!hasPair) return <Picker />

  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="animate-pulse space-y-4">
          <div className="h-36 rounded-lg bg-surface" />
          <div className="h-48 rounded-lg bg-surface" />
          <div className="h-64 rounded-lg bg-surface" />
        </div>
        <p className="mt-4 text-center text-sm text-text-muted">
          Pulling every meeting from the NBA — the first load for a pair can take 10–20 seconds.
        </p>
      </div>
    )
  }

  if (q.isError || !q.data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-text-muted">Couldn't build this matchup.</p>
        <div className="mt-3 flex justify-center gap-4 text-sm">
          <button type="button" onClick={() => q.refetch()} className="font-semibold text-gold hover:underline">
            Try again
          </button>
          <Link to="/matchup" className="text-text-muted hover:text-white">
            Pick different players
          </Link>
        </div>
      </div>
    )
  }

  const data = q.data
  const { players } = data
  const games = data.games ?? []
  const visible = filter === "all" ? games : games.filter((g) => g.seasonType === filter)
  const n = visible.length

  // aggregates follow the active filter
  const avg = (side, k) => (n ? visible.reduce((s, g) => s + (g[side][k] ?? 0), 0) / n : null)
  const record = {
    a: visible.filter((g) => g.a.wl === "W").length,
    b: visible.filter((g) => g.b.wl === "W").length,
  }
  const duels = {
    a: visible.filter((g) => g.verdict === "a").length,
    b: visible.filter((g) => g.verdict === "b").length,
    tie: visible.filter((g) => g.verdict === "tie").length,
  }
  const latestTeam = (side) => games[0]?.[side]?.teamAbbr

  const FilterTab = ({ id, label, count }) => (
    <button
      type="button"
      onClick={() => setFilter(id)}
      className={`text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
        filter === id ? "text-gold" : "text-text-muted hover:text-white"
      }`}
    >
      {label}
      {count != null ? <span className="ml-1 text-text-muted">({count})</span> : null}
    </button>
  )

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
      <div className="mb-5 flex items-center justify-between">
        <Link
          to="/matchup"
          className="flex items-center gap-1 text-xs font-medium uppercase tracking-[0.1em] text-text-muted transition-colors hover:text-gold"
        >
          <ArrowBackRoundedIcon sx={{ fontSize: 15 }} />
          New matchup
        </Link>
        <button
          type="button"
          onClick={() => navigate(`/matchup/${bId}/${aId}`)}
          className="flex items-center gap-1 text-xs font-medium uppercase tracking-[0.1em] text-text-muted transition-colors hover:text-gold"
          title="Swap sides"
        >
          <SwapHorizRoundedIcon sx={{ fontSize: 16 }} />
          Swap
        </button>
      </div>

      {/* hero */}
      <div className="rounded-lg border border-line bg-surface p-5 sm:p-7">
        <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
          <PlayerHero player={players.a} team={latestTeam("a")} side="a" />
          <div className="text-center">
            <div className="text-3xl font-black text-accent-red sm:text-4xl">VS</div>
            <div className="mt-1 text-[11px] text-text-muted">
              {data.meetings} meeting{data.meetings === 1 ? "" : "s"}
            </div>
            {data.firstMeeting ? (
              <div className="text-[10px] text-text-muted">
                {new Date(data.firstMeeting).getFullYear()}–{new Date(data.lastMeeting).getFullYear()}
              </div>
            ) : null}
          </div>
          <PlayerHero player={players.b} team={latestTeam("b")} side="b" align="right" />
        </div>
      </div>

      {games.length === 0 ? (
        <p className="py-16 text-center text-sm text-text-muted">
          These two have never faced each other in an NBA game.
        </p>
      ) : (
        <>
          {/* filter */}
          <div className="mt-6 flex items-center gap-5">
            <FilterTab id="all" label="All" count={games.length} />
            <FilterTab id="regular" label="Regular season" count={data.regular} />
            <FilterTab id="playoffs" label="Playoffs" count={data.playoffs} />
          </div>

          {/* tale of the tape */}
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_260px]">
            <div className="rounded-lg border border-line bg-surface p-5">
              <div className="mb-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                Averages in these meetings
              </div>
              <div className="space-y-4">
                {STATS.map(([k, label]) => (
                  <StatBar key={k} label={label} a={avg("a", k)} b={avg("b", k)} />
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <Tally label="Team record" a={record.a} b={record.b} />
              <Tally label="Better night" a={duels.a} b={duels.b} tie={duels.tie} />
            </div>
          </div>

          {/* games */}
          <div className="mt-8">
            <div className="mb-3 flex items-center gap-4">
              <h2 className="shrink-0 text-sm font-semibold uppercase tracking-widest text-white">
                Every meeting {n !== games.length ? `(${n})` : ""}
              </h2>
              <div className="h-px flex-1 bg-accent-red" />
            </div>
            <div className="rounded-lg border border-line bg-surface">
              {visible.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-muted">No games in this filter.</p>
              ) : (
                visible.map((g) => (
                  <GameRow
                    key={g.gameId}
                    game={g}
                    players={players}
                    open={openId === g.gameId}
                    onToggle={() => setOpenId(openId === g.gameId ? null : g.gameId)}
                    onLoadVideo={() => loadVideo(g.gameId)}
                    onRetryVideo={() => retryVideo(g.gameId)}
                    noHighlight={noHighlight.has(g.gameId)}
                  />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}