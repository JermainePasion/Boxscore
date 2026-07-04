import { Link } from "react-router-dom"
import { TEAM_COLORS, teamLogo } from "../utils/teamColors"

export default function GameCard({ game }) {
  const homeColor = TEAM_COLORS[game.homeTeamId] ?? "#0a4a6e"
  const awayColor = TEAM_COLORS[game.awayTeamId] ?? "#0a4a6e"

  const gameDate = game.date
    ? new Date(game.date).toLocaleDateString("en-US", {
        day: "numeric", month: "long", year: "numeric",
      })
    : null

  return (
    <Link
      to={`/games/${game.id}`}
      className="group block rounded-xl overflow-hidden border border-line bg-surface
                 hover:border-gold transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-black/40"
    >
      {/* Matchup area with team-color gradient */}
       <div
        className="relative aspect-[3/4] flex items-center justify-center"
        style={{
          background: `linear-gradient(105deg, ${awayColor}66 0%, ${awayColor}66 30%, ${homeColor}66 70%, ${homeColor}66 100%), linear-gradient(180deg, #06222f 0%, #001d2e 100%)`,
        }}
      >
        <div className="flex items-center gap-3 px-4">
          <img
            src={teamLogo(game.awayTeamId)}
            alt={game.awayTeam?.name}
            className="w-16 h-16 object-contain drop-shadow-lg group-hover:scale-110 transition-transform"
          />
          <span className="text-gold font-bold text-lg">VS</span>
          <img
            src={teamLogo(game.homeTeamId)}
            alt={game.homeTeam?.name}
            className="w-16 h-16 object-contain drop-shadow-lg group-hover:scale-110 transition-transform"
          />
        </div>

        {/* Review count badge */}
        {game._count?.reviews > 0 && (
          <span className="absolute top-2 right-2 text-xs bg-primary-dark/80 text-gold px-2 py-0.5 rounded-full">
            {game._count.reviews} review{game._count.reviews !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Info footer */}
      <div className="p-3">
        <p className="text-sm font-semibold text-white leading-snug line-clamp-2">
          {game.title ?? `${game.awayTeam?.name ?? "Away"} @ ${game.homeTeam?.name ?? "Home"}`}
        </p>
        {gameDate && (
          <p className="text-xs text-text-muted mt-1">{gameDate}</p>
        )}
      </div>
    </Link>
  )
}