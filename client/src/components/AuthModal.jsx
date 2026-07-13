import { useState, useEffect } from "react"
import { api } from "../lib/api"
import { useAuth } from "../context/AuthContext"
import CloseRoundedIcon from "@mui/icons-material/CloseRounded"

export default function AuthModal({ open, onClose, initialMode = "login" }) {
  const { login } = useAuth()
  const [mode, setMode] = useState(initialMode)
  const [form, setForm] = useState({ username: "", email: "", password: "" })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setMode(initialMode)
      setError(null)
      setForm({ username: "", email: "", password: "" })
    }
  }, [open, initialMode])

  // close on Escape
  useEffect(() => {
    const onKey = e => e.key === "Escape" && onClose()
    if (open) document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register"
      const body = mode === "login"
        ? { email: form.email, password: form.password }
        : { username: form.username, email: form.email, password: form.password }

      const { data } = await api.post(path, body)
      login(data.token, data.user)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error ?? "Something went wrong")
    } finally {
      setBusy(false)
    }
  }

  const field = "w-full bg-primary-dark border border-line rounded-md px-3 py-2 text-sm text-white outline-none focus:border-gold transition-colors"

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-primary border border-line rounded-xl p-6 relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-text-muted hover:text-white transition-colors"
          aria-label="Close"
        >
          <CloseRoundedIcon sx={{ fontSize: 20 }} />
        </button>

        <h2 className="text-lg font-semibold text-white mb-1">
          {mode === "login" ? "Sign in to BoxScore" : "Create your account"}
        </h2>
        <p className="text-xs text-text-muted mb-5">
          {mode === "login"
            ? "Rate games, write reviews, build your GOAT pyramid."
            : "Join and start logging the games you watch."}
        </p>

        <div className="flex flex-col gap-3">
          {mode === "register" && (
            <input
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              placeholder="Username"
              className={field}
            />
          )}
          <input
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="Email"
            type="email"
            className={field}
          />
          <input
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="Password"
            type="password"
            className={field}
          />

          {error && <p className="text-xs text-accent-red">{error}</p>}

          <button
            onClick={submit}
            disabled={busy}
            className="mt-1 w-full py-2 rounded-md bg-accent-orange text-primary-dark font-semibold text-sm hover:bg-gold transition-colors disabled:opacity-60"
          >
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </div>

        <p className="text-xs text-text-muted text-center mt-5">
          {mode === "login" ? "No account yet?" : "Already have an account?"}{" "}
          <button
            onClick={() => { setMode(m => (m === "login" ? "register" : "login")); setError(null) }}
            className="text-gold hover:underline"
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  )
}