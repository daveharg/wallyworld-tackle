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

/** Dashboard stats: your numbers plus any friend's, side by side. */
export default function DashboardStats() {
  const { user } = useFishAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selected, setSelected] = useState<Friend | null>(null);

  useEffect(() => {
    fishFetch("/api/fish/friends")
      .then((d) => setFriends((d.friends ?? []) as Friend[]))
      .catch(() => {});
  }, []);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <FishingStats userId={user.id} hideTitle />
      </div>

      <div>
        <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-4">
          👥 Friends' stats
        </h2>
        {friends.length === 0 ? (
          <div className="bg-white border border-pine/10 rounded-3xl p-6 text-center">
            <p className="text-pine/70 font-bold">No friends yet</p>
            <p className="text-pine/50 text-sm mt-1 mb-4">
              Add fishing buddies to compare stats.
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
    </div>
  );
}
