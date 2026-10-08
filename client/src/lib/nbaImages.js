const CDN = "https://cdn.nba.com"

export const headshotUrl = (playerId) =>
  `${CDN}/headshots/nba/latest/1040x760/${playerId}.png`

export const seasonHeadshotUrl = (teamId, season, playerId) =>
  `${CDN}/headshots/nba/${teamId}/${season}/260x190/${playerId}.png`

export const logoUrl = (teamId) =>
  `${CDN}/logos/nba/${teamId}/global/L/logo.svg`