"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFishAuth } from "../_components/FishAuth";
import { fishFetch } from "../_components/fishFetch";

interface Person {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface FriendsBundle {
  friends: Person[];
  pending_incoming: Person[];
  pending_outgoing: Person[];
}

function Avatar({ p, size = 44 }: { p: Person; size?: number }) {
  if (p.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.avatar_url} alt={p.name} width={size} height={size} className="rounded-full object-cover" />;
  }
  return (
    <div
      className="rounded-full bg-pine/10 flex items-center justify-center font-bold text-pine"
      style={{ width: size, height: size }}
    >
      {p.name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function FriendsPage() {
  const { user, openLogin } = useFishAuth();
  const router = useRouter();
  const [bundle, setBundle] = useState<FriendsBundle | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [actionFriend, setActionFriend] = useState<Person | null>(null);

  const messageFriend = async (p: Person) => {
    setBusy(p.id);
    setNote(null);
    try {
      const d = await fishFetch("/api/fishmb/msg/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ other_user_id: p.id }),
      });
      setActionFriend(null);
      router.push(`/fishmb/messages?convo=${d.id}`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not start conversation.");
    } finally {
      setBusy(null);
    }
  };

  const load = useCallback(async () => {
    try {
      setBundle(await fishFetch("/api/fish/friends"));
    } catch {
      setBundle({ friends: [], pending_incoming: [], pending_outgoing: [] });
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const d = await fishFetch(`/api/fishmb/users/search?q=${encodeURIComponent(query.trim())}`);
        setResults(d.users ?? []);
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const act = async (id: string, fn: () => Promise<unknown>, label: string) => {
    setBusy(id);
    setNote(null);
    try {
      await fn();
      setNote(label);
      await load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  const json = (b: unknown) => ({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(b),
  });
  const request = (id: string) =>
    act(id, () => fishFetch("/api/fish/friends/request", json({ user_id: id })), "Friend request sent 🎣");
  const accept = (id: string) =>
    act(id, () => fishFetch("/api/fish/friends/respond", json({ requester_id: id, accept: true })), "You're friends now!");
  const decline = (id: string) =>
    act(id, () => fishFetch("/api/fish/friends/respond", json({ requester_id: id, accept: false })), "Request declined.");
  const remove = (id: string) =>
    act(id, () => fishFetch(`/api/fish/friends/${id}`, { method: "DELETE" }), "Removed from friends.");

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display font-bold uppercase text-pine text-4xl tracking-wide mb-4">Friends</h1>
        <p className="text-pine/60 mb-6">Log in to find fishing friends and share posts with just friends.</p>
        <button onClick={openLogin} className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-8 py-3.5 rounded-full">
          Log in
        </button>
      </div>
    );
  }

  const requestedIds = new Set([
    ...(bundle?.friends.map((f) => f.id) ?? []),
    ...(bundle?.pending_outgoing.map((f) => f.id) ?? []),
    ...(bundle?.pending_incoming.map((f) => f.id) ?? []),
  ]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 md:py-14">
      <Link href="/fishmb/feed" className="text-sm font-bold text-signal uppercase tracking-wider">← Community feed</Link>
      <h1 className="font-display font-bold uppercase text-pine text-4xl md:text-5xl tracking-wide mt-4 mb-2">Friends</h1>
      <p className="text-pine/60 mb-8">Add fishing friends, then share catches and posts with just friends.</p>

      {note && <p className="text-sm text-pine bg-gold/20 border border-gold/50 rounded-2xl px-4 py-3 mb-6">{note}</p>}

      <div id="find-anglers" className="bg-white border border-pine/10 rounded-3xl p-6 mb-8 scroll-mt-24">
        <h2 className="font-bold text-pine uppercase tracking-wider text-sm mb-3">Find anglers</h2>
        <input
          id="find-anglers-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name…"
          className="w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine placeholder:text-pine/35 focus:outline-none focus:border-signal"
        />
        {results.length > 0 && (
          <ul className="mt-3 divide-y divide-pine/10">
            {results.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <Link href={`/fishmb/anglers/${p.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar p={p} size={40} />
                  <span className="flex-1 font-bold text-pine truncate">{p.name}</span>
                </Link>
                {requestedIds.has(p.id) ? (
                  <span className="text-xs font-bold uppercase tracking-wider text-pine/40">Requested</span>
                ) : (
                  <button
                    onClick={() => request(p.id)}
                    disabled={busy === p.id}
                    className="text-sm font-bold text-signal uppercase tracking-wider disabled:opacity-50"
                  >
                    {busy === p.id ? "…" : "Add friend"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {(bundle?.pending_incoming.length ?? 0) > 0 && (
        <div className="bg-white border border-signal/30 rounded-3xl p-6 mb-8">
          <h2 className="font-bold text-pine uppercase tracking-wider text-sm mb-3">Friend requests</h2>
          <ul className="divide-y divide-pine/10">
            {bundle!.pending_incoming.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <Link href={`/fishmb/anglers/${p.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar p={p} size={40} />
                  <span className="flex-1 font-bold text-pine truncate">{p.name}</span>
                </Link>
                <button onClick={() => accept(p.id)} disabled={busy === p.id} className="text-sm font-bold text-pine uppercase tracking-wider bg-pine/10 hover:bg-pine/20 px-4 py-2 rounded-full disabled:opacity-50">Accept</button>
                <button onClick={() => decline(p.id)} disabled={busy === p.id} className="text-sm font-bold text-pine/50 uppercase tracking-wider px-3 py-2 disabled:opacity-50">Decline</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white border border-pine/10 rounded-3xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-pine uppercase tracking-wider text-sm">
            Your friends ({bundle?.friends.length ?? 0})
          </h2>
          <button
            onClick={() => {
              document.getElementById("find-anglers")?.scrollIntoView({ behavior: "smooth", block: "start" });
              document.getElementById("find-anglers-input")?.focus({ preventScroll: true });
            }}
            className="bg-signal hover:bg-signal-dark text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full transition-colors"
          >
            ＋ Add friends
          </button>
        </div>
        {(bundle?.friends.length ?? 0) === 0 ? (
          <p className="text-pine/55 text-sm">No friends yet — search above to find friends.</p>
        ) : (
          <ul className="divide-y divide-pine/10">
            {bundle!.friends.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <button
                  onClick={() => setActionFriend(p)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <Avatar p={p} size={40} />
                  <span className="flex-1 font-bold text-pine truncate">{p.name}</span>
                </button>
                <button onClick={() => remove(p.id)} disabled={busy === p.id} className="text-xs font-bold text-pine/45 uppercase tracking-wider disabled:opacity-50">Remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Friend action sheet — message or view profile */}
      {actionFriend && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-pine-deep/60 p-4"
          onClick={() => setActionFriend(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${actionFriend.name} options`}
        >
          <div
            className="bg-paper rounded-3xl w-full max-w-sm p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Avatar p={actionFriend} size={64} />
            <p className="font-bold text-pine text-lg mt-3 mb-5">{actionFriend.name}</p>
            <button
              onClick={() => messageFriend(actionFriend)}
              disabled={busy === actionFriend.id}
              className="w-full bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-3.5 rounded-full mb-3 disabled:opacity-50 transition-colors"
            >
              {busy === actionFriend.id ? "Opening…" : "💬 Message"}
            </button>
            <Link
              href={`/fishmb/anglers/${actionFriend.id}`}
              className="block w-full bg-pine/10 hover:bg-pine/15 text-pine font-bold uppercase tracking-wider text-sm px-6 py-3.5 rounded-full mb-3 transition-colors"
            >
              👤 View profile
            </Link>
            <button
              onClick={() => setActionFriend(null)}
              className="text-sm font-bold uppercase tracking-wider text-pine/50 hover:text-pine"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
