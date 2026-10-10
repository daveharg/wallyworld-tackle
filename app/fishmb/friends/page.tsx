"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

type Tab = "friends" | "requests" | "add";

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
  const params = useSearchParams();
  const [bundle, setBundle] = useState<FriendsBundle | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [actionFriend, setActionFriend] = useState<Person | null>(null);

  const tabParam = params.get("tab");
  const tab: Tab = tabParam === "requests" ? "requests" : tabParam === "add" ? "add" : "friends";
  const setTab = (t: Tab) => {
    router.replace(`/fishmb/friends?tab=${t}`, { scroll: false });
  };

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
    act(id, () => fishFetch("/api/fish/friends/request", json({ user_id: id })), "Friend request sent");
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

  const friendIds = new Set(bundle?.friends.map((f) => f.id) ?? []);
  const pendingIds = new Set([
    ...(bundle?.pending_outgoing.map((f) => f.id) ?? []),
    ...(bundle?.pending_incoming.map((f) => f.id) ?? []),
  ]);

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "friends", label: "Friends", count: bundle?.friends.length },
    { id: "requests", label: "Requests", count: bundle?.pending_incoming.length },
    { id: "add", label: "Add friends" },
  ];

  return (
    <div className="min-h-screen">
      {/* Centered header */}
      <div className="pt-8 pb-2 px-4">
        <h1 className="font-display font-bold uppercase text-pine text-4xl tracking-wide text-center">Friends</h1>
      </div>

      {/* Tab bar */}
      <div className="sticky top-0 z-10 bg-paper/95 backdrop-blur border-b border-pine/10">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex gap-2 justify-center py-3">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 max-w-44 px-4 py-2.5 rounded-full text-sm font-bold uppercase tracking-wider transition-colors ${
                  tab === t.id
                    ? "bg-pine text-white"
                    : "bg-pine/10 text-pine/60 hover:bg-pine/15"
                }`}
              >
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className={`ml-1.5 ${tab === t.id ? "text-gold" : "text-signal"}`}>{t.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
        {note && <p className="text-sm text-pine bg-gold/20 border border-gold/50 rounded-2xl px-4 py-3 mb-6">{note}</p>}

        {/* Friends list */}
        {tab === "friends" && (
          <div>
            {(bundle?.friends.length ?? 0) === 0 ? (
              <div className="text-center py-16">
                <p className="text-pine/55 mb-4">No friends yet.</p>
                <button
                  onClick={() => setTab("add")}
                  className="bg-signal hover:bg-signal-dark text-white text-sm font-bold uppercase tracking-wider px-6 py-3 rounded-full transition-colors"
                >
                  Find friends
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-pine/10">
                {bundle!.friends.map((p) => (
                  <li key={p.id} className="flex items-center gap-4 py-3">
                    <Link href={`/fishmb/anglers/${p.id}`}>
                      <Avatar p={p} size={64} />
                    </Link>
                    <button
                      onClick={() => setActionFriend(p)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <span className="block font-bold text-pine text-lg truncate">{p.name}</span>
                    </button>
                    <button
                      onClick={() => remove(p.id)}
                      disabled={busy === p.id}
                      className="text-xs font-bold text-pine/45 uppercase tracking-wider px-3 py-2 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Friend requests */}
        {tab === "requests" && (
          <div>
            {(bundle?.pending_incoming.length ?? 0) === 0 ? (
              <p className="text-pine/55 text-center py-16">No friend requests right now.</p>
            ) : (
              <ul className="divide-y divide-pine/10">
                {bundle!.pending_incoming.map((p) => (
                  <li key={p.id} className="py-4">
                    <div className="flex items-center gap-4">
                      <Link href={`/fishmb/anglers/${p.id}`}>
                        <Avatar p={p} size={80} />
                      </Link>
                      <Link href={`/fishmb/anglers/${p.id}`} className="flex-1 min-w-0">
                        <span className="block font-bold text-pine text-xl truncate">{p.name}</span>
                      </Link>
                    </div>
                    <div className="flex gap-3 mt-3 pl-24">
                      <button
                        onClick={() => accept(p.id)}
                        disabled={busy === p.id}
                        className="flex-1 bg-signal hover:bg-signal-dark text-white font-bold text-lg py-3 rounded-2xl disabled:opacity-50 transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => decline(p.id)}
                        disabled={busy === p.id}
                        className="flex-1 bg-pine/10 hover:bg-pine/15 text-pine font-bold text-lg py-3 rounded-2xl disabled:opacity-50 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Add friends */}
        {tab === "add" && (
          <div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search anglers by name…"
              className="w-full bg-white border border-pine/15 rounded-2xl px-4 py-3.5 text-pine placeholder:text-pine/35 focus:outline-none focus:border-signal mb-4"
            />
            {query.trim().length >= 2 && results.length === 0 && (
              <p className="text-pine/55 text-center py-8">No anglers found.</p>
            )}
            <ul className="divide-y divide-pine/10">
              {results.map((p) => {
                const isFriend = friendIds.has(p.id);
                const isPending = pendingIds.has(p.id);
                return (
                <li key={p.id} className="py-4">
                  <div className="flex items-center gap-4">
                    <Link href={`/fishmb/anglers/${p.id}`}>
                      <Avatar p={p} size={56} />
                    </Link>
                    <Link href={`/fishmb/anglers/${p.id}`} className="flex-1 min-w-0">
                      <span className="block font-bold text-pine text-lg truncate">{p.name}</span>
                      {isFriend && (
                        <span className="text-xs font-bold uppercase tracking-wider text-pine/45">Friend</span>
                      )}
                      {isPending && (
                        <span className="text-xs font-bold uppercase tracking-wider text-pine/45">Requested</span>
                      )}
                    </Link>
                    {!isFriend && !isPending && (
                      <button
                        onClick={() => request(p.id)}
                        disabled={busy === p.id}
                        className="bg-signal hover:bg-signal-dark text-white font-bold text-sm uppercase tracking-wider px-5 py-2.5 rounded-full disabled:opacity-50 transition-colors shrink-0"
                      >
                        {busy === p.id ? "…" : "Add"}
                      </button>
                    )}
                  </div>
                </li>
                );
              })}
            </ul>
          </div>
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
              {busy === actionFriend.id ? "Opening…" : "Message"}
            </button>
            <Link
              href={`/fishmb/anglers/${actionFriend.id}`}
              className="block w-full bg-pine/10 hover:bg-pine/15 text-pine font-bold uppercase tracking-wider text-sm px-6 py-3.5 rounded-full mb-3 transition-colors"
            >
              View profile
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
