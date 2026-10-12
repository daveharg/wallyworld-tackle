// "Fishing stats" section for angler profiles. Used by ProfileView, so it
// shows on both the owner's profile and public angler pages. Privacy is
// enforced server-side by /api/fishmb/users/[id]/stats.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fishFetch } from "../../_components/fishFetch";

interface BiggestFish {
  species: string;
  length_in: number;
}

interface UserStats {
  total_catches: number;
  tournament_catches: number;
  species_count: number;
  biggest: BiggestFish[];
  tournaments_joined: number;
  tournament_wins: number;
  posts_count: number;
  tips_count: number;
  member_since: string | null;
  hidden_stats?: string[];
  is_self?: boolean;
}

function memberSince(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "long" });
}

export default function FishingStats({
  userId,
  hideTitle,
  hqContext,
}: {
  userId: string;
  hideTitle?: boolean;
  /** Set when rendered inside HQ — your own tiles deep-link to HQ sections. */
  hqContext?: boolean;
}) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fishFetch(`/api/fishmb/users/${userId}/stats`)
      .then((d) => {
        if (live) setStats((d as { stats: UserStats }).stats);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [userId]);

  if (failed || !stats) {
    if (failed) return null;
    return (
      <section className="mb-8">
        {!hideTitle && (
          <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-4">
 Fishing stats
          </h2>
        )}
        <div className="bg-pine/5 rounded-3xl h-32 animate-pulse" />
      </section>
    );
  }

  const tiles: [string, number, string][] = [
    ["Catches", stats.total_catches, "catches"],
    ["✓ Verified", stats.tournament_catches, "tournament-catches"],
    ["Non-verified", stats.total_catches - stats.tournament_catches, "catches-nonverified"],
    ["Species", stats.species_count, "species"],
    ["Tournaments", stats.tournaments_joined, "tournaments"],
    ["Wins", stats.tournament_wins, "wins"],
    ["Posts", stats.posts_count, "posts"],
  ];
  // Stats the angler hides from other people don't render as tiles for them.
  const visibleTiles = tiles.filter(
    ([, , key]) => stats.is_self || !(stats.hidden_stats ?? []).includes(key)
  );
  const showBiggest = stats.is_self || !(stats.hidden_stats ?? []).includes("biggest");
  const since = memberSince(stats.member_since);

  // Your own tiles (inside HQ) deep-link straight to the HQ section holding
  // the detail — no separate pages. Anyone else's tiles are display-only.
  const linkHQ = hqContext && stats.is_self;
  const tileHref = (key: string): string | null => {
    if (!linkHQ) return null;
    switch (key) {
      case "catches":
        return "/fishmb/dashboard?tab=stats#catches";
      case "tournament-catches":
        return "/fishmb/dashboard?tab=stats&catchfilter=verified#catches";
      case "catches-nonverified":
        return "/fishmb/dashboard?tab=stats&catchfilter=notverified#catches";
      case "species":
        return "/fishmb/dashboard?tab=stats#species";
      case "tournaments":
      case "wins":
        return "/fishmb/dashboard?tab=tournaments";
      case "posts":
        return "/fishmb/dashboard?tab=profile";
      default:
        return null;
    }
  };
  const tileIcon = (key: string): string => {
    switch (key) {
      case "catches":
        return "🎣";
      case "tournament-catches":
        return "✓";
      case "catches-nonverified":
        return "○";
      case "species":
        return "🐟";
      case "tournaments":
        return "🏆";
      case "wins":
        return "🥇";
      case "posts":
        return "💬";
      default:
        return "•";
    }
  };

  return (
    <section className="mb-8">
      {!hideTitle && (
        <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-4">
 Fishing stats
        </h2>
      )}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 mb-4">
        {visibleTiles.map(([label, value, key]) => {
          const href = tileHref(key);
          const inner = (
            <>
              <span className="text-xl leading-none">{tileIcon(key)}</span>
              <p className="font-display font-bold text-pine text-2xl leading-none mt-1 tabular-nums">
                {value}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-pine/55 mt-1.5 leading-tight">
                {label}
              </p>
            </>
          );
          const cls =
            "bg-white border border-pine/10 rounded-3xl px-2 py-4 flex flex-col items-center justify-center text-center transition-all " +
            (href ? "hover:border-signal/50 hover:shadow-md active:scale-[0.97] cursor-pointer" : "");
          return href ? (
            <Link key={label} href={href} className={cls}>
              {inner}
            </Link>
          ) : (
            <div key={label} className={cls}>
              {inner}
            </div>
          );
        })}
      </div>
      {showBiggest && (
      <div className="bg-white border border-pine/10 rounded-3xl p-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-pine/55 mb-3">
          Biggest fish
        </p>
        {stats.biggest.length > 0 ? (
          <ul className="divide-y divide-pine/8">
            {stats.biggest.map((b, i) => (
              <li key={`${b.species}-${i}`} className="flex items-center justify-between py-2">
                <span className="text-sm font-bold text-pine">
                  <span className="text-gold mr-2">#{i + 1}</span>
                  {b.species}
                </span>
                <span className="text-sm text-pine/70 font-bold">
                  {Number(b.length_in).toFixed(1)}″
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-pine/50">No catches logged yet.</p>
        )}
        {since && (
          <p className="text-xs text-pine/45 mt-4 pt-3 border-t border-pine/10">
 On FishMB since {since}
          </p>
        )}
      </div>
      )}
      <Link
        href="/fishmb/leaderboards"
        className="mt-4 inline-flex items-center gap-2 bg-pine hover:bg-pine-deep text-white font-bold uppercase tracking-wider text-xs px-6 py-3 rounded-full transition-colors"
      >
 View leaderboards →
      </Link>
    </section>
  );
}
