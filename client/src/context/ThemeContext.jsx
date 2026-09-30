import { createContext, useContext, useEffect, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

import { api } from "../lib/api"
import { useAuth } from "./AuthContext"

/*
 * Theme source of truth:
 *   - signed in  -> the user's saved setting (server), mirrored to localStorage
 *   - signed out -> localStorage on this device
 * localStorage also lets index.html apply the theme before React loads (no flash).
 * Default is dark.
 */

const STORAGE_KEY = "theme"
const ThemeContext = createContext(null)

const readStored = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark"
  } catch {
    return "dark"
  }
}

export function ThemeProvider({ children }) {
  const { isAuthed, user } = useAuth()
  const qc = useQueryClient()
  const [theme, setThemeState] = useState(readStored)

  const settingsKey = ["settings", user?.id]

  // apply to <html> + remember on this device
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* storage blocked: theme still works for this session */
    }
  }, [theme])

  // pull the saved preference once signed in (keyed per user, so switching
  // accounts loads the new user's setting)
  const settingsQ = useQuery({
    queryKey: settingsKey,
    queryFn: () => api.get("/settings").then((r) => r.data),
    enabled: isAuthed && !!user?.id,
    staleTime: Infinity,
  })

  useEffect(() => {
    const saved = settingsQ.data?.theme
    if (saved === "dark" || saved === "light") setThemeState(saved)
  }, [settingsQ.data?.theme])

  const saveM = useMutation({
    mutationFn: (next) => api.patch("/settings", { theme: next }).then((r) => r.data),
    onMutate: async (next) => {
      // stop an in-flight settings fetch from overwriting the new choice
      await qc.cancelQueries({ queryKey: settingsKey })
      const prev = qc.getQueryData(settingsKey)
      qc.setQueryData(settingsKey, { theme: next })
      return { prev }
    },
    onError: (_err, _next, ctx) => {
      // save failed: go back to what the account actually has
      if (ctx?.prev?.theme) {
        qc.setQueryData(settingsKey, ctx.prev)
        setThemeState(ctx.prev.theme)
      }
    },
  })

  const setTheme = (next) => {
    if (next !== "dark" && next !== "light") return
    setThemeState(next)
    if (isAuthed) saveM.mutate(next)
  }

  const value = {
    theme,
    isDark: theme === "dark",
    setTheme,
    toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
    syncedToAccount: isAuthed,
    saveFailed: saveM.isError,
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>")
  return ctx
}