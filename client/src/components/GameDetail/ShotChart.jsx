import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "../../lib/api"
import TeamLogoImg from "../TeamLogo"

const API_BASE = "http://localhost:5000"

// Court units: tenths of feet. Full court 940 x 500. Hoop center 52.5 from each baseline.
const W = 940, H = 500, HOOP = 52.5

function toCourt(shot, isLeft) {
  // shot.x: -250..250 (left/right of hoop), shot.y: distance up-court from hoop
  return isLeft
    ? { cx: HOOP + shot.y, cy: H / 2 + shot.x }
    : { cx: W - HOOP - shot.y, cy: H / 2 - shot.x }
}

/**
 * One half-court's markings, drawn for the LEFT side.
 * Rendered twice — the right side is mirrored via transform.
 * All dimensions in tenths of feet (NBA official):
 *  - paint (key): 16ft wide (160) x 19ft deep (190)
 *  - free-throw circle: 6ft radius (60), centered at FT line
 *  - restricted area: 4ft radius (40) arc around hoop
 *  - 3pt: 23.75ft arc (237.5) with straight corner lines 22ft (220) from hoop center,
 *    corner lines run 14ft (140) from the baseline
 *  - backboard: 6ft wide (60), 4ft (40) from baseline; rim r=7.5 at 52.5
 */
function HalfCourt() {
  const paintW = 190   // depth from baseline to FT line
  const paintH = 160   // key width
  const ftY = paintW   // free-throw line x-position
  const cy = H / 2

  return (
    <g>
      {/* paint (outer key) */}
      <rect x="0" y={cy - paintH / 2} width={paintW} height={paintH} />
      {/* inner key (12ft wide, old lane) — subtle detail */}
      <rect x="0" y={cy - 60} width={paintW} height="120" opacity="0.35" />

      {/* free-throw circle: solid top half, dashed bottom half */}
      <path d={`M ${ftY} ${cy - 60} A 60 60 0 0 1 ${ftY} ${cy + 60}`} />
      <path d={`M ${ftY} ${cy + 60} A 60 60 0 0 1 ${ftY} ${cy - 60}`} strokeDasharray="10 10" opacity="0.6" />

      {/* backboard + rim */}
      <line x1="40" y1={cy - 30} x2="40" y2={cy + 30} strokeWidth="4" />
      <circle cx={HOOP} cy={cy} r="7.5" />

      {/* restricted area arc */}
      <path d={`M 40 ${cy - 40} A 40 40 0 0 1 40 ${cy + 40}`} opacity="0.7" />

      {/* 3pt line: corner straights + arc */}
      <line x1="0" y1={cy - 220} x2="140" y2={cy - 220} />
      <line x1="0" y1={cy + 220} x2="140" y2={cy + 220} />
      <path d={`M 140 ${cy - 220} A 237.5 237.5 0 0 1 140 ${cy + 220}`} />

      {/* lane hash marks */}
      {[70, 110, 140, 170].map(x => (
        <g key={x} opacity="0.6">
          <line x1={x} y1={cy - paintH / 2 - 8} x2={x} y2={cy - paintH / 2} />
          <line x1={x} y1={cy + paintH / 2} x2={x} y2={cy + paintH / 2 + 8} />
        </g>
      ))}
    </g>
  )
}

function CourtLines({ homeTeamId }) {
  return (
    <g stroke="var(--color-line)" strokeWidth="3" fill="none">
      {/* floor */}
      <rect x="0" y="0" width={W} height={H} fill="#c9a36a" />
      {/* painted key areas get a slightly darker wood tone */}
      <rect x="0" y={H / 2 - 80} width="190" height="160" fill="#bd9257" stroke="none" />
      <rect x={W - 190} y={H / 2 - 80} width="190" height="160" fill="#bd9257" stroke="none" />

      {/* boundary */}
      <rect x="0" y="0" width={W} height={H} />

      {/* half-court line + circles */}
      <line x1={W / 2} y1="0" x2={W / 2} y2={H} />

      {/* left half */}
      <HalfCourt />
      {/* right half (mirrored) */}
      <g transform={`translate(${W}, 0) scale(-1, 1)`}>
        <HalfCourt />
      </g>

      {/* home team logo in the center circle */}
      <clipPath id="centerCircleClip">
        <circle cx={W / 2} cy={H / 2} r="80" />
      </clipPath>
      <image
        href={`${API_BASE}/api/img/logo/${homeTeamId}`}
        x={W / 2 - 60}
        y={H / 2 - 60}
        width="120"
        height="120"
        clipPath="url(#centerCircleClip)"
        opacity="0.85"
        preserveAspectRatio="xMidYMid slice"
      />
    </g>
  )
}

export default function ShotChart({ game }) {
  const [quarter, setQuarter] = useState("all")
  const [player, setPlayer] = useState("all")
  const [show, setShow] = useState("all") // all | made | missed

  const { data: shots, isLoading, isError } = useQuery({
    queryKey: ["shots", game.id],
    queryFn: () => api.get(`/games/${game.id}/shots`, { timeout: 180000 }).then(r => r.data),
    staleTime: Infinity,
  })

  const periods = useMemo(
    () => [...new Set((shots ?? []).map(s => s.period))].sort((a, b) => a - b),
    [shots]
  )
  const players = useMemo(
    () => [...new Map((shots ?? []).map(s => [s.playerId, s.playerName])).entries()],
    [shots]
  )

  const filtered = useMemo(() => (shots ?? []).filter(s =>
    (quarter === "all" || s.period === Number(quarter)) &&
    (player === "all" || s.playerId === Number(player)) &&
    (show === "all" || (show === "made") === s.made)
  ), [shots, quarter, player, show])

  if (isLoading) return <p className="text-text-muted text-sm">Loading shot chart…</p>
  if (isError) return <p className="text-text-muted text-sm">Shot chart unavailable for this game.</p>

  const selectCls = "bg-primary border border-line rounded-md px-3 py-1.5 text-sm text-white outline-none"

  return (
    <div>
      {/* filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={quarter} onChange={e => setQuarter(e.target.value)} className={selectCls}>
          <option value="all">All Quarters</option>
          {periods.map(p => (
            <option key={p} value={p}>{p <= 4 ? `Q${p}` : `OT${p - 4}`}</option>
          ))}
        </select>
        <select value={show} onChange={e => setShow(e.target.value)} className={selectCls}>
          <option value="all">Made & Missed</option>
          <option value="made">Made only</option>
          <option value="missed">Missed only</option>
        </select>
        <select value={player} onChange={e => setPlayer(e.target.value)} className={selectCls}>
          <option value="all">All Players</option>
          {players.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
      </div>

      {/* court */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-line">
        <CourtLines homeTeamId={game.homeTeamId} />
        {filtered.map((s, i) => {
          const isAway = s.teamId === game.awayTeamId
          const { cx, cy } = toCourt(s, isAway)   // away shoots left, home shoots right
          const color = isAway ? "#d62828" : "#003f88"
          return s.made ? (
            <circle key={i} cx={cx} cy={cy} r="6" fill={color} opacity="0.85" />
          ) : (
            <circle key={i} cx={cx} cy={cy} r="6" fill="none" stroke={color} strokeWidth="2.5" opacity="0.7" />
          )
        })}
      </svg>

      {/* legend */}
      <div className="flex items-center justify-center gap-6 mt-3 text-xs text-text-muted">
        <span className="flex items-center gap-2">
          <TeamLogoImg teamId={game.awayTeamId} className="w-5 h-5 object-contain" />
          <span className="w-3 h-3 rounded-full bg-[#d62828] inline-block" /> made
          <span className="w-3 h-3 rounded-full border-2 border-[#d62828] inline-block" /> missed
        </span>
        <span className="flex items-center gap-2">
          <TeamLogoImg teamId={game.homeTeamId} className="w-5 h-5 object-contain" />
          <span className="w-3 h-3 rounded-full bg-[#003f88] inline-block" /> made
          <span className="w-3 h-3 rounded-full border-2 border-[#003f88] inline-block" /> missed
        </span>
      </div>
    </div>
  )
}