import { useState, useEffect } from "react"

const FALLBACK = "/player-silhouette.png"

export default function PlayerHeadshot({ playerId, teamId, season, className }) {
  // Chain: era-specific → any current headshot → silhouette
  const candidates = [
    season && teamId && playerId
      ? `https://cdn.nba.com/headshots/nba/${teamId}/${season}/260x190/${playerId}.png`
      : null,
    playerId
      ? `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`
      : null,
    FALLBACK,
  ].filter(Boolean)

  const [idx, setIdx] = useState(0)

  useEffect(() => { setIdx(0) }, [playerId, teamId, season])

  return (
    <img
      key={`${playerId}-${idx}`}
      src={candidates[idx]}
      alt=""
      referrerPolicy="no-referrer"
      loading="lazy"
      className={className}
      onError={() => setIdx(i => Math.min(i + 1, candidates.length - 1))}
    />
  )
}