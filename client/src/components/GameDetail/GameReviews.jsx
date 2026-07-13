import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "../../lib/api"
import { useAuth } from "../../context/AuthContext"
import BasketballRating from "./BasketballRating"
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded"
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded"
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded"
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded"

function Avatar({ username, size = 36 }) {
  const initials = username?.slice(0, 2).toUpperCase() ?? "??"
  const hue = ((username?.charCodeAt(0) ?? 0) * 37) % 360
  return (
    <div
      className="rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
      style={{ width: size, height: size, background: `hsl(${hue}, 50%, 45%)` }}
    >
      {initials}
    </div>
  )
}

function ReviewCard({ review, gameId }) {
  const { user, isAuthed } = useAuth()
  const qc = useQueryClient()
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState("")

  const isOwner = user?.id === review.user?.id
  const hasLiked = review.likes?.some(l => l.userId === user?.id)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["reviews", gameId] })
    qc.invalidateQueries({ queryKey: ["game", gameId] })
  }

  const toggleLike = useMutation({
    mutationFn: () => api.post(`/reviews/${review.id}/like`),
    onSuccess: invalidate,
  })

  const addComment = useMutation({
    mutationFn: () =>
      api.post("/comments", { reviewId: review.id, content: commentText.trim() }),
    onSuccess: () => { setCommentText(""); invalidate() },
  })

  const removeReview = useMutation({
    mutationFn: () => api.delete(`/reviews/${review.id}`),
    onSuccess: invalidate,
  })

  const watchInfo = review.watchedAt
    ? `Watched ${new Date(review.watchedAt).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
      })}`
    : review.watchedBefore
    ? "Rewatch"
    : null

  return (
    <div className="border border-line bg-surface rounded-xl p-5">
      {/* header */}
      <div className="flex items-center gap-3 mb-3">
        <Avatar username={review.user?.username} />
        <div className="flex-1 min-w-0">
          <Link
            to={`/user/${review.user?.username}`}
            className="text-sm font-medium text-white hover:text-gold transition-colors"
          >
            {review.user?.username}
          </Link>
          <p className="text-xs text-text-muted">
            {new Date(review.createdAt).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            })}
          </p>
        </div>

        {isOwner && (
          <button
            onClick={() => window.confirm("Delete your review?") && removeReview.mutate()}
            className="text-text-muted hover:text-accent-red transition-colors"
            aria-label="Delete review"
          >
            <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
          </button>
        )}
      </div>

      {/* rating + watch tag */}
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <BasketballRating value={review.rating} readonly size={20} />
        {watchInfo && (
          <span className="text-xs text-text-muted border border-line rounded-full px-2 py-0.5">
            {watchInfo}
          </span>
        )}
      </div>

      {/* body */}
      {review.review && (
        <p className="text-sm text-white leading-relaxed whitespace-pre-wrap mb-4">
          {review.review}
        </p>
      )}

      {/* actions */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => isAuthed && toggleLike.mutate()}
          disabled={!isAuthed}
          className={`flex items-center gap-1.5 text-xs transition-colors ${
            hasLiked ? "text-accent-red" : "text-text-muted hover:text-white"
          } ${!isAuthed ? "cursor-default" : ""}`}
        >
          {hasLiked
            ? <FavoriteRoundedIcon sx={{ fontSize: 16 }} />
            : <FavoriteBorderRoundedIcon sx={{ fontSize: 16 }} />}
          {review.likeCount ?? 0}
        </button>

        <button
          onClick={() => setShowComments(s => !s)}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-white transition-colors"
        >
          <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 16 }} />
          {review.comments?.length ?? 0}
        </button>
      </div>

      {/* comments */}
      {showComments && (
        <div className="mt-4 pt-4 border-t border-line flex flex-col gap-3">
          {review.comments?.map(c => (
            <div key={c.id} className="flex gap-2.5">
              <Avatar username={c.user?.username} size={28} />
              <div className="flex-1 bg-primary rounded-lg px-3 py-2">
                <span className="text-xs font-medium text-white">{c.user?.username}</span>
                <p className="text-sm text-white/90 leading-snug mt-0.5">{c.content}</p>
              </div>
            </div>
          ))}

          {isAuthed ? (
            <div className="flex gap-2">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && commentText.trim() && addComment.mutate()}
                placeholder="Add a comment…"
                className="flex-1 bg-primary-dark border border-line rounded-md px-3 py-1.5 text-sm text-white outline-none focus:border-gold transition-colors"
              />
              <button
                onClick={() => commentText.trim() && addComment.mutate()}
                disabled={!commentText.trim() || addComment.isPending}
                className="px-3 py-1.5 rounded-md border border-line text-sm text-white hover:border-gold transition-colors disabled:opacity-50"
              >
                Post
              </button>
            </div>
          ) : (
            <p className="text-xs text-text-muted">Sign in to comment.</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function GameReviews({ game }) {
  const [sort, setSort] = useState("recent") // recent | liked | rating

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["reviews", game.id],
    queryFn: () => api.get(`/reviews/game/${game.id}`).then(r => r.data),
  })

  if (isLoading) return <p className="text-text-muted text-sm">Loading reviews…</p>

  const sorted = [...(reviews ?? [])].sort((a, b) => {
    if (sort === "liked") return (b.likeCount ?? 0) - (a.likeCount ?? 0)
    if (sort === "rating") return b.rating - a.rating
    return new Date(b.createdAt) - new Date(a.createdAt)
  })

  const withText = sorted.filter(r => r.review?.trim())
  const avg = sorted.length
    ? (sorted.reduce((s, r) => s + r.rating, 0) / sorted.length / 2).toFixed(1)
    : null

  return (
    <div className="max-w-2xl mx-auto">
      {/* summary bar */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-4">
          {avg && (
            <>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-white">{avg}</span>
                <span className="text-sm text-text-muted">/ 5</span>
              </div>
              <div>
                <BasketballRating value={Math.round(avg * 2)} readonly size={18} />
                <p className="text-xs text-text-muted mt-1">
                  {sorted.length} rating{sorted.length !== 1 ? "s" : ""} · {withText.length} written
                </p>
              </div>
            </>
          )}
        </div>

        {sorted.length > 1 && (
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="bg-primary border border-line rounded-md px-3 py-1.5 text-sm text-white outline-none"
          >
            <option value="recent">Most recent</option>
            <option value="liked">Most liked</option>
            <option value="rating">Highest rated</option>
          </select>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="text-text-muted text-sm text-center py-10">
          No reviews yet. Be the first to log this game.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {sorted.map(r => (
            <ReviewCard key={r.id} review={r} gameId={game.id} />
          ))}
        </div>
      )}
    </div>
  )
}