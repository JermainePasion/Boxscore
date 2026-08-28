import { useMemo } from "react"
import SportsBasketballRoundedIcon from "@mui/icons-material/SportsBasketballRounded"
const BUCKETS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]

const normalize = (distribution) => {
  const counts = {}
  for (const b of BUCKETS) counts[b] = 0

  // Ratings are stored on a 1–10 scale but shown as 0.5–5 stars, so halve.
  const toStars = (r) => Number(r) / 2

  if (Array.isArray(distribution)) {
    for (const row of distribution) {
      const r = toStars(row.rating)
      if (r in counts) counts[r] = (counts[r] ?? 0) + Number(row.count ?? 0)
    }
  } else if (distribution && typeof distribution === "object") {
    for (const [k, v] of Object.entries(distribution)) {
      const r = toStars(k)
      if (r in counts) counts[r] = (counts[r] ?? 0) + Number(v ?? 0)
    }
  }
  return counts
}

export default function RatingHistogram({ distribution, average }) {
  const { counts, total, max, avg } = useMemo(() => {
    const counts = normalize(distribution)
    const values = Object.values(counts)
    const total = values.reduce((a, b) => a + b, 0)
    const max = Math.max(1, ...values) // avoid /0; keeps a flat baseline visible
    const avg =
      (average != null ? average / 2 : null) ??
      (total
        ? BUCKETS.reduce((sum, b) => sum + b * counts[b], 0) / total
        : 0)
    return { counts, total, max, avg }
  }, [distribution, average])

  if (total === 0) {
    return (
      <div className="border-t border-line pt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-white text-sm">Ratings</h2>
        </div>
        <p className="text-text-muted text-xs">No ratings yet — be the first.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-white text-sm">Ratings</h2>
        <div className="flex items-center gap-1 text-gold">
          <SportsBasketballRoundedIcon sx={{ fontSize: 15 }} />
          <span className="text-sm font-bold tabular-nums">{avg.toFixed(1)}</span>
        </div>
      </div>

      {/* bars */}
      <div className="flex items-end justify-between gap-1 h-20">
        {BUCKETS.map((b) => {
          const count = counts[b]
          const pct = (count / max) * 100
          return (
            <div key={b} className="group relative flex-1 flex flex-col justify-end h-full">
              {/* tooltip */}
              <span
                className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap
                           rounded bg-primary-dark px-1.5 py-0.5 text-[10px] text-white opacity-0
                           transition-opacity group-hover:opacity-100 z-10 border border-line"
              >
                {b}★ · {count}
              </span>
              <div
                className="w-full rounded-t bg-accent-orange/80 group-hover:bg-gold transition-all duration-200"
                style={{ height: `${Math.max(pct, count > 0 ? 6 : 2)}%` }}
              />
            </div>
          )
        })}
      </div>

      {/* axis: half-star on the left, five on the right */}
      <div className="mt-2 flex items-center justify-between text-text-muted">
        <span className="flex items-center gap-0.5 text-[10px]">
          <SportsBasketballRoundedIcon sx={{ fontSize: 11 }} />
        </span>
        <span className="text-[10px] tabular-nums">
          {total} rating{total !== 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-0.5 text-[10px]">
          {[0, 1, 2, 3, 4].map((i) => (
            <SportsBasketballRoundedIcon key={i} sx={{ fontSize: 11 }} />
          ))}
        </span>
      </div>
    </div>
  )
}