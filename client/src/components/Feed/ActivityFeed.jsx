import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import RateReviewRoundedIcon from "@mui/icons-material/RateReviewRounded";
import ChatBubbleRoundedIcon from "@mui/icons-material/ChatBubbleRounded";
import ChangeHistoryRoundedIcon from "@mui/icons-material/ChangeHistoryRounded";

import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

const PAGE_SIZE = 20;

const teamTag = (team) => team?.abbreviation || team?.name || "?";
const gameLabel = (game) =>
  game?.title || `${teamTag(game?.awayTeam)} @ ${teamTag(game?.homeTeam)}`;

const toFive = (stored) => Math.max(0, Math.min(10, stored ?? 0)) / 2;

const initialsOf = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const timeAgo = (iso) => {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

/* ---------- primitives ---------- */

function Avatar({ user }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-accent-red text-[11px] font-bold text-white">
      {user?.avatarUrl ? (
        <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initialsOf(user?.username)
      )}
    </span>
  );
}

function MiniBall({ muted }) {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill={muted ? "#12435c" : "#f77f00"} />
      <path
        d="M2 12h20M12 2v20M4.5 4.5c4 3 4 12 0 15M19.5 4.5c-4 3-4 12 0 15"
        stroke={muted ? "#0b3040" : "#7a3f00"}
        strokeWidth="1.4"
        fill="none"
      />
    </svg>
  );
}

function MiniRating({ stored }) {
  const value = toFive(stored);
  return (
    <span className="relative inline-flex shrink-0" title={`${value} out of 5`}>
      <span className="flex gap-px" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <MiniBall key={i} muted />
        ))}
      </span>
      <span
        className="absolute inset-0 flex gap-px overflow-hidden"
        style={{ width: `${(value / 5) * 100}%` }}
        aria-hidden="true"
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <MiniBall key={i} />
        ))}
      </span>
      <span className="sr-only">{value} out of 5</span>
    </span>
  );
}

// icon + tint per activity type (scannability)
const TYPE_META = {
  review: { Icon: RateReviewRoundedIcon, tint: "text-gold" },
  comment: { Icon: ChatBubbleRoundedIcon, tint: "text-[#5aa9e6]" },
  pyramid: { Icon: ChangeHistoryRoundedIcon, tint: "text-accent-red" },
};

function ReviewBody({ user, data }) {
  const game = data.game;
  return (
    <>
      <p className="text-sm text-white/90">
        <Link to={`/user/${user.username}`} className="font-semibold hover:text-gold">
          {user.username}
        </Link>{" "}
        <span className="text-text-muted">rated</span>{" "}
        <Link to={`/games/${game?.id}`} className="font-medium hover:text-gold">
          {gameLabel(game)}
        </Link>
      </p>
      <div className="mt-1 flex items-center gap-2">
        <MiniRating stored={data.rating} />
        {data.likeCount ? (
          <span className="text-[11px] text-text-muted">
            {data.likeCount} like{data.likeCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
      {data.review ? (
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-white/70">
          {data.review}
        </p>
      ) : null}
    </>
  );
}

function CommentBody({ user, data }) {
  let target;
  if (data.onGame) {
    target = (
      <Link to={`/games/${data.onGame.id}`} className="font-medium hover:text-gold">
        {gameLabel(data.onGame)}
      </Link>
    );
  } else if (data.onReview) {
    target = (
      <>
        <Link
          to={`/user/${data.onReview.user?.username}`}
          className="font-medium hover:text-gold"
        >
          {data.onReview.user?.username}
        </Link>
        <span className="text-text-muted">’s review</span>
      </>
    );
  } else if (data.onPyramid?.id) {
    target = (
      <Link to={`/pyramid/${data.onPyramid.id}`} className="font-medium hover:text-gold">
        {data.onPyramid.title || "a pyramid"}
      </Link>
    );
  } else {
    target = <span className="text-text-muted">a pyramid</span>;
  }

  return (
    <>
      <p className="text-sm text-white/90">
        <Link to={`/user/${user.username}`} className="font-semibold hover:text-gold">
          {user.username}
        </Link>{" "}
        <span className="text-text-muted">commented on</span> {target}
      </p>
      <p className="mt-1.5 line-clamp-2 border-l-2 border-line pl-3 text-sm leading-relaxed text-white/70">
        {data.content}
      </p>
    </>
  );
}

function PyramidBody({ user, data }) {
  const pid = data.pyramidId ?? data.id;
  return (
    <p className="text-sm text-white/90">
      <Link to={`/user/${user.username}`} className="font-semibold hover:text-gold">
        {user.username}
      </Link>{" "}
      <span className="text-text-muted">built</span>{" "}
      {pid ? (
        <Link to={`/pyramid/${pid}`} className="font-medium hover:text-gold">
          {data.title || "a GOAT pyramid"}
        </Link>
      ) : (
        <span className="text-text-muted">a GOAT pyramid</span>
      )}
      {data.playerCount ? (
        <span className="text-text-muted">
          {" "}
          · {data.playerCount} player{data.playerCount === 1 ? "" : "s"}
        </span>
      ) : null}
    </p>
  );
}

function ActivityItem({ activity }) {
  const meta = TYPE_META[activity.type] ?? TYPE_META.review;
  const Icon = meta.Icon;
  const Body =
    activity.type === "review"
      ? ReviewBody
      : activity.type === "comment"
      ? CommentBody
      : PyramidBody;

  return (
    <article className="flex gap-3 border-b border-line px-2 py-4 transition-colors hover:bg-white/[0.02]">
      <Avatar user={activity.user} />
      <div className="min-w-0 flex-1">
        <Body user={activity.user} data={activity.data} />
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Icon className={meta.tint} sx={{ fontSize: 16 }} />
        <span className="whitespace-nowrap text-[11px] text-text-muted">
          {timeAgo(activity.createdAt)}
        </span>
      </div>
    </article>
  );
}

function FeedSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3 border-b border-line px-2 py-4">
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-surface" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/2 animate-pulse rounded bg-surface" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-surface" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ children }) {
  return (
    <div className="rounded-md border border-dashed border-line bg-surface/40 px-6 py-10 text-center text-sm text-text-muted">
      {children}
    </div>
  );
}

/* ---------- feed ---------- */

export default function ActivityFeed() {
  const { isAuthed } = useAuth();
  const [tab, setTab] = useState(isAuthed ? "following" : "everyone");

  const followingSelected = tab === "following";
  const canQuery = followingSelected ? isAuthed : true;

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["feed", tab],
    queryFn: ({ pageParam }) =>
      api
        .get(followingSelected ? "/feed" : "/feed/global", {
          params: { cursor: pageParam ?? undefined, limit: PAGE_SIZE },
        })
        .then((r) => r.data),
    enabled: canQuery,
    // Backend returns { activities, nextCursor }. No nextCursor -> last page.
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
  });

  const activities = data?.pages.flatMap((p) => p.activities ?? []) ?? [];

  // auto-load the next page when the sentinel scrolls into view
  const sentinelRef = useRef(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "600px" } // start fetching before the user hits the bottom
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const TabButton = ({ id, label }) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${
        tab === id ? "text-gold" : "text-text-muted hover:text-white"
      }`}
    >
      {label}
    </button>
  );

  const renderBody = () => {
    if (followingSelected && !isAuthed) {
      return (
        <EmptyState>
          <Link to="/login" className="font-semibold text-gold hover:underline">
            Sign in
          </Link>{" "}
          to see what the people you follow are watching.
        </EmptyState>
      );
    }

    if (isLoading) return <FeedSkeleton />;

    if (isError) {
      return (
        <EmptyState>
          Couldn’t load the feed.{" "}
          <button
            type="button"
            onClick={() => refetch()}
            className="font-semibold text-gold hover:underline"
          >
            Try again
          </button>
        </EmptyState>
      );
    }

    if (activities.length === 0) {
      return followingSelected ? (
        <EmptyState>
          <p>Quiet so far — the people you follow haven’t posted yet.</p>
          <button
            type="button"
            onClick={() => setTab("everyone")}
            className="mt-3 inline-block font-semibold text-gold hover:underline"
          >
            See what everyone’s watching →
          </button>
        </EmptyState>
      ) : (
        <EmptyState>
          <p>No activity yet — the court’s all yours.</p>
          <Link
            to="/games"
            className="mt-3 inline-block font-semibold text-gold hover:underline"
          >
            Rate your first game →
          </Link>
        </EmptyState>
      );
    }

    return (
      <div className="flex flex-col">
        {activities.map((a) => (
          <ActivityItem key={`${a.type}-${a.id}`} activity={a} />
        ))}

        {/* pagination sentinel + controls */}
        <div ref={sentinelRef} />

        {isFetchingNextPage ? (
          <div className="py-5 text-center text-xs text-text-muted">Loading more…</div>
        ) : hasNextPage ? (
          <button
            type="button"
            onClick={() => fetchNextPage()}
            className="mt-2 self-center rounded-md border border-line px-5 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted transition-colors hover:border-gold hover:text-gold"
          >
            Load more
          </button>
        ) : (
          <p className="py-5 text-center text-xs text-text-muted">
            You’re all caught up ✦
          </p>
        )}
      </div>
    );
  };

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-white">Activity</h2>
        <div className="h-px flex-1 bg-accent-red" />
        <div className="flex shrink-0 gap-4">
          <TabButton id="following" label="Following" />
          <TabButton id="everyone" label="Everyone" />
        </div>
      </div>

      {renderBody()}
    </section>
  );
}