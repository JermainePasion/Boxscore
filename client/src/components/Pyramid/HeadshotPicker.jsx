import { useQuery } from "@tanstack/react-query"
import { api } from "../../lib/api"
import PlayerHeadshot from "../PlayerHeadshot"
import CloseRoundedIcon from "@mui/icons-material/CloseRounded"

export default function HeadshotPicker({ open, onClose, player, onPick }) {
  const { data: variants, isLoading } = useQuery({
    queryKey: ["headshots", player?.id],
    queryFn: () => api.get(`/players/${player.id}/headshots`, { timeout: 90000 }).then(r => r.data),
    enabled: open && !!player?.id,
    staleTime: Infinity,
  })

  if (!open || !player) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
         onClick={onClose}>
      <div className="w-full max-w-lg bg-primary border border-line rounded-xl p-6 relative"
           onClick={e => e.stopPropagation()}>
        <button onClick={onClose}
                className="absolute top-3 right-3 text-text-muted hover:text-white"
                aria-label="Close">
          <CloseRoundedIcon sx={{ fontSize: 20 }} />
        </button>

        <h2 className="text-lg font-semibold text-white mb-1">{player.name}</h2>
        <p className="text-xs text-text-muted mb-5">Pick which headshot to use</p>

        {isLoading ? (
          <p className="text-text-muted text-sm">Finding available headshots…</p>
        ) : (
          <div className="grid grid-cols-4 gap-3 max-h-72 overflow-y-auto">
            {variants?.map(v => (
              <button
                key={`${v.teamId ?? "cur"}-${v.season ?? "cur"}`}
                onClick={() => { onPick(v); onClose() }}
                className="flex flex-col items-center gap-1 group"
              >
                <div className="w-16 h-20 rounded-md overflow-hidden border border-line
                                group-hover:border-gold transition-colors">
                  <PlayerHeadshot
                    playerId={player.id}
                    teamId={v.teamId}
                    season={v.season}
                    className="w-full h-full"
                  />
                </div>
                <span className="text-[10px] text-text-muted">
                  {v.season ? `${v.abbr} ${v.season}` : "Current"}
                </span>
              </button>
            ))}
          </div>
        )}

        {!isLoading && variants?.length === 1 && (
          <p className="text-xs text-text-muted mt-4">
            Only the current headshot is available for this player — the NBA's archive
            doesn't go back further.
          </p>
        )}
      </div>
    </div>
  )
}