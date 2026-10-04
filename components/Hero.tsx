"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const SLIDES = [
  {
    img: "https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=2000&q=75",
    alt: "Angler fishing at sunrise on a misty lake",
    eyebrow: "Chosen by real Canadian anglers",
    headline: "good gear, low prices.",
    sub: "Rods, reels and tackle chosen for performance per dollar — shipped direct, priced honest.",
    cta: "Shop Fishing Gear",
    href: "/rods",
  },
  {
    img: "https://images.unsplash.com/photo-1445112098124-3e76dd67983c?auto=format&fit=crop&w=2000&q=75",
    alt: "Fisherman casting at dawn",
    eyebrow: "Reel season is here",
    headline: "reels that work as hard as you do.",
    sub: "Spinning reels in every size up to 4000 — smooth drags, honest prices.",
    cta: "Shop Reels",
    href: "/reels",
  },
  {
    img: "https://images.unsplash.com/photo-1499242611767-cf8b9be02854?auto=format&fit=crop&w=2000&q=75",
    alt: "Fly angler on a clear river",
    eyebrow: "Tackle for every species",
    headline: "jigs, plastics & hard baits.",
    sub: "Walleye, pike, trout, perch, crappie — stock the box for whatever's biting.",
    cta: "Shop Tackle",
    href: "/tackle",
  },
];

export default function Hero() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 6500);
    return () => clearInterval(t);
  }, []);

  const slide = SLIDES[index];

  return (
    <section className="relative h-[78vh] min-h-[540px] max-h-[820px] overflow-hidden bg-pine-deep" aria-label="Featured">
      {SLIDES.map((s, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={s.img}
          src={s.img}
          alt={s.alt}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
      {/* readability gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-pine-deep/85 via-pine-deep/45 to-pine-deep/10" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-pine-deep/60 to-transparent" />

      <div className="relative h-full max-w-7xl mx-auto px-4 flex items-center">
        <div key={index} className="max-w-2xl animate-fade-up">
          <p className="text-gold font-bold uppercase tracking-[0.28em] text-sm mb-4">
            {slide.eyebrow}
          </p>
          <h1 className="font-display font-bold uppercase text-white leading-[0.95] tracking-wide text-6xl md:text-8xl mb-5">
            {slide.headline}
          </h1>
          <p className="text-white/85 text-lg md:text-xl max-w-xl mb-8">{slide.sub}</p>
          <Link
            href={slide.href}
            className="inline-block rounded-lg bg-signal hover:bg-signal-dark text-white font-display font-bold uppercase tracking-widest text-lg px-10 py-4 shadow-xl transition"
          >
            {slide.cta}
          </Link>
        </div>
      </div>

      {/* carousel dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2.5" role="tablist" aria-label="Hero slides">
        {SLIDES.map((s, i) => (
          <button
            key={s.img}
            role="tab"
            aria-selected={i === index}
            aria-label={`Slide ${i + 1}: ${s.headline}`}
            onClick={() => setIndex(i)}
            className={`h-2.5 rounded-full transition-all duration-300 ${
              i === index ? "w-10 bg-white" : "w-2.5 bg-white/50 hover:bg-white/80"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
