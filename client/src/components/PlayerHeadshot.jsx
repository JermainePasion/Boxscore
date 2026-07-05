
import { useState } from "react"

const FALLBACK = "/player-silhouette.png" 

export default function PlayerHeadshot({ playerId, teamId, season, className }) {
  // Try era-specific → current → silhouette
  const candidates = [
    season && teamId
      ? `https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/${teamId}/${season}/260x190/${playerId}.png`
      : null,
    `https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/260x190/${playerId}.png`,
    FALLBACK,
  ].filter(Boolean)

  const [idx, setIdx] = useState(0)

  return (
    <img
      src={candidates[idx]}
      alt=""
      className={className}
      onError={() => setIdx(i => Math.min(i + 1, candidates.length - 1))}
    />
  )
}