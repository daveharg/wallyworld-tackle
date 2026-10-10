// Dashboard "Profile" tab — friends section at the bottom.
// Compact: see your friends, search anglers, send friend requests.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fishFetch } from "../../_components/fishFetch";

interface Person {
  id: string;
  name: string;
  avatar_url: string | null;
}

function Avatar({ p, size = "w-11 h-11" }: { p: Person; size?: string }) {
  if (p.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.avatar_url} alt="" className={`${size} rounded-full object-cover`} />;
  }
  return (
    <span className={`${size} rounded-full bg-pine/10 flex items-center justify-center font-bold text-pine`}>
      {p.name.charAt(0).toUpperCase()}
    </span>
  );
}

export default function ProfileFriends() {
  const [friends, setFriends] = useState<Person[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    try {
      const d = (await fishFetch("/api/fish/friends")) as {
        friends: Person[];
        pending_incoming: Person[];
      };
      setFriends(d.friends ?? []);
      setPendingCount((d.pending_incoming ?? []).length);
    } catch {
      // leave empty
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Search all anglers.
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = window.setTimeout(async () => {
      try {
        const d = (await fishFetch(`/api/fishmb/users/search?q=${encodeURIComponent(q)}`)) as {
          users: Person[];
        };
        const friendIds = new Set(friends.map((f) => f.id));
        setResults((d.users ?? []).filter((u) => !friendIds.has(u.id)).slice(0, 8));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [search, friends]);

  const sendRequest = async (id: string) => {
    try {
      await fishFetch("/api/fish/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: id }),
      });
      setSentIds((s) => new Set(s).add(id));
      setNotice("Friend request sent.");
      window.setTimeout(() => setNotice(null), 2500);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not send request.");
    }
  };

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide">
          Friends {friends.length > 0 && <span className="text-pine/50">({friends.length})</span>}
        </h2>
        <Link
          href="/fishmb/friends"
          className="text-signal-dark font-bold text-sm flex items-center gap-1"
        >
          {pendingCount > 0 ? (
            <span className="flex items-center gap-1.5">
              <span className="min-w-5 h-5 px-1 rounded-full bg-signal text-white text-[11px] font-black flex items-center justify-center">
                {pendingCount}
              </span>
              Requests
            </span>
          ) : (
            "See all →"
          )}
        </Link>
      </div>

      {notice && (
        <p className="text-sm text-pine bg-pine/5 border border-pine/15 rounded-2xl px-4 py-2.5 mb-3">
          {notice}
        </p>
      )}

      {/* Add friends search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search anglers to add…"
        className="w-full bg-white border border-pine/15 rounded-2xl px-4 py-3 text-sm text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal mb-3"
      />
      {search.trim().length >= 2 && (
        <div className="mb-4">
          {searching ? (
            <p className="text-pine/50 text-sm py-2">Searching…</p>
          ) : results.length === 0 ? (
            <p className="text-pine/50 text-sm py-2">No anglers found.</p>
          ) : (
            <div className="space-y-1">
              {results.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 bg-white border border-pine/10 rounded-2xl p-3"
                >
                  <Avatar p={u} />
                  <span className="font-bold text-pine text-sm flex-1 truncate">{u.name}</span>
                  {sentIds.has(u.id) ? (
                    <span className="text-pine/50 text-xs font-bold">Sent ✓</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => sendRequest(u.id)}
                      className="bg-signal hover:bg-signal-dark text-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-full transition-colors"
                    >
                      Add
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Friends list */}
      {friends.length > 0 ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {friends.slice(0, 6).map((f) => (
            <Link
              key={f.id}
              href={`/fishmb/anglers/${f.id}`}
              className="flex items-center gap-3 bg-white border border-pine/10 rounded-2xl p-3 hover:shadow-md transition-shadow"
            >
              <Avatar p={f} />
              <span className="font-bold text-pine text-sm truncate">{f.name}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-center text-pine/50 py-6 bg-white border border-pine/10 rounded-2xl">
          No friends yet — search above to find anglers.
        </p>
      )}
      {friends.length > 6 && (
        <Link
          href="/fishmb/friends"
          className="block text-center text-signal-dark font-bold text-sm mt-3"
        >
          See all {friends.length} friends →
        </Link>
      )}
    </section>
  );
}
