// Classified listing detail.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useFishAuth } from "../../_components/FishAuth";
import { fishFetch } from "../../_components/fishFetch";
import { classifiedCategoryMeta, formatPrice } from "@/lib/fish/classifieds-meta";

interface Listing {
  id: string;
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  category: string;
  title: string;
  description: string;
  price_cents: number | null;
  photos: string[];
  location: string | null;
  status: "active" | "sold";
  created_at: string;
}

export default function ClassifiedDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, openLogin } = useFishAuth();
  const [item, setItem] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    fishFetch(`/api/fishmb/classifieds/${id}`)
      .then((d) => setItem(d.item as Listing))
      .catch(() => setItem(null))
      .finally(() => setLoading(false));
  }, [id]);

  const isOwner = !!user && !!item && user.id === item.user_id;
  const [shared, setShared] = useState(false);

  const listingUrl = () =>
    `${window.location.origin}/fishmb/classifieds/${id}`;

  const shareToFeed = async () => {
    if (!user) {
      openLogin();
      return;
    }
    if (!item || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const price = item.price_cents != null ? ` — ${formatPrice(item.price_cents)}` : "";
      await fishFetch("/api/fishmb/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
 body: ` For sale on FishMB Classifieds: ${item.title}${price}\n\n${listingUrl()}`,
          photos: item.photos.slice(0, 4),
        }),
      });
      setShared(true);
 setNote("Shared to your FishMB feed! ");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not share to feed.");
    } finally {
      setBusy(false);
    }
  };

  const shareElsewhere = async () => {
    if (!item) return;
    const url = listingUrl();
 const text = ` ${item.title}${item.price_cents != null ? ` — ${formatPrice(item.price_cents)}` : ""} (FishMB Classifieds)`;
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, text, url });
      } else {
        await navigator.clipboard.writeText(url);
 setNote("Link copied — paste it anywhere! ");
      }
    } catch {
      // User dismissed the share sheet; nothing to do.
    }
  };

  const messageSeller = async () => {
    if (!user) {
      openLogin();
      return;
    }
    if (!item || isOwner) return;
    setBusy(true);
    setNote(null);
    try {
      await fishFetch("/api/fishmb/msg/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ other_user_id: item.user_id }),
      });
      router.push("/fishmb/messages");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not start conversation.");
      setBusy(false);
    }
  };

  const markSold = async () => {
    if (!item || !confirm("Mark this listing as sold?")) return;
    setBusy(true);
    try {
      await fishFetch(`/api/fishmb/classifieds/${item.id}/sold`, { method: "POST" });
      setItem({ ...item, status: "sold" });
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not update listing.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!item || !confirm("Delete this listing permanently?")) return;
    setBusy(true);
    try {
      await fishFetch(`/api/fishmb/classifieds/${item.id}/delete`, { method: "POST" });
      router.push("/fishmb/classifieds");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not delete listing.");
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-32 space-y-4">
        <div className="aspect-square bg-pine/5 rounded-3xl animate-pulse" />
        <div className="h-6 bg-pine/10 rounded-full w-2/3 animate-pulse" />
        <div className="h-4 bg-pine/10 rounded-full w-full animate-pulse" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-16 pb-32 text-center">
        <p className="font-bold text-pine mb-4">That listing is gone.</p>
        <Link href="/fishmb/classifieds" className="font-bold text-signal-dark hover:underline">
          ← Back to classifieds
        </Link>
      </div>
    );
  }

  const meta = classifiedCategoryMeta(item.category);

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 md:pt-6 pb-32">
      <Link
        href="/fishmb/classifieds"
        className="inline-block text-sm font-bold text-pine/55 hover:text-pine mb-4"
      >
        ← Classifieds
      </Link>

      <div className="bg-white border border-pine/10 rounded-3xl overflow-hidden">
        <div className="aspect-square bg-paper-deep relative">
          {item.photos.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.photos[photoIdx]}
              alt={item.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-7xl bg-pine/5">
              {meta.emoji}
            </div>
          )}
          {item.status === "sold" && (
            <span className="absolute top-3 left-3 bg-pine-deep/85 text-white text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded-full">
              Sold
            </span>
          )}
        </div>
        {item.photos.length > 1 && (
          <div className="flex gap-2 p-3 overflow-x-auto">
            {item.photos.map((p, i) => (
              <button
                key={i}
                onClick={() => setPhotoIdx(i)}
                className={`w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 ${
                  i === photoIdx ? "border-signal" : "border-transparent"
                }`}
                aria-label={`Photo ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-2">
            <p className="font-black text-pine text-3xl">{formatPrice(item.price_cents)}</p>
            <span className="shrink-0 text-xs font-bold uppercase tracking-wider bg-pine/10 text-pine px-3 py-1.5 rounded-full">
              {meta.emoji} {meta.label}
            </span>
          </div>
          <h1 className="text-xl font-black text-pine tracking-tight mb-1">{item.title}</h1>
          {item.location && (
            <p className="text-sm text-pine/55 mb-3">{item.location}</p>
          )}
          <p className="text-pine/80 text-[15px] leading-relaxed whitespace-pre-wrap mb-5">
            {item.description}
          </p>

          <Link
            href={`/fishmb/anglers/${item.user_id}`}
            className="flex items-center gap-3 bg-paper-deep rounded-2xl p-3 mb-4 hover:bg-pine/5 transition-colors"
          >
            {item.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover" />
            ) : (
              <span className="w-11 h-11 rounded-full bg-pine/15 flex items-center justify-center text-xl">
 
              </span>
            )}
            <span>
              <span className="block font-bold text-pine text-sm">{item.user_name}</span>
              <span className="block text-xs text-pine/50">Seller · view profile →</span>
            </span>
          </Link>

          {isOwner ? (
            <div className="flex gap-2.5 flex-wrap">
              {item.status === "active" && (
                <button
                  onClick={markSold}
                  disabled={busy}
                  className="flex-1 min-w-[140px] bg-pine hover:bg-pine-deep text-white font-bold uppercase tracking-wider text-xs px-6 py-3.5 rounded-full transition-colors disabled:opacity-50"
                >
 Mark as sold
                </button>
              )}
              <button
                onClick={remove}
                disabled={busy}
                className="flex-1 min-w-[140px] border border-signal/40 text-signal-dark hover:bg-signal/10 font-bold uppercase tracking-wider text-xs px-6 py-3.5 rounded-full transition-colors disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          ) : (
            <button
              onClick={messageSeller}
              disabled={busy || item.status === "sold"}
              className="w-full bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-4 rounded-full transition-colors disabled:opacity-40"
            >
              {item.status === "sold"
                ? "This item is sold"
                : busy
                  ? "Opening chat…"
 : " Message seller"}
            </button>
          )}
          {note && (
            <p className="text-sm text-signal-dark mt-3 text-center">{note}</p>
          )}
          {/* Share this listing */}
          <div className="mt-4 pt-4 border-t border-pine/10">
            <p className="text-xs font-bold uppercase tracking-wider text-pine/50 text-center mb-3">
              Share this listing
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={shareToFeed}
                disabled={busy || shared}
                className="flex-1 bg-pine hover:bg-pine-deep text-white font-bold uppercase tracking-wider text-xs px-4 py-3 rounded-full transition-colors disabled:opacity-50"
              >
 {shared ? " Shared" : " FishMB feed"}
              </button>
              <button
                onClick={shareElsewhere}
                className="flex-1 border border-pine/25 text-pine hover:bg-pine/5 font-bold uppercase tracking-wider text-xs px-4 py-3 rounded-full transition-colors"
              >
 ↗ Share…
              </button>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                  typeof window !== "undefined" ? listingUrl() : ""
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on Facebook"
                className="shrink-0 w-12 h-12 rounded-full bg-[#1877f2] text-white flex items-center justify-center text-xl hover:opacity-90 transition-opacity"
              >
                f
              </a>
            </div>
          </div>
          {!user && (
            <p className="text-xs text-pine/50 text-center mt-3">
              You'll be asked to log in to message the seller.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
