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
  { icon: "👥", title: "Fish with friends", body: "Add fishing buddies and share catches with friends only." },
];

/**
 * Mid-homepage community box. Logged out: a login prompt for discussions
 * and fish catches. Logged in: expands with the latest feed items and a
 * link to the full feed page.
 */
export function CommunityBox() {
  const { user, openLogin } = useFishAuth();
  const [items, setItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    if (!user) return;
    fishFetch("/api/fishmb/feed?limit=6")
      .then((d) => setItems(d.items))
      .catch(() => {});
  }, [user]);

  const featureGrid = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-7">
      {FEATURES.map((f) => (
        <div key={f.title} className="bg-white/10 rounded-2xl p-4">
          <p className="text-2xl mb-1.5">{f.icon}</p>
          <p className="text-white font-bold text-sm mb-1">{f.title}</p>
          <p className="text-white/60 text-xs leading-relaxed">{f.body}</p>
        </div>
      ))}
    </div>
  );

  return (
    <section className="max-w-7xl mx-auto px-4 mt-12 md:mt-16">
      <div className="bg-pine rounded-[2rem] p-8 md:p-10 overflow-hidden relative">
        <div className="relative">
          <p className="text-gold font-bold uppercase tracking-[0.28em] text-sm mb-3">
            Community
          </p>
          {!user ? (
            <div>
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
              {featureGrid}
            </div>
          ) : (
            <div>
              <div className="md:flex md:items-center md:justify-between gap-8 mb-6">
                <h2 className="font-display font-bold uppercase text-white text-3xl md:text-4xl tracking-wide">
                  Latest from the community
                </h2>
                <Link
                  href="/fishmb/feed"
                  className="mt-4 md:mt-0 inline-block shrink-0 bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-8 py-3.5 rounded-full transition-colors"
                >
                  Open the feed →
                </Link>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                {items.map((item) => (
                  <Link
                    key={item.id}
                    href="/fishmb/feed"
                    className="bg-white/10 hover:bg-white/15 rounded-2xl p-5 transition-colors"
                  >
                    <p className="text-white font-bold text-sm mb-1">
                      {item.user_name}{" "}
                      <span className="font-normal text-white/50 text-xs">· {timeAgo(item.created_at)}</span>
                    </p>
                    {item.species && (
                      <p className="text-gold text-sm font-bold">
                        {item.species}
                        {item.length_in ? ` · ${Number(item.length_in).toFixed(1)}″` : ""}
                      </p>
                    )}
                    {item.body && (
                      <p className="text-white/75 text-sm mt-1 line-clamp-3">{item.body}</p>
                    )}
                    {!item.body && !item.species && (
                      <p className="text-white/50 text-sm italic">Shared a photo</p>
                    )}
                    {(item.photos?.length > 0 || item.photo_url) && (
                      <div className="flex gap-1.5 mt-3">
                        {(item.photos?.length > 0 ? item.photos : [item.photo_url as string])
                          .slice(0, 3)
                          .map((src, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={i}
                              src={src}
                              alt=""
                              loading="lazy"
                              className="w-16 h-16 rounded-xl object-cover"
                            />
                          ))}
                        {(item.photos?.length ?? 0) > 3 && (
                          <span className="w-16 h-16 rounded-xl bg-white/10 text-white/60 text-xs font-bold flex items-center justify-center">
                            +{(item.photos?.length ?? 0) - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </Link>
                ))}
                {items.length === 0 && (
                  <p className="text-white/60 text-sm md:col-span-3">
                    Nothing posted yet — be the first.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
