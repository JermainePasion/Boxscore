import { useEffect, useState } from "react"
import CloseRoundedIcon from "@mui/icons-material/CloseRounded"

import BasketballRating from "../GameDetail/BasketballRating"

export default function PyramidReviewModal({ open, onClose, existing, onSubmit, pending }) {
  const [rating, setRating] = useState(existing?.rating ?? 0)
  const [text, setText] = useState(existing?.review ?? "")

  useEffect(() => {
    if (open) {
      setRating(existing?.rating ?? 0)
      setText(existing?.review ?? "")
    }
  }, [open, existing])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  const canSave = rating >= 1 && !pending
  const save = () => canSave && onSubmit({ rating, review: text.trim() || null })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-lg border border-line bg-surface p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">
            {existing ? "Edit your review" : "Write a review"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-text-muted transition-colors hover:bg-primary hover:text-white"
          >
            <CloseRoundedIcon sx={{ fontSize: 18 }} />
          </button>
        </div>

        <div className="mb-5 flex justify-center">
          <BasketballRating value={rating} onChange={setRating} size={32} />
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="Share your thoughts on this pyramid… (optional)"
          className="w-full resize-none rounded-md border border-line bg-primary px-3 py-2 text-sm text-white placeholder:text-text-muted focus:border-primary-light focus:outline-none"
        />

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-text-muted transition-colors hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="rounded bg-accent-orange px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-primary-dark transition-colors hover:bg-gold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save review"}
          </button>
        </div>
      </div>
    </div>
  )
}