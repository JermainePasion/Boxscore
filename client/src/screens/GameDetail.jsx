import { useState } from "react"
import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { api } from "../lib/api"
import { TEAM_COLORS, teamLogo } from "../utils/teamColors"
import PlayCircleFilledRoundedIcon from "@mui/icons-material/PlayCircleFilledRounded"
import PlayerHeadshot from "../components/PlayerHeadshot"

function BoxScoreTable({ teamName, teamId, stats, season}) {

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <img src={teamLogo(teamId)} alt={teamName} className="w-6 h-6 object-contain" />
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
                      className="w-7 h-7 rounded-full object-cover bg-primary"
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
export default function GameDetail() {
  const { id } = useParams()
  const [playing, setPlaying] = useState(false)

  const { data: game, isLoading, error } = useQuery({
    queryKey: ["game", id],
    queryFn: () => api.get(`/games/${id}`).then(r => r.data),
  })

  if (isLoading) { /* ... skeleton unchanged ... */ }
  if (error || !game) return <p className="text-text-muted">Game not found.</p>

  const gameDate = game.date
    ? new Date(game.date).toLocaleDateString("en-US", {
        day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
      })
    : null

  const homeColor = TEAM_COLORS[game.homeTeamId] ?? "#0a4a6e"
  const awayColor = TEAM_COLORS[game.awayTeamId] ?? "#0a4a6e"
  const matchupName =
    game.title ?? `${game.awayTeam?.name} vs. ${game.homeTeam?.name}`
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
            <img src={teamLogo(game.awayTeamId)} alt="" className="w-20 h-20 object-contain" />
            <span className="text-white/80 font-bold text-2xl">VS</span>
            <img src={teamLogo(game.homeTeamId)} alt="" className="w-20 h-20 object-contain" />
          </div>
        )}
        {/* fade the bottom into the page background */}
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

          {/* ── Small video card (like the mockup's FULL GAME HIGHLIGHTS tile) ── */}
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

        {/* Rating / review panel — placeholder for now */}
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

      {/* ── Box score ── */}
      <div className="flex items-center gap-4 mb-6">
        <h2 className="text-sm font-semibold tracking-widest text-white uppercase">
          Box Score
        </h2>
        <div className="flex-1 h-px bg-accent-red" />
      </div>

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
    </div>
  )
}