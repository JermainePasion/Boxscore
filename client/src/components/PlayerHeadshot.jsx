// src/components/PlayerHeadshot.jsx
import { useState, useEffect } from "react"

const FALLBACK = "/player-silhouette.png"

export default function PlayerHeadshot({ playerId, teamId, season, className }) {
  const candidates = [
      season && teamId
      ? `https://cdn.nba.com/headshots/nba/${teamId}/${season}/260x190/${playerId}.png`
      : null,
    `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`,
    FALLBACK,
  ].filter(Boolean)

  const [idx, setIdx] = useState(0)

  // Reset the chain when the player changes (e.g., navigating between games)
  useEffect(() => { setIdx(0) }, [playerId, teamId, season])

  return (
    <img
      key={`${playerId}-${idx}`}  
      src={candidates[idx]}
      alt=""
      className={className}
      onError={() => setIdx(i => Math.min(i + 1, candidates.length - 1))}
    />
  )
}