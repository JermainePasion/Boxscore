import { useState } from "react"

/**
 * Half-step basketball rating.
 * value: 0–10 (integer). Each ball = 2 units, so 5 = 2.5 balls.
 */
export default function BasketballRating({ value = 0, onChange, size = 32, readonly = false }) {
  const [hover, setHover] = useState(null)
  const display = hover ?? value

  const handle = (ballIdx, e) => {
    if (readonly) return
    const { left, width } = e.currentTarget.getBoundingClientRect()
    const isLeftHalf = e.clientX - left < width / 2
    return ballIdx * 2 + (isLeftHalf ? 1 : 2)   // 1..10
  }

  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2, 3, 4].map(i => {
        const units = Math.max(0, Math.min(2, display - i * 2))  // 0, 1, or 2
        const fillPct = units * 50                                // 0, 50, or 100
        const clipId = `ball-clip-${i}-${fillPct}`

        return (
          <button
            key={i}
            type="button"
            disabled={readonly}
            onMouseMove={e => !readonly && setHover(handle(i, e))}
            onMouseLeave={() => setHover(null)}
            onClick={e => !readonly && onChange?.(handle(i, e))}
            className={`relative ${readonly ? "cursor-default" : "cursor-pointer hover:scale-110"} transition-transform`}
            style={{ width: size, height: size }}
            aria-label={`${i + 1} balls`}
          >
            <svg viewBox="0 0 100 100" width={size} height={size}>
              <defs>
                <clipPath id={clipId}>
                  <rect x="0" y="0" width={fillPct} height="100" />
                </clipPath>
              </defs>

              {/* empty ball outline */}
              <g fill="none" stroke="var(--color-line)" strokeWidth="5">
                <circle cx="50" cy="50" r="45" />
                <line x1="5" y1="50" x2="95" y2="50" />
                <line x1="50" y1="5" x2="50" y2="95" />
                <path d="M 20 12 Q 42 50 20 88" />
                <path d="M 80 12 Q 58 50 80 88" />
              </g>

              {/* filled portion, clipped left→right */}
              <g clipPath={`url(#${clipId})`}>
                <circle cx="50" cy="50" r="45" fill="#F77F00" stroke="#8a4700" strokeWidth="5" />
                <g stroke="#8a4700" strokeWidth="5" fill="none">
                  <line x1="5" y1="50" x2="95" y2="50" />
                  <line x1="50" y1="5" x2="50" y2="95" />
                  <path d="M 20 12 Q 42 50 20 88" />
                  <path d="M 80 12 Q 58 50 80 88" />
                </g>
              </g>
            </svg>
          </button>
        )
      })}

      {display > 0 && (
        <span className="ml-2 text-sm font-semibold text-gold">
          {(display / 2).toFixed(1)}
        </span>
      )}
    </div>
  )
}