import { useState, useMemo } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import AddRoundedIcon from "@mui/icons-material/AddRounded"
import FormatListNumberedRoundedIcon from "@mui/icons-material/FormatListNumberedRounded"

import { api } from "../../lib/api"
import { useAuth } from "../../context/AuthContext"
import TeamLogo from "../../components/TeamLogo"

/* ------------------------------------------------------------------ *
 *  Lists gallery — /lists                                             *
 *  Free-form game lists: yours to build, everyone's to browse.        *
 *  Editing lives at /lists/edit.                                      *
 * ------------------------------------------------------------------ */

const teamTag = (team) => team?.abbreviation || team?.name || "?"
const gameLabel = (game) =>
  game?.title || `${teamTag(game?.awayTeam)} @ ${teamTag(game?.homeTeam)}`

const shortDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : ""

function TeamMark({ team, className }) {
  if (team?.id) {
    return <TeamLogo teamId={team.id} alt={teamTag(team)} className={`${className} object-contain`} />
  }
  return (
    <span className={`${className} grid place-items-center rounded-full bg-primary text-[8px] font-semibold text-white`}>
      {team?.abbreviation || "—"}
    </span>
  )
}

/* ---------- card: shows a stack of the first few matchups ---------- */

function ListCard({ list, onOpen, showAuthor }) {
  const preview = (list.items ?? []).slice(0, 4)
  const count = list._count?.items ?? list.items?.length ?? 0

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full rounded-md border border-line bg-surface p-3 text-left transition-all duration-200 hover:-translate-y-1 hover:border-primary-light hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
    >
      {/* mini stack of matchup thumbnails */}
      <span className="mb-3 flex gap-1 rounded bg-primary-dark/60 p-2">
        {preview.length ? (
          preview.map((it) => (
            <span
              key={it.id}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded bg-primary py-2"
            >
              <TeamMark team={it.game?.awayTeam} className="h-5 w-5" />
              <TeamMark team={it.game?.homeTeam} className="h-5 w-5" />
            </span>
          ))
        ) : (
          <span className="flex-1 py-6 text-center text-[10px] uppercase tracking-wider text-text-muted">
            Empty
          </span>
        )}
      </span>

      <span className="flex items-center gap-1.5">
        {list.ranked ? (
          <FormatListNumberedRoundedIcon sx={{ fontSize: 14 }} className="shrink-0 text-gold" />
        ) : null}
        <span className="block truncate text-sm font-semibold text-white">{list.title}</span>
      </span>

      <span className="mt-0.5 block truncate text-[11px] text-text-muted">
        {showAuthor ? `by ${list.user?.username} · ` : ""}
        {count} game{count === 1 ? "" : "s"}
        {showAuthor ? "" : ` · ${shortDate(list.updatedAt)}`}
      </span>
    </button>
  )
}

function CreateCard({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid min-h-[150px] w-full place-items-center gap-1 rounded-md border border-dashed border-line bg-surface/40 text-xs font-medium uppercase tracking-[0.12em] text-text-muted transition-colors hover:border-gold hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
    >
      <AddRoundedIcon sx={{ fontSize: 22 }} />
      New list
    </button>
  )
}

/* ---------- detail modal ---------- */

function ListModal({ list, isOwner, onClose, onEdit }) {
  if (!list) return null
  const items = list.items ?? []

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={list.title}
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-primary-dark/85 p-4 backdrop-blur-sm sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl rounded-lg border border-line bg-surface p-5 sm:p-7"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-2xl leading-none text-text-muted transition-colors hover:text-accent-red"
        >
          ×
        </button>

        <div className="flex items-center gap-2 pr-10">
          {list.ranked ? <FormatListNumberedRoundedIcon className="text-gold" /> : null}
          <h3 className="text-2xl font-semibold text-white">{list.title}</h3>
        </div>
        <p className="mb-4 mt-1 text-xs text-text-muted">
          {list.user ? (
            <>
              by{" "}
              <Link to={`/user/${list.user.username}`} className="hover:text-gold">
                {list.user.username}
              </Link>{" "}
              ·{" "}
            </>
          ) : null}
          {items.length} game{items.length === 1 ? "" : "s"} · updated {shortDate(list.updatedAt)}
        </p>

        {list.description ? (
          <p className="mb-5 whitespace-pre-wrap text-sm leading-relaxed text-white/75">
            {list.description}
          </p>
        ) : null}

        <ol className="flex flex-col divide-y divide-line">
          {items.map((it, i) => (
            <li key={it.id}>
              <Link
                to={`/games/${it.game.id}`}
                className="group flex items-center gap-3 py-2.5"
              >
                {list.ranked ? (
                  <span className="w-5 shrink-0 text-center text-sm font-bold text-gold">{i + 1}</span>
                ) : null}
                <span className="flex items-center gap-1">
                  <TeamMark team={it.game.awayTeam} className="h-6 w-6" />
                  <span className="text-[9px] text-text-muted">@</span>
                  <TeamMark team={it.game.homeTeam} className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-white transition-colors group-hover:text-gold">
                    {gameLabel(it.game)}
                  </span>
                  <span className="block text-[11px] text-text-muted">{shortDate(it.game.date)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>

        {isOwner ? (
          <button
            type="button"
            onClick={onEdit}
            className="mt-6 w-full rounded bg-accent-orange py-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary-dark transition-colors hover:bg-gold"
          >
            Edit this list
          </button>
        ) : null}
      </div>
    </div>
  )
}

/* ---------- section rule ---------- */

function SectionRule({ label, action }) {
  return (
    <div className="mb-4 flex items-center gap-4">
      <h2 className="shrink-0 text-sm font-semibold uppercase tracking-widest text-white">{label}</h2>
      <div className="h-px flex-1 bg-accent-red" />
      {action}
    </div>
  )
}

function GridSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-[150px] animate-pulse rounded-md bg-surface" />
      ))}
    </div>
  )
}

/* ---------- screen ---------- */

export default function Lists() {
  const { isAuthed } = useAuth()
  const navigate = useNavigate()
  const [active, setActive] = useState(null)

  const mine = useQuery({
    queryKey: ["lists", "me"],
    queryFn: () => api.get("/lists/me").then((r) => r.data),
    enabled: isAuthed,
  })

  const explore = useQuery({
    queryKey: ["lists", "explore"],
    queryFn: () => api.get("/lists/explore").then((r) => r.data),
  })

  const myLists = mine.data ?? []
  const myIds = useMemo(() => new Set(myLists.map((l) => l.id)), [myLists])
  const otherLists = (explore.data?.lists ?? []).filter((l) => !myIds.has(l.id))

  const goEditor = (id) => navigate(id ? `/lists/edit?id=${id}` : "/lists/edit")
  const activeIsMine = active ? myIds.has(active.id) : false

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-wide text-white md:text-4xl">LISTS</h1>
        <p className="mt-2 text-sm text-text-muted">
          Collect games any way you like — ranked or not.
        </p>
      </div>

      {/* your lists */}
      {isAuthed ? (
        <section className="mb-12">
          <SectionRule
            label="Your lists"
            action={
              myLists.length > 0 ? (
                <button
                  type="button"
                  onClick={() => goEditor()}
                  className="shrink-0 rounded border border-line px-3 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-text-muted transition-colors hover:border-gold hover:text-gold"
                >
                  + New
                </button>
              ) : null
            }
          />
          {mine.isLoading ? (
            <GridSkeleton />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
              {myLists.map((l) => (
                <ListCard key={l.id} list={l} onOpen={() => setActive(l)} />
              ))}
              <CreateCard onClick={() => goEditor()} />
            </div>
          )}
        </section>
      ) : (
        <section className="mb-12">
          <SectionRule label="Your lists" />
          <div className="rounded-md border border-dashed border-line bg-surface/40 px-6 py-8 text-center text-sm text-text-muted">
            <Link to="/login" className="font-semibold text-gold hover:underline">
              Sign in
            </Link>{" "}
            to build your own lists.
          </div>
        </section>
      )}

      {/* explore */}
      <section className="mb-10">
        <SectionRule label="Explore" />
        {explore.isLoading ? (
          <GridSkeleton />
        ) : otherLists.length === 0 ? (
          <div className="rounded-md border border-dashed border-line bg-surface/40 px-6 py-8 text-center text-sm text-text-muted">
            No one else has shared a list yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
            {otherLists.map((l) => (
              <ListCard key={l.id} list={l} showAuthor onOpen={() => setActive(l)} />
            ))}
          </div>
        )}
      </section>

      <ListModal
        list={active}
        isOwner={activeIsMine}
        onClose={() => setActive(null)}
        onEdit={() => goEditor(active.id)}
      />
    </div>
  )
}