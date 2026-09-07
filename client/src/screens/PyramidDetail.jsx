import { useState } from "react"
import { Link, useParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded"
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded"
import EditRoundedIcon from "@mui/icons-material/EditRounded"
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded"
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded"

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
const eraLabel = (entry) => entry.headshotSeason || "Current"

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
      <div className="mx-auto max-w-3xl">
        <div className="h-64 animate-pulse rounded-lg bg-surface" />
      </div>
    )
  }

  if (pyramidQ.isError || !pyramidQ.data) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
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
    <div className="mx-auto max-w-3xl">
      <button
        type="button"
        onClick={() => navigate("/pyramid")}
        className="mb-5 flex items-center gap-1 text-xs font-medium uppercase tracking-[0.1em] text-text-muted transition-colors hover:text-gold"
      >
        <ArrowBackRoundedIcon sx={{ fontSize: 15 }} />
        All pyramids
      </button>

      <div className="rounded-lg border border-line bg-surface p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-white sm:text-3xl">
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
              className="flex shrink-0 items-center gap-2 rounded bg-accent-orange px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-primary-dark transition-colors hover:bg-gold"
            >
              <EditRoundedIcon sx={{ fontSize: 15 }} />
              Edit
            </button>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col items-center gap-5">
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
                      <div className="text-[10px] text-text-muted">
                        {eraLabel(entry)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* comments */}
      <section className="mt-8">
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
      </section>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} initialMode="login" />
    </div>
  )
}