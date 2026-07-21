import { useState, useEffect, useMemo, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "../lib/api"
import { useAuth } from "../context/AuthContext"
import PlayerHeadshot from "../components/PlayerHeadshot"
import AuthModal from "../components/AuthModal"
import SearchRoundedIcon from "@mui/icons-material/SearchRounded"
import CloseRoundedIcon from "@mui/icons-material/CloseRounded"
import PersonRoundedIcon from "@mui/icons-material/PersonRounded"

const TIERS = [
  { tier: 1, slots: 2 },
  { tier: 2, slots: 3 },
  { tier: 3, slots: 4 },
  { tier: 4, slots: 5 },
  { tier: 5, slots: 6 },
]

// A pool/slot entry is uniquely identified by player + chosen era headshot
const variantKey = (p) =>
  `${p.id}-${p.headshotTeamId ?? "cur"}-${p.headshotSeason ?? "cur"}`

function Slot({ player, tierKey, onDrop, onRemove, onSlotClick, selected, editing }) {
  const [over, setOver] = useState(false)
  const ref = useRef(null)

  return (
    <div
      ref={ref}
      draggable={editing && !!player}
      onDragStart={e => {
        if (!player) return
        e.dataTransfer.setData("playerId", String(player.id))
        e.dataTransfer.setData("fromSlot", tierKey)
        if (ref.current) {
          const { width, height } = ref.current.getBoundingClientRect()
          e.dataTransfer.setDragImage(ref.current, width / 2, height / 2)
        }
      }}
      onDragOver={e => { if (editing) { e.preventDefault(); setOver(true) } }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        e.preventDefault()
        setOver(false)
        if (!editing) return
        const id = Number(e.dataTransfer.getData("playerId"))
        const from = e.dataTransfer.getData("fromSlot") || null
        const vKey = e.dataTransfer.getData("variantKey") || null
        if (id) onDrop(id, from, vKey)
      }}
      onClick={() => editing && onSlotClick()}
      className={`relative w-14 h-18 md:w-16 md:h-20 rounded-md overflow-hidden border transition-all group
        ${editing ? "cursor-pointer" : "cursor-default"}
        ${over ? "border-gold scale-105 shadow-lg shadow-black/30"
               : player ? "border-primary/40"
               : "border-dashed border-primary/30"}
        ${selected && !player ? "border-gold" : ""}
        ${player ? "bg-primary" : "bg-white/50"}`}
    >
      {player ? (
        <>
          <PlayerHeadshot
            playerId={player.id}
            teamId={player.headshotTeamId}
            season={player.headshotSeason}
            className="w-full h-full"
          />
          <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-white text-center truncate px-0.5 py-0.5">
            {player.name.split(" ").slice(-1)[0]}
          </span>
          {editing && (
            <button
              onClick={e => { e.stopPropagation(); onRemove() }}
              className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity
                         flex items-center justify-center text-white"
              aria-label={`Remove ${player.name}`}
            >
              <CloseRoundedIcon sx={{ fontSize: 18 }} />
            </button>
          )}
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <PersonRoundedIcon sx={{ fontSize: 30 }} className="text-primary/25" />
        </div>
      )}
    </div>
  )
}

function PoolPlayer({ player, onDragStart, onClick, selected, used }) {
  const ref = useRef(null)

  return (
    <button
      ref={ref}
      draggable={!used}
      onDragStart={e => {
        e.dataTransfer.setData("playerId", String(player.id))
        e.dataTransfer.setData("variantKey", variantKey(player))
        if (ref.current) {
          const { width, height } = ref.current.getBoundingClientRect()
          e.dataTransfer.setDragImage(ref.current, width / 2, height / 2)
        }
        onDragStart(player)
      }}
      onClick={() => !used && onClick(player)}
      disabled={used}
      title={player.variantLabel ? `${player.name} — ${player.variantLabel}` : player.name}
      className={`relative shrink-0 w-12 h-16 rounded-md overflow-hidden border transition-all
        ${used ? "opacity-25 cursor-not-allowed border-transparent"
               : selected ? "border-gold brightness-110 cursor-grab"
                          : "border-line hover:border-gold hover:brightness-110 cursor-grab"}`}
    >
      <PlayerHeadshot
        playerId={player.id}
        teamId={player.headshotTeamId}
        season={player.headshotSeason}
        className="w-full h-full"
      />
      {player.variantLabel && (
        <span className="absolute bottom-0 inset-x-0 bg-black/75 text-[8px] leading-tight text-white text-center truncate px-0.5">
          {player.variantLabel}
        </span>
      )}
    </button>
  )
}

export default function Pyramid() {
  const { isAuthed } = useAuth()
  const qc = useQueryClient()

  const [authOpen, setAuthOpen] = useState(false)
  const [selected, setSelected] = useState(null)   // tap-to-place fallback
  const [query, setQuery] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)
  const [editing, setEditing] = useState(false)

  const [activeId, setActiveId] = useState(null)
  const [title, setTitle] = useState("")

  // slots: { "1-0": { id, name, headshotTeamId, headshotSeason }, ... }
  const [slots, setSlots] = useState({})

  const suggested = useQuery({
    queryKey: ["players", "suggested"],
    queryFn: () => api.get("/players/suggested").then(r => r.data),
    staleTime: Infinity,
  })

  const myPyramids = useQuery({
    queryKey: ["pyramid", "me"],
    queryFn: () => api.get("/pyramid/me").then(r => r.data),
    enabled: isAuthed,
  })

  const active = useMemo(
    () => myPyramids.data?.find(p => p.id === activeId) ?? myPyramids.data?.[0] ?? null,
    [myPyramids.data, activeId]
  )

  // keep activeId pointing at something real
  useEffect(() => {
    if (!activeId && myPyramids.data?.length) setActiveId(myPyramids.data[0].id)
  }, [myPyramids.data, activeId])

  // hydrate slots + title whenever the active pyramid changes
  useEffect(() => {
    if (!active) { setSlots({}); setTitle(""); return }
    const next = {}
    const counters = {}
    for (const entry of active.players) {
      const i = counters[entry.tier] ?? 0
      counters[entry.tier] = i + 1
      next[`${entry.tier}-${i}`] = {
        id: entry.player.id,
        name: entry.player.name,
        headshotTeamId: entry.headshotTeamId ?? null,
        headshotSeason: entry.headshotSeason ?? null,
      }
    }
    setSlots(next)
    setTitle(active.title)
    setEditing(false)
  }, [active?.id, active?.updatedAt])

  // debounced search → expand each matched player into its era headshot variants
  useEffect(() => {
    if (query.trim().length < 3) {
      setSearchResults([])
      setSearching(false)
      return
    }

    let cancelled = false
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const { data: players } = await api.get("/players/search", { params: { q: query } })
        const top = (players ?? []).slice(0, 5)   // cap — each costs a variants request

        const expanded = []
        for (const p of top) {
          try {
            const { data: variants } = await api.get(
              `/players/${p.id}/headshots`, { timeout: 90000 }
            )
            for (const v of variants) {
              expanded.push({
                id: p.id,
                name: p.name,
                headshotTeamId: v.teamId,
                headshotSeason: v.season,
                variantLabel: v.season ? `${v.abbr} ${v.season}` : "Current",
              })
            }
          } catch {
            expanded.push({
              id: p.id,
              name: p.name,
              headshotTeamId: null,
              headshotSeason: null,
              variantLabel: "Current",
            })
          }
          if (cancelled) return
          setSearchResults([...expanded])   // progressive fill
        }
      } catch {
        if (!cancelled) setSearchResults([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 400)

    return () => { cancelled = true; clearTimeout(t) }
  }, [query])

  const usedIds = useMemo(
    () => new Set(Object.values(slots).map(p => p.id)),
    [slots]
  )

  const place = (key, player, fromKey = null) => {
    setSlots(s => {
      const next = { ...s }
      const occupant = next[key]

      if (fromKey && fromKey !== key) {
        if (occupant) next[fromKey] = occupant   // swap
        else delete next[fromKey]                 // move
      } else if (!fromKey && usedIds.has(player.id) && next[key]?.id !== player.id) {
        return s   // already ranked elsewhere
      }

      next[key] = {
        id: player.id,
        name: player.name,
        headshotTeamId: player.headshotTeamId ?? null,
        headshotSeason: player.headshotSeason ?? null,
      }
      return next
    })
    setSelected(null)
  }

  const remove = (key) => setSlots(s => {
    const next = { ...s }
    delete next[key]
    return next
  })

  const createPyramid = useMutation({
    mutationFn: () => api.post("/pyramid", { title: "New Pyramid" }).then(r => r.data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["pyramid", "me"] })
      setActiveId(created.id)
      setSlots({})
      setTitle(created.title)
      setEditing(true)
    },
  })

  const save = useMutation({
    mutationFn: () => {
      const players = Object.entries(slots).map(([key, p]) => ({
        playerId: p.id,
        tier: Number(key.split("-")[0]),
        headshotTeamId: p.headshotTeamId ?? null,
        headshotSeason: p.headshotSeason ?? null,
      }))
      return api.put(`/pyramid/${active.id}`, { title, players }).then(r => r.data)
    },
    onSuccess: () => {
      setSaveMsg("Pyramid saved")
      setTimeout(() => setSaveMsg(null), 2500)
      setEditing(false)
      qc.invalidateQueries({ queryKey: ["pyramid", "me"] })
    },
    onError: e => setSaveMsg(e.response?.data?.error ?? "Save failed"),
  })

  const removePyramid = useMutation({
    mutationFn: () => api.delete(`/pyramid/${active.id}`),
    onSuccess: () => {
      setActiveId(null)
      setSlots({})
      qc.invalidateQueries({ queryKey: ["pyramid", "me"] })
    },
  })

  const pool = searchResults.length > 0 ? searchResults : (suggested.data ?? [])
  const filled = Object.keys(slots).length

  return (
    <div>
      {/* pyramid selector */}
      {isAuthed && (
        <div className="flex items-center justify-center gap-2 flex-wrap mb-6">
          {myPyramids.data?.map(p => (
            <button
              key={p.id}
              onClick={() => setActiveId(p.id)}
              className={`px-3 py-1.5 rounded-full text-xs transition-colors border ${
                p.id === active?.id
                  ? "border-gold text-gold"
                  : "border-line text-text-muted hover:text-white"
              }`}
            >
              {p.title}
              <span className="ml-1.5 opacity-60">{p.players.length}</span>
            </button>
          ))}
          <button
            onClick={() => createPyramid.mutate()}
            disabled={createPyramid.isPending}
            className="px-3 py-1.5 rounded-full text-xs border border-dashed border-line
                       text-text-muted hover:text-gold hover:border-gold transition-colors"
          >
            + New pyramid
          </button>
        </div>
      )}

      {/* title */}
      {editing ? (
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={60}
          placeholder="Pyramid title"
          className="block mx-auto text-center text-3xl md:text-4xl font-bold text-white tracking-wide
                     bg-transparent border-b border-line focus:border-gold outline-none mb-2 px-2"
        />
      ) : (
        <h1 className="text-3xl md:text-4xl font-bold text-white text-center tracking-wide mb-2">
          {active?.title ?? "G.O.A.T. PYRAMID"}
        </h1>
      )}

      <p className="text-center text-text-muted text-sm mb-8">
        {editing
          ? `${filled}/20 spots filled · drag a player in, or tap a player then tap a slot`
          : `${filled} player${filled !== 1 ? "s" : ""} ranked`}
      </p>

      {/* pyramid */}
      <div className="relative max-w-3xl mx-auto mb-10 px-4">
        <svg
          className="absolute inset-0 -z-10 w-full h-full"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <polygon
            points="50,0 100,100 0,100"
            fill="#e8eaed"
            fillOpacity="0.92"
            stroke="#c9ced6"
            strokeWidth="0.3"
          />
        </svg>

        <div className="flex flex-col items-center gap-3 md:gap-4 py-6">
          {TIERS.map(({ tier, slots: count }) => {
            const keys = Array.from({ length: count }, (_, i) => `${tier}-${i}`)
            const visible = editing ? keys : keys.filter(k => slots[k])
            if (visible.length === 0) return null

            return (
              <div key={tier} className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-[0.2em] text-primary/70 font-semibold">
                  Tier {tier}
                </span>
                <div className="flex gap-2 md:gap-2.5">
                  {visible.map(key => (
                    <Slot
                      key={key}
                      tierKey={key}
                      player={slots[key]}
                      editing={editing}
                      selected={!!selected}
                      onDrop={(playerId, fromKey, vKey) => {
                        const fromSlot = fromKey ? slots[fromKey] : null
                        const p = fromSlot
                          ?? (vKey && pool.find(x => variantKey(x) === vKey))
                          ?? pool.find(x => x.id === playerId)
                          ?? Object.values(slots).find(x => x.id === playerId)
                        if (p) place(key, p, fromKey)
                      }}
                      onRemove={() => remove(key)}
                      onSlotClick={() => { if (selected) place(key, selected) }}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* action bar */}
      <div className="flex items-center justify-center gap-4 mb-8">
        {editing ? (
          <>
            <button
              onClick={() => (isAuthed ? save.mutate() : setAuthOpen(true))}
              disabled={save.isPending || !active || filled === 0}
              className="px-6 py-2 rounded-md bg-accent-orange text-primary-dark font-semibold text-sm
                         hover:bg-gold transition-colors disabled:opacity-50"
            >
              {save.isPending ? "Saving…" : "Save pyramid"}
            </button>

            {active && (
              <button
                onClick={() => {
                  setEditing(false)
                  qc.invalidateQueries({ queryKey: ["pyramid", "me"] })
                }}
                className="text-sm text-text-muted hover:text-white transition-colors"
              >
                Cancel
              </button>
            )}

            <button
              onClick={() => setSlots({})}
              className="text-sm text-text-muted hover:text-accent-red transition-colors"
            >
              Clear all
            </button>

            {active && myPyramids.data?.length > 1 && (
              <button
                onClick={() =>
                  window.confirm(`Delete "${active.title}"?`) && removePyramid.mutate()
                }
                className="text-sm text-text-muted hover:text-accent-red transition-colors"
              >
                Delete pyramid
              </button>
            )}
          </>
        ) : (
          <button
            onClick={() => {
              if (!isAuthed) return setAuthOpen(true)
              if (!active) return createPyramid.mutate()
              setEditing(true)
            }}
            className="px-6 py-2 rounded-md border border-line text-white font-semibold text-sm
                       hover:border-gold transition-colors"
          >
            {active ? "Edit pyramid" : "Create your first pyramid"}
          </button>
        )}
        {saveMsg && <span className="text-sm text-gold">{saveMsg}</span>}
      </div>

      {/* player pool — only while editing */}
      {editing && (
        <div className="border border-line rounded-xl bg-surface p-4">
          <div className="flex items-center gap-2 bg-primary-dark border border-line rounded-md px-3 py-2 mb-4">
            <SearchRoundedIcon sx={{ fontSize: 18 }} className="text-text-muted" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search players…"
              className="bg-transparent outline-none text-sm text-white placeholder:text-text-muted w-full"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-text-muted hover:text-white">
                <CloseRoundedIcon sx={{ fontSize: 16 }} />
              </button>
            )}
          </div>

          <p className="text-xs text-text-muted mb-3">
            {searchResults.length > 0
              ? "Search results — each card is a different era headshot"
              : "Suggested players"}
            {searching && <span className="ml-2 text-gold">loading eras…</span>}
          </p>

          {suggested.isLoading ? (
            <p className="text-text-muted text-sm">Loading players…</p>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto">
              {pool.map(p => (
                <PoolPlayer
                  key={variantKey(p)}
                  player={p}
                  used={usedIds.has(p.id)}
                  selected={selected && variantKey(selected) === variantKey(p)}
                  onDragStart={setSelected}
                  onClick={setSelected}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} initialMode="login" />
    </div>
  )
}