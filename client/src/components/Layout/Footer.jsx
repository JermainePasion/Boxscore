import LocalCafeRoundedIcon from "@mui/icons-material/LocalCafeRounded"

// TODO: replace with your Ko-fi page
const KOFI_URL = "https://ko-fi.com/mainejerms"

/*
 * Site footer: NBA non-affiliation notice + Ko-fi support link.
 * Uses only theme tokens (bg-primary, border-line, text-text-muted, text-gold,
 * accent-orange / on-accent), so it follows the light/dark theme switch.
 */
export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t border-line bg-primary">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-4 py-6 sm:px-6 md:flex-row md:items-center md:justify-between md:gap-8">
        <div className="min-w-0 space-y-1.5 text-center md:text-left">
          <p className="text-sm font-semibold tracking-tight text-gold">BoxScore</p>
          <p className="max-w-2xl text-xs leading-relaxed text-text-muted">
            BoxScore is an independent, fan-made project and is not affiliated with, endorsed by,
            or sponsored by the National Basketball Association (NBA) or any of its teams. NBA and
            team names, logos, and player images are the property of their respective owners.
          </p>
          <p className="text-[11px] text-text-muted/70">© {year} BoxScore</p>
        </div>

        <a
          href={KOFI_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Support BoxScore on Ko-fi (opens in a new tab)"
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-accent-orange px-4 py-2 text-sm font-semibold text-on-accent shadow-sm transition-colors hover:bg-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          <LocalCafeRoundedIcon sx={{ fontSize: 18 }} />
          Support on Ko-fi
        </a>
      </div>
    </footer>
  )
}