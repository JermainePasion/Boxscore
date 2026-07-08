import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../../lib/api"
import SearchRoundedIcon from "@mui/icons-material/SearchRounded"

export default function GameSearch() {
  const [q, setQ] = useState("")
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const boxRef = useRef(null)

  // debounce
  useEffect(() => {
    if (q.trim().length < 3) { setResults([]); return }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get("/games/smart-search", { params: { q } })
        setResults(Array.isArray(data) ? data.slice(0, 5) : [])
        setOpen(true)
      } catch { setResults([]) }
    }, 400)
    return () => clearTimeout(t)
  }, [q])

  // close on outside click
  useEffect(() => {
    const onClick = e => { if (!boxRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const submit = () => {
    if (!q.trim()) return
    setOpen(false)
    navigate(`/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-xs">
      <div className="flex items-center gap-2 bg-primary-light/40 border border-line rounded-md px-3 py-1.5">
        <SearchRoundedIcon sx={{ fontSize: 18 }} className="text-text-muted" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          onFocus={() => results.length && setOpen(true)}
          placeholder="lakers march 2026…"
          className="bg-transparent outline-none text-sm text-white placeholder:text-text-muted w-full"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-primary border border-line rounded-md shadow-lg overflow-hidden z-50">
          {results.map(r => (
            <button
              key={r.gameId + r.matchup}
              onClick={() => { setOpen(false); setQ(""); navigate(`/games/${r.gameId}`) }}
              className="w-full text-left px-3 py-2 hover:bg-surface-hover transition-colors"
            >
              <p className="text-sm text-white">{r.label ?? r.matchup}</p>
              <p className="text-xs text-text-muted">{r.date}</p>
            </button>
          ))}
          <button
            onClick={submit}
            className="w-full text-left px-3 py-2 text-xs text-gold hover:bg-surface-hover border-t border-line"
          >
            See all results →
          </button>
        </div>
      )}
    </div>
  )
}