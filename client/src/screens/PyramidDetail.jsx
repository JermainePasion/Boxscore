import { useEffect, useState } from "react"
import { Link, useParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded"
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded"
import EditRoundedIcon from "@mui/icons-material/EditRounded"
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded"
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded"
import OpenInFullRoundedIcon from "@mui/icons-material/OpenInFullRounded"
import CloseRoundedIcon from "@mui/icons-material/CloseRounded"

import { api } from "../lib/api"
import { useAuth } from "../context/AuthContext"
import PlayerHeadshot from "../components/PlayerHeadshot"
import AuthModal from "../components/AuthModal"

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
const eraLabel = (entry) => {
  if (!entry.headshotSeason) return "Current"
  const start = Number(entry.headshotSeason)
  return Number.isNaN(start)
    ? entry.headshotSeason
    : `${start}-${String(start + 1).slice(-2)}`   // "2015" → "2015-16"
}

/* ---------- pyramid board (reused compact + enlarged) ---------- */

function PyramidBoard({ tiers, compact = false }) {
  const dims = compact
    ? {
        stackGap: "gap-2.5",
        cellPad: "px-1",
        avatarMax: "max-w-[48px]",
        tierLabel: "text-[9px]",
        name: "text-[10px]",
        era: "text-[9px]",
      }
    : {
        stackGap: "gap-5",
        cellPad: "px-1.5",
        avatarMax: "max-w-[84px]",
        tierLabel: "text-[10px]",
        name: "text-xs",
        era: "text-[11px]",
      }

  // The widest tier sets a single shared cell width, so every tier's width is
  // proportional to its player count → tier 5 (6) is wider than tier 4 (5), etc.
  const maxCount = Math.max(1, ...tiers.map((t) => t.length))
  const cellWidth = `${100 / maxCount}%`

  return (
    <div className={`flex flex-col items-center ${dims.stackGap}`}>
      {tiers.map((tier, i) =>
        tier.length === 0 ? null : (
          <div key={i} className="w-full">
            <div
              className={`mb-1.5 text-center font-semibold uppercase tracking-[0.16em] text-text-muted ${dims.tierLabel}`}
            >
              Tier {i + 1}
            </div>
            <div className="flex flex-nowrap items-start justify-center">
              {tier.map((entry) => (
                <div
                  key={entry.id}
                  style={{ width: cellWidth }}
                  className={`min-w-0 ${dims.cellPad} text-center`}
                >
                  <div
                    className={`mx-auto mb-1.5 aspect-square w-full ${dims.avatarMax} overflow-hidden rounded-full bg-primary`}
                  >
                    <PlayerHeadshot
                      playerId={entry.player.id}
                      teamId={entry.headshotTeamId}
                      season={entry.headshotSeason}
                      className="h-full w-full"
                    />
                  </div>
                  <div
                    className={`${dims.name} truncate font-medium leading-tight text-white`}
                    title={lastName(entry.player.name)}
                  >
                    {lastName(entry.player.name)}
                  </div>
                  <div className={`${dims.era} truncate text-text-muted`}>
                    {eraLabel(entry)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  )
}

/* ---------- enlarged pyramid modal ---------- */

function PyramidModal({ open, onClose, title, tiers }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-line bg-surface p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-white sm:text-2xl">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-text-muted transition-colors hover:bg-primary hover:text-white"
          >
            <CloseRoundedIcon sx={{ fontSize: 18 }} />
          </button>
        </div>
        <PyramidBoard tiers={tiers} />
      </div>
    </div>
  )
}

/* ---------- comment row ---------- */

function CommentRow({ comment, me, onLike, onDelete }) {
  const liked = comment.likes.some((l) => l.userId === me)
  const count = comment.likes.length
  const isMine = comment.user?.id === me

  return (
    <div className="flex gap-3 border-b border-line/60 py-4 last:border-0">
      <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-xs font-semibold uppercase text-white">
        {comment.user?.avatarUrl ? (
          <img
            src={comment.user.avatarUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          comment.user?.username?.[0] ?? "?"
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs">
          <Link
            to={`/user/${comment.user?.username}`}
            className="font-semibold text-white hover:text-gold"
          >
            {comment.user?.username}
          </Link>
          <span className="text-text-muted">{shortDate(comment.createdAt)}</span>
        </div>

        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-text-muted">
          {comment.content}
        </p>

        <div className="mt-2 flex items-center gap-4">
          <button
            type="button"
            onClick={() => onLike(comment.id)}
            className={`flex items-center gap-1 text-xs transition-colors ${
              liked ? "text-accent-red" : "text-text-muted hover:text-accent-red"
            }`}
            aria-pressed={liked}
            aria-label={liked ? "Unlike comment" : "Like comment"}
          >
            {liked ? (
              <FavoriteRoundedIcon sx={{ fontSize: 15 }} />
            ) : (
              <FavoriteBorderRoundedIcon sx={{ fontSize: 15 }} />
            )}
            {count > 0 ? count : null}
          </button>

          {isMine ? (
            <button
              type="button"
              onClick={() => onDelete(comment.id)}
              className="flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-accent-red"
            >
              <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />
              Delete
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/* ---------- composer ---------- */

function Composer({ onSubmit, pending }) {
  const [value, setValue] = useState("")
  const submit = () => {
    const text = value.trim()
    if (!text) return
    onSubmit(text, () => setValue(""))
  }

  return (
    <div className="mb-6">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        placeholder="Add a comment…"
        className="w-full resize-none rounded-md border border-line bg-surface px-3 py-2 text-sm text-white placeholder:text-text-muted focus:border-primary-light focus:outline-none"
      />
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !value.trim()}
          className="rounded bg-accent-orange px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-primary-dark transition-colors hover:bg-gold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  )
}

/* ---------- screen ---------- */

export default function PyramidDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAuthed, user } = useAuth()
  const qc = useQueryClient()
  const me = user?.id
  const [authOpen, setAuthOpen] = useState(false)
  const [zoomOpen, setZoomOpen] = useState(false)

  const pyramidQ = useQuery({
    queryKey: ["pyramid", id],
    queryFn: () => api.get(`/pyramid/${id}`).then((r) => r.data),
  })

  const commentsQ = useQuery({
    queryKey: ["pyramid-comments", id],
    queryFn: () => api.get(`/comments/pyramid/${id}`).then((r) => r.data),
  })

  const postM = useMutation({
    mutationFn: (content) => api.post("/comments", { content, pyramidId: id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pyramid-comments", id] }),
  })

  const deleteM = useMutation({
    mutationFn: (commentId) => api.delete(`/comments/${commentId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pyramid-comments", id] }),
  })

  // optimistic like toggle
  const likeM = useMutation({
    mutationFn: (commentId) => api.post(`/comments/${commentId}/like`),
    onMutate: async (commentId) => {
      await qc.cancelQueries({ queryKey: ["pyramid-comments", id] })
      const prev = qc.getQueryData(["pyramid-comments", id])
      qc.setQueryData(["pyramid-comments", id], (old = []) =>
        old.map((c) => {
          if (c.id !== commentId) return c
          const liked = c.likes.some((l) => l.userId === me)
          return {
            ...c,
            likes: liked
              ? c.likes.filter((l) => l.userId !== me)
              : [...c.likes, { userId: me }],
          }
        })
      )
      return { prev }
    },
    onError: (_e, _v, ctx) =>
      ctx?.prev && qc.setQueryData(["pyramid-comments", id], ctx.prev),
    onSettled: () =>
      qc.invalidateQueries({ queryKey: ["pyramid-comments", id] }),
  })

  const handleLike = (commentId) => {
    if (!isAuthed) return setAuthOpen(true)
    likeM.mutate(commentId)
  }

  const handlePost = (content, reset) =>
    postM.mutate(content, { onSuccess: reset })

  if (pyramidQ.isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="h-64 animate-pulse rounded-lg bg-surface" />
      </div>
    )
  }

  if (pyramidQ.isError || !pyramidQ.data) {
    return (
      <div className="mx-auto max-w-6xl py-16 text-center">
        <p className="text-sm text-text-muted">This pyramid doesn’t exist.</p>
        <Link to="/pyramid" className="mt-3 inline-block text-sm text-gold hover:underline">
          ← Back to pyramids
        </Link>
      </div>
    )
  }

  const pyramid = pyramidQ.data
  const tiers = groupByTier(pyramid.players)
  const isOwner = me && pyramid.user?.id === me
  const comments = commentsQ.data ?? []

  return (
    <div className="mx-auto max-w-6xl">
      <button
        type="button"
        onClick={() => navigate("/pyramid")}
        className="mb-5 flex items-center gap-1 text-xs font-medium uppercase tracking-[0.1em] text-text-muted transition-colors hover:text-gold"
      >
        <ArrowBackRoundedIcon sx={{ fontSize: 15 }} />
        All pyramids
      </button>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start">
        {/* ---------- left: compact pyramid (click to enlarge) ---------- */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-lg border border-line bg-surface p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold text-white">
                  {pyramid.title}
                </h1>
                <p className="mt-1 text-xs text-text-muted">
                  {pyramid.user ? (
                    <>
                      by{" "}
                      <Link
                        to={`/user/${pyramid.user.username}`}
                        className="hover:text-gold"
                      >
                        {pyramid.user.username}
                      </Link>{" "}
                      ·{" "}
                    </>
                  ) : null}
                  updated {shortDate(pyramid.updatedAt)}
                </p>
              </div>

              {isOwner ? (
                <button
                  type="button"
                  onClick={() => navigate(`/pyramid/edit?id=${pyramid.id}`)}
                  className="flex shrink-0 items-center gap-1.5 rounded bg-accent-orange px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-primary-dark transition-colors hover:bg-gold"
                >
                  <EditRoundedIcon sx={{ fontSize: 15 }} />
                  Edit
                </button>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setZoomOpen(true)}
              aria-label="Enlarge pyramid"
              className="group relative mt-5 block w-full cursor-zoom-in rounded-md p-1 transition-colors hover:bg-primary/20"
            >
              <span className="pointer-events-none absolute right-1 top-1 z-10 grid h-7 w-7 place-items-center rounded-full bg-primary-dark/70 text-white opacity-0 transition-opacity group-hover:opacity-100">
                <OpenInFullRoundedIcon sx={{ fontSize: 14 }} />
              </span>

              <PyramidBoard tiers={tiers} compact />

              <span className="mt-3 block text-center text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted transition-colors group-hover:text-gold">
                Click to enlarge
              </span>
            </button>
          </div>
        </aside>

        {/* ---------- right: comments ---------- */}
        <section className="min-w-0">
          <div className="mb-4 flex items-center gap-4">
            <h2 className="shrink-0 text-sm font-semibold uppercase tracking-widest text-white">
              Comments {comments.length > 0 ? `(${comments.length})` : ""}
            </h2>
            <div className="h-px flex-1 bg-accent-red" />
          </div>

          {isAuthed ? (
            <Composer onSubmit={handlePost} pending={postM.isPending} />
          ) : (
            <div className="mb-6 rounded-md border border-dashed border-line bg-surface/40 px-6 py-6 text-center text-sm text-text-muted">
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                className="font-semibold text-gold hover:underline"
              >
                Sign in
              </button>{" "}
              to join the conversation.
            </div>
          )}

          {/* scrolls on its own so the pyramid stays in view beside it */}
          <div className="lg:max-h-[calc(100vh-16rem)] lg:overflow-y-auto lg:pr-1">
            {commentsQ.isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-md bg-surface" />
                ))}
              </div>
            ) : comments.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-muted">
                No comments yet — be the first.
              </p>
            ) : (
              <div>
                {comments.map((c) => (
                  <CommentRow
                    key={c.id}
                    comment={c}
                    me={me}
                    onLike={handleLike}
                    onDelete={(cid) => deleteM.mutate(cid)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <PyramidModal
        open={zoomOpen}
        onClose={() => setZoomOpen(false)}
        title={pyramid.title}
        tiers={tiers}
      />

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} initialMode="login" />
    </div>
  )
}