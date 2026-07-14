import { Link } from "react-router-dom"
import TeamLogoImg from "./TeamLogo"
import PlayerHeadshot from "./PlayerHeadshot"

function LeaderRow({ label, away, home, awayTeamId, homeTeamId, season }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <PlayerHeadshot
          playerId={away?.playerId}
          teamId={awayTeamId}
          season={season}
          className="w-10 h-10 rounded-full object-cover object-top bg-primary ring-1 ring-line"
        />
        <span className="font-bold text-white">{away?.value ?? "—"}</span>
      </div>

      <span className="text-text-muted uppercase tracking-wider text-[10px]">{label}</span>

      <div className="flex items-center gap-2">
        <span className="font-bold text-white">{home?.value ?? "—"}</span>
        <PlayerHeadshot
          playerId={home?.playerId}
          teamId={homeTeamId}
          season={season}
          className="w-10 h-10 rounded-full object-cover object-top bg-primary ring-1 ring-line"
        />
      </div>
    </div>
  )
}

export default function GameCard({ game }) {

  if (game.stub) {
  return (
    <Link
      to={`/games/${game.id}`}
      className="group block rounded-xl overflow-hidden border border-line bg-surface
                 hover:border-gold transition-all hover:-translate-y-1"
    >
      <div className="aspect-[3/4] flex flex-col items-center justify-center gap-2 px-4 text-center">
        <span className="text-sm font-semibold text-white">{game.title}</span>
        <span className="text-xs text-text-muted">Tap to load game data</span>
      </div>
      <div className="p-3 border-t border-line">
        <p className="text-xs text-text-muted">
          {game.date && new Date(game.date).toLocaleDateString("en-US", {
            day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
          })}
        </p>
      </div>
    </Link>
  )
}

  const gameDate = game.date
    ? new Date(game.date).toLocaleDateString("en-US", {
        day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
      })
    : null

  const hasLeaders = game.home && game.away && (game.home.total > 0 || game.away.total > 0)

  return (
    <Link
      to={`/games/${game.id}`}
      className="group block rounded-xl overflow-hidden border border-line bg-surface
                 hover:border-gold transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-black/40"
    >
      <div className="relative aspect-[3/4] bg-surface">

        {/* ── Default face: logos + VS ── */}
        <div className="absolute inset-0 flex items-center justify-center gap-3 px-4
                        transition-opacity duration-200 group-hover:opacity-0">
          <TeamLogoImg
            teamId={game.awayTeamId}
            alt={game.awayTeam?.name}
            className="w-16 h-16 object-contain drop-shadow-lg"
          />
          <span className="text-white/80 font-bold text-lg">VS</span>
          <TeamLogoImg
            teamId={game.homeTeamId}
            alt={game.homeTeam?.name}
            className="w-16 h-16 object-contain drop-shadow-lg"
          />
        </div>

        {/* ── Hover face: leaders + total score ── */}
        {hasLeaders && (
          <div className="absolute inset-0 flex flex-col justify-center gap-3 px-3
                          opacity-0 group-hover:opacity-100 transition-opacity duration-200
                          bg-primary-dark/95">
            {/* mini team header */}
            <div className="flex items-center justify-between px-1">
              <TeamLogoImg
                teamId={game.awayTeamId}
                alt={game.awayTeam?.name}
                className="w-7 h-7 object-contain"
              />
              <span className="text-[10px] text-text-muted uppercase tracking-wider">Leaders</span>
              <TeamLogoImg
                teamId={game.homeTeamId}
                alt={game.homeTeam?.name}
                className="w-7 h-7 object-contain"
              />
            </div>

            <LeaderRow label="PTS" away={game.away.points} home={game.home.points}
              awayTeamId={game.awayTeamId} homeTeamId={game.homeTeamId} season={game.season} />
            <LeaderRow label="REB" away={game.away.rebounds} home={game.home.rebounds}
              awayTeamId={game.awayTeamId} homeTeamId={game.homeTeamId} season={game.season} />
            <LeaderRow label="AST" away={game.away.assists} home={game.home.assists}
              awayTeamId={game.awayTeamId} homeTeamId={game.homeTeamId} season={game.season} />

            {/* total score */}
            <div className="border-t border-line pt-3 mt-1 flex items-center justify-center gap-3">
              <span className={`text-xl font-bold ${game.away.total > game.home.total ? "text-gold" : "text-white"}`}>
                {game.away.total}
              </span>
              <span className="text-text-muted text-xs">—</span>
              <span className={`text-xl font-bold ${game.home.total > game.away.total ? "text-gold" : "text-white"}`}>
                {game.home.total}
              </span>
            </div>
          </div>
        )}

        {/* review count badge */}
        {game._count?.reviews > 0 && (
          <span className="absolute top-2 right-2 text-xs bg-primary-dark/80 text-gold px-2 py-0.5 rounded-full z-10">
            {game._count.reviews} review{game._count.reviews !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Info footer */}
      <div className="p-3 border-t border-line">
        <p className="text-sm font-semibold text-white leading-snug line-clamp-2">
          {game.title ?? `${game.awayTeam?.name ?? "Away"} @ ${game.homeTeam?.name ?? "Home"}`}
        </p>
        {gameDate && <p className="text-xs text-text-muted mt-1">{gameDate}</p>}
      </div>
    </Link>
  )
}