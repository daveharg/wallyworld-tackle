"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFishAuth } from "../../_components/FishAuth";
import { fishFetch } from "../../_components/fishFetch";
import FishingStats from "../../profile/_components/FishingStats";

interface Friend {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface LeaderRow {
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  value: number;
}

function LeaderboardList({ rows, unit }: { rows: LeaderRow[]; unit: string }) {
  if (rows.length === 0) {
    return <p className="text-pine/50 text-sm">No rankings yet — log a catch to get on the board.</p>;
  }
  return (
    <div className="bg-white border border-pine/10 rounded-3xl overflow-hidden divide-y divide-pine/8">
      {rows.map((r, i) => (
        <Link
          key={r.user_id}
          href={`/fishmb/anglers/${r.user_id}`}
          className="flex items-center gap-3 px-4 py-3 hover:bg-pine/[0.03] transition-colors"
        >
          <span
            className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-black ${
              i === 0
                ? "bg-gold/15 text-gold"
                : i === 1
                  ? "bg-pine/10 text-pine/70"
                  : i === 2
                    ? "bg-signal/10 text-signal-dark"
                    : "bg-pine/5 text-pine/50"
            }`}
          >
            {i + 1}
          </span>
          {r.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
          ) : (
            <span className="w-9 h-9 rounded-full bg-pine/10 flex items-center justify-center font-bold text-sm shrink-0">
              {r.user_name.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="flex-1 min-w-0 text-sm font-bold text-pine truncate">{r.user_name}</span>
          <span className="text-xs font-bold text-pine/60 tabular-nums whitespace-nowrap">
            {r.value} {unit}
          </span>
        </Link>
      ))}
    </div>
  );
}

/** Dashboard stats: your numbers plus any friend's, side by side. */
export default function DashboardStats() {
  const { user } = useFishAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selected, setSelected] = useState<Friend | null>(null);
  const [topAnglers, setTopAnglers] = useState<LeaderRow[]>([]);
  const [topFriends, setTopFriends] = useState<LeaderRow[]>([]);

  useEffect(() => {
    fishFetch("/api/fish/friends")
      .then((d) => setFriends((d.friends ?? []) as Friend[]))
      .catch(() => {});
    // Top Manitoba anglers by fish logged.
    fishFetch("/api/fishmb/leaderboards?category=most")
      .then((d) => setTopAnglers(((d.rows ?? []) as LeaderRow[]).slice(0, 5)))
      .catch(() => {});
  }, []);

  // Top friends: rank the user's friends by fish logged.
  useEffect(() => {
    if (friends.length === 0) return;
    fishFetch("/api/fishmb/leaderboards?category=most")
      .then((d) => {
        const rows = (d.rows ?? []) as LeaderRow[];
        const friendIds = new Set(friends.map((f) => f.id));
        setTopFriends(rows.filter((r) => friendIds.has(r.user_id)).slice(0, 5));
      })
      .catch(() => {});
  }, [friends]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <FishingStats userId={user.id} hideTitle />
      </div>

      <div>
        <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-4">
 Friends' stats
        </h2>
        {friends.length === 0 ? (
          <div className="bg-white border border-pine/10 rounded-3xl p-6 text-center">
            <p className="text-pine/70 font-bold">No friends yet</p>
            <p className="text-pine/50 text-sm mt-1 mb-4">
              Add fishing friends to compare stats.
            </p>
            <Link
              href="/fishmb/friends"
              className="inline-block bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-full transition-colors"
            >
              Find friends
            </Link>
          </div>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
              {friends.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelected(f)}
                  className={`shrink-0 flex items-center gap-2 rounded-full pl-1 pr-4 py-1 border transition-colors ${
                    selected?.id === f.id
                      ? "bg-signal text-white border-signal"
                      : "bg-white text-pine border-pine/15 hover:border-signal"
                  }`}
                >
                  {f.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={f.avatar_url}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-pine/10 flex items-center justify-center font-bold text-sm">
                      {f.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="text-sm font-bold max-w-[140px] truncate">
                    {f.name}
                  </span>
                </button>
              ))}
            </div>
            {selected ? (
              <div>
                <p className="text-pine/60 text-sm mb-2">
                  Showing stats for{" "}
                  <Link
                    href={`/fishmb/anglers/${selected.id}`}
                    className="font-bold text-signal-dark hover:underline"
                  >
                    {selected.name}
                  </Link>
                </p>
                <FishingStats userId={selected.id} />
              </div>
            ) : (
              <p className="text-pine/50 text-sm">
                Tap a friend above to see their stats.
              </p>
            )}
          </>
        )}
      </div>

      <div>
        <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-4">
          Top Manitoba anglers
        </h2>
        <LeaderboardList rows={topAnglers} unit="fish" />
      </div>

      {friends.length > 0 && (
        <div>
          <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-4">
            Top friends
          </h2>
          <LeaderboardList rows={topFriends} unit="fish" />
        </div>
      )}
    </div>
  );
}
