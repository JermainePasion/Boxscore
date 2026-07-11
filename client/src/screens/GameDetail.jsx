import { useState, useRef, useEffect } from "react"
import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { api } from "../lib/api"
import { TEAM_COLORS } from "../utils/teamColors"
import TeamLogoImg from "../components/TeamLogo"
import PlayerHeadshot from "../components/PlayerHeadshot"
import GameLeaders from "../components/GameDetail/GameLeaders"
import ShotChart from "../components/GameDetail/ShotChart"
import PlayCircleFilledRoundedIcon from "@mui/icons-material/PlayCircleFilledRounded"

function BoxScoreTable({ teamName, teamId, stats, season }) {

  
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
              <th className="text-left px-3 py-2 font-medium">Player</th>
              <th className="px-3 py-2 font-medium">MIN</th>
              <th className="px-3 py-2 font-medium">PTS</th>
              <th className="px-3 py-2 font-medium">REB</th>
              <th className="px-3 py-2 font-medium">AST</th>
              <th className="px-3 py-2 font-medium">STL</th>
              <th className="px-3 py-2 font-medium">BLK</th>
            </tr>
          </thead>
          <tbody>
            {stats.map(s => (
              <tr key={s.id} className="border-t border-line hover:bg-surface-hover transition-colors">
                <td className="px-3 py-2">
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
                <td className="text-center px-3 py-2 text-text-muted">{s.minutes ?? "—"}</td>
                <td className="text-center px-3 py-2 font-semibold text-gold">{s.points}</td>
                <td className="text-center px-3 py-2">{s.rebounds}</td>
                <td className="text-center px-3 py-2">{s.assists}</td>
                <td className="text-center px-3 py-2">{s.steals}</td>
                <td className="text-center px-3 py-2">{s.blocks}</td>
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
]

export default function GameDetail() {
  const { id } = useParams()
  const [playing, setPlaying] = useState(false)
  const [activeTab, setActiveTab] = useState("box")
  const tabRefs = useRef({})
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  const [ready, setReady] = useState(false)


  const { data: game, isLoading, isError, failureCount, refetch } = useQuery({
    queryKey: ["game", id],
    queryFn: () => api.get(`/games/${id}`, { timeout: 45000 }).then(r => r.data),
    retry: 2,
    retryDelay: 2000,
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
        <div className="bg-primary rounded-xl border border-line p-5 h-fit">
          <h2 className="text-center font-semibold text-white mb-4">Rate</h2>
          <p className="text-center text-text-muted text-sm mb-4">
            {game._count?.reviews ?? 0} review{game._count?.reviews !== 1 ? "s" : ""}
          </p>
          <button className="w-full py-2 rounded-md bg-accent-orange text-primary-dark font-semibold text-sm hover:bg-gold transition-colors">
            Review / Log
          </button>
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
    </div>
  )
}