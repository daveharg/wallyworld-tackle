"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFishAuth } from "./FishAuth";
import { fishFetch } from "./fishFetch";

interface FeedItem {
  id: string;
  kind: "catch" | "post";
  user_name: string;
  avatar_url: string | null;
  body: string | null;
  photo_url: string | null;
  photos: string[];
  species: string | null;
  length_in: number | null;
  created_at: string;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const FEATURES = [
  { icon: "🐟", title: "Share your catches", body: "Post photos with species and length — your personal fishing log." },
  { icon: "💬", title: "Join the discussion", body: "Ask questions, swap spots and talk technique with Manitoba anglers." },
  { icon: "💡", title: "Tips that travel", body: "Post tips on any species page — they land in the feed for everyone." },
  { icon: "👥", title: "Fish with friends", body: "Add fishing friends and share catches with friends only." },
];

const photoOf = (it: FeedItem) => (it.photos?.length > 0 ? it.photos[0] : it.photo_url);

/**
 * Mid-homepage community box. Logged out: a login prompt for discussions
 * and fish catches. Logged in: a featured photo post (full-bleed on mobile)
 * plus the most recent text posts, and a link to the full feed page.
 */
export function CommunityBox() {
  const { user, openLogin } = useFishAuth();
  const [items, setItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    if (!user) return;
    fishFetch("/api/fishmb/feed?limit=8")
      .then((d) => setItems(d.items))
      .catch(() => {});
  }, [user]);

  return (
    <section className="max-w-7xl mx-auto px-4 mt-12 md:mt-16">
      {!user ? (
        <div className="bg-pine rounded-[2rem] p-8 md:p-10 overflow-hidden relative">
          <div className="relative">
            <p className="text-gold font-bold uppercase tracking-[0.28em] text-sm mb-3">
              Community
            </p>
            <div className="md:flex md:items-center md:justify-between gap-8">
              <div>
                <h2 className="font-display font-bold uppercase text-white text-3xl md:text-4xl tracking-wide mb-3">
                  Talk fishing. Show your catches.
                </h2>
                <p className="text-white/70 max-w-xl">
                  Log in to join the discussion, share your fish, and comment —
                  the same community feed as the FishMB app.
                </p>
              </div>
              <button
                onClick={openLogin}
                className="mt-6 md:mt-0 shrink-0 bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-8 py-4 rounded-full transition-colors"
              >
                Log in to join
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-7">
              {FEATURES.map((f) => (
                <div key={f.title} className="bg-white/10 rounded-2xl p-4">
                  <p className="text-2xl mb-1.5">{f.icon}</p>
                  <p className="text-white font-bold text-sm mb-1">{f.title}</p>
                  <p className="text-white/60 text-xs leading-relaxed">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div>
          {(() => {
            const featured = items.find((it) => photoOf(it));
            const textPosts = items.filter((it) => !photoOf(it) && it.body).slice(0, 2);
            return (
              <>
                {featured && (
                  <Link
                    href="/fishmb/feed"
                    className="block relative -mx-4 md:mx-0 md:rounded-3xl overflow-hidden group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoOf(featured) as string}
                      alt={featured.species ?? "Community catch"}
                      loading="lazy"
                      className="w-full h-80 md:h-[26rem] object-cover group-hover:scale-[1.02] transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-pine-deep/95 via-pine-deep/20 to-transparent" />
                    <span className="absolute top-4 left-4 md:left-6 bg-gold text-pine text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full">
                      📸 Latest catch
                    </span>
                    <div className="absolute bottom-0 inset-x-0 p-5 md:p-7">
                      <p className="text-white font-bold">
                        {featured.user_name}{" "}
                        <span className="font-normal text-white/60 text-xs">
                          · {timeAgo(featured.created_at)}
                        </span>
                      </p>
                      {featured.species && (
                        <p className="text-gold text-xl font-bold mt-0.5">
                          {featured.species}
                          {featured.length_in
                            ? ` · ${Number(featured.length_in).toFixed(1)}″`
                            : ""}
                        </p>
                      )}
                      {featured.body && (
                        <p className="text-white/85 text-sm mt-1 line-clamp-2">
                          {featured.body}
                        </p>
                      )}
                    </div>
                  </Link>
                )}

                {textPosts.length > 0 && (
                  <div className="grid md:grid-cols-2 gap-3 mt-4">
                    {textPosts.map((item) => (
                      <Link
                        key={item.id}
                        href="/fishmb/feed"
                        className="bg-white border border-pine/10 hover:border-signal/50 rounded-2xl p-5 transition-colors"
                      >
                        <p className="text-pine font-bold text-sm mb-1.5">
                          {item.user_name}{" "}
                          <span className="font-normal text-pine/50 text-xs">
                            · {timeAgo(item.created_at)}
                          </span>
                        </p>
                        <p className="text-pine/75 text-sm line-clamp-3">{item.body}</p>
                      </Link>
                    ))}
                  </div>
                )}

                {items.length === 0 && (
                  <p className="text-pine/60 text-sm mt-4">
                    Nothing posted yet — be the first.
                  </p>
                )}

                {(featured || textPosts.length > 0) && (
                  <div className="text-center mt-5">
                    <Link
                      href="/fishmb/feed"
                      className="inline-block bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-8 py-3.5 rounded-full transition-colors"
                    >
                      Open the feed →
                    </Link>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </section>
  );
}
