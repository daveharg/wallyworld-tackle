"use client";

import { useCallback, useEffect, useRef, useState, Fragment, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useFishAuth } from "../_components/FishAuth";
import { fishFetch } from "../_components/fishFetch";
import { compressImage } from "../_components/compressImage";
import { FISHMB_TOKEN_KEY } from "@/lib/fishmb-constants";
import MuxPlayer from "@mux/mux-player-react";
import YouTubeEmbed, { extractYouTubeId } from "../_components/YouTubeEmbed";
import { TournamentBuilder } from "../tournaments/_components/TournamentBuilder";
import { JoinByCode } from "../tournaments/_components/JoinByCode";

/** Tournament tab inside the + composer: build one here or join with a code. */
/** Bottom sheet for the + composer: swipe down to dismiss, no X button. */
function ComposerSheet({
  mode,
  setMode,
  setCatchNote,
  closeComposer,
  children,
}: {
  mode: "post" | "catch" | "tournament";
  setMode: (m: "post" | "catch" | "tournament") => void;
  setCatchNote: (s: string | null) => void;
  closeComposer: () => void;
  children: React.ReactNode;
}) {
  const startY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const onTouchStart = (e: React.TouchEvent) => {
    // Only start a dismiss-drag from the top handle area, not from scrollable content.
    const target = e.target as HTMLElement;
    if (!target.closest("[data-sheet-handle]")) return;
    startY.current = e.touches[0].clientY;
    setDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setDragY(dy);
  };
  const onTouchEnd = () => {
    if (startY.current === null) return;
    if (dragY > 120) closeComposer();
    startY.current = null;
    setDragging(false);
    setDragY(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-pine-deep/60" onClick={closeComposer} />
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: dragging ? "none" : "transform 0.2s ease-out",
        }}
        className={`relative bg-white w-full rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto ${
          mode === "tournament" ? "sm:max-w-3xl" : "sm:max-w-lg"
        }`}
      >
        {/* Drag handle — swipe down here to dismiss */}
        <div data-sheet-handle className="sticky top-0 bg-white pt-3 pb-1 px-5 cursor-grab touch-none">
          <div className="w-10 h-1.5 bg-pine/20 rounded-full mx-auto mb-3" />
          <div className="flex gap-2">
            {(
              [
                ["post", "Share a post"],
                ["catch", "🐟 Log a catch"],
                ["tournament", "🏆 Tournament"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => {
                  setMode(v);
                  setCatchNote(null);
                }}
                className={`flex-1 px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
                  mode === v ? "bg-pine text-white" : "bg-pine/5 text-pine/60 hover:bg-pine/10"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-5 pt-4">{children}</div>
      </div>
    </div>
  );
}

function TournamentPanel() {
  const [sub, setSub] = useState<"build" | "join">("join");
  const [lakes, setLakes] = useState<{ id: string; name: string; region: string }[]>([]);
  useEffect(() => {
    let stop = false;
    fishFetch("/api/fishmb/lakes/options")
      .then((d) => {
        if (!stop) setLakes((d as { lakes?: { id: string; name: string; region: string }[] }).lakes ?? []);
      })
      .catch(() => {});
    return () => {
      stop = true;
    };
  }, []);
  return (
    <div>
      <div className="flex gap-2 mb-5">
        {(
          [
            ["build", "🏆 Build a tournament"],
            ["join", "🔑 Join with a code"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setSub(v)}
            className={`flex-1 px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-colors ${
              sub === v ? "bg-gold text-pine-deep" : "bg-pine/5 text-pine/60 hover:bg-pine/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {sub === "build" ? (
        <TournamentBuilder lakes={lakes} />
      ) : (
        <div className="py-4">
          <p className="text-sm text-pine/65 mb-4">
            Got an invite code from an organizer? Enter it to join their
            tournament.
          </p>
          <JoinByCode />
          <Link
            href="/fishmb/tournaments"
            className="block text-center mt-5 text-sm font-bold uppercase tracking-wider text-signal-dark hover:underline"
          >
            🏆 Browse all tournaments →
          </Link>
        </div>
      )}
    </div>
  );
}

interface FeedItem {
  id: string;
  kind: "catch" | "post" | "tip";
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  body: string | null;
  photo_url: string | null;
  photos: string[];
  video?: { playback_id: string; duration: number | null } | null;
  spot_share?: { name: string; lat: number; lng: number; notes: string; icon: string } | null;
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
  user_id?: string;
  user_name: string;
  avatar_url: string | null;
  body: string;
  parent_id: string | null;
  like_count: number;
  dislike_count: number;
  viewer_reaction: 1 | -1 | null;
  created_at: string;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Render URLs in post text as clickable links. */
function linkify(text: string): React.ReactNode[] {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target={part.includes("wallyworldtackle.ca") || part.includes("fishmb.ca") ? undefined : "_blank"}
        rel="noopener"
        className="text-signal-dark font-bold hover:underline break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {part.replace(/^https?:\/\/(www\.)?/, "")}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function Avatar({ name, url, small }: { name: string; url: string | null; small?: boolean }) {
  const cls = small ? "w-9 h-9" : "w-10 h-10";
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={`${cls} rounded-full object-cover ring-2 ring-white/70`} />;
  }
  return (
    <span className={`${cls} rounded-full bg-signal text-white flex items-center justify-center font-bold ring-2 ring-white/70`}>
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
/** First-party feature promos shown to new (signed-out) visitors, interleaved in the feed. */
const FEATURE_PROMOS = [
  {
    img: "/fishmb/promos/tournaments.jpg",
    badge: "🏆 Tournaments",
    title: "Run your own fishing tournament",
    body: "Challenge your friends to a month-long walleye showdown. Invite codes, live leaderboard, GPS-verified catches — FishMB never touches the money.",
    cta: "Start a tournament",
    href: "/fishmb/tournaments",
  },
  {
    img: "/fishmb/promos/maps.jpg",
    badge: "🗺️ My Maps",
    title: "Your secret spots, on your private map",
    body: "Mark honey holes with a long-press, keep lake notes on depths and patterns, and flip to depth contours when they land. Only you can see them.",
    cta: "Explore my maps",
    href: "/fishmb/maps",
  },
  {
    img: "/fishmb/promos/messaging.jpg",
    badge: "🔒 Encrypted messaging",
    title: "Chat with your fishing friends — privately",
    body: "End-to-end encrypted 1:1 and group chats. Plan the trip, share the photos, keep the spots secret. Not even FishMB can read them.",
    cta: "Start chatting",
    href: "/fishmb/messages",
  },
  {
    img: "/fishmb/promos/weather.jpg",
    badge: "🌦️ AI fish forecast",
    title: "Is the weather in your favour?",
    body: "Barometric pressure gauge with the ideal bite range, wind, cloud cover and storm-front tracking — plus a live wind map. Know before you go.",
    cta: "Check the forecast",
    href: "/fishmb/weather",
  },
];

function FeaturePromoCard({ promo }: { promo: (typeof FEATURE_PROMOS)[number] }) {
  return (
    <article className="bg-white border border-pine/10 rounded-3xl overflow-hidden max-sm:-mx-4 max-sm:rounded-none max-sm:border-x-0">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={promo.img} alt={promo.title} loading="lazy" className="w-full max-h-72 object-cover" />
        <span className="absolute top-3 left-3 text-[10px] font-black uppercase tracking-[0.18em] bg-black/55 text-white px-3 py-1.5 rounded-full">
          ✨ {promo.badge}
        </span>
      </div>
      <div className="p-5">
        <p className="font-black text-pine text-lg leading-snug">{promo.title}</p>
        <p className="text-pine/70 text-sm mt-1.5 leading-relaxed">{promo.body}</p>
        <Link
          href={promo.href}
          className="inline-block mt-4 bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-xs px-6 py-3 rounded-full transition-colors"
        >
          {promo.cta} →
        </Link>
      </div>
    </article>
  );
}

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

/** Mux-hosted video attached to a post (converted to universal HLS by Mux). */
function FeedVideo({ playbackId }: { playbackId: string }) {
  return (
    <div className="w-full bg-black">
      <MuxPlayer
        playbackId={playbackId}
        className="w-full aspect-video"
        accentColor="#2f6b3a"
      />
    </div>
  );
}

/** A fishing spot shared to the feed — view it on the map or save a copy. */
function SpotShareCard({
  spot,
  own,
}: {
  spot: { name: string; lat: number; lng: number; notes: string; icon: string };
  own: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveSpot = async () => {
    if (saving || saved) return;
    setSaving(true);
    setSaveError(null);
    try {
      const d = await fishFetch("/api/fishmb/spots", {
        method: "POST",
        body: JSON.stringify({
          name: spot.name,
          lat: spot.lat,
          lng: spot.lng,
          notes: spot.notes || null,
          icon: spot.icon,
        }),
      });
      if (d?.spot) setSaved(true);
      else setSaveError("Couldn't save that spot — try again.");
    } catch {
      setSaveError("Couldn't save that spot — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };
  const mapHref = `/fishmb/maps?spot=${spot.lat.toFixed(5)},${spot.lng.toFixed(5)}&name=${encodeURIComponent(spot.name)}`;
  return (
    <div className="mt-3 -mx-5 bg-pine/[0.04] border-y border-pine/10 px-5 py-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">📍</span>
        <p className="font-bold text-pine truncate">{spot.name}</p>
      </div>
      {spot.notes ? (
        <p className="text-pine/70 text-sm mb-3">{spot.notes}</p>
      ) : null}
      <p className="text-xs text-pine/45 tabular-nums mb-3">
        {spot.lat.toFixed(5)}, {spot.lng.toFixed(5)}
      </p>
      <div className="flex gap-2">
        <Link
          href={mapHref}
          className="flex-1 text-center bg-pine text-white font-bold uppercase tracking-wider text-xs px-4 py-3 rounded-2xl"
        >
          🗺️ View on map
        </Link>
        {!own && (
          <button
            type="button"
            onClick={saveSpot}
            disabled={saving || saved}
            className="flex-1 bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-xs px-4 py-3 rounded-2xl disabled:opacity-60 transition-colors"
          >
            {saved ? "✓ Saved!" : saving ? "Saving…" : "💾 Save spot"}
          </button>
        )}
      </div>
      {saveError && <p className="text-xs text-red-600 mt-2">{saveError}</p>}
    </div>
  );
}

/** What signed-out visitors see instead of the feed — the pitch, not the posts. */
function FeedSignupWall({ onJoin }: { onJoin: () => void }) {
  const perks = [
    {
      icon: "🐟",
      title: "Log every catch",
      text: "Species, length, weight, photo and GPS spot — kept in your personal catch history with running stats and personal bests.",
    },
    {
      icon: "📸",
      title: "Posts, photos & video",
      text: "Share up to 4 photos per post or a 60-second video, get reactions and comments from Manitoba anglers.",
    },
    {
      icon: "🏆",
      title: "Real tournaments",
      text: "Create catch-photo-release tournaments with invite codes and live leaderboards, or join ones running right now.",
    },
    {
      icon: "🗺️",
      title: "Private maps & spots",
      text: "Save your secret spots on the map with lake contours. They stay private unless you share them with friends.",
    },
    {
      icon: "💬",
      title: "Encrypted messaging",
      text: "One-on-one and group chats with photo and spot sharing. End-to-end encrypted — only you and your crew can read them.",
    },
    {
      icon: "🌤️",
      title: "AI fish-activity forecast",
      text: "Live conditions, wind and pressure trends, with AI predicting how active the fish are on Manitoba lakes — so you fish when they're biting.",
    },
  ];
  return (
    <div className="text-center pt-10 pb-16 px-2">
      <div className="text-6xl mb-4">🎣</div>
      <h1 className="text-2xl font-black text-pine tracking-tight mb-2">
        The bite is happening in here.
      </h1>
      <p className="text-pine/60 text-sm max-w-xs mx-auto mb-6">
        Manitoba anglers are sharing catches, reports and tips right now. Join
        free to see the community feed.
      </p>
      <button
        onClick={onJoin}
        className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-10 py-4 rounded-full transition-colors mb-8"
      >
        Join FishMB — it's free
      </button>
      <div className="flex flex-col gap-3 max-w-md mx-auto text-left">
        {perks.map((p) => (
          <div
            key={p.title}
            className="bg-white border border-pine/10 rounded-2xl px-4 py-3.5 flex items-start gap-3"
          >
            <span className="text-2xl shrink-0">{p.icon}</span>
            <span>
              <span className="block text-sm font-black text-pine">{p.title}</span>
              <span className="block text-xs text-pine/65 leading-snug mt-0.5">{p.text}</span>
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-pine/40 mt-6">Anglers 13+ only.</p>
    </div>
  );
}

/** Photos for a card: all attached photos, falling back to the legacy single photo_url. */
function cardPhotos(item: FeedItem): string[] {
  if (item.photos && item.photos.length > 0) return item.photos;
  return item.photo_url ? [item.photo_url] : [];
}

function PhotoCarousel({ photos, bare }: { photos: string[]; bare?: boolean }) {
  const [idx, setIdx] = useState(0);
  if (photos.length === 0) return null;
  const go = (d: number) => setIdx((i) => (i + d + photos.length) % photos.length);
  return (
    <div className={bare ? "relative bg-pine-deep/10" : "mt-3 rounded-2xl overflow-hidden bg-pine-deep/10 relative max-sm:-mx-5 max-sm:rounded-none"}>
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
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
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

  const sendReply = async (parentId: string) => {
    if (!user) {
      openLogin();
      return;
    }
    if (!replyDraft.trim() || replyBusy) return;
    setReplyBusy(true);
    try {
      const d = await fishFetch(`/api/fishmb/feed/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyDraft.trim(), parent_id: parentId }),
      });
      setComments([...comments, d.comment]);
      setReplyDraft("");
      setReplyTo(null);
    } catch {
      // non-fatal
    } finally {
      setReplyBusy(false);
    }
  };

  const react = async (commentId: string, value: 1 | -1) => {
    if (!user) {
      openLogin();
      return;
    }
    const c = comments.find((x) => x.id === commentId);
    if (!c) return;
    // Tapping the active reaction removes it (toggle).
    const next = c.viewer_reaction === value ? null : value;
    // Optimistic update.
    setComments(
      comments.map((x) =>
        x.id === commentId
          ? {
              ...x,
              viewer_reaction: next,
              like_count: x.like_count + (next === 1 ? 1 : 0) - (x.viewer_reaction === 1 ? 1 : 0),
              dislike_count: x.dislike_count + (next === -1 ? 1 : 0) - (x.viewer_reaction === -1 ? 1 : 0),
            }
          : x
      )
    );
    try {
      const d = await fishFetch(`/api/fishmb/feed/${postId}/comments/${commentId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: next }),
      });
      setComments(
        comments.map((x) =>
          x.id === commentId
            ? { ...x, like_count: d.like_count, dislike_count: d.dislike_count, viewer_reaction: d.viewer_reaction }
            : x
        )
      );
    } catch {
      // Revert on failure.
      setComments(comments);
    }
  };

  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);

  const renderComment = (c: FeedComment, nested: boolean) => (
    <div key={c.id} className={nested ? "ml-10" : ""}>
      <div className="flex gap-2.5">
        <Avatar name={c.user_name} url={c.avatar_url} />
        <div className="bg-paper-deep rounded-2xl px-3.5 py-2.5 flex-1 min-w-0">
          <p className="text-xs font-bold text-pine">
            {c.user_id ? (
              <Link href={`/fishmb/anglers/${c.user_id}`} className="hover:text-signal-dark">
                {c.user_name}
              </Link>
            ) : (
              c.user_name
            )}{" "}
            <span className="font-normal text-pine/45">· {timeAgo(c.created_at)}</span>
          </p>
          <p className="text-sm text-pine/80 mt-0.5">{c.body}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <button
              onClick={() => react(c.id, 1)}
              aria-label="Like comment"
              className={`flex items-center gap-1 text-xs font-bold transition-colors ${
                c.viewer_reaction === 1 ? "text-signal" : "text-pine/40 hover:text-pine"
              }`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill={c.viewer_reaction === 1 ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 10v12" />
                <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
              </svg>
              {c.like_count > 0 && <span>{c.like_count}</span>}
            </button>
            <button
              onClick={() => react(c.id, -1)}
              aria-label="Dislike comment"
              className={`flex items-center gap-1 text-xs font-bold transition-colors ${
                c.viewer_reaction === -1 ? "text-signal" : "text-pine/40 hover:text-pine"
              }`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill={c.viewer_reaction === -1 ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 14V2" />
                <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
              </svg>
              {c.dislike_count > 0 && <span>{c.dislike_count}</span>}
            </button>
            {!nested && (
              <button
                onClick={() => {
                  if (!user) {
                    openLogin();
                    return;
                  }
                  setReplyTo(replyTo === c.id ? null : c.id);
                  setReplyDraft("");
                }}
                className="text-xs font-bold text-pine/40 hover:text-pine transition-colors"
              >
                Reply
              </button>
            )}
          </div>
        </div>
      </div>
      {!nested && replyTo === c.id && (
        <div className="flex gap-2 ml-10 mt-2">
          <input
            value={replyDraft}
            onChange={(e) => setReplyDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendReply(c.id)}
            placeholder={`Reply to ${c.user_name}…`}
            autoFocus
            className="flex-1 bg-paper-deep border border-pine/15 rounded-full px-4 py-2 text-sm text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal"
          />
          <button
            onClick={() => sendReply(c.id)}
            disabled={replyBusy}
            className="bg-pine text-white text-xs font-bold uppercase tracking-wider px-4 rounded-full disabled:opacity-50"
          >
            Send
          </button>
        </div>
      )}
      {!nested && repliesOf(c.id).map((r) => renderComment(r, true))}
    </div>
  );

  return (
    <div className="mt-3 pt-3 border-t border-pine/10 space-y-3">
      {topLevel.map((c) => renderComment(c, false))}
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

function FeedPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading, openLogin } = useFishAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [tab, setTab] = useState<"all" | "catch" | "post">("all");
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const [activeQ, setActiveQ] = useState("");
  const [mode, setMode] = useState<"post" | "catch" | "tournament">("post");
  const [draft, setDraft] = useState("");
  const [catchPhotos, setCatchPhotos] = useState<File[]>([]);
  const [postPhotos, setPostPhotos] = useState<File[]>([]);
  // Optional one video per post (60s max) — uploads straight to Mux.
  const [postVideo, setPostVideo] = useState<File | null>(null);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [videoPhase, setVideoPhase] = useState<"idle" | "uploading" | "processing" | "ready" | "error">("idle");
  const [videoPlayback, setVideoPlayback] = useState<{ playback_id: string; duration: number | null } | null>(null);
  const [videoErr, setVideoErr] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [visibility, setVisibility] = useState<"public" | "friends" | "private">("public");
  const [catchSpecies, setCatchSpecies] = useState("");
  const [catchLength, setCatchLength] = useState("");
  const [catchLat, setCatchLat] = useState<number | null>(null);
  const [catchLng, setCatchLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [myTournaments, setMyTournaments] = useState<{ id: string; name: string }[]>([]);
  const [tournamentId, setTournamentId] = useState("");
  const [tournamentHelpOpen, setTournamentHelpOpen] = useState(false);
  const [catchNote, setCatchNote] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());

  const PAGE_SIZE = 20;
  // Refs mirror state so the IntersectionObserver callback never goes stale.
  const tabRef = useRef(tab);
  const friendsOnlyRef = useRef(friendsOnly);
  const activeQRef = useRef(activeQ);
  const itemsRef = useRef<FeedItem[]>([]);
  const nextCursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { tabRef.current = tab; }, [tab]);
  useEffect(() => { friendsOnlyRef.current = friendsOnly; }, [friendsOnly]);
  useEffect(() => { activeQRef.current = activeQ; }, [activeQ]);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const applyPage = useCallback((d: { items?: FeedItem[]; nextCursor?: string | null; hasMore?: boolean }) => {
    setItems(d.items ?? []);
    setNextCursor(d.nextCursor ?? null);
    setHasMore(!!d.hasMore);
    nextCursorRef.current = d.nextCursor ?? null;
    hasMoreRef.current = !!d.hasMore;
  }, []);

  const load = useCallback(async (query?: string, tabValue: "all" | "catch" | "post" = "all", friends = friendsOnlyRef.current) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), kind: tabValue });
      if (query && query.trim()) params.set("q", query.trim());
      if (friends) params.set("friends", "1");
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
      if (friendsOnlyRef.current) params.set("friends", "1");
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
    // The feed is members-only — no fetching until signed in.
    if (!user || user.is_anonymous) return;
    load();
  }, [load, user]);

  // Keep the feed section and composer in sync with the URL, so bottom-bar
  // taps work every time (even tapping the same button twice in a row).
  // ?log=catch → catch composer, ?compose=1 → post composer,
  // ?kind=catch → Catches, ?friends=1 → Friends.
  const lastActionRef = useRef<string | null>(null);
  useEffect(() => {
    const kind = searchParams.get("kind");
    const friends = searchParams.get("friends") === "1";
    const wantTab = kind === "catch" ? "catch" : "all";
    if (wantTab !== tabRef.current || friends !== friendsOnlyRef.current) {
      tabRef.current = wantTab;
      setTab(wantTab);
      friendsOnlyRef.current = friends;
      setFriendsOnly(friends);
      load(undefined, wantTab, friends);
    }
    const action =
      searchParams.get("log") === "catch" ? "log"
      : searchParams.get("compose") === "1" ? "compose"
      : null;
    const actionKey = action ? `${action}:${searchParams.toString()}` : null;
    if (action && lastActionRef.current !== actionKey) {
      lastActionRef.current = actionKey;
      if (!user) {
        openLogin();
      } else {
        setMode(action === "log" ? "catch" : "post");
        setComposerOpen(true);
      }
    }
    if (!action) lastActionRef.current = null;
  }, [searchParams, user, load]);

  // Closing the composer clears the action params so the next tap re-fires.
  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    const sp = new URLSearchParams(searchParams.toString());
    if (sp.has("compose") || sp.has("log")) {
      sp.delete("compose");
      sp.delete("log");
      const qs = sp.toString();
      router.replace(`/fishmb/feed${qs ? `?${qs}` : ""}`, { scroll: false });
    }
  }, [searchParams, router]);

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
    setFriendsOnly(false);
    friendsOnlyRef.current = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
    load(activeQRef.current || undefined, v, false);
  };

  const selectBuddies = () => {
    setTab("all");
    tabRef.current = "all";
    setFriendsOnly(true);
    friendsOnlyRef.current = true;
    window.scrollTo({ top: 0, behavior: "smooth" });
    load(activeQRef.current || undefined, "all", true);
  };

  const [feedAds, setFeedAds] = useState<
    { id: string; title: string; body: string; image_url: string | null; video_url: string | null; link_url: string | null; business_name: string | null }[]
  >([]);
  useEffect(() => {
    fetch("/api/fishmb/ads?slot=feed")
      .then((r) => r.json())
      .then((d) => setFeedAds(d.ads ?? []))
      .catch(() => {});
  }, []);

  const runSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = q.trim();
    setActiveQ(trimmed);
    activeQRef.current = trimmed;
    // Bottom-bar search always spans every post type, not just the current tab.
    setTab("all");
    tabRef.current = "all";
    setFriendsOnly(false);
    friendsOnlyRef.current = false;
    load(trimmed || undefined, "all", false);
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

  const uploadVideoFile = async (file: File): Promise<void> => {
    setVideoErr(null);
    setVideoPhase("uploading");
    setVideoProgress(0);
    setVideoPlayback(null);
    // If Mux reports the file arrived damaged (usually a cut-off upload),
    // retry once automatically with a fresh upload URL.
    let attempts = 0;
    while (attempts < 2) {
      attempts++;
      try {
        await uploadVideoAttempt(file);
        return;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Video upload failed.";
        const damaged = /not a valid video|damaged|corrupt/i.test(msg);
        if (damaged && attempts < 2) {
          setVideoProgress(0);
          continue;
        }
        setVideoPhase("error");
        setVideoErr(msg);
        return;
      }
    }
  };

  const uploadVideoAttempt = async (file: File): Promise<void> => {
    try {
      const { upload_id, upload_url } = (await fishFetch("/api/fish/video/upload-url", {
        method: "POST",
      })) as { upload_id: string; upload_url: string };
      // Read the whole file into memory first. On iOS, XHR can silently send
      // an empty body for photo-library videos; reading it here fails fast
      // with a clear error instead of uploading zero bytes.
      let payload: ArrayBuffer;
      try {
        payload = await file.arrayBuffer();
      } catch {
        throw new Error("Couldn't read that video file — try saving it to the Files app first, then upload it.");
      }
      if (!payload.byteLength) {
        throw new Error("That video file looks empty — try saving it to the Files app first, then upload it.");
      }
      let sentBytes = 0;
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", upload_url);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            sentBytes = e.loaded;
            setVideoProgress(e.loaded / e.total);
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            // Guard against the silent-empty-upload bug: the bytes actually
            // sent must match the file size.
            if (sentBytes > 0 && sentBytes < payload.byteLength * 0.99) {
              reject(new Error("Video upload was cut off — try again on Wi-Fi."));
              return;
            }
            resolve();
          } else {
            reject(new Error(`Video upload failed (network ${xhr.status}).`));
          }
        };
        xhr.onerror = () => reject(new Error("Video upload failed — check your connection and try again."));
        xhr.onabort = () => reject(new Error("Video upload was interrupted — try again."));
        xhr.ontimeout = () => reject(new Error("Video upload timed out — try again on Wi-Fi."));
        xhr.timeout = 10 * 60 * 1000;
        xhr.send(payload);
      });
      setVideoPhase("processing");
      // Poll Mux until the video is converted and playable.
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const s = (await fishFetch(
          `/api/fish/video/status?upload_id=${encodeURIComponent(upload_id)}`
        )) as { status: string; playback_id?: string; duration?: number | null; error?: string };
        if (s.status === "ready" && s.playback_id) {
          setVideoPlayback({ playback_id: s.playback_id, duration: s.duration ?? null });
          setVideoPhase("ready");
          return;
        }
        if (s.status === "errored")
          throw new Error(
            s.error
              ? `The video arrived damaged (${s.error}). Try again.`
              : "The video arrived damaged and couldn't be processed. Try again."
          );
      }
      throw new Error("Video is taking too long — try again.");
    } catch (e) {
      throw e;
    }
  };

  const pickVideo = async (file: File) => {
    setVideoErr(null);
    // 60-second cap, checked on-device before uploading.
    const duration: number = await new Promise<number>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(v.duration || 0);
      };
      v.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Couldn't read that video."));
      };
      v.src = url;
    }).catch((e) => {
      setVideoErr(e instanceof Error ? e.message : "Couldn't read that video.");
      return -1;
    });
    if (duration < 0) return;
    if (duration > 62) {
      setVideoErr("Videos are capped at 60 seconds — trim it down first.");
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      setVideoErr("That video is too big (200MB max).");
      return;
    }
    setPostVideo(file);
    uploadVideoFile(file);
  };

  const clearVideo = () => {
    setPostVideo(null);
    setVideoProgress(null);
    setVideoPhase("idle");
    setVideoPlayback(null);
    setVideoErr(null);
  };

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
          video: videoPhase === "ready" ? videoPlayback : null,
          visibility: visibility === "private" ? "public" : visibility,
        }),
      });
      setItems([d.item, ...items]);
      setDraft("");
      setPostPhotos([]);
      clearVideo();
      closeComposer();
    } catch (e) {
      setCatchNote(e instanceof Error ? e.message : "Could not post.");
    } finally {
      setPosting(false);
    }
  };

  const saveCatchLocation = () => {
    if (!("geolocation" in navigator)) {
      setCatchNote("Your device doesn't support location.");
      return;
    }
    setLocating(true);
    setCatchNote(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCatchLat(pos.coords.latitude);
        setCatchLng(pos.coords.longitude);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setCatchNote("Couldn't get your location — check permission.");
      },
      { timeout: 10000 }
    );
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
          lat: catchLat,
          lng: catchLng,
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
            latitude: catchLat,
            longitude: catchLng,
          }),
        });
        setCatchNote("Catch logged — and sent to your tournament for review! 🎣");
      } else {
        setCatchNote("Catch logged! 🎣");
      }
      setCatchSpecies("");
      setCatchLength("");
      setDraft("");
      setCatchPhotos([]);
      setTournamentId("");
      setCatchLat(null);
      setCatchLng(null);
      closeComposer();
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


  // Members-only feed: signed-out visitors (and guests) get the pitch, not the posts.
  if (!authLoading && (!user || user.is_anonymous)) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-4 md:pt-6 pb-32">
        <FeedSignupWall onJoin={openLogin} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 md:pt-6 pb-32">
      {/* Feed section header — tap the title to switch sections */}
      <div className="flex items-center justify-between mb-4">        <div className="relative">
          <button
            onClick={() => setSectionMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={sectionMenuOpen}
            className="flex items-center gap-1.5 text-xl font-black text-pine tracking-tight"
          >
            {friendsOnly ? (tab === "catch" ? "🎣 Friends Catches" : "👥 Friends") : tab === "catch" ? "🐟 Catches" : "🌊 Community"}
            <span className="text-pine/40 text-sm">▾</span>
          </button>
          {sectionMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSectionMenuOpen(false)} />
              <div role="menu" className="absolute z-50 mt-2 w-56 bg-white rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.18)] border border-pine/10 py-1.5">
                {(
                  [
                    ["community", "🌊 Community", "/fishmb/feed"],
                    ["buddies", "👥 Friends", "/fishmb/feed?friends=1"],
                    ["catches", "🐟 Catches", "/fishmb/feed?kind=catch"],
                    ["friendcatches", "🎣 Friends Catches", "/fishmb/feed?kind=catch&friends=1"],
                  ] as const
                ).map(([id, label, href]) => {
                  const current =
                    (id === "buddies" && friendsOnly && tab !== "catch") ||
                    (id === "friendcatches" && friendsOnly && tab === "catch") ||
                    (id === "catches" && tab === "catch" && !friendsOnly) ||
                    (id === "community" && tab !== "catch" && !friendsOnly);
                  return (
                    <button
                      key={id}
                      role="menuitem"
                      onClick={() => {
                        setSectionMenuOpen(false);
                        router.push(href);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3 text-sm font-bold ${
                        current ? "text-signal-dark" : "text-pine/70 hover:bg-pine/5"
                      }`}
                    >
                      {label}
                      {current && <span>✓</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <button
          onClick={() => setSearchOpen(true)}
          aria-label="Search the feed"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-pine/10 text-pine/60 hover:text-pine shadow-sm"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </button>
      </div>






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
          {items.map((item, idx) => {
            const photos = cardPhotos(item);
            const ytId = item.body ? extractYouTubeId(item.body) : null;
            const hasVideo = !!(item.video?.playback_id || ytId);
            const authorOverlay = (
              <>
                <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/65 to-transparent pointer-events-none" />
                <div className="absolute top-3 left-3 flex items-center gap-2.5">
                  <Avatar name={item.user_name} url={item.avatar_url} small />
                  <div className="leading-tight">
                    <Link href={`/fishmb/anglers/${item.user_id}`} className="block font-bold text-white text-sm drop-shadow-md">
                      {item.user_name}
                    </Link>
                    <p className="text-[11px] text-white/85 drop-shadow">
                      {timeAgo(item.created_at)}
                      {item.visibility === "friends" && " · 👥 friends"}
                    </p>
                  </div>
                </div>
                {item.kind === "catch" && (
                  <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider bg-black/55 text-white px-3 py-1 rounded-full">
                    🐟 Catch
                  </span>
                )}
              </>
            );
            return (
            <Fragment key={item.id}>
            <article className="bg-white border border-pine/10 rounded-3xl overflow-hidden max-sm:-mx-4 max-sm:rounded-none max-sm:border-x-0">
              {hasVideo ? (
                <div className="relative">
                  {item.video?.playback_id ? (
                    <FeedVideo playbackId={item.video.playback_id} />
                  ) : (
                    <YouTubeEmbed videoId={ytId!} />
                  )}
                  {authorOverlay}
                </div>
              ) : photos.length > 0 ? (
                <div className="relative">
                  <PhotoCarousel photos={photos} bare />
                  {authorOverlay}
                </div>
              ) : (
                <div className="flex items-center gap-3 px-5 pt-4">
                  <Avatar name={item.user_name} url={item.avatar_url} />
                  <div>
                    <Link href={`/fishmb/anglers/${item.user_id}`} className="font-bold text-pine text-sm hover:text-signal-dark">
                      {item.user_name}
                    </Link>
                    <p className="text-xs text-pine/45">
                      {timeAgo(item.created_at)}
                      {item.visibility === "friends" && " · 👥 friends only"}
                    </p>
                  </div>
                  {item.kind === "catch" && (
                    <span className="ml-auto text-[10px] font-bold uppercase tracking-wider bg-accentTeal/15 text-accentTeal px-3 py-1 rounded-full">
                      Catch
                    </span>
                  )}
                </div>
              )}
              <div className="px-5 py-4">
                {item.species && (
                  <p className="font-bold text-pine mb-1">
                    {item.species}
                    {item.length_in ? ` · ${Number(item.length_in).toFixed(1)}″` : ""}
                  </p>
                )}
                {item.body && (() => {
                  const text = ytId
                    ? item.body.replace(/https?:\/\/[^\s]+/g, "").replace(/\n{3,}/g, "\n\n").trim()
                    : item.body;
                  return (
                    <>
                      {text && <p className="text-pine/80 text-sm whitespace-pre-line">{linkify(text)}</p>}
                      {item.spot_share && (
                        <SpotShareCard
                          spot={item.spot_share}
                          own={user?.id === item.user_id}
                        />
                      )}
                    </>
                  );
                })()}
                <div className="mt-3 flex items-center justify-between">
                  <Reactions item={item} onReacted={handleReacted} />
                  <button
                    onClick={() => toggleComments(item.id)}
                    className="text-xs font-bold uppercase tracking-wider text-pine/50 hover:text-signal-dark"
                  >
                    💬 {item.comment_count} {item.comment_count === 1 ? "comment" : "comments"}
                  </button>
                </div>
              </div>
              {openComments.has(item.id) && (
                <div className="px-5 pb-4">
                  <Comments postId={item.id} />
                </div>
              )}
            </article>
            {/* Interleave a sponsored ad after every 8th post */}
            {feedAds.length > 0 && (idx + 1) % 8 === 0 && (
              <FeedAdCard ad={feedAds[Math.floor((idx + 1) / 8 - 1) % feedAds.length]} />
            )}
            {/* Feature promos for new visitors — after the 3rd, 6th, 9th and 12th posts */}
            {!user && (idx === 2 || idx === 5 || idx === 8 || idx === 11) && (
              <FeaturePromoCard promo={FEATURE_PROMOS[(idx - 2) / 3]} />
            )}
            </Fragment>
            );
          })}
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

      {/* Feed search overlay */}
      {searchOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-pine-deep/60" onClick={() => setSearchOpen(false)} />
          <div className="absolute inset-x-0 top-0 bg-paper border-b border-pine/10 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <form
              onSubmit={(e) => {
                runSearch(e);
                setSearchOpen(false);
              }}
              className="flex gap-2 max-w-2xl mx-auto"
            >
              <input
                autoFocus
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
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
                className="text-pine/50 hover:text-pine font-bold px-2"
              >
                ✕
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Composer modal */}
      {user && composerOpen && (
        <ComposerSheet mode={mode} setMode={setMode} setCatchNote={setCatchNote} closeComposer={closeComposer}>
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
                  <div className="flex items-center gap-3">
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
                    {!postVideo ? (
                      <label className="text-sm font-bold text-signal-dark cursor-pointer">
                        🎬 Add video (60s)
                        <input
                          type="file"
                          accept="video/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            if (f) pickVideo(f);
                          }}
                        />
                      </label>
                    ) : (
                      <span className="relative text-xs font-bold text-pine/70 bg-pine/5 rounded-full pl-3 pr-2 py-1.5">
                        🎬 {postVideo.name.slice(0, 18)}
                        {videoPhase === "uploading" && videoProgress !== null && (
                          <span className="text-pine/50"> · {Math.round(videoProgress * 100)}%</span>
                        )}
                        {videoPhase === "processing" && <span className="text-pine/50"> · processing…</span>}
                        {videoPhase === "ready" && <span className="text-green-700"> · ready ✓</span>}
                        {videoPhase === "error" && <span className="text-signal-dark"> · failed</span>}
                        <button
                          onClick={clearVideo}
                          aria-label="Remove video"
                          className="ml-1.5 text-pine/50 hover:text-signal-dark font-bold"
                        >
                          ✕
                        </button>
                      </span>
                    )}
                  </div>
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
                      disabled={posting || !draft.trim() || (postVideo !== null && videoPhase !== "ready")}
                      className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-xs px-6 py-2.5 rounded-full disabled:opacity-40 transition-colors"
                    >
                      {posting ? "Posting…" : videoPhase === "uploading" || videoPhase === "processing" ? "Waiting for video…" : "Post"}
                    </button>
                  </div>
                </div>
                {catchNote && <p className="text-sm text-signal-dark mt-3">{catchNote}</p>}
                {videoErr && <p className="text-sm text-signal-dark mt-3">{videoErr}</p>}
              </>
            ) : mode === "catch" ? (
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
                {catchPhotos.length > 0 && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {catchPhotos.map((f, i) => (
                      <span
                        key={i}
                        className="relative text-xs font-bold text-pine/70 bg-pine/5 rounded-full pl-3 pr-2 py-1.5"
                      >
                        📷 {f.name.slice(0, 20)}
                        <button
                          onClick={() => setCatchPhotos(catchPhotos.filter((_, j) => j !== i))}
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
                    {catchPhotos.length > 0
                      ? `📷 ${catchPhotos.length}/4 photos *`
                      : "📷 Add photos (up to 4) *"}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const picked = Array.from(e.target.files ?? []).slice(0, 4 - catchPhotos.length);
                        if (picked.length) setCatchPhotos([...catchPhotos, ...picked].slice(0, 4));
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={saveCatchLocation}
                    disabled={locating}
                    className="text-sm font-bold text-signal-dark disabled:opacity-50"
                  >
                    {locating ? "📍 Getting location…" : "📍 Save location"}
                  </button>
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
                {catchLat !== null && catchLng !== null && (
                  <div className="flex items-center justify-between mt-2 bg-pine/5 border border-pine/10 rounded-2xl px-4 py-2.5">
                    <p className="text-sm text-pine font-bold">
                      📍 Location saved
                      <span className="font-normal text-pine/50 text-xs ml-2">
                        {catchLat.toFixed(5)}, {catchLng.toFixed(5)}
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setCatchLat(null);
                        setCatchLng(null);
                      }}
                      className="text-xs font-bold text-pine/50 hover:text-signal-dark"
                    >
                      remove
                    </button>
                  </div>
                )}
                {myTournaments.length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-pine/55">
                        Also enter in tournament
                      </label>
                      <button
                        type="button"
                        onClick={() => setTournamentHelpOpen(true)}
                        aria-label="How do tournaments work?"
                        title="How do tournaments work?"
                        className="w-6 h-6 rounded-full bg-pine/10 hover:bg-pine/20 text-pine/70 text-xs font-black flex items-center justify-center shrink-0"
                      >
                        ?
                      </button>
                    </div>
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
            ) : (
              <TournamentPanel />
            )}
        </ComposerSheet>
      )}

      {/* Tournament explainer popup */}
      {tournamentHelpOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="How tournaments work"
        >
          <div className="absolute inset-0 bg-pine-deep/60" onClick={() => setTournamentHelpOpen(false)} />
          <div className="relative bg-paper rounded-3xl p-6 w-full max-w-sm shadow-2xl max-h-[80dvh] overflow-y-auto">
            <h3 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-3">
              🏆 How tournaments work
            </h3>
            <div className="space-y-3 text-sm text-pine/75 leading-relaxed">
              <p>
                <strong className="text-pine">Make one:</strong> go to Tournaments
                and start your own — set the name, dates, lakes, species and
                rules. You&apos;ll get a private invite link to share with your crew.
              </p>
              <p>
                <strong className="text-pine">Join one:</strong> open the
                organizer&apos;s invite link and join up. Only people with the
                link can enter.
              </p>
              <p>
                <strong className="text-pine">Enter catches:</strong> log a catch
                from the feed and pick the tournament in the dropdown. Only
                tournaments you&apos;ve joined show up there.
              </p>
              <p>
                <strong className="text-pine">Fair play:</strong> entries are
                GPS-checked and reviewed by the organizer before they hit the
                leaderboard.
              </p>
              <p className="text-xs text-pine/55">
                FishMB never touches entry money — any fees are handled directly
                with the organizer. Events with 25+ anglers need Manitoba&apos;s
                free Competitive Fishing Event licence.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTournamentHelpOpen(false)}
              className="w-full mt-5 bg-pine hover:bg-pine-deep text-white font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-full transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}


    </div>
  );
}

export default function FeedPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-32 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white border border-pine/10 rounded-3xl p-5 h-40 animate-pulse" />
          ))}
        </div>
      }
    >
      <FeedPageInner />
    </Suspense>
  );
}
