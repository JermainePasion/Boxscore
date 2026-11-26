import { useQuery } from "@tanstack/react-query"
import { useState, useRef, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { api } from "../lib/api"
import GameCard from "../components/GameCard"
import ActivityFeed from "../components/Feed/ActivityFeed"
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded"
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded"
import ViewCarouselRoundedIcon from "@mui/icons-material/ViewCarouselRounded"
import TableRowsRoundedIcon from "@mui/icons-material/TableRowsRounded"
import PlayCircleRoundedIcon from "@mui/icons-material/PlayCircleRounded"
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded"
import TeamLogoImg from "../components/TeamLogo"
import { useSettings } from "../context/SettingsContext"

/* ── shared section header: title, red rule, optional controls on the right ── */
function SectionHeader({ title, children }) {
  return (
    <div className="flex items-center gap-4 mb-4">
      <h2 className="text-sm font-semibold tracking-widest text-white uppercase">{title}</h2>
      <div className="flex-1 h-px bg-accent-red" />
      {children}
    </div>
  )
}

/* ── plain grid row (Popular) ── */
function GameRow({ title, games, isLoading }) {
  return (
    <section className="mb-10">
      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-sm font-semibold tracking-widest text-white uppercase">
          {title}
        </h2>
        <div className="flex-1 h-px bg-accent-red" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-xl bg-surface animate-pulse" />
          ))}
        </div>
      ) : games?.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {games.slice(0, 10).map(game => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      ) : (
        <p className="text-text-muted text-sm">No games to show yet.</p>
      )}
    </section>
  )
}

/* ── looping coverflow carousel (Latest Games) ── */
const GAP = 16               // px of visible space between every pair of adjacent cards
const MAX_RANGE = 3          // how many cards to show on each side of center
const SCALE_STEP = 0.13      // how much smaller each card gets per step away from center
const DRAG_STEP = 170        // px of drag that counts as moving one card

const scaleAt = (ad) => 1 - Math.min(ad, MAX_RANGE) * SCALE_STEP

// Cards shrink as they move away from the center, so a fixed center-to-center
// distance makes the gaps uneven (the center card overlaps its neighbors while
// the outer cards drift apart). Instead, walk outward and add half of each
// neighbor's *scaled* width plus GAP. Returned in "card widths" so it can be
// used as a translate % (which is relative to the card's unscaled width).
const offsetUnits = (ad) => {
  let units = 0
  for (let j = 1; j <= ad; j++) units += (scaleAt(j - 1) + scaleAt(j)) / 2
  return units
}

function CarouselRow({ title, games, isLoading, skeletons = 5, actions }) {
  const list = games ?? []
  const N = list.length
  const [active, setActive] = useState(0)

  // How far out we render. Kept below N/2 so the point where a card wraps from
  // the far right to the far left always happens off-screen (hidden), which is
  // what makes the infinite loop look seamless instead of sliding across.
  const range = Math.max(0, Math.min(MAX_RANGE, Math.floor((N - 1) / 2)))

  // keep active valid if the data length changes
  useEffect(() => {
    if (N && active > N - 1) setActive(0)
  }, [N, active])

  // drag / swipe
  const drag = useRef({ startX: 0, dx: 0, active: false, moved: false })
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)

  const wrap = (i) => ((i % N) + N) % N
  const go = (dir) => setActive((a) => wrap(a + dir))

  const onDown = (e) => {
    drag.current = { startX: e.clientX, dx: 0, active: true, moved: false }
    setDragging(true)
  }
  const onMove = (e) => {
    if (!drag.current.active) return
    const dx = e.clientX - drag.current.startX
    drag.current.dx = dx
    if (Math.abs(dx) > 5) drag.current.moved = true
    setDragX(dx)
  }
  const onUp = () => {
    if (!drag.current.active) return
    const steps = Math.round(-drag.current.dx / DRAG_STEP)
    if (steps !== 0) setActive((a) => wrap(a + steps))
    drag.current.active = false
    setDragging(false)
    setDragX(0)
  }

  return (
    <section className="mb-10">
      <SectionHeader title={title}>{actions}</SectionHeader>

      {isLoading ? (
        <div className="flex justify-center gap-4 h-[320px] items-center">
          {Array.from({ length: Math.min(skeletons, 3) }).map((_, i) => (
            <div
              key={i}
              className="w-40 sm:w-44 aspect-[4/5] rounded-xl bg-surface animate-pulse"
              style={{ opacity: i === 1 ? 1 : 0.4 }}
            />
          ))}
        </div>
      ) : N === 0 ? (
        <p className="text-text-muted text-sm">Nothing to show yet.</p>
      ) : (
        <div className="relative mx-12 isolate">
          {/* left arrow */}
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous"
            className="absolute -left-12 top-1/2 -translate-y-1/2 z-[200] grid h-9 w-9 place-items-center
                       rounded-full bg-surface border border-line text-white hover:border-gold transition-colors"
          >
            <ChevronLeftRoundedIcon sx={{ fontSize: 20 }} />
          </button>

          {/* stage */}
          <div
            className="relative h-[320px] overflow-hidden select-none touch-pan-y cursor-grab active:cursor-grabbing"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
          >
            {list.map((g, i) => {
              // signed shortest distance from the active (center) card, wrapped
              let d = i - active
              if (d > N / 2) d -= N
              if (d < -N / 2) d += N

              const ad = Math.abs(d)
              if (ad > range) return null

              const isCenter = d === 0
              const scale = scaleAt(ad)
              // outermost ring is rendered but fully transparent — cards fade out
              // at the edges instead of popping in/out
              const opacity =
                ad === range ? 0 : isCenter ? 1 : Math.max(0.12, 0.55 - (ad - 1) * 0.18)
              const sign = Math.sign(d)
              const pct = sign * offsetUnits(ad) * 100   // % of card width
              const px = sign * ad * GAP + dragX

              return (
                <div
                  key={g.id}
                  onClickCapture={(e) => {
                    // a drag shouldn't trigger navigation; a side-card click centers it
                    if (drag.current.moved) {
                      e.preventDefault()
                      e.stopPropagation()
                    } else if (!isCenter) {
                      e.preventDefault()
                      e.stopPropagation()
                      setActive(i)
                    }
                  }}
                  className={`absolute left-1/2 top-1/2 w-40 sm:w-44 ${
                    dragging ? "" : "transition-all duration-300 ease-out"
                  } ${isCenter ? "" : "pointer-events-auto"}`}
                  style={{
                    transform: `translate(calc(-50% + ${pct}% + ${px}px), -50%) scale(${scale})`,
                    opacity,
                    zIndex: 100 - ad,
                    filter: isCenter ? "none" : "saturate(0.85)",
                  }}
                >
                  <GameCard game={g} />
                </div>
              )
            })}
          </div>

          {/* right arrow */}
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next"
            className="absolute -right-12 top-1/2 -translate-y-1/2 z-[200] grid h-9 w-9 place-items-center
                       rounded-full bg-surface border border-line text-white hover:border-gold transition-colors"
          >
            <ChevronRightRoundedIcon sx={{ fontSize: 20 }} />
          </button>
        </div>
      )}
    </section>
  )
}

/* ── Latest Games: card / table toggle ── */
const VIEW_KEY = "latestGamesView"

function readSavedView() {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    return v === "table" || v === "cards" ? v : "cards"
  } catch {
    return "cards"
  }
}

function ViewToggle({ view, onChange }) {
  const btn = (value, label, Icon) => (
    <button
      type="button"
      onClick={() => onChange(value)}
      aria-pressed={view === value}
      title={`${label} view`}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
        view === value ? "bg-accent-orange text-on-accent" : "text-text-muted hover:text-white"
      }`}
    >
      <Icon sx={{ fontSize: 16 }} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
  return (
    <div role="group" aria-label="Latest games view" className="flex shrink-0 rounded-lg border border-line bg-surface p-0.5">
      {btn("cards", "Cards", ViewCarouselRoundedIcon)}
      {btn("table", "Table", TableRowsRoundedIcon)}
    </div>
  )
}

// Game dates are stored as the US (Eastern) game date, so format them in UTC
// to show that same date everywhere (matches GameCard).
const dayKey = (date) => (date ? new Date(date).toISOString().slice(0, 10) : "unknown")
const dayLabel = (date) =>
  date
    ? new Date(date).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
      })
    : "Date unknown"

// Abbreviation on phones ("LAL"), nickname on wider screens ("Lakers").
function TeamCell({ team, teamId, align = "left", strong }) {
  const short = team?.abbreviation || team?.name || "—"
  const long = team?.name || team?.abbreviation || "—"
  const name = (
    <span className={`truncate ${strong ? "font-bold text-gold" : "text-white"}`} title={team?.name}>
      <span className="sm:hidden">{short}</span>
      <span className="hidden sm:inline">{long}</span>
    </span>
  )
  return (
    <div className={`flex min-w-0 items-center gap-2 ${align === "right" ? "justify-end" : ""}`}>
      {align === "right" && name}
      <TeamLogoImg teamId={teamId} alt="" className="h-7 w-7 shrink-0 object-contain" />
      {align !== "right" && name}
    </div>
  )
}

function LatestGamesTable({ title, games, isLoading, actions }) {
  const navigate = useNavigate()
  const { settings } = useSettings()
  const hideScores = settings.hideScores
  const list = games ?? []

  // group consecutive games by day, keeping the API's order (newest first)
  const groups = []
  for (const g of list) {
    const key = dayKey(g.date)
    if (!groups.length || groups[groups.length - 1].key !== key) {
      groups.push({ key, label: dayLabel(g.date), games: [] })
    }
    groups[groups.length - 1].games.push(g)
  }

  return (
    <section className="mb-10">
      <SectionHeader title={title}>{actions}</SectionHeader>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-surface animate-pulse" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="text-text-muted text-sm">Nothing to show yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full table-fixed text-sm">
            <caption className="sr-only">
              Latest games{hideScores ? ", scores hidden" : ""}
            </caption>
            <thead>
              <tr className="bg-surface text-[11px] uppercase tracking-wider text-text-muted">
                <th scope="col" className="w-[38%] sm:w-[34%] px-3 sm:px-4 py-2.5 text-right font-semibold">Away</th>
                <th scope="col" className="w-[24%] sm:w-[16%] px-2 py-2.5 text-center font-semibold">Score</th>
                <th scope="col" className="w-[38%] sm:w-[34%] px-3 sm:px-4 py-2.5 text-left font-semibold">Home</th>
                <th scope="col" className="hidden sm:table-cell px-3 py-2.5 text-center font-semibold">Reviews</th>
                <th scope="col" className="hidden sm:table-cell px-3 py-2.5 text-center font-semibold">
                  <span className="sr-only">Highlights</span>
                  <PlayCircleRoundedIcon sx={{ fontSize: 16 }} aria-hidden="true" />
                </th>
              </tr>
            </thead>
            {groups.map((group) => (
              <tbody key={group.key}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={5}
                    className="bg-primary-dark/60 px-4 py-2 text-left text-xs font-semibold text-gold border-t border-line"
                  >
                    {group.label}
                  </th>
                </tr>
                {group.games.map((g) => {
                  const away = g.away?.total
                  const home = g.home?.total
                  const hasScore = !g.stub && (away > 0 || home > 0)
                  // winner highlight only when scores are visible (it would give the result away)
                  const awayWon = hasScore && !hideScores && away > home
                  const homeWon = hasScore && !hideScores && home > away
                  const reviews = g._count?.reviews ?? 0

                  return (
                    <tr
                      key={g.id}
                      onClick={() => navigate(`/games/${g.id}`)}
                      className="cursor-pointer border-t border-line transition-colors hover:bg-surface-hover"
                    >
                      {g.stub ? (
                        <td colSpan={3} className="px-3 py-2.5 text-center">
                          <Link
                            to={`/games/${g.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-white hover:text-gold"
                          >
                            {g.title ?? g.matchup}
                          </Link>
                          <span className="ml-2 text-xs text-text-muted">Not loaded yet</span>
                        </td>
                      ) : (
                        <>
                      <td className="px-3 sm:px-4 py-2.5">
                        <TeamCell team={g.awayTeam} teamId={g.awayTeamId} align="right" strong={awayWon} />
                      </td>
                      <td className="px-2 py-2.5 text-center whitespace-nowrap">
                        {hasScore ? (
                          <Link
                            to={`/games/${g.id}`}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={
                              hideScores
                                ? `Open game, score hidden`
                                : `Open game, ${g.awayTeam?.name ?? "away"} ${away}, ${g.homeTeam?.name ?? "home"} ${home}`
                            }
                            title={hideScores ? "Score hidden. You can change this in Settings." : undefined}
                            className="inline-flex items-center gap-2 font-bold tabular-nums"
                          >
                            <span className={hideScores ? "blur-xs select-none text-white" : awayWon ? "text-gold" : "text-white"}>
                              {away}
                            </span>
                            <span className="text-text-muted font-normal">–</span>
                            <span className={hideScores ? "blur-xs select-none text-white" : homeWon ? "text-gold" : "text-white"}>
                              {home}
                            </span>
                          </Link>
                        ) : (
                          <Link
                            to={`/games/${g.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-text-muted hover:text-gold"
                          >
                            View
                          </Link>
                        )}
                      </td>
                      <td className="px-3 sm:px-4 py-2.5">
                        <TeamCell team={g.homeTeam} teamId={g.homeTeamId} strong={homeWon} />
                      </td>
                        </>
                      )}
                      <td className="hidden sm:table-cell px-3 py-2.5 text-center text-text-muted">
                        {reviews > 0 ? (
                          <span className="inline-flex items-center gap-1 text-gold">
                            <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 14 }} aria-hidden="true" />
                            {reviews}
                          </span>
                        ) : (
                          <span aria-label="No reviews">–</span>
                        )}
                      </td>
                      <td className="hidden sm:table-cell px-3 py-2.5 text-center">
                        {g.youtubeId ? (
                          <PlayCircleRoundedIcon
                            sx={{ fontSize: 18 }}
                            className="text-accent-red"
                            titleAccess="Highlights available"
                          />
                        ) : (
                          <span className="text-text-muted" aria-label="No highlights">–</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </section>
  )
}

export default function Home() {
  const recent = useQuery({
    queryKey: ["games", "recent"],
    queryFn: () => api.get("/games/recent", { timeout: 300000 }).then((r) => r.data), // 5 min ceiling
    staleTime: 30 * 60 * 1000,
  })

  const [view, setView] = useState(readSavedView)
  const changeView = (v) => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* storage unavailable (private mode): the choice just isn't remembered */
    }
  }
  const toggle = <ViewToggle view={view} onChange={changeView} />

  const popular = useQuery({
    queryKey: ["games", "popular"],
    queryFn: () => api.get("/games/popular").then(r => r.data),
  })

  return (
    <div>
      {view === "table" ? (
        <LatestGamesTable
          title="Latest Games"
          games={recent.data}
          isLoading={recent.isLoading}
          actions={toggle}
        />
      ) : (
        <CarouselRow
          title="Latest Games"
          games={recent.data}
          isLoading={recent.isLoading}
          skeletons={10}
          actions={toggle}
        />
      )}
      <GameRow
        title="Popular Games"
        games={popular.data}
        isLoading={popular.isLoading}
      />
      <ActivityFeed />
    </div>
  )
}