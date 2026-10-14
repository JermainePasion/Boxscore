import { useState, useRef, useEffect } from "react"
import { Link, NavLink } from "react-router-dom"
import GameSearch from "../Search/GameSearch"
import AuthModal from "../AuthModal"
import { useAuth } from "../../context/AuthContext"

import HomeRoundedIcon from "@mui/icons-material/HomeRounded"
import ChangeHistoryIcon from "@mui/icons-material/ChangeHistory"
import PersonRoundedIcon from "@mui/icons-material/PersonRounded"
import SportsBasketballRoundedIcon from "@mui/icons-material/SportsBasketballRounded"
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded"
import MenuRoundedIcon from "@mui/icons-material/MenuRounded"
import CloseRoundedIcon from "@mui/icons-material/CloseRounded"
import FormatListBulletedRoundedIcon from "@mui/icons-material/FormatListBulletedRounded"
import CompareArrowsRoundedIcon from "@mui/icons-material/CompareArrowsRounded"
import BookmarkBorderRoundedIcon from "@mui/icons-material/BookmarkBorderRounded"
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded"
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded"
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded"
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded"
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded"

const navLinks = [
  { to: "/", label: "Home", icon: HomeRoundedIcon },
  { to: "/pyramid", label: "G.O.A.T Pyramid", icon: ChangeHistoryIcon },
  { to: "/lists", label: "Lists", icon: FormatListBulletedRoundedIcon },
  { to: "/matchup", label: "Matchups", icon: CompareArrowsRoundedIcon },
  { to: "/games", label: "Games", icon: SportsBasketballRoundedIcon },
]

const getUserLinks = (username) => [
  { to: `/user/${username}`, label: "Profile", icon: PersonRoundedIcon, end: true },
  { to: "/watchlist", label: "Watchlist", icon: BookmarkBorderRoundedIcon },
  { to: `/user/${username}/diary`, label: "Diary", icon: MenuBookRoundedIcon },
  { to: "/settings", label: "Settings", icon: SettingsRoundedIcon },
  { to: "/faq", label: "FAQ", icon: HelpOutlineRoundedIcon },
]

const initials = (name) => name?.slice(0, 2).toUpperCase() ?? ""

/* ───────────────────────── Desktop user dropdown ───────────────────────── */

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
        aria-expanded={open}
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
        <div className="absolute left-1/2 top-full z-300 mt-1 w-40 -translate-x-1/2 overflow-hidden rounded-md border border-line bg-primary py-1 shadow-lg shadow-black/30">
          {getUserLinks(username).map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={itemClasses}>
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

/* ───────────────────────────── Mobile panel ───────────────────────────── */

const mobileLinkClasses = ({ isActive }) =>
  `flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-medium transition-colors ${
    isActive
      ? "bg-surface-hover text-gold"
      : "text-white hover:bg-surface-hover hover:text-gold active:bg-surface-hover"
  }`

function SectionLabel({ children }) {
  return (
    <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
      {children}
    </p>
  )
}

function MobileMenu({ open, onClose, onAuth, user, isAuthed, logout }) {
  const username = user?.username
  const accountLinks = isAuthed ? getUserLinks(username).slice(1) : [] // Profile lives in the user card

  return (
    <div
      id="mobile-menu"
      className={`md:hidden absolute inset-x-0 top-full border-b border-line bg-primary shadow-xl shadow-black/40
        max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain
        transition-[opacity,transform] duration-200 ease-out
        ${open ? "visible opacity-100 translate-y-0" : "invisible pointer-events-none opacity-0 -translate-y-2"}`}
    >
      <div className="mx-auto max-w-6xl px-4 pb-5 pt-3">
        {/* Signed-in user card */}
        {isAuthed && (
          <Link
            to={`/user/${username}`}
            onClick={onClose}
            className="mb-3 flex items-center gap-3 rounded-xl border border-line bg-surface-hover/50 p-3 transition-colors hover:bg-surface-hover"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-red text-sm font-bold text-white">
              {initials(username)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-white">{username}</span>
              <span className="block text-xs text-text-muted">View profile</span>
            </span>
            <ChevronRightRoundedIcon className="text-text-muted" sx={{ fontSize: 20 }} />
          </Link>
        )}

        {/* Search */}
        <GameSearch onNavigate={onClose} />

        {/* Main navigation */}
        <SectionLabel>Browse</SectionLabel>
        <nav className="flex flex-col gap-0.5">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === "/"} onClick={onClose} className={mobileLinkClasses}>
              <Icon sx={{ fontSize: 20 }} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Account */}
        {isAuthed ? (
          <>
            <SectionLabel>Your stuff</SectionLabel>
            <div className="flex flex-col gap-0.5">
              {accountLinks.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} onClick={onClose} className={mobileLinkClasses}>
                  <Icon sx={{ fontSize: 20 }} />
                  {label}
                </NavLink>
              ))}
            </div>

            <div className="mt-4 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => { logout(); onClose() }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-medium text-text-muted transition-colors hover:bg-surface-hover hover:text-accent-red"
              >
                <LogoutRoundedIcon sx={{ fontSize: 20 }} />
                Log out
              </button>
            </div>
          </>
        ) : (
          <>
            <SectionLabel>Help</SectionLabel>
            <NavLink to="/faq" onClick={onClose} className={mobileLinkClasses}>
              <HelpOutlineRoundedIcon sx={{ fontSize: 20 }} />
              FAQ
            </NavLink>
            <div className="mt-5 grid grid-cols-2 gap-2 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => onAuth("login")}
                className="rounded-lg border border-line py-2.5 text-sm font-medium text-white transition-colors hover:border-gold hover:text-gold"
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => onAuth("register")}
                className="rounded-lg bg-accent-orange py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-gold"
              >
                Sign up
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ──────────────────────────────── Navbar ──────────────────────────────── */

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState("login")
  const { user, isAuthed, logout } = useAuth()

  const closeMobile = () => setMobileOpen(false)

  const openAuth = (mode) => {
    setAuthMode(mode)
    setAuthOpen(true)
    setMobileOpen(false)
  }

  // While the mobile menu is open: lock page scroll, close on Escape,
  // and auto-close if the viewport grows to desktop width.
  useEffect(() => {
    if (!mobileOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const onKey = (e) => e.key === "Escape" && setMobileOpen(false)
    const mq = window.matchMedia("(min-width: 768px)")
    const onResize = (e) => e.matches && setMobileOpen(false)

    document.addEventListener("keydown", onKey)
    mq.addEventListener("change", onResize)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener("keydown", onKey)
      mq.removeEventListener("change", onResize)
    }
  }, [mobileOpen])

  const linkClasses = ({ isActive }) =>
    `flex flex-col items-center gap-1 px-4 py-2 rounded-md text-xs font-medium transition-colors ${
      isActive ? "text-gold" : "text-white hover:text-gold"
    }`

  return (
    <>
      <header className="sticky top-0 z-300 bg-primary border-b border-line">
        <div className="relative">
          <nav className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-center h-16 gap-4">
              <Link to="/" onClick={closeMobile} className="flex items-center gap-2 shrink-0">
                <img src="/logo2.png" alt="BoxScore logo" className="h-11 w-11 object-contain light:hidden" />
                <img src="/logo.png" alt="BoxScore logo" className="hidden h-9 w-9 object-contain light:block" />
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
                        {initials(user?.username)}
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
                    <NavLink
                      to="/faq"
                      className={({ isActive }) =>
                        `text-sm transition-colors whitespace-nowrap ${isActive ? "text-gold" : "text-white hover:text-gold"}`
                      }
                    >
                      FAQ
                    </NavLink>
                    <button
                      onClick={() => openAuth("login")}
                      className="text-sm text-white hover:text-gold transition-colors whitespace-nowrap"
                    >
                      Sign in
                    </button>
                    <button
                      onClick={() => openAuth("register")}
                      className="text-sm font-semibold bg-accent-orange text-on-accent px-3 py-1.5 rounded-md hover:bg-gold transition-colors whitespace-nowrap"
                    >
                      Sign up
                    </button>
                  </>
                )}
              </div>

              {/* Mobile toggle */}
              <button
                type="button"
                onClick={() => setMobileOpen((o) => !o)}
                className="md:hidden ml-auto grid h-10 w-10 place-items-center rounded-lg text-white transition-colors hover:bg-surface-hover hover:text-gold"
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileOpen}
                aria-controls="mobile-menu"
              >
                {mobileOpen ? <CloseRoundedIcon /> : <MenuRoundedIcon />}
              </button>
            </div>
          </nav>

          <MobileMenu
            open={mobileOpen}
            onClose={closeMobile}
            onAuth={openAuth}
            user={user}
            isAuthed={isAuthed}
            logout={logout}
          />
        </div>
      </header>

      {/* Dim the page behind the mobile menu; tap to close */}
      <div
        onClick={closeMobile}
        aria-hidden="true"
        className={`md:hidden fixed inset-x-0 bottom-0 top-16 z-290 bg-black/50 transition-opacity duration-200 ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        initialMode={authMode}
      />
    </>
  )
}