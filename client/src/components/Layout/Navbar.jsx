import { useState, useRef, useEffect } from "react"
import { Link, NavLink } from "react-router-dom"
import GameSearch from "../Search/GameSearch"
import AuthModal from "../AuthModal"
import { useAuth } from "../../context/AuthContext"

import HomeRoundedIcon from "@mui/icons-material/HomeRounded"
import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory'
import PersonRoundedIcon from "@mui/icons-material/PersonRounded"
import SportsBasketballRoundedIcon from "@mui/icons-material/SportsBasketballRounded"
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded"
import MenuRoundedIcon from "@mui/icons-material/MenuRounded"
import CloseRoundedIcon from "@mui/icons-material/CloseRounded"

const navLinks = [
  { to: "/", label: "Home", icon: HomeRoundedIcon },
  { to: "/pyramid", label: "G.O.A.T Pyramid", icon: ChangeHistoryIcon },
  { to: "/games", label: "Games", icon: SportsBasketballRoundedIcon },
]

function NavUserMenu({ username }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const itemClasses = ({ isActive }) =>
    `block px-4 py-2 text-sm transition-colors ${
      isActive ? "text-gold" : "text-white hover:text-gold hover:bg-surface-hover"
    }`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex flex-col items-center gap-1 px-4 py-2 rounded-md text-xs font-medium transition-colors ${
          open ? "text-gold" : "text-white hover:text-gold"
        }`}
      >
        <PersonRoundedIcon sx={{ fontSize: 22 }} />
        <span className="relative flex items-center justify-center gap-0.5">
          <span className="max-w-[90px] truncate">{username}</span>
          <ExpandMoreRoundedIcon
            sx={{ fontSize: 14 }}
            className={`absolute -right-3 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open && (
        <div className="absolute left-1/2 top-full z-50 mt-1 w-40 -translate-x-1/2 overflow-hidden rounded-md border border-line bg-primary py-1 shadow-lg shadow-black/30">
          <NavLink to={`/user/${username}`} end onClick={() => setOpen(false)} className={itemClasses}>
            Profile
          </NavLink>
          <NavLink to={`/user/${username}/diary`} onClick={() => setOpen(false)} className={itemClasses}>
            Diary
          </NavLink>
        </div>
      )}
    </div>
  )
}

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState("login")
  const { user, isAuthed, logout } = useAuth()

  const openAuth = (mode) => {
    setAuthMode(mode)
    setAuthOpen(true)
    setMobileOpen(false)
  }

  const linkClasses = ({ isActive }) =>
    `flex flex-col items-center gap-1 px-4 py-2 rounded-md text-xs font-medium transition-colors ${
      isActive ? "text-gold" : "text-white hover:text-gold"
    }`

  return (
    <>
      <header className="sticky top-0 z-50 bg-primary border-b border-line">
        <nav className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center h-16 gap-4">

            <Link to="/" className="flex items-center gap-2 shrink-0">
              <SportsBasketballRoundedIcon sx={{ fontSize: 34 }} className="text-accent-orange" />
              <span className="text-xl tracking-tight text-gold">BoxScore</span>
            </Link>

            <div className="hidden md:flex items-center gap-2 mx-auto">
              {navLinks.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} className={linkClasses}>
                  <Icon sx={{ fontSize: 22 }} />
                  <span>{label}</span>
                </NavLink>
              ))}
              {isAuthed ? <NavUserMenu username={user?.username} /> : null}
            </div>

            <div className="hidden md:block shrink-0 w-48">
              <GameSearch />
            </div>

            {/* Auth — desktop */}
            <div className="hidden md:flex items-center gap-3 shrink-0">
              {isAuthed ? (
                <>
                  <Link
                    to={`/user/${user?.username}`}
                    className="flex items-center gap-2 text-sm text-white hover:text-gold transition-colors"
                  >
                    <span className="w-7 h-7 rounded-full bg-accent-red flex items-center justify-center text-xs font-bold">
                      {user?.username?.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="hidden lg:inline">{user?.username}</span>
                  </Link>
                  <button
                    onClick={logout}
                    className="text-xs text-text-muted hover:text-accent-red transition-colors"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => openAuth("login")}
                    className="text-sm text-white hover:text-gold transition-colors whitespace-nowrap"
                  >
                    Sign in
                  </button>
                  <button
                    onClick={() => openAuth("register")}
                    className="text-sm font-semibold bg-accent-orange text-primary-dark px-3 py-1.5 rounded-md hover:bg-gold transition-colors whitespace-nowrap"
                  >
                    Sign up
                  </button>
                </>
              )}
            </div>

            <button
              onClick={() => setMobileOpen(o => !o)}
              className="md:hidden ml-auto p-2 rounded-md text-white hover:text-gold transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <CloseRoundedIcon /> : <MenuRoundedIcon />}
            </button>
          </div>

          {mobileOpen && (
            <div className="md:hidden pb-4 flex flex-col gap-1 border-t border-line pt-3">
              <div className="px-1 pb-2">
                <GameSearch onNavigate={() => setMobileOpen(false)} />
              </div>

              {navLinks.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive ? "text-gold" : "text-white hover:text-gold"
                    }`
                  }
                >
                  <Icon sx={{ fontSize: 20 }} />
                  {label}
                </NavLink>
              ))}

              {/* Auth — mobile */}
              <div className="border-t border-line mt-2 pt-3 flex flex-col gap-1">
                {isAuthed ? (
                  <>
                    <Link
                      to={`/user/${user?.username}`}
                      onClick={() => setMobileOpen(false)}
                      className="px-3 py-2 text-sm text-white hover:text-gold"
                    >
                      Profile ({user?.username})
                    </Link>
                    <Link
                      to={`/user/${user?.username}/diary`}
                      onClick={() => setMobileOpen(false)}
                      className="px-3 py-2 text-sm text-white hover:text-gold"
                    >
                      Diary
                    </Link>
                    <button
                      onClick={() => { logout(); setMobileOpen(false) }}
                      className="px-3 py-2 text-left text-sm text-text-muted hover:text-accent-red"
                    >
                      Log out
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => openAuth("login")}
                      className="px-3 py-2 text-left text-sm text-white hover:text-gold"
                    >
                      Sign in
                    </button>
                    <button
                      onClick={() => openAuth("register")}
                      className="mx-3 mt-1 text-center text-sm font-semibold bg-accent-orange text-primary-dark px-4 py-2 rounded-md hover:bg-gold"
                    >
                      Sign up
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </nav>
      </header>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        initialMode={authMode}
      />
    </>
  )
}