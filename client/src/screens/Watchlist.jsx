import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import CloseIcon from "@mui/icons-material/Close"
import BookmarkRoundedIcon from "@mui/icons-material/BookmarkRounded"

import { api } from "../lib/api"
import { useAuth } from "../context/AuthContext"
import TeamLogo from "../components/TeamLogo"

const teamTag = (team) => team?.abbreviation || team?.name || "?"
const gameLabel = (game) =>
  game?.title || `${teamTag(game?.awayTeam)} @ ${teamTag(game?.homeTeam)}`

const shortDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : ""

function TeamMark({ team, className = "h-11 w-11" }) {
  if (team?.id) {
    return (
      <TeamLogo
        teamId={team.id}
        alt={team.abbreviation || team.name || ""}
        className={`${className} object-contain`}
      />
    )
  }
  return (
    <span className={`${className} grid place-items-center rounded-full bg-primary text-[9px] font-semibold text-white`}>
      {team?.abbreviation || team?.name?.slice(0, 3).toUpperCase() || "—"}
    </span>
  )
}

function WatchlistCard({ game, onRemove }) {
  const label = gameLabel(game)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} from watchlist`}
        className="absolute right-2 top-2 z-10 grid h-5 w-5 place-items-center rounded-full bg-primary-dark/85 text-white transition-colors hover:bg-accent-red"
      >
        <CloseIcon sx={{ fontSize: 13 }} />
      </button>

      <Link
        to={`/games/${game.id}`}
        className="block aspect-[2/3] w-full overflow-hidden rounded-md bg-surface transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        <span className="flex h-full w-full flex-col">
          <span className="flex flex-1 items-center justify-center gap-2 bg-primary p-3">
            <TeamMark team={game.awayTeam} className="h-11 w-11 sm:h-12 sm:w-12" />
            <span className="text-xs font-semibold text-text-muted">@</span>
            <TeamMark team={game.homeTeam} className="h-11 w-11 sm:h-12 sm:w-12" />
          </span>
          <span className="bg-primary-dark px-2 py-2 text-center">
            <span className="block truncate text-[11px] font-medium uppercase tracking-wider text-white">
              {label}
            </span>
            <span className="mt-0.5 block text-[10px] text-text-muted">{shortDate(game.date)}</span>
          </span>
        </span>
      </Link>
    </div>
  )
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="aspect-[2/3] animate-pulse rounded-md bg-surface" />
      ))}
    </div>
  )
}

export default function Watchlist() {
  const { isAuthed } = useAuth()
  const qc = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["watchlist", "me"],
    queryFn: () => api.get("/watchlist").then((r) => r.data),
    enabled: isAuthed,
  })

  const remove = useMutation({
    mutationFn: (gameId) => api.delete(`/watchlist/${gameId}`).then((r) => r.data),
    // optimistic: drop the card immediately, roll back on error
    onMutate: async (gameId) => {
      await qc.cancelQueries({ queryKey: ["watchlist", "me"] })
      const prev = qc.getQueryData(["watchlist", "me"])
      qc.setQueryData(["watchlist", "me"], (old) =>
        old ? { ...old, items: old.items.filter((it) => it.game.id !== gameId) } : old
      )
      qc.setQueryData(["watchlist", "status", gameId], { watchlisted: false })
      return { prev }
    },
    onError: (_e, _gameId, ctx) => {
      if (ctx?.prev) qc.setQueryData(["watchlist", "me"], ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["watchlist", "me"] }),
  })

  if (!isAuthed) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-xl font-semibold text-white">Your watchlist</h1>
        <p className="mt-2 text-sm text-text-muted">
          <Link to="/login" className="font-semibold text-gold hover:underline">
            Sign in
          </Link>{" "}
          to save games you want to watch.
        </p>
      </div>
    )
  }

  const items = data?.items ?? []

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <header className="flex items-center gap-3 py-8 sm:py-10">
        <BookmarkRoundedIcon className="text-gold" />
        <div>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">Watchlist</h1>
          <p className="mt-1 text-sm text-text-muted">
            {items.length > 0
              ? `${items.length} game${items.length === 1 ? "" : "s"} to watch`
              : "Games you save will show up here."}
          </p>
        </div>
      </header>

      {isLoading ? (
        <GridSkeleton />
      ) : isError ? (
        <div className="rounded-md border border-dashed border-line bg-surface/40 px-6 py-12 text-center text-sm text-text-muted">
          Couldn't load your watchlist.{" "}
          <button onClick={() => refetch()} className="text-gold hover:underline">
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-line bg-surface/40 px-6 py-12 text-center text-sm text-text-muted">
          Nothing saved yet. Open a game and tap{" "}
          <span className="text-white">Add to watchlist</span>.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
          {items.map((it) => (
            <WatchlistCard key={it.id} game={it.game} onRemove={() => remove.mutate(it.game.id)} />
          ))}
        </div>
      )}
    </div>
  )
}