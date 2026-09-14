import { useState } from "react"
import { Link, useParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import EditRoundedIcon from "@mui/icons-material/EditRounded"
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded"
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded"
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded"
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded"
import FormatListNumberedRoundedIcon from "@mui/icons-material/FormatListNumberedRounded"

import { api } from "../../lib/api"
import { useAuth } from "../../context/AuthContext"
import TeamLogo from "../../components/TeamLogo"
import BasketballRating from "../../components/GameDetail/BasketballRating"
import ListReviewModal from "../../components/List/ListReviewModal"
import AuthModal from "../../components/AuthModal"

/* ---------- helpers ---------- */

const teamTag = (team) => team?.abbreviation || team?.name || "?"
const gameLabel = (game) =>
  game?.title || `${teamTag(game?.awayTeam)} @ ${teamTag(game?.homeTeam)}`

const shortDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : ""

function TeamMark({ team, className }) {
  if (team?.id) {
    return <TeamLogo teamId={team.id} alt={teamTag(team)} className={`${className} object-contain`} />
  }
  return (
    <span className={`${className} grid place-items-center rounded-full bg-primary text-[8px] font-semibold text-white`}>
      {team?.abbreviation || "-"}
    </span>
  )
}

function Avatar({ user }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-xs font-semibold uppercase text-white">
      {user?.avatarUrl ? (
        <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        user?.username?.[0] ?? "?"
      )}
    </span>
  )
}

function SectionRule({ label }) {
  return (
    <div className="mb-4 flex items-center gap-4">
      <h2 className="shrink-0 text-sm font-semibold uppercase tracking-widest text-white">{label}</h2>
      <div className="h-px flex-1 bg-accent-red" />
    </div>
  )
}

/* ---------- review row ---------- */

function ReviewRow({ review, me, onLike, onDelete }) {
  const liked = review.likes.some((l) => l.userId === me)
  const count = review.likes.length
  const isMine = review.userId === me

  return (
    <div className="flex gap-3 border-b border-line/60 py-4 last:border-0">
      <Avatar user={review.user} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs">
          <Link to={`/user/${review.user?.username}`} className="font-semibold text-white hover:text-gold">
            {review.user?.username}
          </Link>
          <span className="text-text-muted">{shortDate(review.createdAt)}</span>
        </div>

        <div className="mt-1">
          <BasketballRating value={review.rating} readonly size={15} />
        </div>

        {review.review ? (
          <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-text-muted">
            {review.review}
          </p>
        ) : null}

        <div className="mt-2 flex items-center gap-4">
          <button
            type="button"
            onClick={() => onLike(review.id)}
            className={`flex items-center gap-1 text-xs transition-colors ${
              liked ? "text-accent-red" : "text-text-muted hover:text-accent-red"
            }`}
            aria-pressed={liked}
            aria-label={liked ? "Unlike review" : "Like review"}
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
              onClick={onDelete}
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

/* ---------- comment row ---------- */

function CommentRow({ comment, me, onLike, onDelete }) {
  const liked = comment.likes.some((l) => l.userId === me)
  const count = comment.likes.length
  const isMine = comment.user?.id === me

  return (
    <div className="flex gap-3 border-b border-line/60 py-4 last:border-0">
      <Avatar user={comment.user} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs">
          <Link to={`/user/${comment.user?.username}`} className="font-semibold text-white hover:text-gold">
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
        placeholder="Add a comment..."
        className="w-full resize-none rounded-md border border-line bg-surface px-3 py-2 text-sm text-white placeholder:text-text-muted focus:border-primary-light focus:outline-none"
      />
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !value.trim()}
          className="rounded bg-accent-orange px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-primary-dark transition-colors hover:bg-gold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Posting..." : "Post"}
        </button>
      </div>
    </div>
  )
}

/* ---------- screen ---------- */

export default function ListDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAuthed, user } = useAuth()
  const qc = useQueryClient()
  const me = user?.id
  const [authOpen, setAuthOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)

  const listQ = useQuery({
    queryKey: ["list", id],
    queryFn: () => api.get(`/lists/${id}`).then((r) => r.data),
  })

  const reviewsQ = useQuery({
    queryKey: ["list-reviews", id],
    queryFn: () => api.get(`/list-reviews/list/${id}`).then((r) => r.data),
  })

  const commentsQ = useQuery({
    queryKey: ["list-comments", id],
    queryFn: () => api.get(`/comments/list/${id}`).then((r) => r.data),
  })

  /* reviews */
  const rateM = useMutation({
    mutationFn: (body) => api.put(`/list-reviews/list/${id}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["list-reviews", id] }),
  })

  const deleteReviewM = useMutation({
    mutationFn: () => api.delete(`/list-reviews/list/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["list-reviews", id] }),
  })

  const likeReviewM = useMutation({
    mutationFn: (reviewId) => api.post(`/list-reviews/${reviewId}/like`),
    onMutate: async (reviewId) => {
      await qc.cancelQueries({ queryKey: ["list-reviews", id] })
      const prev = qc.getQueryData(["list-reviews", id])
      qc.setQueryData(["list-reviews", id], (old = []) =>
        old.map((rv) => {
          if (rv.id !== reviewId) return rv
          const liked = rv.likes.some((l) => l.userId === me)
          return {
            ...rv,
            likes: liked
              ? rv.likes.filter((l) => l.userId !== me)
              : [...rv.likes, { userId: me }],
          }
        })
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(["list-reviews", id], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ["list-reviews", id] }),
  })

  /* comments */
  const postM = useMutation({
    mutationFn: (content) => api.post("/comments", { content, listId: id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["list-comments", id] }),
  })

  const deleteM = useMutation({
    mutationFn: (commentId) => api.delete(`/comments/${commentId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["list-comments", id] }),
  })

  const likeM = useMutation({
    mutationFn: (commentId) => api.post(`/comments/${commentId}/like`),
    onMutate: async (commentId) => {
      await qc.cancelQueries({ queryKey: ["list-comments", id] })
      const prev = qc.getQueryData(["list-comments", id])
      qc.setQueryData(["list-comments", id], (old = []) =>
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
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(["list-comments", id], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ["list-comments", id] }),
  })

  const handleQuickRate = (r) => {
    if (!isAuthed) return setAuthOpen(true)
    rateM.mutate({ rating: r })
  }
  const submitReview = (body) => rateM.mutate(body, { onSuccess: () => setReviewOpen(false) })
  const handleReviewLike = (rid) => {
    if (!isAuthed) return setAuthOpen(true)
    likeReviewM.mutate(rid)
  }
  const handleLike = (cid) => {
    if (!isAuthed) return setAuthOpen(true)
    likeM.mutate(cid)
  }
  const handlePost = (content, reset) => postM.mutate(content, { onSuccess: reset })

  if (listQ.isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="h-40 animate-pulse rounded-lg bg-surface" />
      </div>
    )
  }

  if (listQ.isError || !listQ.data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-text-muted">This list doesn't exist.</p>
        <Link to="/lists" className="mt-3 inline-block text-sm text-gold hover:underline">
          &larr; Back to lists
        </Link>
      </div>
    )
  }

  const list = listQ.data
  const items = list.items ?? []
  const isOwner = me && list.user?.id === me

  const reviews = reviewsQ.data ?? []
  const myReview = reviews.find((r) => r.userId === me) ?? null
  const reviewCount = reviews.length
  const avgRating = reviewCount
    ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviewCount
    : 0

  const comments = commentsQ.data ?? []

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 sm:px-6">
      <button
        type="button"
        onClick={() => navigate("/lists")}
        className="mb-5 flex items-center gap-1 text-xs font-medium uppercase tracking-[0.1em] text-text-muted transition-colors hover:text-gold"
      >
        <ArrowBackRoundedIcon sx={{ fontSize: 15 }} />
        All lists
      </button>

      {/* header + rate */}
      <div className="rounded-lg border border-line bg-surface p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {list.ranked ? (
                <FormatListNumberedRoundedIcon sx={{ fontSize: 18 }} className="shrink-0 text-gold" />
              ) : null}
              <h1 className="truncate text-2xl font-semibold text-white sm:text-3xl">{list.title}</h1>
            </div>
            <p className="mt-1 text-xs text-text-muted">
              {list.user ? (
                <>
                  by{" "}
                  <Link to={`/user/${list.user.username}`} className="hover:text-gold">
                    {list.user.username}
                  </Link>{" "}
                  &middot;{" "}
                </>
              ) : null}
              {items.length} game{items.length === 1 ? "" : "s"} &middot; updated {shortDate(list.updatedAt)}
            </p>
          </div>

          {isOwner ? (
            <button
              type="button"
              onClick={() => navigate(`/lists/edit?id=${list.id}`)}
              className="flex shrink-0 items-center gap-1.5 rounded bg-accent-orange px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-primary-dark transition-colors hover:bg-gold"
            >
              <EditRoundedIcon sx={{ fontSize: 15 }} />
              Edit
            </button>
          ) : null}
        </div>

        {list.description ? (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-white/75">
            {list.description}
          </p>
        ) : null}

        {/* rate row */}
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line pt-4">
          <div className="flex items-center gap-2">
            {reviewCount ? (
              <BasketballRating value={avgRating} readonly size={18} />
            ) : (
              <span className="text-xs text-text-muted">No ratings yet</span>
            )}
            <span className="text-xs text-text-muted">
              {reviewCount} rating{reviewCount === 1 ? "" : "s"}
            </span>
          </div>

          <div className="h-8 w-px bg-line" />

          <div>
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">
              Your rating
            </div>
            <BasketballRating value={myReview?.rating ?? 0} onChange={handleQuickRate} size={24} />
          </div>

          <div className="ml-auto flex items-center gap-3">
            {myReview ? (
              <button
                type="button"
                onClick={() => deleteReviewM.mutate()}
                disabled={deleteReviewM.isPending}
                className="text-[11px] text-text-muted transition-colors hover:text-accent-red disabled:opacity-50"
              >
                Remove
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => (isAuthed ? setReviewOpen(true) : setAuthOpen(true))}
              className="rounded-md bg-accent-orange px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary-dark transition-colors hover:bg-gold"
            >
              {myReview ? "Edit review" : "Write a review"}
            </button>
          </div>
        </div>
      </div>

      {/* games */}
      <section className="mt-8">
        <SectionRule label="Games" />
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-muted">This list is empty.</p>
        ) : (
          <ol className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
            {items.map((it, i) => (
              <li key={it.id}>
                <Link to={`/games/${it.game.id}`} className="group flex items-center gap-3 px-4 py-2.5">
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
        )}
      </section>

      {/* reviews */}
      <section className="mt-10">
        <SectionRule label={`Reviews${reviewCount > 0 ? ` (${reviewCount})` : ""}`} />
        {reviewsQ.isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-md bg-surface" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-muted">
            No reviews yet - {isAuthed ? "be the first to rate this list." : "sign in to rate this list."}
          </p>
        ) : (
          <div>
            {reviews.map((r) => (
              <ReviewRow
                key={r.id}
                review={r}
                me={me}
                onLike={handleReviewLike}
                onDelete={() => deleteReviewM.mutate()}
              />
            ))}
          </div>
        )}
      </section>

      {/* comments */}
      <section className="mt-10">
        <SectionRule label={`Comments${comments.length > 0 ? ` (${comments.length})` : ""}`} />
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
          <p className="py-6 text-center text-sm text-text-muted">No comments yet - be the first.</p>
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

      <ListReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        existing={myReview}
        onSubmit={submitReview}
        pending={rateM.isPending}
      />

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} initialMode="login" />
    </div>
  )
}