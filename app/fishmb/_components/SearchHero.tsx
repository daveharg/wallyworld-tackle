"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FISHMB_HERO_PHOTOS } from "@/lib/fishmb-constants";

const ROTATE_MS = 7000;

/** Hero search: type a query, hit Search (or Enter), land on a results page. No live dropdown. */
export default function SearchHero() {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const router = useRouter();

  // Rotate through real Manitoba lake photos with a slow crossfade.
  useEffect(() => {
    if (FISHMB_HERO_PHOTOS.length < 2) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % FISHMB_HERO_PHOTOS.length);
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, []);

  // Preload the next photo so the crossfade never flashes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const next = FISHMB_HERO_PHOTOS[(idx + 1) % FISHMB_HERO_PHOTOS.length];
    const img = new window.Image();
    img.src = next.src;
  }, [idx]);

  const submit = (value?: string) => {
    const query = (value ?? q).trim();
    if (query.length < 2) return;
    router.push(`/fishmb/search?q=${encodeURIComponent(query)}`);
  };

  const current = FISHMB_HERO_PHOTOS[idx];

  return (
    <section className="relative overflow-hidden bg-pine-deep" aria-label="Search Manitoba fishing">
      {/* rotating backdrop — stacked imgs crossfade via opacity */}
      {FISHMB_HERO_PHOTOS.map((p, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={p.src}
          src={p.src}
          alt=""
          aria-hidden={i !== idx}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
            i === idx ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-pine-deep/90 via-pine-deep/55 to-pine-deep/20" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-pine-deep/70 to-transparent" />
      {/* photo credit */}
      <p
        key={`credit-${idx}`}
        className="absolute bottom-2 right-3 text-[10px] text-white/60 z-10"
      >
        Photo: {current.credit} via Wikimedia Commons
      </p>

      <div className="relative max-w-4xl mx-auto px-4 pt-12 pb-14 md:pt-16 md:pb-20 text-center">
        <p className="text-gold font-bold uppercase tracking-[0.28em] text-sm mb-3">
          Manitoba fishing, all in one place
        </p>
        <h1 className="font-display font-bold uppercase text-white leading-[0.95] tracking-wide text-4xl md:text-6xl mb-4">
          Find your next bite.
        </h1>
        <p className="text-white/85 text-base md:text-lg max-w-2xl mx-auto mb-6">
          Search your lake or lodge for fishing regulations, stocking info,
          nearby towns and more.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="relative max-w-2xl mx-auto"
        >
          <div className="flex items-center bg-white rounded-full pl-6 pr-2 py-2 shadow-2xl">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-pine/50 shrink-0">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search 272 lakes or 132 lodges — try “Winnipeg”, “walleye”…"
              className="flex-1 bg-transparent outline-none px-3 py-2.5 text-pine placeholder:text-pine/40 text-base md:text-lg"
              aria-label="Search lakes and lodges"
            />
            <button
              type="submit"
              className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-7 py-3 rounded-full transition-colors shrink-0"
            >
              Search
            </button>
          </div>
        </form>

        <div className="flex flex-wrap justify-center gap-2.5 mt-6">
          {["Lake Winnipeg", "Walleye", "Red River", "Stocked trout"].map((s) => (
            <button
              key={s}
              onClick={() => submit(s)}
              className="text-sm text-white/85 border border-white/30 rounded-full px-4 py-1.5 hover:bg-white/10 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
