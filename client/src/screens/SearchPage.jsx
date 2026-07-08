import { useSearchParams, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { api } from "../lib/api"

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
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-sm font-semibold tracking-widest text-white uppercase">
          Results for “{q}”
        </h1>
        <div className="flex-1 h-px bg-accent-red" />
      </div>

      {isLoading && <p className="text-text-muted text-sm">Searching…</p>}

      {!isLoading && results?.length === 0 && (
        <p className="text-text-muted text-sm">
          No games found. Try formats like “lakers march 2026” or “bam adebayo 83 points”.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {results?.map(r => (
          <Link
            key={r.gameId + r.matchup}
            to={`/games/${r.gameId}`}
            className="flex items-center justify-between px-4 py-3 rounded-lg border border-line bg-surface hover:border-gold transition-colors"
          >
            <span className="text-sm text-white">{r.label ?? r.matchup}</span>
            <span className="text-xs text-text-muted">{r.date}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}