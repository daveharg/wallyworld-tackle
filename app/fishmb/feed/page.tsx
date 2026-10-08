"use client";

import { useCallback, useEffect, useRef, useState, Fragment } from "react";
import Link from "next/link";
import { useFishAuth } from "../_components/FishAuth";
import { fishFetch } from "../_components/fishFetch";
import { compressImage } from "../_components/compressImage";
import { FISHMB_TOKEN_KEY } from "@/lib/fishmb-constants";

interface FeedItem {
  id: string;
  kind: "catch" | "post" | "tip";
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  body: string | null;
  photo_url: string | null;
  photos: string[];
  species: string | null;
  length_in: number | null;
  species_tag?: string | null;
  visibility?: string;
  comment_count: number;
  like_count: number;
  dislike_count: number;
  viewer_reaction: 1 | -1 | null;
  created_at: string;
}

interface FeedComment {
  id: string;
  user_name: string;
  avatar_url: string | null;
  body: string;
  created_at: string;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="w-10 h-10 rounded-full object-cover" />;
  }
  return (
    <span className="w-10 h-10 rounded-full bg-signal text-white flex items-center justify-center font-bold">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

interface FeedAd {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  video_url: string | null;
  link_url: string | null;
  business_name: string | null;
}

/** Sponsored ad card interleaved into the feed. */
function FeedAdCard({ ad }: { ad: FeedAd }) {
  return (
    <article className="bg-white border-2 border-gold/50 rounded-3xl p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold mb-2">Sponsored</p>
      <p className="font-bold text-pine">{ad.title}</p>
      {ad.business_name && <p className="text-xs text-pine/55 mb-2">by {ad.business_name}</p>}
      {ad.video_url ? (
        <video src={ad.video_url} controls className="w-full rounded-2xl mt-2" />
      ) : ad.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ad.image_url} alt={ad.title} loading="lazy" className="w-full rounded-2xl mt-2 object-cover max-h-80" />
      ) : null}
      {ad.body && <p className="text-pine/75 text-sm mt-2">{ad.body}</p>}
      {ad.link_url && (
        <a
          href={ad.link_url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="inline-block mt-3 bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-xs px-5 py-2.5 rounded-full transition-colors"
        >
          Learn more →
        </a>
      )}
    </article>
  );
}

/** Photos for a card: all attached photos, falling back to the legacy single photo_url. */
function cardPhotos(item: FeedItem): string[] {
  if (item.photos && item.photos.length > 0) return item.photos;
  return item.photo_url ? [item.photo_url] : [];
}

function PhotoCarousel({ photos }: { photos: string[] }) {
  const [idx, setIdx] = useState(0);
  if (photos.length === 0) return null;
  const go = (d: number) => setIdx((i) => (i + d + photos.length) % photos.length);
  return (
    <div className="mt-3 rounded-2xl overflow-hidden bg-pine-deep/10 relative max-sm:-mx-5 max-sm:rounded-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photos[idx]}
        alt=""
        className="w-full max-h-96 object-cover"
        loading="lazy"
      />
      {photos.length > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white text-sm font-bold"
          >
            ‹
          </button>
          <button
            onClick={() => go(1)}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white text-sm font-bold"
          >
            ›
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`Photo ${i + 1}`}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === idx ? "bg-white" : "bg-white/50"
                }`}
              />
            ))}
          </div>
          <span className="absolute top-2 right-2 text-[11px] font-bold text-white bg-black/50 rounded-full px-2 py-0.5">
            {idx + 1}/{photos.length}
          </span>
        </>
      )}
    </div>
  );
}

function Reactions({
  item,
  onReacted,
}: {
  item: FeedItem;
  onReacted: (id: string, r: { like_count: number; dislike_count: number; viewer_reaction: 1 | -1 | null }) => void;
}) {
  const { user, openLogin } = useFishAuth();
  const [busy, setBusy] = useState(false);

  const react = async (value: 1 | -1) => {
    if (!user) {
      openLogin();
      return;
    }
    if (busy) return;
    setBusy(true);
    // Tapping the active reaction again removes it.
    const next = item.viewer_reaction === value ? null : value;
    try {
      const d = await fishFetch(`/api/fishmb/feed/${item.id}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: next }),
      });
      onReacted(item.id, d);
    } catch {
      // non-fatal
    } finally {
      setBusy(false);
    }
  };

  const btn = (value: 1 | -1, icon: string, count: number, label: string) => {
    const active = item.viewer_reaction === value;
    return (
      <button
        onClick={() => react(value)}
        disabled={busy}
        aria-label={label}
        className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full transition-colors ${
          active ? "bg-signal/15 text-signal-dark" : "text-pine/50 hover:bg-pine/5"
        }`}
      >
        <span className={active ? "" : "grayscale opacity-60"}>{icon}</span>
        {count}
      </button>
    );
  };

  return (
    <div className="flex items-center gap-1">
      {btn(1, "👍", item.like_count, "Like")}
      {btn(-1, "👎", item.dislike_count, "Dislike")}
    </div>
  );
}

function Comments({ postId }: { postId: string }) {
  const { user, openLogin } = useFishAuth();
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    fishFetch(`/api/fishmb/feed/${postId}/comments`)
      .then((d) => setComments(d.comments))
      .catch(() => {});
  }, [postId]);

  const send = async () => {
    if (!user) {
      openLogin();
      return;
    }
    if (!draft.trim() || busy) return;
    setBusy(true);
    try {
      const d = await fishFetch(`/api/fishmb/feed/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim() }),
      });
      setComments([...comments, d.comment]);
      setDraft("");
    } catch {
      // non-fatal
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-pine/10 space-y-3">
      {comments.map((c) => (
        <div key={c.id} className="flex gap-2.5">
          <Avatar name={c.user_name} url={c.avatar_url} />
          <div className="bg-paper-deep rounded-2xl px-3.5 py-2.5 flex-1">
            <p className="text-xs font-bold text-pine">
              {c.user_name} <span className="font-normal text-pine/45">· {timeAgo(c.created_at)}</span>
            </p>
            <p className="text-sm text-pine/80 mt-0.5">{c.body}</p>
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={user ? "Write a comment…" : "Log in to comment"}
          onFocus={() => !user && openLogin()}
          className="flex-1 bg-paper-deep border border-pine/15 rounded-full px-4 py-2 text-sm text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal"
        />
        <button
          onClick={send}
          disabled={busy}
          className="bg-pine text-white text-xs font-bold uppercase tracking-wider px-4 rounded-full disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default function FeedPage() {
  const { user, openLogin } = useFishAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [tab, setTab] = useState<"all" | "catch" | "post">("all");
  const [composerOpen, setComposerOpen] = useState(false);
  const [q, setQ] = useState("");
  const [activeQ, setActiveQ] = useState("");
  const [mode, setMode] = useState<"post" | "catch">("post");
  const [draft, setDraft] = useState("");
  const [catchPhotos, setCatchPhotos] = useState<File[]>([]);
  const [postPhotos, setPostPhotos] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);
  const [visibility, setVisibility] = useState<"public" | "friends" | "private">("public");
  const [catchSpecies, setCatchSpecies] = useState("");
  const [catchLength, setCatchLength] = useState("");
  const [myTournaments, setMyTournaments] = useState<{ id: string; name: string }[]>([]);
  const [tournamentId, setTournamentId] = useState("");
  const [catchNote, setCatchNote] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());

  const PAGE_SIZE = 20;
  // Refs mirror state so the IntersectionObserver callback never goes stale.
  const tabRef = useRef(tab);
  const activeQRef = useRef(activeQ);
  const itemsRef = useRef<FeedItem[]>([]);
  const nextCursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { tabRef.current = tab; }, [tab]);
  useEffect(() => { activeQRef.current = activeQ; }, [activeQ]);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const applyPage = useCallback((d: { items?: FeedItem[]; nextCursor?: string | null; hasMore?: boolean }) => {
    setItems(d.items ?? []);
    setNextCursor(d.nextCursor ?? null);
    setHasMore(!!d.hasMore);
    nextCursorRef.current = d.nextCursor ?? null;
    hasMoreRef.current = !!d.hasMore;
  }, []);

  const load = useCallback(async (query?: string, tabValue: "all" | "catch" | "post" = "all") => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), kind: tabValue });
      if (query && query.trim()) params.set("q", query.trim());
      const d = await fishFetch(`/api/fishmb/feed?${params.toString()}`);
      applyPage(d);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [applyPage]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current || !nextCursorRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        kind: tabRef.current,
        cursor: nextCursorRef.current,
      });
      if (activeQRef.current) params.set("q", activeQRef.current);
      const d = await fishFetch(`/api/fishmb/feed?${params.toString()}`);
      const seen = new Set(itemsRef.current.map((i) => i.id));
      const fresh = ((d.items ?? []) as FeedItem[]).filter((i) => !seen.has(i.id));
      setItems((prev) => [...prev, ...fresh]);
      setNextCursor(d.nextCursor ?? null);
      setHasMore(!!d.hasMore);
      nextCursorRef.current = d.nextCursor ?? null;
      hasMoreRef.current = !!d.hasMore;
    } catch {
      // non-fatal; user can scroll again to retry
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "600px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  const selectTab = (v: "all" | "catch" | "post") => {
    setTab(v);
    tabRef.current = v;
    window.scrollTo({ top: 0, behavior: "smooth" });
    load(activeQRef.current || undefined, v);
  };

  const [friends, setFriends] = useState<{ id: string; name: string; avatar_url: string | null }[]>([]);
  const [feedAds, setFeedAds] = useState<
    { id: string; title: string; body: string; image_url: string | null; video_url: string | null; link_url: string | null; business_name: string | null }[]
  >([]);
  useEffect(() => {
    fetch("/api/fishmb/ads?slot=feed")
      .then((r) => r.json())
      .then((d) => setFeedAds(d.ads ?? []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!user) {
      setFriends([]);
      return;
    }
    let live = true;
    fishFetch("/api/fish/friends")
      .then((d) => {
        if (live) setFriends((d as { friends?: { id: string; name: string; avatar_url: string | null }[] }).friends ?? []);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [user]);

  const runSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = q.trim();
    setActiveQ(trimmed);
    activeQRef.current = trimmed;
    load(trimmed || undefined, tabRef.current);
  };

  const clearSearch = () => {
    setQ("");
    setActiveQ("");
    activeQRef.current = "";
    load(undefined, tabRef.current);
  };

  const handleReacted = (
    id: string,
    r: { like_count: number; dislike_count: number; viewer_reaction: 1 | -1 | null }
  ) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...r } : it)));
  };

  // My tournaments for the "also enter in tournament" picker.
  useEffect(() => {
    if (!user) return;
    fishFetch("/api/fishmb/tournaments?mine=1")
      .then((d) => setMyTournaments(d.tournaments ?? []))
      .catch(() => {});
  }, [user]);

  const uploadPhoto = async (file: File): Promise<string> => {
    const token = localStorage.getItem(FISHMB_TOKEN_KEY);
    const form = new FormData();
    form.append("file", await compressImage(file));
    const upRes = await fetch("/api/fish/photos/upload", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const up = await upRes.json();
    if (!upRes.ok) throw new Error(up.error || "Photo upload failed.");
    return up.url as string;
  };

  const post = async () => {
    if (!user) {
      openLogin();
      return;
    }
    if (!draft.trim() || posting) return;
    setPosting(true);
    setCatchNote(null);
    try {
      const urls: string[] = [];
      for (const f of postPhotos.slice(0, 4)) {
        urls.push(await uploadPhoto(f));
      }
      const d = await fishFetch("/api/fishmb/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: draft.trim(),
          photo_url: urls[0] ?? null,
          photos: urls,
          visibility: visibility === "private" ? "public" : visibility,
        }),
      });
      setItems([d.item, ...items]);
      setDraft("");
      setPostPhotos([]);
      setComposerOpen(false);
    } catch (e) {
      setCatchNote(e instanceof Error ? e.message : "Could not post.");
    } finally {
      setPosting(false);
    }
  };

  const logCatch = async () => {
    if (!user) {
      openLogin();
      return;
    }
    if (posting) return;
    const lengthIn = parseFloat(catchLength);
    if (!catchSpecies.trim()) {
      setCatchNote("What species was it?");
      return;
    }
    if (!Number.isFinite(lengthIn) || lengthIn <= 0) {
      setCatchNote("Enter the length in inches.");
      return;
    }
    if (catchPhotos.length === 0) {
      setCatchNote("Add a photo of your catch.");
      return;
    }
    setPosting(true);
    setCatchNote(null);
    try {
      const urls: string[] = [];
      for (const f of catchPhotos.slice(0, 4)) {
        urls.push(await uploadPhoto(f));
      }
      const photoUrl = urls[0];
      await fishFetch("/api/fish/catches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          species: catchSpecies.trim(),
          length_in: lengthIn,
          photo_measure_url: photoUrl,
          photo_hold_url: photoUrl,
          photos: urls,
          visibility,
          note: draft.trim() || null,
        }),
      });
      if (tournamentId) {
        await fishFetch(`/api/fishmb/tournaments/${tournamentId}/entries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photo_url: photoUrl,
            photo_urls: urls,
            species: catchSpecies.trim(),
            length_inches: lengthIn,
            notes: draft.trim(),
            captured_at: new Date().toISOString(),
          }),
        });
        setCatchNote("Catch logged — and sent to your tournament for review! 🎣");
      } else {
        setCatchNote("Catch logged! 🎣");
      }
      setCatchSpecies("");
      setCatchLength("");
      setDraft("");
      setPhoto(null);
      setTournamentId("");
      setComposerOpen(false);
      load();
    } catch (e) {
      setCatchNote(e instanceof Error ? e.message : "Could not log the catch.");
    } finally {
      setPosting(false);
    }
  };

  const toggleComments = (id: string) => {
    const next = new Set(openComments);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpenComments(next);
  };


  return (
    <div className="max-w-2xl mx-auto px-4 pt-10 md:pt-14 pb-32">
      <p className="text-signal font-bold uppercase tracking-[0.28em] text-sm mb-3">Community</p>
      <h1 className="font-display font-bold uppercase text-pine text-4xl md:text-5xl tracking-wide mb-2">
        The feed
      </h1>
      <p className="text-pine/60 mb-8">
        Catches and discussions from Manitoba anglers — the same feed as the FishMB app.
      </p>

      {/* Composer — collapsed until tapped */}
      <div className="bg-white border border-pine/10 rounded-3xl p-5 mb-6">
        {user ? (
          composerOpen ? (
          <>
            <div className="flex gap-2 mb-4 items-center">
              {(
                [
                  ["post", "Share a post"],
                  ["catch", "🐟 Log a catch"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => {
                    setMode(v);
                    setCatchNote(null);
                  }}
                  className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
                    mode === v ? "bg-pine text-white" : "bg-pine/5 text-pine/60 hover:bg-pine/10"
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => setComposerOpen(false)}
                aria-label="Close composer"
                className="ml-auto text-pine/40 hover:text-pine font-bold text-lg leading-none px-2"
              >
                ✕
              </button>
            </div>

            {mode === "post" ? (
              <>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  placeholder="How's the bite? Share a report…"
                  className="w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-sm placeholder:text-pine/40 focus:outline-none focus:border-signal resize-none"
                />
                {postPhotos.length > 0 && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {postPhotos.map((f, i) => (
                      <span
                        key={i}
                        className="relative text-xs font-bold text-pine/70 bg-pine/5 rounded-full pl-3 pr-2 py-1.5"
                      >
                        📷 {f.name.slice(0, 20)}
                        <button
                          onClick={() => setPostPhotos(postPhotos.filter((_, j) => j !== i))}
                          aria-label={`Remove ${f.name}`}
                          className="ml-1.5 text-pine/50 hover:text-signal-dark font-bold"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
                  <label className="text-sm font-bold text-signal-dark cursor-pointer">
                    {postPhotos.length > 0
                      ? `📷 ${postPhotos.length}/4 photos`
                      : "📷 Add photos (up to 4)"}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const picked = Array.from(e.target.files ?? []).slice(0, 4 - postPhotos.length);
                        if (picked.length) setPostPhotos([...postPhotos, ...picked].slice(0, 4));
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={visibility === "private" ? "public" : visibility}
                      onChange={(e) => setVisibility(e.target.value as "public" | "friends")}
                      className="bg-paper-deep border border-pine/15 rounded-full px-3 py-2 text-xs font-bold text-pine focus:outline-none"
                      aria-label="Who can see this"
                    >
                      <option value="public">🌍 Everyone</option>
                      <option value="friends">👥 Friends only</option>
                    </select>
                    <button
                      onClick={post}
                      disabled={posting || !draft.trim()}
                      className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-xs px-6 py-2.5 rounded-full disabled:opacity-40 transition-colors"
                    >
                      {posting ? "Posting…" : "Post"}
                    </button>
                  </div>
                </div>
                {catchNote && <p className="text-sm text-signal-dark mt-3">{catchNote}</p>}
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={catchSpecies}
                    onChange={(e) => setCatchSpecies(e.target.value)}
                    placeholder="Species * (e.g. Walleye)"
                    className="bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-sm placeholder:text-pine/40 focus:outline-none focus:border-signal"
                  />
                  <input
                    value={catchLength}
                    onChange={(e) => setCatchLength(e.target.value.replace(/[^0-9.]/g, ""))}
                    inputMode="decimal"
                    placeholder="Length (in) *"
                    className="bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-sm placeholder:text-pine/40 focus:outline-none focus:border-signal"
                  />
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  placeholder="Notes — where, how, on what…"
                  className="w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-sm placeholder:text-pine/40 focus:outline-none focus:border-signal resize-none mt-3"
                />
                <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
                  <label className="text-sm font-bold text-signal-dark cursor-pointer">
                    {photo ? `📷 ${photo.name.slice(0, 24)}` : "📷 Add photo *"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                    />
                  </label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as "public" | "friends" | "private")}
                    className="bg-paper-deep border border-pine/15 rounded-full px-3 py-2 text-xs font-bold text-pine focus:outline-none"
                    aria-label="Who can see this"
                  >
                    <option value="public">🌍 Everyone</option>
                    <option value="friends">👥 Friends only</option>
                    <option value="private">🔒 Only me</option>
                  </select>
                </div>
                {myTournaments.length > 0 && (
                  <div className="mt-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-pine/55">
                      Also enter in tournament
                    </label>
                    <select
                      value={tournamentId}
                      onChange={(e) => setTournamentId(e.target.value)}
                      className="w-full mt-1 bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-sm text-pine focus:outline-none focus:border-signal"
                    >
                      <option value="">Just the feed — no tournament</option>
                      {myTournaments.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  onClick={logCatch}
                  disabled={posting}
                  className="w-full mt-4 bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-3.5 rounded-full disabled:opacity-40 transition-colors"
                >
                  {posting ? "Logging…" : "Log catch"}
                </button>
                {catchNote && <p className="text-sm text-pine mt-3">{catchNote}</p>}
              </>
            )}
          </>
          ) : (
            <button
              onClick={() => setComposerOpen(true)}
              className="w-full flex items-center gap-3 text-left"
            >
              {user.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar_url} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <span className="w-10 h-10 rounded-full bg-pine/10 flex items-center justify-center font-bold text-pine">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="flex-1 bg-paper-deep border border-pine/10 rounded-full px-4 py-3 text-sm text-pine/40">
                Share a report or log a catch…
              </span>
            </button>
          )
        ) : (
          <div className="text-center py-2">
            <p className="text-pine/60 text-sm mb-4">
              Log in to join the discussion and share your catches.
            </p>
            <button
              onClick={openLogin}
              className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-7 py-3 rounded-full transition-colors"
            >
              Log in
            </button>
          </div>
        )}
      </div>

      {user ? (
        <div className="flex items-center justify-center mb-6">
          {friends.length > 0 ? (
            <div className="flex -space-x-2">
              {friends.slice(0, 8).map((f) => (
                <Link key={f.id} href={`/fishmb/anglers/${f.id}`} title={f.name}>
                  {f.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={f.avatar_url}
                      alt={f.name}
                      className="w-9 h-9 rounded-full object-cover border-2 border-paper"
                    />
                  ) : (
                    <span className="w-9 h-9 rounded-full bg-pine/10 border-2 border-paper flex items-center justify-center font-bold text-pine text-sm">
                      {f.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </Link>
              ))}
              <Link
                href="/fishmb/friends"
                aria-label="Add friends"
                title="Add friends"
                className="w-9 h-9 rounded-full bg-signal text-white border-2 border-paper flex items-center justify-center font-bold text-lg leading-none"
              >
                +
              </Link>
            </div>
          ) : (
            <Link
              href="/fishmb/friends"
              className="text-xs font-bold uppercase tracking-wider text-signal-dark border border-signal/40 rounded-full px-4 py-2"
            >
              + Find friends
            </Link>
          )}
        </div>
      ) : null}

      {/* Tabs */}
      <form onSubmit={runSearch} className="flex gap-2 mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the feed…"
          className="flex-1 bg-white border border-pine/15 rounded-full px-4 py-2.5 text-sm text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal"
        />
        <button
          type="submit"
          className="bg-pine text-white text-xs font-bold uppercase tracking-wider px-5 rounded-full"
        >
          Search
        </button>
      </form>
      {activeQ && (
        <div className="flex items-center gap-2 mb-4">
          <p className="text-sm text-pine/60">
            Results for <span className="font-bold text-pine">“{activeQ}”</span>
          </p>
          <button
            onClick={clearSearch}
            className="text-xs font-bold text-signal-dark hover:underline"
          >
            Clear ✕
          </button>
        </div>
      )}
      {/* Bottom tab bar — fixed, like the FishMB app. Top filter row removed. */}

      {/* Items */}
      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white border border-pine/10 rounded-3xl p-5 h-40 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-pine/55 text-center py-10">
          {activeQ ? `No posts match “${activeQ}”.` : "Nothing here yet — be the first to post."}
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((item, idx) => (
            <Fragment key={item.id}>
            <article className="bg-white border border-pine/10 rounded-3xl p-5 max-sm:-mx-4 max-sm:rounded-none max-sm:border-x-0">
              <div className="flex items-center gap-3 mb-3">
                <Avatar name={item.user_name} url={item.avatar_url} />
                <div>
                  <Link href={`/fishmb/anglers/${item.user_id}`} className="font-bold text-pine text-sm hover:text-signal-dark">
                    {item.user_name}
                  </Link>
                  <p className="text-xs text-pine/45">
                    {timeAgo(item.created_at)} ·{" "}
                    {item.kind === "catch"
                      ? "logged a catch"
                      : item.kind === "tip"
                        ? `💡 added a tip${item.species_tag ? ` for ${item.species_tag}` : ""}`
                        : "posted"}
                    {item.visibility === "friends" && " · 👥 friends only"}
                  </p>
                </div>
                {item.kind === "catch" && (
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-wider bg-accentTeal/15 text-accentTeal px-3 py-1 rounded-full">
                    Catch
                  </span>
                )}
              </div>
              {item.species && (
                <p className="font-bold text-pine mb-1">
                  {item.species}
                  {item.length_in ? ` · ${Number(item.length_in).toFixed(1)}″` : ""}
                </p>
              )}
              {item.body && <p className="text-pine/80 text-sm whitespace-pre-line">{item.body}</p>}
              <PhotoCarousel photos={cardPhotos(item)} />
              <div className="mt-3 flex items-center justify-between">
                <Reactions item={item} onReacted={handleReacted} />
                <button
                  onClick={() => toggleComments(item.id)}
                  className="text-xs font-bold uppercase tracking-wider text-pine/50 hover:text-signal-dark"
                >
                  💬 {item.comment_count} {item.comment_count === 1 ? "comment" : "comments"}
                </button>
              </div>
              {openComments.has(item.id) && <Comments postId={item.id} />}
            </article>
            {/* Interleave a sponsored ad after every 8th post */}
            {feedAds.length > 0 && (idx + 1) % 8 === 0 && (
              <FeedAdCard ad={feedAds[Math.floor((idx + 1) / 8 - 1) % feedAds.length]} />
            )}
            </Fragment>
          ))}
        </div>
      )}

      {/* Infinite-scroll sentinel */}
      {!loading && items.length > 0 && (
        <div ref={sentinelRef} className="py-6 text-center min-h-[4rem]">
          {loadingMore && (
            <div className="flex items-center justify-center gap-2 text-pine/50 text-sm">
              <span className="w-5 h-5 border-2 border-pine/20 border-t-pine rounded-full animate-spin" />
              Loading more…
            </div>
          )}
          {!loadingMore && !hasMore && (
            <p className="text-pine/45 text-sm">You&apos;re all caught up 🎣</p>
          )}
        </div>
      )}

      {/* Floating bottom bar — white pill, icons only */}
      <nav
        aria-label="Feed sections"
        className="fixed z-40 left-1/2 -translate-x-1/2"
        style={{ bottom: "calc(0.9rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-1 bg-white/95 backdrop-blur rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.18)] border border-black/5 px-3 py-2">
          {(
            [
              ["all", "Home", "M4 11.5 12 4l8 7.5M6.5 10v9.5h11V10"],
              ["catch", "Fish", "M6.5 12c2.5-3.5 6-5.5 10-5.5 0 0-1.5 2.5-1.5 5.5S16.5 17.5 16.5 17.5c-4 0-7.5-2-10-5.5ZM6.5 12 3.5 9.5v5L6.5 12Zm13 0h.01"],
              ["post", "Posts", "M4 6.5h16v10H9l-5 4v-4H4v-10Z"],
            ] as const
          ).map(([v, label, d]) => (
            <button
              key={v}
              onClick={() => selectTab(v)}
              aria-label={label}
              className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors ${
                tab === v ? "bg-pine/10 text-pine" : "text-pine/45 hover:text-pine"
              }`}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={d} />
              </svg>
            </button>
          ))}
          <Link
            href="/fishmb/search"
            aria-label="Search"
            className="w-12 h-12 flex items-center justify-center rounded-full text-pine/45 hover:text-pine transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </Link>
          <Link
            href="/fishmb/profile"
            aria-label="Profile"
            className="relative w-12 h-12 flex items-center justify-center rounded-full text-pine/45 hover:text-pine transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4.5 20.5c1.5-3.5 4.5-5 7.5-5s6 1.5 7.5 5" />
            </svg>
            {!user && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-signal rounded-full" />}
          </Link>
        </div>
      </nav>
    </div>
  );
}
