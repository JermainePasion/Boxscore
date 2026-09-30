import { useState } from "react"
import { useSettings } from "../context/SettingsContext"
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

function SettingRow({ id, title, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="min-w-0">
        <div id={id} className="text-sm font-semibold text-white">
          {title}
        </div>
        <p className="mt-0.5 text-xs text-text-muted">{description}</p>
      </div>
      <Switch checked={checked} onChange={onChange} labelledBy={id} />
    </div>
  )
}

export default function Settings() {
  const { settings, updateSetting, syncedToAccount, saveFailed, retrySave } = useSettings()
  const [authOpen, setAuthOpen] = useState(false)

  return (
    <div className="mx-auto max-w-2xl pb-24">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-wide text-white md:text-4xl">SETTINGS</h1>
      </div>

      <section className="mb-10">
        <SectionRule label="Appearance" />
        <div className="rounded-lg border border-line bg-surface p-5">
          <SettingRow
            id="setting-dark-mode"
            title="Dark mode"
            description="Turn off to use the light theme."
            checked={settings.theme === "dark"}
            onChange={(on) => updateSetting("theme", on ? "dark" : "light")}
          />
        </div>
      </section>

      <section>
        <SectionRule label="Spoilers" />
        <div className="rounded-lg border border-line bg-surface p-5">
          <SettingRow
            id="setting-hide-scores"
            title="Hide scores on game cards"
            description="Blurs the final score when you hover a game card, so you can watch the game first."
            checked={settings.hideScores}
            onChange={(on) => updateSetting("hideScores", on)}
          />
        </div>
      </section>

      <p className="mt-6 text-center text-[11px] text-text-muted">
        {saveFailed ? (
          <span className="text-accent-red">
            Couldn't save to your account, so this change won't stick after a reload.{" "}
            <button type="button" onClick={retrySave} className="font-semibold underline hover:no-underline">
              Try again
            </button>
          </span>
        ) : syncedToAccount ? (
          "Settings are saved to your account, so they follow you to any device."
        ) : (
          <>
            Settings are saved on this device.{" "}
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="font-semibold text-gold hover:underline"
            >
              Sign in
            </button>{" "}
            to keep them across devices.
          </>
        )}
      </p>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} initialMode="login" />
    </div>
  )
}