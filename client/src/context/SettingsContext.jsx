import { createContext, useContext, useEffect, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

import { api } from "../lib/api"
import { useAuth } from "./AuthContext"

/*
 * User settings. Source of truth:
 *   - signed in  -> saved on the account (server), mirrored to localStorage
 *   - signed out -> localStorage on this device
 * Each setting has its own localStorage key; "theme" is also read by the
 * inline script in index.html so the page never flashes the wrong theme.
 */

const DEFAULTS = { theme: "dark", hideScores: true }

const VALID = {
  theme: (v) => v === "dark" || v === "light",
  hideScores: (v) => typeof v === "boolean",
}

const readLocal = () => {
  const out = { ...DEFAULTS }
  try {
    const theme = localStorage.getItem("theme")
    if (VALID.theme(theme)) out.theme = theme

    const hide = localStorage.getItem("hideScores")
    if (hide === "true" || hide === "false") out.hideScores = hide === "true"
  } catch {
    /* storage blocked: defaults */
  }
  return out
}

// keep only known keys with valid values
const clean = (obj = {}) =>
  Object.fromEntries(Object.entries(obj).filter(([k, v]) => VALID[k]?.(v)))

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const { isAuthed, user } = useAuth()
  const qc = useQueryClient()
  const [settings, setSettings] = useState(readLocal)

  const settingsKey = ["settings", user?.id]

  // apply the theme + remember everything on this device
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
    try {
      localStorage.setItem("theme", settings.theme)
      localStorage.setItem("hideScores", String(settings.hideScores))
    } catch {
      /* storage blocked: settings still work for this session */
    }
  }, [settings.theme, settings.hideScores])

  // load the account's saved settings once signed in (keyed per user)
  const settingsQ = useQuery({
    queryKey: settingsKey,
    queryFn: () => api.get("/settings").then((r) => r.data),
    enabled: isAuthed && !!user?.id,
    staleTime: Infinity,
  })

  useEffect(() => {
    const saved = clean(settingsQ.data)
    if (Object.keys(saved).length) setSettings((prev) => ({ ...prev, ...saved }))
  }, [settingsQ.data])

  const saveM = useMutation({
    mutationFn: (patch) => api.patch("/settings", patch).then((r) => r.data),
    onMutate: async (patch) => {
      // stop an in-flight load from overwriting the new choice
      await qc.cancelQueries({ queryKey: settingsKey })
      qc.setQueryData(settingsKey, (old) => ({ ...old, ...patch }))
    },
    // On failure, keep the choice for this session rather than snapping back.
    onError: (err) => console.error("Saving settings failed:", err),
  })

  const updateSetting = (key, value) => {
    if (!VALID[key]?.(value)) return
    setSettings((prev) => ({ ...prev, [key]: value }))
    if (isAuthed) saveM.mutate({ [key]: value })
  }

  const value = {
    settings,
    updateSetting,
    syncedToAccount: isAuthed,
    saveFailed: saveM.isError,
    retrySave: () => saveM.mutate(settings),
  }

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error("useSettings must be used inside <SettingsProvider>")
  return ctx
}