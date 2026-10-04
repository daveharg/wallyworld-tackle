"use client";

import { useState } from "react";
import type { ShopifyImage } from "../lib/shopify";

export default function ProductGallery({
  images,
  title,
}: {
  images: ShopifyImage[];
  title: string;
}) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0];

  if (images.length === 0) {
    return (
      <div className="rounded-2xl bg-paper-deep border border-pine/10 aspect-square grid place-items-center text-pine/40">
        Wallyworld Tackle
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:mx-0">
      <div className="sm:rounded-2xl overflow-hidden bg-white border-y sm:border border-pine/10">
        {current && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={current.url}
            src={current.url}
            alt={current.altText ?? title}
            className="w-full h-auto block animate-fade-in"
          />
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2.5 mt-3 overflow-x-auto no-scrollbar pb-1 px-4 sm:px-0">
          {images.map((img, i) => (
            <button
              key={img.url + i}
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              className={`shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-white border-2 transition ${
                i === active ? "border-signal" : "border-pine/10 hover:border-pine/30"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
