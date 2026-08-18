import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import SportsBasketballRoundedIcon from "@mui/icons-material/SportsBasketballRounded";

import { api } from "../../lib/api";
import TeamLogo from "../../components/TeamLogo";
import { TEAM_BY_ABBR } from "../../utils/nbaTeams";

/* ------------------------------------------------------------------ *
 *  FavoriteGamePicker — search for a game and add it to favorites.    *
 *                                                                     *
 *  Same engine as the navbar GameSearch: /games/smart-search returns  *
 *  lean rows { gameId, matchup, label, date }. There are no team ids  *
 *  in the payload, so we parse the abbreviations out of the matchup   *
 *  string ("LAL @ CLE" / "LAL vs. CLE") and map them to logos.        *
 * ------------------------------------------------------------------ */

const SEARCH_ENDPOINT = "/games/smart-search";

const labelOf = (r) => r.label ?? r.matchup ?? "Game";

/* "LAL @ CLE" or "LAL vs. CLE" → { away, home, sep }, resolving each
   abbreviation to a team via the shared lookup. Returns null if the
   string doesn't split cleanly, so callers can fall back. */
function parseMatchup(matchup) {
  if (!matchup) return null;
  const at = matchup.split(" @ ");
  if (at.length === 2) {
    return { away: TEAM_BY_ABBR[at[0].trim()], home: TEAM_BY_ABBR[at[1].trim()], sep: "@" };
  }
  const vs = matchup.split(" vs. ");
  if (vs.length === 2) {
    return { home: TEAM_BY_ABBR[vs[0].trim()], away: TEAM_BY_ABBR[vs[1].trim()], sep: "vs" };
  }
  return null;
}

function MatchupLogos({ matchup, logoClass = "h-6 w-6" }) {
  const m = parseMatchup(matchup);
  if (!m || (!m.home && !m.away)) {
    return <SportsBasketballRoundedIcon sx={{ fontSize: 18 }} className="text-accent-orange" />;
  }
  const first = m.sep === "@" ? m.away : m.home;
  const second = m.sep === "@" ? m.home : m.away;
  return (
    <span className="flex items-center gap-1">
      {first ? (
        <TeamLogo teamId={first.id} alt={first.abbreviation} className={`${logoClass} object-contain`} />
      ) : null}
      <span className="text-[9px] font-semibold uppercase text-text-muted">{m.sep}</span>
      {second ? (
        <TeamLogo teamId={second.id} alt={second.abbreviation} className={`${logoClass} object-contain`} />
      ) : null}
    </span>
  );
}

function ResultRow({ result, added, onClick }) {
  return (
    <button
      type="button"
      disabled={added}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-md border border-line p-2.5 text-left transition-colors ${
        added
          ? "cursor-not-allowed opacity-50"
          : "hover:border-primary-light hover:bg-surface-hover"
      }`}
    >
      <span className="grid h-10 shrink-0 place-items-center rounded bg-primary-dark/60 px-2">
        <MatchupLogos matchup={result.matchup} size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-white">{labelOf(result)}</span>
        {result.date ? (
          <span className="block text-xs text-text-muted">{result.date}</span>
        ) : null}
      </span>
      {added ? (
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-gold">
          Added
        </span>
      ) : null}
    </button>
  );
}

export default function FavoriteGamePicker({ open, onClose, onConfirm, existingIds = [], saving }) {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [pending, setPending] = useState(null); // result awaiting confirmation

  useEffect(() => {
    if (open) {
      setTerm("");
      setDebounced("");
      setPending(null);
    }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 400);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && (pending ? setPending(null) : onClose());
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onClose]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["gameSmartSearch", debounced],
    queryFn: () =>
      api.get(SEARCH_ENDPOINT, { params: { q: debounced } }).then((r) =>
        Array.isArray(r.data) ? r.data : []
      ),
    enabled: open && debounced.length >= 3,
  });

  if (!open) return null;

  const existing = new Set(existingIds);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add a favorite game"
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-primary-dark/85 p-4 backdrop-blur-sm sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg border border-line bg-surface p-5 sm:p-6"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-text-muted transition-colors hover:text-accent-red"
        >
          <CloseRoundedIcon />
        </button>

        {pending ? (
          /* ---- confirmation step ---- */
          <div>
            <button
              type="button"
              onClick={() => setPending(null)}
              disabled={saving}
              className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-text-muted transition-colors hover:text-white disabled:opacity-50"
            >
              <ArrowBackRoundedIcon sx={{ fontSize: 15 }} />
              Back to search
            </button>

            <h3 className="text-lg font-semibold text-white">Add to favorites?</h3>

            <div className="my-5 flex items-center gap-3 rounded-md border border-line bg-primary-dark/40 p-3">
              <span className="grid h-12 shrink-0 place-items-center rounded bg-primary-dark/60 px-2">
                <MatchupLogos matchup={pending.matchup} size={28} />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-white">{labelOf(pending)}</span>
                {pending.date ? (
                  <span className="block text-xs text-text-muted">{pending.date}</span>
                ) : null}
              </span>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPending(null)}
                disabled={saving}
                className="rounded border border-line px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-text-muted transition-colors hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onConfirm(pending)}
                disabled={saving}
                className="rounded bg-accent-orange px-5 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary-dark transition-colors hover:bg-gold disabled:opacity-60"
              >
                {saving ? "Adding…" : "Add game"}
              </button>
            </div>
          </div>
        ) : (
          /* ---- search step ---- */
          <>
            <h3 className="mb-4 pr-10 text-lg font-semibold text-white">Add a favorite game</h3>

            <div className="mb-4 flex items-center gap-2 rounded-md border border-line bg-primary-dark px-3 py-2">
              <SearchRoundedIcon sx={{ fontSize: 18 }} className="text-text-muted" />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                autoFocus
                placeholder="lakers march 2026, celtics vs knicks, luka 73 points…"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-text-muted"
              />
              {term ? (
                <button
                  type="button"
                  onClick={() => setTerm("")}
                  className="text-text-muted hover:text-white"
                  aria-label="Clear search"
                >
                  <CloseRoundedIcon sx={{ fontSize: 16 }} />
                </button>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-2 -mr-2">
              {debounced.length < 3 ? (
                <p className="py-8 text-center text-sm text-text-muted">
                  Search by team, matchup, date, or a player’s big night.
                </p>
              ) : isFetching ? (
                <p className="py-8 text-center text-sm text-text-muted">Searching…</p>
              ) : results.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-muted">
                  No games found for “{debounced}”.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {results.map((r) => (
                    <ResultRow
                      key={`${r.gameId}-${r.matchup ?? ""}`}
                      result={r}
                      added={existing.has(r.gameId)}
                      onClick={() => setPending(r)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}