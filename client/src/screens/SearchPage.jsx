import { useSearchParams, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { api } from "../lib/api"
import TeamLogoImg from "../components/TeamLogo"
import { ABBR_TO_ID, TEAM_COLORS } from "../utils/teamColors"

function parseMatchup(matchup) {
  // "LAL vs. OKC" or "LAL @ OKC"
  const m = matchup?.match(/^(\w+)\s+(vs\.|@)\s+(\w+)$/)
  if (!m) return null
  return { left: m[1], sep: m[2] === "@" ? "@" : "vs", right: m[3] }
}

function ResultRow({ r }) {
  const parsed = parseMatchup(r.matchup)
  const dateStr = r.date
    ? new Date(r.date).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
      })
    : null

  const leftId = parsed ? ABBR_TO_ID[parsed.left] : null
  const rightId = parsed ? ABBR_TO_ID[parsed.right] : null
  const leftColor = TEAM_COLORS[leftId] ?? "transparent"

  return (
    <Link
      to={`/games/${r.gameId}`}
      className="group flex items-center gap-4 px-4 py-3 rounded-lg border border-line bg-surface
                 hover:border-gold hover:bg-surface-hover transition-all border-l-4"
      style={{ borderLeftColor: leftColor }}
    >
      {parsed ? (
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <TeamLogoImg teamId={leftId} className="w-15 h-15 object-contain" />
          <span className="text-sm font-semibold text-white">{parsed.left}</span>
          <span className="text-xs text-text-muted">{parsed.sep}</span>
          <span className="text-sm font-semibold text-white">{parsed.right}</span>
          {rightId && <TeamLogoImg teamId={rightId} className="w-15 h-15 object-contain" />}
        </div>
      ) : (
        <span className="text-sm text-white flex-1">{r.label ?? r.matchup}</span>
      )}

      {/* stat-line label (e.g. "Luka Doncic — 73 pts") when present */}
      {r.label && r.label !== r.matchup && parsed && (
        <span className="text-xs text-gold hidden sm:block">{r.label}</span>
      )}

      {dateStr && (
        <span className="text-xs text-text-muted whitespace-nowrap">{dateStr}</span>
      )}
    </Link>
  )
}

const EXAMPLE_QUERIES = [
  "lakers march 2026",
  "celtics vs knicks 2025",
  "luka 73 points",
]

export default function SearchPage() {
  const [params] = useSearchParams()
  const q = params.get("q") ?? ""

  const { data: results, isLoading } = useQuery({
    queryKey: ["smart-search", q],
    queryFn: () => api.get("/games/smart-search", { params: { q } }).then(r => r.data),
    enabled: q.trim().length > 0,
  })

  return (
    <div>
      {/* header */}
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-sm font-semibold tracking-widest text-white uppercase">
          Results for “{q}”
          {results?.length > 0 && (
            <span className="ml-2 text-text-muted normal-case tracking-normal font-normal">
              ({results.length})
            </span>
          )}
        </h1>
        <div className="flex-1 h-px bg-accent-red" />
      </div>

      {/* loading skeletons */}
      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-surface animate-pulse" />
          ))}
        </div>
      )}

      {/* empty state with clickable examples */}
      {!isLoading && results?.length === 0 && (
        <div className="text-center py-12">
          <p className="text-text-muted text-sm mb-4">No games found for “{q}”.</p>
          <p className="text-xs text-text-muted mb-3">Try one of these formats:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {EXAMPLE_QUERIES.map(ex => (
              <Link
                key={ex}
                to={`/search?q=${encodeURIComponent(ex)}`}
                className="text-xs border border-line rounded-full px-3 py-1 text-gold hover:border-gold transition-colors"
              >
                {ex}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* results */}
      {!isLoading && results?.length > 0 && (
        <div className="flex flex-col gap-2">
          {results.map(r => (
            <ResultRow key={r.gameId + (r.matchup ?? "")} r={r} />
          ))}
        </div>
      )}
    </div>
  )
}