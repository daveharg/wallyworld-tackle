// Homepage banner ad slot — shows the first active homepage_banner ad.

"use client";

import { useEffect, useState } from "react";

interface Ad {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  video_url: string | null;
  link_url: string | null;
  business_name: string | null;
}

export default function HomepageBannerAd() {
  const [ad, setAd] = useState<Ad | null>(null);

  useEffect(() => {
    fetch("/api/fishmb/ads?slot=homepage_banner")
      .then((r) => r.json())
      .then((d) => setAd(d.ads?.[0] ?? null))
      .catch(() => {});
  }, []);

  if (!ad) return null;

  const inner = (
    <div className="relative rounded-3xl overflow-hidden border border-gold/40 bg-pine-deep">
      {ad.video_url ? (
        <video src={ad.video_url} autoPlay muted loop playsInline className="w-full max-h-72 object-cover" />
      ) : ad.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ad.image_url} alt={ad.title} className="w-full max-h-72 object-cover" loading="lazy" />
      ) : null}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-pine-deep/90 to-transparent p-5 pt-10">
        <p className="text-gold font-bold uppercase tracking-[0.2em] text-[10px] mb-1">Sponsored</p>
        <p className="text-white font-display font-bold text-xl uppercase tracking-wide">{ad.title}</p>
        {ad.body && <p className="text-white/75 text-sm mt-1 line-clamp-2">{ad.body}</p>}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 mt-8">
      {ad.link_url ? (
        <a href={ad.link_url} target="_blank" rel="noopener noreferrer sponsored" className="block">
          {inner}
        </a>
      ) : (
        inner
      )}
    </div>
  );
}
