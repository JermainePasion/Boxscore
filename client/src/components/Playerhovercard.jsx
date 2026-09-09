import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useQuery } from "@tanstack/react-query"

import { api } from "../lib/api"

/*
 * Expected endpoint (see playerSummary.py + getPlayerSummary controller).
 * Lives on the same router as /:playerId/headshots, so use that same base:
 *
 *   GET /api/players/:playerId/summary?season=2015   (season = start year, optional)
 *
 *   {
 *     "playerId": 201939,
 *     "name": "Stephen Curry",            // optional — falls back to the name prop
 *     "imageUrl": "https://.../body.png",  // full-body photo, or null
 *     "statsSource": "season" | "career",  // backend decides the fallback
 *     "seasonLabel": "2015-16" | null,
 *     "perGame": { "pts": 30.1, "reb": 5.4, "ast": 6.7, "stl": 2.1, "blk": 0.2 },
 *     "bestThreePct": 45.4,                // career-high single-season 3P%, 0–100
 *     "accolades": { "mvp": 2, "championships": 4 }
 *   }
 */

const CARD_W = 280
const OPEN_DELAY = 120
const CLOSE_DELAY = 160
const EST_H = 240

const fmt = (n, d = 1) =>
  n === null || n === undefined || Number.isNaN(Number(n))
    ? "—"
    : Number(n).toFixed(d)

const pct = (n) =>
  n === null || n === undefined || Number.isNaN(Number(n))
    ? "—"
    : `${Number(n).toFixed(1)}%`

/* ---------- stat row + accolade ---------- */

function StatRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums text-white">{value}</span>
    </div>
  )
}

function Accolade({ emoji, count, label }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-md bg-primary/40 py-2.5">
      <span className="text-xl leading-none" role="img" aria-label={label}>
        {emoji}
      </span>
      <span className="text-lg font-bold leading-none tabular-nums text-white">
        {count}
      </span>
      <span className="text-[9px] font-medium uppercase tracking-wider text-text-muted">
        {label}
      </span>
    </div>
  )
}

/* ---------- presentational card ---------- */

function PlayerStatsCard({ name, query }) {
  const data = query.data
  const g = data?.perGame ?? {}
  const label =
    data?.statsSource === "season" && data?.seasonLabel
      ? `${data.seasonLabel} season`
      : "Career averages"

  return (
    <div className="w-[280px] overflow-hidden rounded-lg border border-line bg-surface shadow-xl shadow-black/40">
      {/* name / period */}
      <div className="border-b border-line/60 px-3 py-2.5">
        <div className="truncate text-sm font-semibold leading-tight text-white">
          {data?.name ?? name}
        </div>
        <div className="text-[10px] text-text-muted">
          {query.isSuccess ? label : "\u00a0"}
        </div>
      </div>

      {query.isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-gold" />
        </div>
      ) : query.isError ? (
        <div className="px-3 py-10 text-center text-xs text-text-muted">
          Stats unavailable.
        </div>
      ) : (
        <>
          <div className="flex">
            {/* left: per-game averages, stacked lengthwise */}
            <div className="flex-1 space-y-1 border-r border-line/60 px-3 py-2.5">
              <StatRow label="PTS" value={fmt(g.pts)} />
              <StatRow label="REB" value={fmt(g.reb)} />
              <StatRow label="AST" value={fmt(g.ast)} />
              <StatRow label="STL" value={fmt(g.stl)} />
              <StatRow label="BLK" value={fmt(g.blk)} />
              <StatRow label="3P%*" value={pct(data?.bestThreePct)} />
            </div>

            {/* right: accolades */}
            <div className="flex w-[108px] shrink-0 flex-col justify-center gap-2 px-3 py-2.5">
              <Accolade emoji="👑" count={data?.accolades?.mvp ?? 0} label="MVPs" />
              <Accolade emoji="🏆" count={data?.accolades?.championships ?? 0} label="Titles" />
            </div>
          </div>

          <div className="border-t border-line/60 px-3 py-1.5 text-[8px] leading-tight text-text-muted">
            * highest 3P% in a single season
          </div>
        </>
      )}
    </div>
  )
}

/* ---------- hover/click wrapper ---------- */

export default function PlayerHoverCard({
  playerId,
  teamId,
  season,
  name,
  className,
  children,
}) {
  const anchorRef = useRef(null)
  const openTimer = useRef(null)
  const closeTimer = useRef(null)

  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [pos, setPos] = useState(null)

  const query = useQuery({
    queryKey: ["player-summary", playerId, season ?? "career"],
    queryFn: () =>
      api
        .get(`/players/${playerId}/summary`, {
          params: season ? { season } : {},
        })
        .then((r) => r.data),
    enabled: open && !!playerId,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })

  const computePos = useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    let left = r.left + r.width / 2 - CARD_W / 2
    left = Math.max(8, Math.min(left, vw - CARD_W - 8))
    const flipUp = r.bottom + 8 + EST_H > vh && r.top - EST_H - 8 > 8
    const top = flipUp ? r.top - EST_H - 8 : r.bottom + 8
    setPos({ left, top })
  }, [])

  const scheduleOpen = useCallback(() => {
    clearTimeout(closeTimer.current)
    openTimer.current = setTimeout(() => {
      computePos()
      setOpen(true)
    }, OPEN_DELAY)
  }, [computePos])

  const scheduleClose = useCallback(() => {
    clearTimeout(openTimer.current)
    if (pinned) return
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY)
  }, [pinned])

  const openPinned = useCallback(() => {
    clearTimeout(closeTimer.current)
    computePos()
    setOpen(true)
    setPinned(true)
  }, [computePos])

  const closeNow = useCallback(() => {
    setOpen(false)
    setPinned(false)
  }, [])

  // keep the card anchored while the page scrolls / resizes
  useEffect(() => {
    if (!open) return
    const onMove = () => computePos()
    window.addEventListener("scroll", onMove, true)
    window.addEventListener("resize", onMove)
    return () => {
      window.removeEventListener("scroll", onMove, true)
      window.removeEventListener("resize", onMove)
    }
  }, [open, computePos])

  // escape + outside-click dismiss (mainly for the pinned/click state)
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === "Escape" && closeNow()
    const onDown = (e) => {
      if (anchorRef.current?.contains(e.target)) return
      if (e.target.closest?.("[data-player-card]")) return
      closeNow()
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("mousedown", onDown)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("mousedown", onDown)
    }
  }, [open, closeNow])

  useEffect(
    () => () => {
      clearTimeout(openTimer.current)
      clearTimeout(closeTimer.current)
    },
    []
  )

  return (
    <>
      <div
        ref={anchorRef}
        className={className}
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        onFocus={scheduleOpen}
        onBlur={scheduleClose}
        onClick={openPinned}
        onKeyDown={(e) =>
          (e.key === "Enter" || e.key === " ") && (e.preventDefault(), openPinned())
        }
        tabIndex={0}
        role="button"
        aria-label={`${name} stats`}
      >
        {children}
      </div>

      {open && pos
        ? createPortal(
            <div
              data-player-card
              style={{ position: "fixed", left: pos.left, top: pos.top, zIndex: 60 }}
              onMouseEnter={() => clearTimeout(closeTimer.current)}
              onMouseLeave={scheduleClose}
            >
              <PlayerStatsCard name={name} query={query} />
            </div>,
            document.body
          )
        : null}
    </>
  )
}