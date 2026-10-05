"use client";

import { useState } from "react";
import Link from "next/link";
import type { ShopifyProduct } from "../../lib/shopify";
import {
  reelSubcategoryOf,
  hasStandardSeriesVariants,
} from "../../lib/categories";
import ProductCard from "../../components/ProductCard";
import Breadcrumbs from "../../components/Breadcrumbs";
import WalleyeReelGuide from "../../components/WalleyeReelGuide";

type SortKey = "featured" | "price-asc" | "price-desc" | "name";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "featured", label: "Featured" },
  { key: "price-asc", label: "Price: Low to High" },
  { key: "price-desc", label: "Price: High to Low" },
  { key: "name", label: "Name A–Z" },
];

function priceOf(p: ShopifyProduct): number {
  return parseFloat(p.priceRange.minVariantPrice.amount);
}

function sortProducts(list: ShopifyProduct[], sort: SortKey): ShopifyProduct[] {
  const out = [...list];
  switch (sort) {
    case "price-asc":
      out.sort((a, b) => priceOf(a) - priceOf(b));
      break;
    case "price-desc":
      out.sort((a, b) => priceOf(b) - priceOf(a));
      break;
    case "name":
      out.sort((a, b) => a.title.localeCompare(b.title));
      break;
  }
  return out;
}

export default function ReelsClient({ products }: { products: ShopifyProduct[] }) {
  const [sort, setSort] = useState<SortKey>("featured");

  const baitcasters = sortProducts(
    products.filter(
      (p) => reelSubcategoryOf(p) === "baitcaster" && hasStandardSeriesVariants(p)
    ),
    sort
  );
  const spinners = sortProducts(
    products.filter(
      (p) => reelSubcategoryOf(p) === "spinner" && hasStandardSeriesVariants(p)
    ),
    sort
  );
  const otherReels = sortProducts(
    products.filter((p) => reelSubcategoryOf(p) === "other"),
    sort
  );

  const groups = [
    { id: "baitcaster-reels", label: "Baitcaster Reels", products: baitcasters },
    { id: "spinner-reels", label: "Spinner Reels", products: spinners },
    { id: "other-reels", label: "Other Reels", products: otherReels },
  ].filter((g) => g.products.length > 0);

  return (
    <>
      <WalleyeReelGuide />
      <div className="max-w-7xl mx-auto px-4 py-8">
      <Breadcrumbs trail={[{ label: "Home", href: "/" }, { label: "Reels" }]} />

      <div className="mt-3 mb-6">
        <h1 className="font-display font-bold uppercase text-4xl md:text-5xl text-pine tracking-wide">
          Fishing Reels
        </h1>
        <p className="text-pine/60 mt-2 max-w-2xl">
          Baitcasting, spinning, and large species reels — smooth drags, metal spools, prices that make sense.
        </p>
        <p className="text-sm text-pine/40 mt-2">
          {products.length} {products.length === 1 ? "product" : "products"}
        </p>
      </div>

      <div className="rounded-2xl bg-white border border-pine/10 p-4 mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-pine/60">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg bg-paper border border-pine/15 text-pine text-sm px-3 py-2 outline-none focus:border-signal"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          {sort !== "featured" && (
            <button
              onClick={() => setSort("featured")}
              className="text-sm text-pine/50 hover:text-signal underline underline-offset-2"
            >
              Clear sort
            </button>
          )}
        </div>
      </div>

      <div className="space-y-12">
        {groups.map((g) => (
          <section key={g.id} id={g.id} className="scroll-mt-28">
            <div className="flex items-end justify-between mb-5">
              <h2 className="font-display font-bold uppercase text-3xl md:text-4xl text-pine tracking-wide">
                {g.label}
              </h2>
            </div>
            {/* Two rows: 2 cols mobile (4 products), 4 cols desktop (8 products) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
              {g.products.slice(0, 8).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            {g.products.length > 8 && (
              <p className="text-sm text-pine/50 mt-4 text-center">
                Showing 8 of {g.products.length} — use Sort above to explore more
              </p>
            )}
          </section>
        ))}
      </div>
      </div>
    </>
  );
}
