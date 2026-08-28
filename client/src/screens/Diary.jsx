import { useMemo } from "react"
import { useParams, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"

import { api } from "../lib/api"
import TeamLogo from "../components/TeamLogo"


const teamTag = (team) => team?.abbreviation || team?.name || "?"

const gameLabel = (game) =>
  game?.title || `${teamTag(game?.awayTeam)} @ ${teamTag(game?.homeTeam)}`

// Ratings are stored 1–10, shown as 0.5–5 stars.
const toFive = (stored) => Math.max(0, Math.min(10, stored ?? 0)) / 2

const monthKey = (iso) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

const monthLabel = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" })

const dayNum = (iso) => new Date(iso).getDate()

const weekday = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: "short" }).toUpperCase()

/* ---------- rating balls (same widget as the profile) ---------- */

function Ball({ muted }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill={muted ? "#12435c" : "#f77f00"} />
      <path
        d="M2 12h20M12 2v20M4.5 4.5c4 3 4 12 0 15M19.5 4.5c-4 3-4 12 0 15"
        stroke={muted ? "#0b3040" : "#7a3f00"}
        strokeWidth="1.2"
        fill="none"
      />
    </svg>
  )
}

function Rating({ stored }) {
  const value = toFive(stored)
  return (
    <span className="relative inline-flex shrink-0">
      <span className="flex gap-0.5" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <Ball key={i} muted />
        ))}
      </span>
      <span
        className="absolute inset-0 flex gap-0.5 overflow-hidden"
        style={{ width: `${(value / 5) * 100}%` }}
        aria-hidden="true"
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <Ball key={i} />
        ))}
      </span>
      <span className="sr-only">{value} out of 5</span>
    </span>
  )
}

function TeamMark({ team, className = "h-7 w-7" }) {
  if (team?.id) {
    return (
      <TeamLogo
        teamId={team.id}
        alt={team.abbreviation || team.name || ""}
        className={`${className} object-contain`}
      />
    )
  }
  return (
    <span className={`${className} grid place-items-center rounded-full bg-primary text-[9px] font-semibold text-white`}>
      {team?.abbreviation || team?.name?.slice(0, 3).toUpperCase() || "—"}
    </span>
  )
}

/* ---------- one diary row ---------- */

function DiaryRow({ entry }) {
  const game = entry.game
  const watched = entry.watchedAt || entry.createdAt
  const shortDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : ""
  

  return (
    <Link
      to={`/games/${entry.gameId}`}
      className="group grid grid-cols-[52px_minmax(0,1fr)] items-center gap-4 border-b border-line py-3
                 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold sm:grid-cols-[64px_minmax(0,1fr)] sm:gap-5"
    >
      {/* matchup thumbnail — flat, no gradient */}
      <span className="flex aspect-[2/3] flex-col items-center justify-center gap-0.5 rounded bg-primary p-1">
        <TeamMark team={game?.awayTeam} className="h-6 w-6" />
        <span className="text-[7px] font-semibold text-text-muted">@</span>
        <TeamMark team={game?.homeTeam} className="h-6 w-6" />
      </span>

      {/* title + date + rating */}
      <span className="min-w-0">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="truncate text-sm font-semibold text-white transition-colors group-hover:text-gold sm:text-base">
            {gameLabel(game)}
          </span>
          <span className="text-xs text-text-muted">{shortDate(game?.date)}</span>
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-3">
          <Rating stored={entry.rating} />
          {entry.watchedBefore ? (
            <span className="rounded-sm border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-text-muted">
              Rewatch
            </span>
          ) : null}
        </span>
      </span>
    </Link>
  )
}

/* ---------- skeleton ---------- */

function DiarySkeleton() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse px-4 pb-24 sm:px-6">
      <div className="h-8 w-40 rounded bg-surface py-10 my-10" />
      {[0, 1].map((m) => (
        <div key={m} className="mt-8">
          <div className="mb-4 h-4 w-32 rounded bg-surface" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="mb-3 h-16 rounded bg-surface" />
          ))}
        </div>
      ))}
    </div>
  )
}

/* ---------- screen ---------- */

export default function Diary() {
  const { username } = useParams()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["diary", username],
    queryFn: () => api.get(`/users/${username}/diary`).then((r) => r.data),
    retry: 2,
  })

  // Group entries by watched month, newest month first, newest entry first.
  const months = useMemo(() => {
    const entries = data?.entries ?? data ?? []
    const withDate = entries.filter((e) => e.watchedAt || e.createdAt)
    withDate.sort(
      (a, b) =>
        new Date(b.watchedAt || b.createdAt) - new Date(a.watchedAt || a.createdAt)
    )

    const groups = new Map()
    for (const e of withDate) {
      const key = monthKey(e.watchedAt || e.createdAt)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(e)
    }
    return [...groups.entries()] // already in insertion (newest-first) order
  }, [data])

  if (isLoading) return <DiarySkeleton />

  if (isError) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-xl font-semibold text-white">Couldn't load the diary</h1>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-6 rounded bg-gold px-6 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary-dark transition-colors hover:bg-accent-orange"
        >
          Try again
        </button>
      </div>
    )
  }

  const total = months.reduce((n, [, rows]) => n + rows.length, 0)

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
      <header className="flex items-baseline justify-between gap-4 py-8 sm:py-10">
        <div>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">Diary</h1>
        </div>
      </header>

      {months.length === 0 ? (
        <div className="rounded-md border border-dashed border-line bg-surface/40 px-6 py-12 text-center text-sm text-text-muted">
          No games logged yet.
        </div>
      ) : (
        months.map(([key, rows]) => (
          <section key={key} className="mb-8">
            <h2 className="mb-2 flex items-center gap-4">
              <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                {monthLabel(rows[0].watchedAt || rows[0].createdAt)}
              </span>
              <span className="h-px w-12 shrink-0 bg-accent-red" />
              <span className="h-px flex-1 bg-line" />
              <span className="shrink-0 text-[11px] text-text-muted">{rows.length}</span>
            </h2>

            <div className="flex flex-col">
              {rows.map((entry) => (
                <DiaryRow key={entry.id} entry={entry} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}