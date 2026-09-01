import { useState, useEffect, useMemo, useRef } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import SearchRoundedIcon from "@mui/icons-material/SearchRounded"
import CloseRoundedIcon from "@mui/icons-material/CloseRounded"
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded"

import { api } from "../../lib/api"
import { useAuth } from "../../context/AuthContext"
import TeamLogo from "../../components/TeamLogo"

const teamTag = (t) => t?.abbreviation || t?.name || "?"
const gameLabel = (g) => g?.title || `${teamTag(g?.awayTeam)} @ ${teamTag(g?.homeTeam)}`
const shortDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : ""

function TeamMark({ team, className }) {
  if (team?.id) return <TeamLogo teamId={team.id} alt={teamTag(team)} className={`${className} object-contain`} />
  return (
    <span className={`${className} grid place-items-center rounded-full bg-primary text-[8px] font-semibold text-white`}>
      {team?.abbreviation || "—"}
    </span>
  )
}

export default function ListEditor() {
  const { isAuthed } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editingId = params.get("id")

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [ranked, setRanked] = useState(false)
  const [items, setItems] = useState([]) // [{ game }]
  const [activeId, setActiveId] = useState(editingId ?? null)

  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)

  const dragIndex = useRef(null)

  const myLists = useQuery({
    queryKey: ["lists", "me"],
    queryFn: () => api.get("/lists/me").then((r) => r.data),
    enabled: isAuthed,
  })

  const active = useMemo(
    () => myLists.data?.find((l) => l.id === activeId) ?? null,
    [myLists.data, activeId]
  )

  // hydrate when the active list loads/changes
  useEffect(() => {
    if (!active) return
    setTitle(active.title)
    setDescription(active.description ?? "")
    setRanked(active.ranked)
    setItems((active.items ?? []).map((it) => ({ game: it.game })))
  }, [active?.id, active?.updatedAt])

  const usedIds = useMemo(() => new Set(items.map((it) => it.game.id)), [items])

  // debounced game search
  useEffect(() => {
    if (query.trim().length < 3) { setResults([]); setSearching(false); return }
    let cancelled = false
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const { data } = await api.get("/games/search", { params: { q: query } })
        if (!cancelled) setResults((data ?? []).slice(0, 8))
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 400)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query])

  const addGame = (game) => {
    if (usedIds.has(game.id)) return
    // search may return a light shape; keep whatever teams it gave us
    setItems((prev) => [...prev, { game }])
    setQuery("")
    setResults([])
  }
  const removeGame = (gameId) => setItems((prev) => prev.filter((it) => it.game.id !== gameId))

  const move = (from, to) => {
    setItems((prev) => {
      if (to < 0 || to >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const createList = useMutation({
    mutationFn: () => api.post("/lists", { title: "Untitled list", ranked: false }).then((r) => r.data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["lists", "me"] })
      setActiveId(created.id)
    },
  })

  const save = useMutation({
    mutationFn: () =>
      api
        .put(`/lists/${active.id}`, {
          title,
          description,
          ranked,
          gameIds: items.map((it) => it.game.id),
        })
        .then((r) => r.data),
    onSuccess: () => {
      setSaveMsg("Saved")
      setTimeout(() => setSaveMsg(null), 2000)
      qc.invalidateQueries({ queryKey: ["lists", "me"] })
      qc.invalidateQueries({ queryKey: ["lists", "explore"] })
    },
    onError: (e) => setSaveMsg(e.response?.data?.error ?? "Save failed"),
  })

  const removeList = useMutation({
    mutationFn: () => api.delete(`/lists/${active.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lists", "me"] })
      navigate("/lists")
    },
  })

  if (!isAuthed) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center text-sm text-text-muted">
        Sign in to build lists.
      </div>
    )
  }

  // no list selected yet → offer to create one
  if (!active) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-xl font-semibold text-white">New list</h1>
        <p className="mt-2 text-sm text-text-muted">Start a fresh game list.</p>
        <button
          type="button"
          onClick={() => createList.mutate()}
          disabled={createList.isPending}
          className="mt-6 rounded bg-gold px-6 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary-dark transition-colors hover:bg-accent-orange disabled:opacity-60"
        >
          {createList.isPending ? "Creating…" : "Create list"}
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
      {/* title + meta */}
      <div className="py-8">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          placeholder="List title"
          className="w-full bg-transparent text-2xl font-bold tracking-wide text-white outline-none placeholder:text-text-muted sm:text-3xl"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 500))}
          rows={2}
          placeholder="Add a description (optional)"
          className="mt-3 w-full resize-none rounded border border-line bg-primary-dark/40 p-3 text-sm leading-relaxed text-white/80 outline-none placeholder:text-text-muted focus:border-primary-light"
        />

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-text-muted">
            <input
              type="checkbox"
              checked={ranked}
              onChange={(e) => setRanked(e.target.checked)}
              className="h-4 w-4 accent-gold"
            />
            Ranked list (show numbers)
          </label>
          <span className="text-xs text-text-muted">{items.length} game{items.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      {/* search / add */}
      <div className="mb-6 rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center gap-2 rounded-md border border-line bg-primary-dark px-3 py-2">
          <SearchRoundedIcon sx={{ fontSize: 18 }} className="text-text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search games to add…"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-text-muted"
          />
          {searching ? <span className="text-xs text-gold">…</span> : null}
        </div>

        {results.length > 0 ? (
          <div className="mt-3 flex flex-col divide-y divide-line">
            {results.map((g) => {
              const added = usedIds.has(g.id)
              return (
                <button
                  key={g.id}
                  type="button"
                  disabled={added}
                  onClick={() => addGame(g)}
                  className={`flex items-center gap-3 py-2 text-left transition-colors ${
                    added ? "opacity-40" : "hover:text-gold"
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <TeamMark team={g.awayTeam} className="h-6 w-6" />
                    <span className="text-[9px] text-text-muted">@</span>
                    <TeamMark team={g.homeTeam} className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-white">{gameLabel(g)}</span>
                    <span className="block text-[11px] text-text-muted">{shortDate(g.date)}</span>
                  </span>
                  <span className="shrink-0 text-xs text-text-muted">{added ? "Added" : "+ Add"}</span>
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      {/* items — drag to reorder */}
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-line bg-surface/40 px-6 py-10 text-center text-sm text-text-muted">
          Search above to add games to this list.
        </p>
      ) : (
        <ol className="flex flex-col divide-y divide-line rounded-lg border border-line">
          {items.map((it, i) => (
            <li
              key={it.game.id}
              draggable
              onDragStart={() => (dragIndex.current = i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex.current != null && dragIndex.current !== i) move(dragIndex.current, i)
                dragIndex.current = null
              }}
              className="flex items-center gap-3 bg-surface px-3 py-2.5"
            >
              <DragIndicatorRoundedIcon sx={{ fontSize: 18 }} className="shrink-0 cursor-grab text-text-muted" />
              {ranked ? (
                <span className="w-5 shrink-0 text-center text-sm font-bold text-gold">{i + 1}</span>
              ) : null}
              <span className="flex items-center gap-1">
                <TeamMark team={it.game.awayTeam} className="h-6 w-6" />
                <span className="text-[9px] text-text-muted">@</span>
                <TeamMark team={it.game.homeTeam} className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-white">{gameLabel(it.game)}</span>
                <span className="block text-[11px] text-text-muted">{shortDate(it.game.date)}</span>
              </span>
              <button
                type="button"
                onClick={() => removeGame(it.game.id)}
                aria-label="Remove"
                className="shrink-0 text-text-muted transition-colors hover:text-accent-red"
              >
                <CloseRoundedIcon sx={{ fontSize: 16 }} />
              </button>
            </li>
          ))}
        </ol>
      )}

      {/* actions */}
      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="rounded-md bg-accent-orange px-6 py-2 text-sm font-semibold text-primary-dark transition-colors hover:bg-gold disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : "Save list"}
        </button>
        <button
          type="button"
          onClick={() => navigate("/lists")}
          className="text-sm text-text-muted transition-colors hover:text-white"
        >
          Done
        </button>
        <button
          type="button"
          onClick={() => window.confirm(`Delete "${active.title}"?`) && removeList.mutate()}
          className="ml-auto text-sm text-text-muted transition-colors hover:text-accent-red"
        >
          Delete list
        </button>
        {saveMsg ? <span className="text-sm text-gold">{saveMsg}</span> : null}
      </div>
    </div>
  )
}