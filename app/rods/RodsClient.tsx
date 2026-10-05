"use client";

import { useState } from "react";
import type { ShopifyProduct } from "../../lib/shopify";
import ProductCard from "../../components/ProductCard";

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

function RodGrid({ id, title, products }: { id: string; title: string; products: ShopifyProduct[] }) {
  if (products.length === 0) return null;
  return (
    <section id={id} className="scroll-mt-28">
      <div className="flex items-end justify-between mb-5">
        <h2 className="font-display font-bold uppercase text-3xl md:text-4xl text-pine tracking-wide">
          {title}
        </h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

export default function RodsClient({
  spinning,
  casting,
  total,
}: {
  spinning: ShopifyProduct[];
  casting: ShopifyProduct[];
  total: number;
}) {
  const [sort, setSort] = useState<SortKey>("featured");

  const sortedSpinning = sortProducts(spinning, sort);
  const sortedCasting = sortProducts(casting, sort);

  return (
    <div className="space-y-12">
      <div className="rounded-2xl bg-white border border-pine/10 p-4">
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
          <span className="text-sm text-pine/40 ml-auto">
            {total} {total === 1 ? "product" : "products"}
          </span>
        </div>
      </div>

      <RodGrid id="spinning-rods" title="Spinning Rods" products={sortedSpinning} />
      <RodGrid id="casting-rods" title="Casting Rods" products={sortedCasting} />
    </div>
  );
}
