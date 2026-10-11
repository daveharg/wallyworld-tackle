// Friend requests section — shows at the top of the profile page.

"use client";

import { useEffect, useState } from "react";
import { fishFetch } from "../../_components/fishFetch";

interface Person {
  id: string;
  name: string;
  avatar_url: string | null;
}

export default function FriendRequests() {
  const [requests, setRequests] = useState<Person[]>([]);
  const [acting, setActing] = useState<Set<string>>(new Set());

  const load = async () => {
    try {
      const d = (await fishFetch("/api/fish/friends")) as {
        pending_incoming: Person[];
      };
      setRequests(d.pending_incoming ?? []);
    } catch {
      // leave empty
    }
  };

  useEffect(() => {
    load();
  }, []);

  const respond = async (id: string, accept: boolean) => {
    setActing((s) => new Set(s).add(id));
    try {
      await fishFetch("/api/fish/friends/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requester_id: id, accept }),
      });
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // leave in list
    } finally {
      setActing((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  };

  if (requests.length === 0) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 pt-4">
      <div className="bg-white border-2 border-signal/30 rounded-3xl p-4">
        <h3 className="font-display font-bold uppercase text-pine text-lg tracking-wide mb-3">
          Friend requests
          <span className="ml-2 inline-flex min-w-[24px] h-6 px-1.5 rounded-full bg-signal text-white text-xs font-bold items-center justify-center">
            {requests.length}
          </span>
        </h3>
        <div className="space-y-2">
          {requests.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 bg-pine/5 rounded-2xl p-2.5"
            >
              {r.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.avatar_url}
                  alt={r.name}
                  className="w-11 h-11 rounded-full object-cover shrink-0"
                />
              ) : (
                <span className="w-11 h-11 rounded-full bg-pine/10 text-pine flex items-center justify-center font-bold text-lg shrink-0">
                  {r.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="flex-1 min-w-0 font-bold text-pine text-sm truncate">
                {r.name}
              </span>
              <button
                type="button"
                onClick={() => respond(r.id, true)}
                disabled={acting.has(r.id)}
                className="px-4 py-2 rounded-full bg-pine text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => respond(r.id, false)}
                disabled={acting.has(r.id)}
                className="px-4 py-2 rounded-full border border-pine/20 text-pine/60 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
