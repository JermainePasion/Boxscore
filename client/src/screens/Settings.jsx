import { useState } from "react"
import { useTheme } from "../context/ThemeContext"
import AuthModal from "../components/AuthModal"

function SectionRule({ label }) {
  return (
    <div className="mb-4 flex items-center gap-4">
      <h2 className="shrink-0 text-sm font-semibold uppercase tracking-widest text-white">{label}</h2>
      <div className="h-px flex-1 bg-accent-red" />
    </div>
  )
}

function Switch({ checked, onChange, labelledBy }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
        checked ? "bg-accent-orange" : "bg-line"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-snow shadow transition-transform motion-reduce:transition-none ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  )
}

export default function Settings() {
  const { isDark, setTheme, syncedToAccount, saveFailed } = useTheme()
  const [authOpen, setAuthOpen] = useState(false)

  return (
    <div className="mx-auto max-w-2xl pb-24">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-wide text-white md:text-4xl">SETTINGS</h1>
      </div>

      <section>
        <SectionRule label="Appearance" />

        <div className="rounded-lg border border-line bg-surface p-5">
          <div className="flex items-center justify-between gap-6">
            <div className="min-w-0">
              <div id="dark-mode-label" className="text-sm font-semibold text-white">
                Dark mode
              </div>
              <p className="mt-0.5 text-xs text-text-muted">Turn off to use the light theme.</p>
            </div>
            <Switch
              checked={isDark}
              onChange={(on) => setTheme(on ? "dark" : "light")}
              labelledBy="dark-mode-label"
            />
          </div>

          <p className="mt-4 border-t border-line pt-3 text-[11px] text-text-muted">
            {saveFailed ? (
              <span className="text-accent-red">
                Couldn't save to your account. Your choice still applies on this device.
              </span>
            ) : syncedToAccount ? (
              "Saved to your account, so it follows you to any device."
            ) : (
              <>
                Saved on this device.{" "}
                <button
                  type="button"
                  onClick={() => setAuthOpen(true)}
                  className="font-semibold text-gold hover:underline"
                >
                  Sign in
                </button>{" "}
                to keep it across devices.
              </>
            )}
          </p>
        </div>
      </section>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} initialMode="login" />
    </div>
  )
}