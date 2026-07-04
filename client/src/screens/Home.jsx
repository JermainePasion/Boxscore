import { useQuery } from "@tanstack/react-query"
import { api } from "../lib/api"
import GameCard from "../components/GameCard"

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

export default function Home() {
  const suggested = useQuery({
    queryKey: ["games", "suggested"],
    queryFn: () => api.get("/games/suggested").then(r => r.data),
  })

  const popular = useQuery({
    queryKey: ["games", "popular"],
    queryFn: () => api.get("/games/popular").then(r => r.data),
  })

  return (
    <div>
      <GameRow
        title="Suggested Games"
        games={suggested.data}
        isLoading={suggested.isLoading}
      />
      <GameRow
        title="Popular Games"
        games={popular.data}
        isLoading={popular.isLoading}
      />
    </div>
  )
}