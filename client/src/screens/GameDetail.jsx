import { useState, useRef, useEffect, useMemo } from "react"
import { useParams } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "../lib/api"
import { useAuth } from "../context/AuthContext"   
import { TEAM_COLORS } from "../utils/teamColors"
import TeamLogoImg from "../components/TeamLogo"
import PlayerHeadshot from "../components/PlayerHeadshot"
import GameLeaders from "../components/GameDetail/GameLeaders"
import ShotChart from "../components/GameDetail/ShotChart"
import BasketballRating from "../components/GameDetail/BasketballRating"
import AuthModal from "../components/AuthModal"
import ReviewModal from "../components/GameDetail/ReviewModal"
import GameReviews from "../components/GameDetail/GameReviews"
import RatingHistogram from "../components/GameDetail/Ratinghistogram"

import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded"
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded"
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded"
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded"
import BookmarkRoundedIcon from "@mui/icons-material/BookmarkRounded"
import BookmarkBorderRoundedIcon from "@mui/icons-material/BookmarkBorderRounded"
import PlayCircleFilledRoundedIcon from "@mui/icons-material/PlayCircleFilledRounded"


const BOX_COLUMNS = [
  { key: "player",   label: "Player", align: "left" },
  { key: "minutes",  label: "MIN",    align: "center" },
  { key: "points",   label: "PTS",    align: "center" },
  { key: "rebounds", label: "REB",    align: "center" },
  { key: "assists",  label: "AST",    align: "center" },
  { key: "steals",   label: "STL",    align: "center" },
  { key: "blocks",   label: "BLK",    align: "center" },
]

// Minutes can arrive as a number, a "MM:SS" string, or null (DNP → sinks to bottom).
const toMinutes = (m) => {
  if (m == null) return -1
  if (typeof m === "number") return m
  const str = String(m)
  if (str.includes(":")) {
    const [mm, ss] = str.split(":")
    return Number(mm) + (Number(ss) || 0) / 60
  }
  const n = Number(str)
  return Number.isNaN(n) ? -1 : n
}

const cellValue = (s, key) => {
  if (key === "player") return s.player?.name ?? ""
  if (key === "minutes") return toMinutes(s.minutes)
  return s[key] ?? 0
}

function BoxScoreTable({ teamName, teamId, stats, season }) {
  // Default: points, highest first; ties fall back to minutes played.
  const [sort, setSort] = useState({ key: "points", dir: "desc" })
  const [touched, setTouched] = useState(false)   // no column highlighted until first click

  const sorted = useMemo(() => {
    const rows = [...stats]
    const mult = sort.dir === "asc" ? 1 : -1
    rows.sort((a, b) => {
      const av = cellValue(a, sort.key)
      const bv = cellValue(b, sort.key)
      const cmp =
        typeof av === "string" || typeof bv === "string"
          ? String(av).localeCompare(String(bv))
          : av - bv
      if (cmp !== 0) return cmp * mult
      // tiebreak — whoever played more minutes stays on top (the "can't sort on
      // points anymore" fallback, applied to every column except MIN itself)
      return sort.key === "minutes" ? 0 : toMinutes(b.minutes) - toMinutes(a.minutes)
    })
    return rows
  }, [stats, sort])

  const onSort = (key) => {
    setTouched(true)
    setSort(prev =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" }
    )
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <TeamLogoImg teamId={teamId} alt={teamName} className="w-6 h-6 object-contain" />
        <h3 className="font-semibold text-white">{teamName}</h3>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-text-muted text-xs uppercase tracking-wide">
              {BOX_COLUMNS.map(col => {
                const active = touched && sort.key === col.key
                return (
                  <th
                    key={col.key}
                    className={`px-3 py-2 font-medium ${col.align === "left" ? "text-left" : "text-center"}`}
                  >
                    <button
                      type="button"
                      onClick={() => onSort(col.key)}
                      className={`inline-flex items-center gap-0.5 uppercase tracking-wide transition-colors hover:text-white ${
                        col.align === "left" ? "" : "justify-center w-full"
                      } ${active ? "text-gold" : ""}`}
                    >
                      {col.label}
                      {active &&
                        (sort.dir === "asc" ? (
                          <ArrowUpwardRoundedIcon sx={{ fontSize: 13 }} />
                        ) : (
                          <ArrowDownwardRoundedIcon sx={{ fontSize: 13 }} />
                        ))}
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map(s => (
              <tr key={s.id} className="border-t border-line hover:bg-surface-hover transition-colors">
                {BOX_COLUMNS.map(col => {
                  const active = touched && sort.key === col.key
                  const activeCls = active ? "bg-white/[0.05]" : ""

                  if (col.key === "player") {
                    return (
                      <td key={col.key} className={`px-3 py-2 ${activeCls}`}>
                        <div className="flex items-center gap-2">
                          <PlayerHeadshot
                            playerId={s.player?.id}
                            teamId={s.teamId}
                            season={season}
                            className="w-7 h-7 rounded-full bg-primary"
                          />
                          <span className="font-medium text-white whitespace-nowrap">
                            {s.player?.name}
                          </span>
                        </div>
                      </td>
                    )
                  }

                  return (
                    <td
                      key={col.key}
                      className={`text-center px-3 py-2 ${
                        active ? "font-semibold text-gold" : ""
                      } ${col.key === "minutes" && !active ? "text-text-muted" : ""} ${
                        active ? "bg-white/[0.05]" : ""
                      }`}
                    >
                      {col.key === "minutes" ? (s.minutes ?? "—") : s[col.key]}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const TABS = [
  { id: "box", label: "Box Score" },
  { id: "leaders", label: "Game Leaders" },
  { id: "charts", label: "Game Charts" },
  { id: "reviews", label: "Reviews" },
]

export default function GameDetail() {
  const { id } = useParams()
  const [playing, setPlaying] = useState(false)
  const [activeTab, setActiveTab] = useState("box")
  const tabRefs = useRef({})
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  const [ready, setReady] = useState(false)

  const [reviewOpen, setReviewOpen] = useState(false)    
  const [authOpen, setAuthOpen] = useState(false)       

  const { isAuthed, user } = useAuth()                    
  const qc = useQueryClient()    
  
  const [showScore, setShowScore] = useState(false)


  const { data: game, isLoading, isError, failureCount, refetch } = useQuery({
    queryKey: ["game", id],
    queryFn: () => api.get(`/games/${id}`, { timeout: 45000 }).then(r => r.data),
    retry: 2,
    retryDelay: 2000,
  })

   const quickRate = useMutation({
    mutationFn: (rating) =>
      api.post("/reviews", { gameId: id, rating }).then(r => r.data),
    onSuccess: () => {                                        // ← replace the old one-liner
      qc.invalidateQueries({ queryKey: ["game", id] })
      qc.invalidateQueries({ queryKey: ["reviews", id] })
    },
  })

  const watchStatus = useQuery({
    queryKey: ["watchlist", "status", id],
    queryFn: () => api.get(`/watchlist/${id}/status`).then(r => r.data),
    enabled: isAuthed,
  })
  const onList = watchStatus.data?.watchlisted ?? false

  const toggleWatch = useMutation({
    mutationFn: () =>
      onList
        ? api.delete(`/watchlist/${id}`).then(r => r.data)
        : api.post(`/watchlist/${id}`).then(r => r.data),
    onSuccess: (data) => {
      qc.setQueryData(["watchlist", "status", id], data)   // reflect immediately
      qc.invalidateQueries({ queryKey: ["watchlist", "me"] }) // refresh the list page
    },
  })


  useEffect(() => {
    const measure = () => {
      const el = tabRefs.current[activeTab]
      if (el) {
        setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
        setReady(true)
      }
    }

    const raf = requestAnimationFrame(measure)
    document.fonts?.ready.then(measure)
    window.addEventListener("resize", measure)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", measure)
    }
  }, [activeTab, isLoading])   


  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="aspect-video rounded-xl bg-surface mb-6" />
        <div className="h-8 bg-surface rounded w-2/3 mb-3" />
        <div className="h-4 bg-surface rounded w-1/3 mb-6" />
        <p className="text-text-muted text-sm">
          {failureCount > 0
            ? "Still fetching game data from the NBA — this can take a moment for first-time games…"
            : "Loading game…"}
        </p>
      </div>
    )
  }

  if (isError || !game) {
    return (
      <div className="text-center py-16">
        <p className="text-text-muted mb-4">Couldn't load this game right now.</p>
        <button
          onClick={() => refetch()}
          className="px-5 py-2 rounded-md bg-accent-orange text-primary-dark font-semibold text-sm hover:bg-gold transition-colors"
        >
          Try again
        </button>
      </div>
    )
  }

  const myReview = game.reviews?.find(r => r.userId === user?.id) ?? null

  const gameDate = game.date
    ? new Date(game.date).toLocaleDateString("en-US", {
        day: "numeric", month: "long", year: "numeric",
        timeZone: "UTC",
      })
    : null

  const homeColor = TEAM_COLORS[game.homeTeamId] ?? "#0a4a6e"
  const awayColor = TEAM_COLORS[game.awayTeamId] ?? "#0a4a6e"

  const matchupName =
    game.title ??
    (game.awayTeam && game.homeTeam
      ? `${game.awayTeam.name} vs. ${game.homeTeam.name}`
      : "Unknown Matchup")

  const homeStats = game.stats?.filter(s => s.teamId === game.homeTeamId) ?? []
  const awayStats = game.stats?.filter(s => s.teamId === game.awayTeamId) ?? []
  const awayScore = awayStats.reduce((sum, s) => sum + (s.points ?? 0), 0)
  const homeScore = homeStats.reduce((sum, s) => sum + (s.points ?? 0), 0)

  return (
    <div>
      {/* ── HERO BANNER — YouTube thumbnail as full-width backdrop ── */}
      <div className="relative -mx-4 sm:-mx-6 mb-8 h-56 md:h-80 overflow-hidden">
        {game.youtubeId ? (
          <img
            src={`https://img.youtube.com/vi/${game.youtubeId}/maxresdefault.jpg`}
            alt=""
            className="w-full h-full object-cover"
            onError={e => {
              e.target.src = `https://img.youtube.com/vi/${game.youtubeId}/hqdefault.jpg`
            }}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center gap-6"
            style={{
              background: `linear-gradient(105deg, ${awayColor}66 0%, ${awayColor}66 30%, ${homeColor}66 70%, ${homeColor}66 100%), linear-gradient(180deg, #06222f 0%, #001d2e 100%)`,
            }}
          >
            <TeamLogoImg teamId={game.awayTeamId} className="w-20 h-20 object-contain" />
            <span className="text-white/80 font-bold text-2xl">VS</span>
            <TeamLogoImg teamId={game.homeTeamId} className="w-20 h-20 object-contain" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-primary-dark to-transparent" />
      </div>

      {/* ── Title / date / description + Rate panel ── */}
      <div className="grid md:grid-cols-3 gap-8 mb-10">
        <div className="md:col-span-2">
          <h1 className="text-2xl md:text-3xl font-bold text-white uppercase tracking-wide">
            {matchupName}
          </h1>
          {gameDate && <p className="text-gold text-sm mt-1">{gameDate}</p>}

          {(awayStats.length > 0 || homeStats.length > 0) && (
            <div className="mt-4 flex items-center gap-3">
              <div className="flex items-center gap-4 rounded-lg border border-line bg-primary px-4 py-2">
                <div className="flex items-center gap-2">
                  <TeamLogoImg teamId={game.awayTeamId} className="w-6 h-6 object-contain" />
                  <span
                    className={`text-xl font-bold tabular-nums text-white transition ${
                      showScore ? "" : "blur-md select-none"
                    }`}
                  >
                    {awayScore}
                  </span>
                </div>
                <span className="text-text-muted text-sm">—</span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xl font-bold tabular-nums text-white transition ${
                      showScore ? "" : "blur-md select-none"
                    }`}
                  >
                    {homeScore}
                  </span>
                  <TeamLogoImg teamId={game.homeTeamId} className="w-6 h-6 object-contain" />
                </div>
              </div>

              <button
                onClick={() => setShowScore(v => !v)}
                className="text-text-muted hover:text-white transition-colors"
                aria-label={showScore ? "Hide final score" : "Show final score"}
                title={showScore ? "Hide score" : "Show final score"}
              >
                {showScore ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
              </button>
            </div>
          )}

          {game.description && (
            <p className="text-text-muted leading-relaxed mt-4">{game.description}</p>
          )}

          {/* Small video card */}
          {game.youtubeId && (
            playing ? (
              <div className="relative w-full max-w-md aspect-video mt-6 rounded-lg overflow-hidden border border-line">
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src={`https://www.youtube.com/embed/${game.youtubeId}?autoplay=1`}
                  title={matchupName}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <button
                onClick={() => setPlaying(true)}
                className="relative w-48 aspect-video mt-6 rounded-lg overflow-hidden border border-line group cursor-pointer block"
              >
                <img
                  src={`https://img.youtube.com/vi/${game.youtubeId}/mqdefault.jpg`}
                  alt="Watch highlights"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/15 transition-colors flex items-center justify-center">
                  <PlayCircleFilledRoundedIcon className="text-white drop-shadow" sx={{ fontSize: 40 }} />
                </div>
              </button>
            )
          )}
        </div>

        {/* Rate panel */}
                {/* Rate panel + distribution */}
        <div className="flex flex-col gap-4">
          <div className="bg-primary rounded-xl border border-line p-5 h-fit">
            <h2 className="text-center font-semibold text-white mb-4">Rate</h2>

            <div className="flex justify-center mb-4">
              <BasketballRating
                value={myReview?.rating ?? 0}
                onChange={(r) => {
                  if (!isAuthed) return setAuthOpen(true)
                  quickRate.mutate(r)
                }}
                size={30}
              />
            </div>

            <p className="text-center text-text-muted text-xs mb-4">
              {game._count?.reviews ?? 0} review{game._count?.reviews !== 1 ? "s" : ""}
            </p>

            <button
              onClick={() => (isAuthed ? setReviewOpen(true) : setAuthOpen(true))}
              className="w-full py-2 rounded-md bg-accent-orange text-primary-dark font-semibold text-sm hover:bg-gold transition-colors"
            >
              {myReview ? "Edit review" : "Review / Log"}
            </button>

              <button
                onClick={() => (isAuthed ? toggleWatch.mutate() : setAuthOpen(true))}
                disabled={toggleWatch.isPending}
                className={`mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-semibold transition-colors disabled:opacity-60 ${
                  onList
                    ? "bg-primary-dark text-gold border border-gold/60 hover:border-gold"
                    : "border border-line text-white hover:border-gold hover:text-gold"
                }`}
              >
                {onList ? (
                  <>
                    <BookmarkRoundedIcon sx={{ fontSize: 16 }} />
                    On your watchlist
                  </>
                ) : (
                  <>
                    <BookmarkBorderRoundedIcon sx={{ fontSize: 16 }} />
                    Add to watchlist
                  </>
                )}
              </button>
          </div>

          <RatingHistogram distribution={game.ratingDistribution} average={game.averageRating} />
        </div>
      </div>

      {/* ── Tabs: Box Score / Game Leaders / Game Charts ── */}
      <div className="relative flex items-center justify-center gap-10 border-b border-line mb-6">
        {TABS.map(t => (
          <button
            key={t.id}
            ref={el => (tabRefs.current[t.id] = el)}
            onClick={() => setActiveTab(t.id)}
            className={`pb-3 text-sm font-medium transition-colors ${
              activeTab === t.id ? "text-white" : "text-text-muted hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
        <span
          className={`absolute bottom-0 h-0.5 bg-accent-red ${ready ? "transition-all duration-300 ease-out" : ""}`}
          style={{ left: indicator.left, width: indicator.width }}
        />
      </div>

      {activeTab === "box" && (
        <>
          {awayStats.length > 0 && (
            <BoxScoreTable
              teamName={game.awayTeam?.name}
              teamId={game.awayTeamId}
              stats={awayStats}
              season={game.season}
            />
          )}
          {homeStats.length > 0 && (
            <BoxScoreTable
              teamName={game.homeTeam?.name}
              teamId={game.homeTeamId}
              stats={homeStats}
              season={game.season}
            />
          )}
          {game.stats?.length === 0 && (
            <p className="text-text-muted text-sm">No box score data available for this game.</p>
          )}
        </>
      )}

      {activeTab === "leaders" && (
        <GameLeaders game={game} awayStats={awayStats} homeStats={homeStats} />
      )}

      {activeTab === "charts" && <ShotChart game={game} />}

      {activeTab === "reviews" && <GameReviews game={game} />}

      <ReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        game={game}
        existing={myReview}
      />
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        initialMode="login"
      />
    </div>
  
    
  )
}