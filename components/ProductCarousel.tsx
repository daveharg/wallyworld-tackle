"use client";

import { useRef } from "react";
import type { ShopifyProduct } from "../lib/shopify";
import ProductCard from "./ProductCard";

interface Props {
  products: ShopifyProduct[];
  cardWidth?: string;
}

/** Horizontal product carousel with left/right arrows. */
export default function ProductCarousel({ products, cardWidth = "w-[240px] md:w-[260px]" }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  if (products.length === 0) return null;

  return (
    <div className="relative group/carousel">
      <div
        ref={trackRef}
        className="flex gap-4 md:gap-5 overflow-x-auto no-scrollbar scroll-smooth pb-1 -mx-4 px-4 md:mx-0 md:px-0"
      >
        {products.map((p) => (
          <div key={p.id} className={`${cardWidth} shrink-0`}>
            <ProductCard product={p} />
          </div>
        ))}
      </div>

      <button
        onClick={() => scrollBy(-1)}
        aria-label="Scroll products left"
        className="hidden md:grid absolute -left-5 top-[38%] place-items-center w-11 h-11 rounded-full bg-white border border-pine/15 shadow-lg text-pine hover:text-signal hover:border-signal/50 transition opacity-0 group-hover/carousel:opacity-100"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 6-6 6 6 6" />
        </svg>
      </button>
      <button
        onClick={() => scrollBy(1)}
        aria-label="Scroll products right"
        className="hidden md:grid absolute -right-5 top-[38%] place-items-center w-11 h-11 rounded-full bg-white border border-pine/15 shadow-lg text-pine hover:text-signal hover:border-signal/50 transition opacity-0 group-hover/carousel:opacity-100"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}
