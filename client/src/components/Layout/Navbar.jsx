import { useState } from "react"
import { Link, NavLink } from "react-router-dom"
import GameSearch from "../Search/GameSearch";

import HomeRoundedIcon from "@mui/icons-material/HomeRounded"
import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory';
import PersonRoundedIcon from "@mui/icons-material/PersonRounded"
import SportsBasketballRoundedIcon from "@mui/icons-material/SportsBasketballRounded"
import FormatListBulletedRoundedIcon from "@mui/icons-material/FormatListBulletedRounded"
import MenuRoundedIcon from "@mui/icons-material/MenuRounded"
import CloseRoundedIcon from "@mui/icons-material/CloseRounded"

const navLinks = [
  { to: "/", label: "Home", icon: HomeRoundedIcon },
  { to: "/pyramid", label: "G.O.A.T Pyramid", icon: ChangeHistoryIcon},
  { to: "/profile", label: "Profile", icon: PersonRoundedIcon },
  { to: "/games", label: "Games", icon: SportsBasketballRoundedIcon },
  { to: "/list", label: "List", icon: FormatListBulletedRoundedIcon },
]

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  const linkClasses = ({ isActive }) =>
    `flex flex-col items-center gap-1 px-4 py-2 rounded-md text-xs font-medium transition-colors ${
      isActive ? "text-gold" : "text-white hover:text-gold"
    }`

  return (
    <header className="sticky top-0 z-50 bg-primary border-b border-line">
      <nav className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center h-16 gap-4">

          <Link to="/" className="flex items-center gap-2 shrink-0">
            <SportsBasketballRoundedIcon
              sx={{ fontSize: 34 }}
              className="text-accent-orange"
            />
            <span className="text-xl tracking-tight text-gold">
              BoxScore
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-2 mx-auto">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={linkClasses}>
                <Icon sx={{ fontSize: 22 }} />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>

          {/* Desktop search — right side */}
          <div className="hidden md:block shrink-0 w-56">
            <GameSearch />
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
            {/* Mobile search — top of menu */}
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
          </div>
        )}
      </nav>
    </header>
  )
}