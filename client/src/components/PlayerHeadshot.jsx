import { useState, useEffect } from "react"

const FALLBACK = "/player-silhouette.png"
const API_BASE = "http://localhost:5000"

export default function PlayerHeadshot({ playerId, teamId, season, className }) {
  // Chain: era-specific → any current headshot → silhouette (all via proxy)
  const candidates = [
    season && teamId && playerId
      ? `${API_BASE}/api/img/headshot/${teamId}/${season}/${playerId}`
      : null,
    playerId
      ? `${API_BASE}/api/img/headshot/${playerId}`
      : null,
    FALLBACK,
  ].filter(Boolean)

  const [idx, setIdx] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setIdx(0)
    setLoaded(false)
  }, [playerId, teamId, season])

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* spinner while loading */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary">
          <div className="w-1/2 h-1/2 max-w-6 max-h-6 border-2 border-line border-t-gold rounded-full animate-spin" />
        </div>
      )}

      <img
        key={`${playerId}-${idx}`}
        src={candidates[idx]}
        alt=""
        loading="lazy"
        className={`w-full h-full object-cover object-top transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(false)
          setIdx(i => Math.min(i + 1, candidates.length - 1))
        }}
      />
    </div>
  )
}