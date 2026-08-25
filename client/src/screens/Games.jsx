import { useQuery } from "@tanstack/react-query"
import { useState, useRef, useEffect } from "react"
import { api } from "../lib/api"
import GameCard from "../components/GameCard"
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded"
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded"

/* ── plain grid section (Discover) ── */
function Section({ title, games, isLoading, skeletons = 5 }) {
  return (
    <section className="mb-10">
      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-sm font-semibold tracking-widest text-white uppercase">{title}</h2>
        <div className="flex-1 h-px bg-accent-red" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: skeletons }).map((_, i) => (
            <div key={i} className="aspect-[4/5] rounded-xl bg-surface animate-pulse" />
          ))}
        </div>
      ) : games?.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {games.map((g) => <GameCard key={g.id} game={g} />)}
        </div>
      ) : (
        <p className="text-text-muted text-sm">Nothing to show yet.</p>
      )}
    </section>
  )
}

/* ── looping coverflow carousel (Latest Games) ── */
const SPACING = 150          // px between card centers; < card width so neighbors overlap
const MAX_RANGE = 3          // how many cards to show on each side of center

function CarouselRow({ title, games, isLoading, skeletons = 5 }) {
  const list = games ?? []
  const N = list.length
  const [active, setActive] = useState(0)

  // How far out we render. Kept below N/2 so the point where a card wraps from
  // the far right to the far left always happens off-screen (hidden), which is
  // what makes the infinite loop look seamless instead of sliding across.
  const range = Math.max(0, Math.min(MAX_RANGE, Math.floor((N - 1) / 2)))

  // keep active valid if the data length changes
  useEffect(() => {
    if (N && active > N - 1) setActive(0)
  }, [N, active])

  // drag / swipe
  const drag = useRef({ startX: 0, dx: 0, active: false, moved: false })
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)

  const wrap = (i) => ((i % N) + N) % N
  const go = (dir) => setActive((a) => wrap(a + dir))

  const onDown = (e) => {
    drag.current = { startX: e.clientX, dx: 0, active: true, moved: false }
    setDragging(true)
  }
  const onMove = (e) => {
    if (!drag.current.active) return
    const dx = e.clientX - drag.current.startX
    drag.current.dx = dx
    if (Math.abs(dx) > 5) drag.current.moved = true
    setDragX(dx)
  }
  const onUp = () => {
    if (!drag.current.active) return
    const steps = Math.round(-drag.current.dx / SPACING)
    if (steps !== 0) setActive((a) => wrap(a + steps))
    drag.current.active = false
    setDragging(false)
    setDragX(0)
  }

  return (
    <section className="mb-10">
      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-sm font-semibold tracking-widest text-white uppercase">{title}</h2>
        <div className="flex-1 h-px bg-accent-red" />
      </div>

      {isLoading ? (
        <div className="flex justify-center gap-4 h-[320px] items-center">
          {Array.from({ length: Math.min(skeletons, 3) }).map((_, i) => (
            <div
              key={i}
              className="w-40 sm:w-44 aspect-[4/5] rounded-xl bg-surface animate-pulse"
              style={{ opacity: i === 1 ? 1 : 0.4 }}
            />
          ))}
        </div>
      ) : N === 0 ? (
        <p className="text-text-muted text-sm">Nothing to show yet.</p>
      ) : (
        <div className="relative mx-12">
          {/* left arrow */}
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous"
            className="absolute -left-12 top-1/2 -translate-y-1/2 z-[200] grid h-9 w-9 place-items-center
                       rounded-full bg-surface border border-line text-white hover:border-gold transition-colors"
          >
            <ChevronLeftRoundedIcon sx={{ fontSize: 20 }} />
          </button>

          {/* stage */}
          <div
            className="relative h-[320px] overflow-hidden select-none touch-pan-y cursor-grab active:cursor-grabbing"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
          >
            {list.map((g, i) => {
              // signed shortest distance from the active (center) card, wrapped
              let d = i - active
              if (d > N / 2) d -= N
              if (d < -N / 2) d += N

              const ad = Math.abs(d)
              if (ad > range) return null // off-screen (and where the wrap hides)

              const isCenter = d === 0
              const scale = 1 - Math.min(ad, MAX_RANGE) * 0.13
              const opacity = isCenter ? 1 : Math.max(0.12, 0.55 - (ad - 1) * 0.18)
              const x = d * SPACING + dragX

              return (
                <div
                  key={g.id}
                  onClickCapture={(e) => {
                    // a drag shouldn't trigger navigation; a side-card click centers it
                    if (drag.current.moved) {
                      e.preventDefault()
                      e.stopPropagation()
                    } else if (!isCenter) {
                      e.preventDefault()
                      e.stopPropagation()
                      setActive(i)
                    }
                  }}
                  className={`absolute left-1/2 top-1/2 w-40 sm:w-44 ${
                    dragging ? "" : "transition-all duration-300 ease-out"
                  } ${isCenter ? "" : "pointer-events-auto"}`}
                  style={{
                    transform: `translate(calc(-50% + ${x}px), -50%) scale(${scale})`,
                    opacity,
                    zIndex: 100 - ad,
                    filter: isCenter ? "none" : "saturate(0.85)",
                  }}
                >
                  <GameCard game={g} />
                </div>
              )
            })}
          </div>

          {/* right arrow */}
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next"
            className="absolute -right-12 top-1/2 -translate-y-1/2 z-[200] grid h-9 w-9 place-items-center
                       rounded-full bg-surface border border-line text-white hover:border-gold transition-colors"
          >
            <ChevronRightRoundedIcon sx={{ fontSize: 20 }} />
          </button>
        </div>
      )}
    </section>
  )
}

export default function Games() {
  const recent = useQuery({
    queryKey: ["games", "recent"],
    queryFn: () => api.get("/games/recent", { timeout: 300000 }).then((r) => r.data), // 5 min ceiling
    staleTime: 30 * 60 * 1000,
  })

  const random = useQuery({
    queryKey: ["games", "random"],
    queryFn: () => api.get("/games/random?count=10").then((r) => r.data),
    staleTime: Infinity, // keep the same random set for the session
  })

  return (
    <div>
      <CarouselRow title="Latest Games" games={recent.data} isLoading={recent.isLoading} skeletons={10} />
      <Section title="Discover" games={random.data} isLoading={random.isLoading} skeletons={10} />
    </div>
  )
}