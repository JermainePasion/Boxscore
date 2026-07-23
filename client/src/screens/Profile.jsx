import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PersonIcon from "@mui/icons-material/Person";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";

import { api } from "../lib/api";


const TIER_SIZES = [2, 3, 4, 5, 6]; // pyramid rows, top to bottom
const MAX_FAVORITES = 5;

const youtubeThumb = (game) =>
  game?.youtubeId ? `https://img.youtube.com/vi/${game.youtubeId}/hqdefault.jpg` : null;

const shortDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

const gameLabel = (game) =>
  game?.title || `${game?.awayTeam?.abbreviation ?? "?"} @ ${game?.homeTeam?.abbreviation ?? "?"}`;

const initialsOf = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const groupByTier = (players = []) =>
  TIER_SIZES.map((_, i) => players.filter((p) => p.tier === i + 1));

const toFive = (stored) => Math.max(0, Math.min(10, stored ?? 0)) / 2;


function Crest({ team, size = "md" }) {
  const box = size === "sm" ? "h-6 w-6 text-[8px]" : "h-11 w-11 text-[11px]";
  return (
    <span
      title={team?.name || ""}
      className={`${box} grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary font-semibold tracking-wide text-white`}
    >
      {team?.abbreviation || "—"}
    </span>
  );
}

function Ball({ muted }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill={muted ? "#12435c" : "#f77f00"} />
      <path
        d="M2 12h20M12 2v20M4.5 4.5c4 3 4 12 0 15M19.5 4.5c-4 3-4 12 0 15"
        stroke={muted ? "#0b3040" : "#7a3f00"}
        strokeWidth="1.2"
        fill="none"
      />
    </svg>
  );
}

function Rating({ stored }) {
  const value = toFive(stored);
  return (
    <span className="relative inline-flex shrink-0">
      <span className="flex gap-0.5" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <Ball key={i} muted />
        ))}
      </span>
      <span
        className="absolute inset-0 flex gap-0.5 overflow-hidden"
        style={{ width: `${(value / 5) * 100}%` }}
        aria-hidden="true"
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <Ball key={i} />
        ))}
      </span>
      <span className="sr-only">{value} out of 5</span>
    </span>
  );
}

function SectionRule({ label, action }) {
  return (
    <div className="mb-4 flex items-center gap-4">
      <h2 className="shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-white">
        {label}
      </h2>
      <span className="h-px w-16 shrink-0 bg-accent-red" />
      <span className="h-px flex-1 bg-line" />
      {action}
    </div>
  );
}

function EmptyState({ children }) {
  return (
    <div className="rounded-md border border-dashed border-line bg-surface/40 px-6 py-8 text-center text-sm text-text-muted">
      {children}
    </div>
  );
}

/* ---------- cards ---------- */

function GameCard({ game, rank, onRemove }) {
  const label = gameLabel(game);
  const thumb = youtubeThumb(game);

  return (
    <div className="relative">
      {rank ? (
        <span className="absolute left-2 top-2 z-10 grid h-5 w-5 place-items-center rounded-sm bg-gold text-xs font-bold text-primary-dark">
          {rank}
        </span>
      ) : null}

      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="absolute right-2 top-2 z-10 grid h-5 w-5 place-items-center rounded-full bg-primary-dark/85 text-white transition-colors hover:bg-accent-red"
        >
          <CloseIcon sx={{ fontSize: 13 }} />
        </button>
      ) : null}

      <Link
        to={`/games/${game.id}`}
        className="block aspect-[2/3] w-full overflow-hidden rounded-md bg-surface transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        <span className="relative block h-full w-full">
          {thumb ? (
            <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center bg-gradient-to-br from-primary-light via-primary to-primary-dark">
              <Crest team={game.homeTeam} />
            </span>
          )}

          <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-primary-dark via-primary-dark/90 to-transparent px-2 pb-3 pt-8">
            <Crest team={game.awayTeam} size="sm" />
            <span className="min-w-0 text-center">
              <span className="block truncate text-[11px] font-medium uppercase tracking-wider text-white">
                {label}
              </span>
              <span className="mt-0.5 block text-[10px] text-text-muted">
                {shortDate(game.date)}
              </span>
            </span>
            <Crest team={game.homeTeam} size="sm" />
          </span>
        </span>
      </Link>
    </div>
  );
}

function EmptySlot() {
  return (
    <Link
      to="/games"
      className="grid aspect-[2/3] w-full place-items-center gap-1 rounded-md border border-dashed border-line bg-surface/50 text-xs font-medium uppercase tracking-[0.12em] text-text-muted transition-colors hover:border-gold hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
    >
      <AddIcon sx={{ fontSize: 18 }} />
      Add game
    </Link>
  );
}

function PyramidCard({ pyramid, onOpen }) {
  const tiers = useMemo(() => groupByTier(pyramid.players), [pyramid.players]);
  const filled = (pyramid.players || []).length;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-md border border-line bg-surface p-3 text-left transition-all duration-200 hover:-translate-y-1 hover:border-primary-light hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
    >
      {/* top two rows, as a silhouette of the real pyramid */}
      <span className="mb-3 flex flex-col items-center gap-1 rounded bg-primary-dark/60 px-2 py-4">
        {[0, 1].map((row) => (
          <span key={row} className="flex gap-1">
            {Array.from({ length: TIER_SIZES[row] }).map((_, slot) => {
              const entry = tiers[row][slot];
              return (
                <span
                  key={slot}
                  className={`grid h-7 w-7 place-items-center overflow-hidden rounded-full text-[9px] font-medium text-white ${
                    entry ? "bg-primary" : "bg-line/60"
                  }`}
                >
                  {entry?.player?.headshotUrl ? (
                    <img
                      src={entry.player.headshotUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : entry ? (
                    initialsOf(entry.player?.name)
                  ) : null}
                </span>
              );
            })}
          </span>
        ))}
      </span>

      <span className="block truncate text-sm font-semibold text-white">{pyramid.title}</span>
      <span className="mt-0.5 block text-[11px] text-text-muted">
        {filled}/20 placed · updated {shortDate(pyramid.updatedAt)}
      </span>
    </button>
  );
}

function ReviewCard({ review }) {
  const thumb = youtubeThumb(review.game);

  return (
    <Link
      to={`/games/${review.gameId}`}
      className="group grid w-full grid-cols-[56px_minmax(0,1fr)] items-start gap-4 border-b border-line py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold sm:grid-cols-[72px_minmax(0,1fr)] sm:gap-5"
    >
      <span className="block aspect-[2/3] overflow-hidden rounded bg-surface">
        {thumb ? (
          <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="block h-full w-full bg-gradient-to-br from-primary-light to-primary-dark" />
        )}
      </span>

      <span className="min-w-0">
        <span className="block text-base font-semibold text-white transition-colors group-hover:text-gold">
          {gameLabel(review.game)}
        </span>

        <span className="mt-1.5 flex flex-wrap items-center gap-3">
          <Rating stored={review.rating} />
          <span className="text-xs text-text-muted">
            {shortDate(review.watchedAt || review.createdAt)}
          </span>
          {review.watchedBefore ? (
            <span className="rounded-sm border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-text-muted">
              Rewatch
            </span>
          ) : null}
        </span>

        {review.review ? (
          <span className="mt-2 line-clamp-3 block text-sm leading-relaxed text-white/75">
            {review.review}
          </span>
        ) : null}

        <span className="mt-2 block text-xs text-text-muted">
          {review.likeCount} like{review.likeCount === 1 ? "" : "s"}
        </span>
      </span>
    </Link>
  );
}

/* ---------- pyramid detail ---------- */

function PyramidModal({ pyramid, onClose }) {
  useEffect(() => {
    if (!pyramid) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pyramid, onClose]);

  if (!pyramid) return null;

  // View mode shows filled slots only, same rule as the Pyramid screen.
  const tiers = groupByTier(pyramid.players);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={pyramid.title}
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-primary-dark/85 p-4 backdrop-blur-sm sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl rounded-lg border border-line bg-surface p-5 sm:p-7"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-text-muted transition-colors hover:text-accent-red"
        >
          <CloseIcon />
        </button>

        <h3 className="pr-10 text-2xl font-semibold text-white">{pyramid.title}</h3>
        <p className="mb-6 mt-1 text-xs text-text-muted">
          Updated {shortDate(pyramid.updatedAt)}
        </p>

        <div className="flex flex-col items-center gap-5">
          {tiers.map((tier, i) =>
            tier.length === 0 ? null : (
              <div key={i} className="w-full">
                <div className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                  Tier {i + 1}
                </div>
                <div className="flex flex-wrap justify-center gap-4">
                  {tier.map((entry) => (
                    <div key={entry.id} className="w-[76px] text-center">
                      <div className="mx-auto mb-1.5 grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-white">
                        {entry.player?.headshotUrl ? (
                          <img
                            src={entry.player.headshotUrl}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          initialsOf(entry.player?.name)
                        )}
                      </div>
                      <div className="text-[11px] font-medium leading-tight text-white">
                        {entry.player?.name}
                      </div>
                      {entry.headshotSeason ? (
                        <div className="text-[10px] text-text-muted">{entry.headshotSeason}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>

        <Link
          to={`/pyramid/${pyramid.id}`}
          className="mt-7 block rounded border border-line py-2 text-center text-xs font-semibold uppercase tracking-[0.1em] text-text-muted transition-colors hover:border-gold hover:text-gold"
        >
          Open full pyramid
        </Link>
      </div>
    </div>
  );
}

/* ---------- bio editor ---------- */

function BioEditor({ bio, onSave, onCancel, saving }) {
  const [draft, setDraft] = useState(bio || "");
  const left = 500 - draft.length;

  return (
    <div className="lg:text-right">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, 500))}
        rows={4}
        autoFocus
        placeholder="What do you watch, and how do you rate it?"
        className="w-full resize-none rounded border border-line bg-primary-dark/60 p-3 text-left text-sm leading-relaxed text-white placeholder:text-text-muted focus:border-primary-light focus:outline-none"
      />
      <div className="mt-2 flex items-center justify-between gap-3 lg:justify-end">
        <span className="text-[11px] text-text-muted">{left} left</span>
        <span className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-line px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted transition-colors hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            disabled={saving}
            className="rounded bg-gold px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-primary-dark transition-colors hover:bg-accent-orange disabled:opacity-60"
          >
            {saving ? "Saving" : "Save bio"}
          </button>
        </span>
      </div>
    </div>
  );
}

/* ---------- skeleton ---------- */

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 pb-24 sm:px-6">
      <div className="flex items-center gap-6 py-10">
        <div className="h-20 w-20 rounded-full bg-surface sm:h-24 sm:w-24" />
        <div className="space-y-3">
          <div className="h-7 w-48 rounded bg-surface" />
          <div className="h-4 w-32 rounded bg-surface" />
        </div>
      </div>
      {[0, 1].map((s) => (
        <div key={s} className="mt-8">
          <div className="mb-4 h-3 w-40 rounded bg-surface" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-[2/3] rounded-md bg-surface" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- screen ---------- */

export default function Profile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editingFavorites, setEditingFavorites] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [activePyramid, setActivePyramid] = useState(null);

  const profileKey = ["profile", username];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: profileKey });

  const { data: profile, isLoading, isError, error, refetch } = useQuery({
    queryKey: profileKey,
    queryFn: () => api.get(`/users/${username}`).then((r) => r.data),
    retry: 2,
  });

  const toggleFollow = useMutation({
    mutationFn: () =>
      profile.isFollowing
        ? api.delete(`/users/${username}/follow`)
        : api.post(`/users/${username}/follow`),
    onSuccess: invalidate,
    onError: (err) => {
      if (err?.response?.status === 401) navigate("/login");
    },
  });

  const saveBio = useMutation({
    mutationFn: (bio) => api.patch("/users/me", { bio }),
    onSuccess: () => {
      setEditingBio(false);
      invalidate();
    },
  });

  // The favorites endpoint replaces the whole ordered list, so removing one
  // means sending the other four back.
  const saveFavorites = useMutation({
    mutationFn: (gameIds) => api.put("/users/me/favorite-games", { gameIds }),
    onSuccess: invalidate,
  });

  if (isLoading) return <ProfileSkeleton />;

  if (isError) {
    const notFound = error?.response?.status === 404;
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-xl font-semibold text-white">
          {notFound ? "No profile here" : "Couldn't load this profile"}
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          {notFound
            ? `Nobody is using the name ${username}.`
            : "The server didn't respond. It may still be waking up."}
        </p>
        {notFound ? null : (
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-6 rounded bg-gold px-6 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary-dark transition-colors hover:bg-accent-orange"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  const { isSelf, stats = {} } = profile;
  const favorites = profile.favoriteGames || [];
  const pyramids = profile.pyramids || [];
  const reviews = profile.recentReviews || [];
  const emptySlots = Math.max(0, MAX_FAVORITES - favorites.length);

  const removeFavorite = (gameId) =>
    saveFavorites.mutate(favorites.map((f) => f.game.id).filter((id) => id !== gameId));

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      {/* header */}
      <header className="grid grid-cols-1 items-start gap-7 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:gap-12 lg:py-10">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-surface sm:h-24 sm:w-24">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <PersonIcon className="text-line" sx={{ fontSize: 52 }} />
            )}
          </div>

          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold leading-tight text-white sm:text-3xl">
              {profile.username}
            </h1>

            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-muted">
              <span>
                <b className="mr-1 text-sm font-semibold text-white">{stats.followerCount ?? 0}</b>
                Followers
              </span>
              <span>
                <b className="mr-1 text-sm font-semibold text-white">{stats.followingCount ?? 0}</b>
                Following
              </span>
              <span>
                <b className="mr-1 text-sm font-semibold text-white">{stats.reviewCount ?? 0}</b>
                Reviews
              </span>
              {stats.averageRating ? (
                <span>
                  <b className="mr-1 text-sm font-semibold text-white">
                    {toFive(stats.averageRating).toFixed(1)}
                  </b>
                  Avg
                </span>
              ) : null}
            </div>

            <div className="mt-4">
              {isSelf ? (
                <button
                  type="button"
                  onClick={() => setEditingBio(true)}
                  className="inline-flex items-center gap-1.5 rounded border border-line px-4 py-1.5 text-xs font-medium uppercase tracking-[0.1em] text-text-muted transition-colors hover:border-primary-light hover:text-white"
                >
                  <EditIcon sx={{ fontSize: 14 }} />
                  Edit profile
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => toggleFollow.mutate()}
                  disabled={toggleFollow.isPending}
                  className={`rounded px-6 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition-colors disabled:opacity-60 ${
                    profile.isFollowing
                      ? "border border-line text-text-muted hover:border-accent-red hover:text-accent-red"
                      : "bg-gold text-primary-dark hover:bg-accent-orange"
                  }`}
                >
                  {profile.isFollowing ? "Following" : "Follow"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="lg:pt-1">
          <div className="mb-4 flex items-center gap-3 lg:justify-end">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-text-muted">
              Favorite team
            </span>
            {profile.favoriteTeam ? (
              <Crest team={profile.favoriteTeam} />
            ) : (
              <span className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                Not set
              </span>
            )}
          </div>

          {editingBio ? (
            <BioEditor
              bio={profile.bio}
              saving={saveBio.isPending}
              onCancel={() => setEditingBio(false)}
              onSave={(bio) => saveBio.mutate(bio)}
            />
          ) : profile.bio ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/75 lg:text-right">
              {profile.bio}
            </p>
          ) : (
            <p className="text-sm italic text-text-muted lg:text-right">
              {isSelf ? "Add a bio so people know what you watch." : "No bio yet."}
            </p>
          )}
        </div>
      </header>

      {/* favorite games */}
      <section className="mt-8">
        <SectionRule
          label="Favorite games"
          action={
            isSelf && favorites.length > 0 ? (
              <button
                type="button"
                onClick={() => setEditingFavorites((v) => !v)}
                className="shrink-0 rounded border border-line px-3 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-text-muted transition-colors hover:border-primary-light hover:text-white"
              >
                {editingFavorites ? "Done" : "Edit"}
              </button>
            ) : null
          }
        />

        {favorites.length === 0 && !isSelf ? (
          <EmptyState>No favorite games picked yet.</EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
            {favorites.map((fav, i) => (
              <GameCard
                key={fav.game.id}
                game={fav.game}
                rank={i + 1}
                onRemove={editingFavorites ? () => removeFavorite(fav.game.id) : null}
              />
            ))}
            {isSelf &&
              Array.from({ length: emptySlots }).map((_, i) => <EmptySlot key={`slot-${i}`} />)}
          </div>
        )}
      </section>

      {/* pyramids */}
      <section className="mt-10">
        <SectionRule
          label="GOAT pyramids"
          action={
            isSelf ? (
              <Link
                to="/pyramid"
                className="shrink-0 rounded border border-line px-3 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-text-muted transition-colors hover:border-primary-light hover:text-white"
              >
                New
              </Link>
            ) : null
          }
        />
        {pyramids.length === 0 ? (
          <EmptyState>{isSelf ? "Build a pyramid to show it here." : "No pyramids yet."}</EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
            {pyramids.map((p) => (
              <PyramidCard key={p.id} pyramid={p} onOpen={() => setActivePyramid(p)} />
            ))}
          </div>
        )}
      </section>

      {/* reviews */}
      <section className="mt-10">
        <SectionRule
          label="Recent reviews"
          action={
            reviews.length >= 5 ? (
              <Link
                to={`/user/${username}/reviews`}
                className="shrink-0 rounded border border-line px-3 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-text-muted transition-colors hover:border-primary-light hover:text-white"
              >
                All
              </Link>
            ) : null
          }
        />
        {reviews.length === 0 ? (
          <EmptyState>
            {isSelf ? "Rate a game and your review lands here." : "No reviews yet."}
          </EmptyState>
        ) : (
          <div className="flex flex-col">
            {reviews.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </div>
        )}
      </section>

      <PyramidModal pyramid={activePyramid} onClose={() => setActivePyramid(null)} />
    </div>
  );
}