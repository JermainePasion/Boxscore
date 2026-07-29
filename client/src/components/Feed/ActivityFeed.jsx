import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import RateReviewRoundedIcon from "@mui/icons-material/RateReviewRounded";
import ChatBubbleRoundedIcon from "@mui/icons-material/ChatBubbleRounded";
import ChangeHistoryRoundedIcon from "@mui/icons-material/ChangeHistoryRounded";

import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

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

const TYPE_ICON = {
  review: RateReviewRoundedIcon,
  comment: ChatBubbleRoundedIcon,
  pyramid: ChangeHistoryRoundedIcon,
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
  return (
    <p className="text-sm text-white/90">
      <Link to={`/user/${user.username}`} className="font-semibold hover:text-gold">
        {user.username}
      </Link>{" "}
      <span className="text-text-muted">built a pyramid</span>
      {data.playerCount ? (
        <span className="text-text-muted">
          {" "}
          with {data.playerCount} player{data.playerCount === 1 ? "" : "s"}
        </span>
      ) : null}
    </p>
  );
}

function ActivityItem({ activity }) {
  const Icon = TYPE_ICON[activity.type] ?? RateReviewRoundedIcon;
  const Body =
    activity.type === "review"
      ? ReviewBody
      : activity.type === "comment"
      ? CommentBody
      : PyramidBody;

  return (
    <article className="flex gap-3 border-b border-line py-4">
      <Avatar user={activity.user} />
      <div className="min-w-0 flex-1">
        <Body user={activity.user} data={activity.data} />
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Icon className="text-line" sx={{ fontSize: 16 }} />
        <span className="whitespace-nowrap text-[11px] text-text-muted">
          {timeAgo(activity.createdAt)}
        </span>
      </div>
    </article>
  );
}

/* ---------- feed ---------- */

export default function ActivityFeed() {
  const { isAuthed } = useAuth();
  const [tab, setTab] = useState(isAuthed ? "following" : "everyone");

  const followingSelected = tab === "following";
  const canQuery = followingSelected ? isAuthed : true;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["feed", tab],
    queryFn: () =>
      api.get(followingSelected ? "/feed" : "/feed/global").then((r) => r.data),
    enabled: canQuery,
  });

  const activities = data?.activities ?? [];

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

      {followingSelected && !isAuthed ? (
        <div className="rounded-md border border-dashed border-line bg-surface/40 px-6 py-8 text-center text-sm text-text-muted">
          <Link to="/login" className="font-semibold text-gold hover:underline">
            Sign in
          </Link>{" "}
          to see what the people you follow are watching.
        </div>
      ) : isLoading ? (
        <div className="flex flex-col">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3 border-b border-line py-4">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-surface" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/2 animate-pulse rounded bg-surface" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-surface" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-md border border-dashed border-line bg-surface/40 px-6 py-8 text-center text-sm text-text-muted">
          Couldn’t load the feed.{" "}
          <button
            type="button"
            onClick={() => refetch()}
            className="font-semibold text-gold hover:underline"
          >
            Try again
          </button>
        </div>
      ) : activities.length === 0 ? (
        <div className="rounded-md border border-dashed border-line bg-surface/40 px-6 py-8 text-center text-sm text-text-muted">
          {followingSelected
            ? "Nothing here yet — follow some people to fill this in."
            : "No activity yet. Be the first to rate a game."}
        </div>
      ) : (
        <div className="flex flex-col">
          {activities.map((a) => (
            <ActivityItem key={`${a.type}-${a.id}`} activity={a} />
          ))}
        </div>
      )}
    </section>
  );
}