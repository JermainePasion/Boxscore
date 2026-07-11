import PlayerHeadshot from "../PlayerHeadshot"
import TeamLogoImg from "../TeamLogo"

const CATEGORIES = [
  { key: "points", label: "Points" },
  { key: "rebounds", label: "Rebounds" },
  { key: "assists", label: "Assists" },
]

function topFor(stats, key) {
  return [...stats].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))[0] ?? null
}

function LeaderSide({ stat, statKey, teamId, season, align }) {
  if (!stat) return <div className="flex-1" />
  return (
    <div className={`flex-1 flex flex-col ${align === "right" ? "items-end" : "items-start"}`}>
      <div className={`flex items-center gap-3 ${align === "right" ? "flex-row-reverse" : ""}`}>
        <PlayerHeadshot
          playerId={stat.player?.id}
          teamId={teamId}
          season={season}
          className="w-12 h-12 rounded-full bg-primary ring-1 ring-line"
        />
        <span className="text-2xl font-bold text-white">{stat[statKey] ?? 0}</span>
      </div>
      <p className="text-sm text-white mt-1.5">{stat.player?.name}</p>
      <p className="text-xs text-text-muted">{stat.minutes ? `${stat.minutes} MIN` : ""}</p>
    </div>
  )
}

export default function GameLeaders({ game, awayStats, homeStats }) {
  return (
    <div className="max-w-lg mx-auto">
      {/* team header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TeamLogoImg teamId={game.awayTeamId} className="w-8 h-8 object-contain" />
          <span className="font-semibold text-white">{game.awayTeam?.abbreviation ?? game.awayTeam?.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">{game.homeTeam?.abbreviation ?? game.homeTeam?.name}</span>
          <TeamLogoImg teamId={game.homeTeamId} className="w-8 h-8 object-contain" />
        </div>
      </div>

      {CATEGORIES.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-4 py-5 border-t border-line">
          <LeaderSide
            stat={topFor(awayStats, key)}
            statKey={key}
            teamId={game.awayTeamId}
            season={game.season}
            align="left"
          />
          <span className="text-sm font-semibold text-text-muted w-20 text-center shrink-0">
            {label}
          </span>
          <LeaderSide
            stat={topFor(homeStats, key)}
            statKey={key}
            teamId={game.homeTeamId}
            season={game.season}
            align="right"
          />
        </div>
      ))}
    </div>
  )
}