import { useQuery } from "@tanstack/react-query"
import { api } from "../lib/api"
import GameCard from "../components/GameCard"

function Section({ title, games, isLoading, skeletons = 5 }) {
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
          {Array.from({ length: skeletons }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-xl bg-surface animate-pulse" />
          ))}
        </div>
      ) : games?.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {games.map(g => <GameCard key={g.id} game={g} />)}
        </div>
      ) : (
        <p className="text-text-muted text-sm">Nothing to show yet.</p>
      )}
    </section>
  )
}

export default function Games() {
  const recent = useQuery({
    queryKey: ["games", "recent"],
    queryFn: () => api.get("/games/recent", { timeout: 300000 }).then(r => r.data),  // 5 min ceiling
    staleTime: 30 * 60 * 1000,
  })

  const random = useQuery({
    queryKey: ["games", "random"],
    queryFn: () => api.get("/games/random?count=10").then(r => r.data),
    staleTime: Infinity,   // keep the same random set for the session
  })

  return (
    <div>
      <Section title="Latest Games" games={recent.data} isLoading={recent.isLoading} skeletons={10} />
      <Section title="Discover" games={random.data} isLoading={random.isLoading} skeletons={10} />
    </div>
  )
}