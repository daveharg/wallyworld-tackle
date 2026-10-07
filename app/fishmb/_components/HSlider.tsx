"use client";

import { useRef } from "react";

/** Horizontal scroll row with arrow buttons — retail-site style. */
export default function HSlider({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.85, 640), behavior: "smooth" });
  };
  return (
    <div className="relative group">
      <div
        ref={ref}
        className="flex gap-4 md:gap-5 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <button
        onClick={() => scroll(-1)}
        aria-label="Scroll left"
        className="hidden md:flex absolute -left-5 top-[38%] -translate-y-1/2 w-11 h-11 rounded-full bg-white shadow-lg border border-pine/10 items-center justify-center text-pine hover:bg-pine hover:text-white transition-colors opacity-0 group-hover:opacity-100"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5m6 6-6-6 6-6" /></svg>
      </button>
      <button
        onClick={() => scroll(1)}
        aria-label="Scroll right"
        className="hidden md:flex absolute -right-5 top-[38%] -translate-y-1/2 w-11 h-11 rounded-full bg-white shadow-lg border border-pine/10 items-center justify-center text-pine hover:bg-pine hover:text-white transition-colors opacity-0 group-hover:opacity-100"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
      </button>
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  href,
  linkLabel,
}: {
  eyebrow?: string;
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        {eyebrow && (
          <p className="text-signal text-xs font-bold uppercase tracking-[0.24em] mb-1.5">
            {eyebrow}
          </p>
        )}
        <h2 className="font-display font-bold uppercase text-3xl md:text-4xl text-pine tracking-wide">
          {title}
        </h2>
      </div>
      {href && (
        <a
          href={href}
          className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold text-signal hover:text-signal-dark uppercase tracking-wider shrink-0"
        >
          {linkLabel ?? "View all"}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14m-6-6 6 6-6 6" />
          </svg>
        </a>
      )}
    </div>
  );
}
