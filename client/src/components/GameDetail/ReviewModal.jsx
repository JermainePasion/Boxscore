import { useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "../../lib/api"
import BasketballRating from "./BasketballRating"
import CloseRoundedIcon from "@mui/icons-material/CloseRounded"

export default function ReviewModal({ open, onClose, game, existing }) {
  const qc = useQueryClient()
  const [rating, setRating] = useState(0)
  const [text, setText] = useState("")
  const [watchedAt, setWatchedAt] = useState("")
  const [watchedBefore, setWatchedBefore] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) {
      setRating(existing?.rating ?? 0)
      setText(existing?.review ?? "")
      setWatchedAt(existing?.watchedAt ? existing.watchedAt.slice(0, 10) : "")
      setWatchedBefore(existing?.watchedBefore ?? false)
      setError(null)
    }
  }, [open, existing])

  useEffect(() => {
    const onKey = e => e.key === "Escape" && onClose()
    if (open) document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const save = useMutation({
    mutationFn: () => api.post("/reviews", {
      gameId: game.id,
      rating,
      review: text.trim() || null,
      watchedAt: watchedAt || null,
      watchedBefore,
    }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["game", game.id] })
      qc.invalidateQueries({ queryKey: ["reviews", game.id] })
      onClose()
    },
    onError: (e) => setError(e.response?.data?.error ?? "Failed to save review"),
  })

  if (!open) return null

  const matchup = game.title ?? `${game.awayTeam?.name} vs. ${game.homeTeam?.name}`

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-primary border border-line rounded-xl p-6 relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-text-muted hover:text-white transition-colors"
          aria-label="Close"
        >
          <CloseRoundedIcon sx={{ fontSize: 20 }} />
        </button>

        <h2 className="text-lg font-semibold text-white">
          {existing ? "Edit your review" : "Log this game"}
        </h2>
        <p className="text-xs text-text-muted mb-5">{matchup}</p>

        <div className="flex flex-col gap-5">
          <div>
            <label className="text-xs text-text-muted block mb-2">Rating</label>
            <BasketballRating value={rating} onChange={setRating} size={34} />
          </div>

          <div>
            <label className="text-xs text-text-muted block mb-2">
              Review <span className="opacity-60">(optional)</span>
            </label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={5}
              placeholder="What did you think of this game?"
              className="w-full bg-primary-dark border border-line rounded-md px-3 py-2 text-sm text-white outline-none focus:border-gold transition-colors resize-y leading-relaxed"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
              <input
                type="checkbox"
                checked={watchedBefore}
                onChange={e => {
                  setWatchedBefore(e.target.checked)
                  if (e.target.checked) setWatchedAt("")
                }}
                className="accent-[#F77F00]"
              />
              I've watched this before
            </label>

            <div className="flex items-center gap-2">
              <label className="text-sm text-text-muted whitespace-nowrap">Watched on</label>
              <input
                type="date"
                value={watchedAt}
                onChange={e => {
                  setWatchedAt(e.target.value)
                  if (e.target.value) setWatchedBefore(false)
                }}
                className="bg-primary-dark border border-line rounded-md px-2 py-1 text-sm text-white outline-none focus:border-gold"
              />
            </div>
          </div>

          {error && <p className="text-xs text-accent-red">{error}</p>}

          <button
            onClick={() => {
              if (rating === 0) return setError("Pick a rating first")
              save.mutate()
            }}
            disabled={save.isPending}
            className="w-full py-2 rounded-md bg-accent-orange text-primary-dark font-semibold text-sm hover:bg-gold transition-colors disabled:opacity-60"
          >
            {save.isPending ? "Saving…" : existing ? "Update review" : "Post review"}
          </button>
        </div>
      </div>
    </div>
  )
}