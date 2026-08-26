import { useState, useEffect, useMemo } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import AddRoundedIcon from "@mui/icons-material/AddRounded"
import CloseRoundedIcon from "@mui/icons-material/CloseRounded"
import EditRoundedIcon from "@mui/icons-material/EditRounded"

import { api } from "../lib/api"
import { useAuth } from "../context/AuthContext"
import PlayerHeadshot from "../components/PlayerHeadshot"
import AuthModal from "../components/AuthModal"

/* ------------------------------------------------------------------ *
 *  Pyramid gallery — /pyramid                                         *
 *  Browse your pyramids and everyone else's as cards; click for a     *
 *  detail view. Editing lives in the editor at /pyramid/edit.         *
 * ------------------------------------------------------------------ */

const TIER_SIZES = [2, 3, 4, 5, 6]

const groupByTier = (players = []) =>
  TIER_SIZES.map((_, i) => players.filter((p) => p.tier === i + 1))

const shortDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : ""

const lastName = (name = "") => name.split(" ").slice(-1)[0]

const eraLabel = (entry) => entry.headshotSeason || "Current"

/* ---------- card ---------- */

function PyramidCard({ pyramid, onOpen, showAuthor, isOwner }) {
  const tiers = useMemo(() => groupByTier(pyramid.players), [pyramid.players])
  const filled = (pyramid.players || []).length

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative w-full rounded-md border border-line bg-surface p-3 text-left transition-all duration-200 hover:-translate-y-1 hover:border-primary-light hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
    >
      {isOwner ? (
        <span className="absolute right-2 top-2 z-10 grid h-6 w-6 place-items-center rounded-full bg-primary-dark/80 text-text-muted opacity-0 transition-opacity group-hover:opacity-100">
          <EditRoundedIcon sx={{ fontSize: 13 }} />
        </span>
      ) : null}

      {/* top two tiers as a silhouette */}
      <span className="mb-3 flex flex-col items-center gap-1 rounded bg-primary-dark/60 px-2 py-4">
        {[0, 1].map((row) => (
          <span key={row} className="flex gap-1">
            {Array.from({ length: TIER_SIZES[row] }).map((_, slot) => {
              const entry = tiers[row][slot]
              return (
                <span
                  key={slot}
                  className={`h-17 w-17 overflow-hidden rounded-full ${
                entry ? "bg-primary" : "bg-line/50"
                }`}
                >
                  {entry ? (
                    <PlayerHeadshot
                      playerId={entry.player.id}
                      teamId={entry.headshotTeamId}
                      season={entry.headshotSeason}
                      className="h-full w-full"
                    />
                  ) : null}
                </span>
              )
            })}
          </span>
        ))}
      </span>

      <span className="block truncate text-sm font-semibold text-white">{pyramid.title}</span>

      {showAuthor ? (
        <span className="mt-0.5 block truncate text-[11px] text-text-muted">
          by {pyramid.user?.username} · {filled}/20
        </span>
      ) : (
        <span className="mt-0.5 block text-[11px] text-text-muted">
          {filled}/20 placed · {shortDate(pyramid.updatedAt)}
        </span>
      )}
    </button>
  )
}

function CreateCard({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid min-h-[168px] w-full place-items-center gap-1 rounded-md border border-dashed border-line bg-surface/40 text-xs font-medium uppercase tracking-[0.12em] text-text-muted transition-colors hover:border-gold hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
    >
      <AddRoundedIcon sx={{ fontSize: 22 }} />
      New pyramid
    </button>
  )
}

/* ---------- detail modal ---------- */

function PyramidModal({ pyramid, isOwner, onClose, onEdit }) {
  useEffect(() => {
    if (!pyramid) return
    const onKey = (e) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [pyramid, onClose])

  if (!pyramid) return null

  const tiers = groupByTier(pyramid.players) // filled-only per tier

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={pyramid.title}
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
          className="absolute right-4 top-4 text-text-muted transition-colors hover:text-accent-red"
        >
          <CloseRoundedIcon />
        </button>

        <h3 className="pr-10 text-2xl font-semibold text-white">{pyramid.title}</h3>
        <p className="mb-6 mt-1 text-xs text-text-muted">
          {pyramid.user ? (
            <>
              by{" "}
              <Link to={`/user/${pyramid.user.username}`} className="hover:text-gold">
                {pyramid.user.username}
              </Link>{" "}
              ·{" "}
            </>
          ) : null}
          updated {shortDate(pyramid.updatedAt)}
        </p>

        <div className="flex flex-col items-center gap-5">
          {tiers.map((tier, i) =>
            tier.length === 0 ? null : (
              <div key={i} className="w-full">
                <div className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                  Tier {i + 1}
                </div>
                <div className="flex flex-wrap justify-center gap-4">
                  {tier.map((entry) => (
                    <div key={entry.id} className="w-[76px] text-center">
                      <div className="mx-auto mb-1.5 h-14 w-14 overflow-hidden rounded-full bg-primary">
                        <PlayerHeadshot
                          playerId={entry.player.id}
                          teamId={entry.headshotTeamId}
                          season={entry.headshotSeason}
                          className="h-full w-full"
                        />
                      </div>
                      <div className="text-[11px] font-medium leading-tight text-white">
                        {lastName(entry.player.name)}
                      </div>
                      <div className="text-[10px] text-text-muted">{eraLabel(entry)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>

        {isOwner ? (
          <button
            type="button"
            onClick={onEdit}
            className="mt-7 flex w-full items-center justify-center gap-2 rounded bg-accent-orange py-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary-dark transition-colors hover:bg-gold"
          >
            <EditRoundedIcon sx={{ fontSize: 15 }} />
            Edit this pyramid
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
      <h2 className="shrink-0 text-sm font-semibold uppercase tracking-widest text-white">
        {label}
      </h2>
      <div className="h-px flex-1 bg-accent-red" />
      {action}
    </div>
  )
}

function CardGridSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-[168px] animate-pulse rounded-md bg-surface" />
      ))}
    </div>
  )
}

/* ---------- screen ---------- */

export default function Pyramid() {
  const { isAuthed, user } = useAuth()
  const navigate = useNavigate()
  const [active, setActive] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  

  const mine = useQuery({
    queryKey: ["pyramid", "me"],
    queryFn: () => api.get("/pyramid/me").then((r) => r.data),
    enabled: isAuthed,
  })

  const explore = useQuery({
    queryKey: ["pyramid", "explore"],
    queryFn: () => api.get("/pyramid/explore").then((r) => r.data),
  })

  const myPyramids = mine.data ?? []
  const myIds = useMemo(() => new Set(myPyramids.map((p) => p.id)), [myPyramids])

  // Explore excludes the viewer's own pyramids — those already have a section.
  const otherPyramids = (explore.data?.pyramids ?? []).filter((p) => !myIds.has(p.id))

  const goEditor = (id) => navigate(id ? `/pyramid/edit?id=${id}` : "/pyramid/edit")

  const activeIsMine = active ? myIds.has(active.id) : false

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-wide text-white md:text-4xl">
          G.O.A.T. PYRAMIDS
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Build your ranking, and see how everyone else stacks the greats.
        </p>
      </div>

      {/* your pyramids */}
      {isAuthed ? (
        <section className="mb-12">
          <SectionRule
            label="Your pyramids"
            action={
              myPyramids.length > 0 ? (
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
            <CardGridSkeleton />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
              {myPyramids.map((p) => (
                <PyramidCard key={p.id} pyramid={p} isOwner onOpen={() => setActive(p)} />
              ))}
              <CreateCard onClick={() => goEditor()} />
            </div>
          )}
        </section>
      ) : (
        <section className="mb-12">
          <SectionRule label="Your pyramids" />
          <div className="rounded-md border border-dashed border-line bg-surface/40 px-6 py-8 text-center text-sm text-text-muted">
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="font-semibold text-gold hover:underline"
            >
              Sign in
            </button>{" "}
            to build and save your own pyramids.
          </div>
        </section>
      )}

      {/* explore */}
      <section className="mb-10">
        <SectionRule label="Explore" />
        {explore.isLoading ? (
          <CardGridSkeleton />
        ) : otherPyramids.length === 0 ? (
          <div className="rounded-md border border-dashed border-line bg-surface/40 px-6 py-8 text-center text-sm text-text-muted">
            No one else has shared a pyramid yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
            {otherPyramids.map((p) => (
              <PyramidCard key={p.id} pyramid={p} showAuthor onOpen={() => setActive(p)} />
            ))}
          </div>
        )}
      </section>

      <PyramidModal
        pyramid={active}
        isOwner={activeIsMine}
        onClose={() => setActive(null)}
        onEdit={() => goEditor(active.id)}
      />

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        initialMode="login"
      />
    </div>
  )
}