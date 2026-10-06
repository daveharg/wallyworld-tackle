"use client";

import { useEffect, useMemo, useState } from "react";
import type { ShopifyProduct } from "../lib/shopify";
import { categoryOf, type CategoryKey } from "../lib/categories";
import ProductCarousel from "./ProductCarousel";
import ProductRow, { CategoryJumpNav } from "./ProductRow";
import Breadcrumbs from "./Breadcrumbs";

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

export default function ProductListing({
  title,
  subtitle,
  products,
  breadcrumbs,
  // When set, group products into one horizontal row per category with jump nav.
  rowGroups,
}: {
  title: string;
  subtitle?: string;
  products: ShopifyProduct[];
  breadcrumbs: { label: string; href?: string }[];
  rowGroups?: { key: CategoryKey; id: string; label: string }[];
}) {
  const [sort, setSort] = useState<SortKey>("featured");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);

  // Honor /tackle#<section> anchor links from the nav.
  useEffect(() => {
    if (!rowGroups) return;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    // Defer so the row exists in the DOM.
    const t = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
    }, 150);
    return () => window.clearTimeout(t);
  }, [rowGroups]);

  const priceCap = useMemo(() => {
    let m = 0;
    for (const p of products) m = Math.max(m, priceOf(p));
    return Math.ceil(m);
  }, [products]);

  const applyFilters = (list: ShopifyProduct[]) => {
    let out = [...list];
    if (inStockOnly) out = out.filter((p) => p.availableForSale);
    if (maxPrice !== null) out = out.filter((p) => priceOf(p) <= maxPrice);
    return sortProducts(out, sort);
  };

  const clearFilters = () => {
    setInStockOnly(false);
    setMaxPrice(null);
    setSort("featured");
  };

  const hasFilters = inStockOnly || maxPrice !== null || sort !== "featured";

  const filterBar = (
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

        {priceCap > 0 && (
          <label className="flex items-center gap-2 text-sm text-pine/60">
            Max price
            <select
              value={maxPrice ?? ""}
              onChange={(e) => setMaxPrice(e.target.value === "" ? null : Number(e.target.value))}
              className="rounded-lg bg-paper border border-pine/15 text-pine text-sm px-3 py-2 outline-none focus:border-signal"
            >
              <option value="">Any</option>
              {[25, 50, 75, 100].filter((v) => v < priceCap).map((v) => (
                <option key={v} value={v}>
                  Under ${v}
                </option>
              ))}
              <option value={priceCap}>Under ${priceCap}</option>
            </select>
          </label>
        )}

        <button
          onClick={() => setInStockOnly((v) => !v)}
          aria-pressed={inStockOnly}
          className={`flex items-center gap-2 text-sm font-semibold rounded-lg border px-3 py-2 transition ${
            inStockOnly
              ? "bg-signal/10 border-signal/50 text-signal"
              : "bg-paper border-pine/15 text-pine/60 hover:text-pine"
          }`}
        >
          <span
            className={`w-3.5 h-3.5 rounded border grid place-items-center ${
              inStockOnly ? "bg-signal border-signal" : "border-pine/30"
            }`}
          >
            {inStockOnly && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
          </span>
          In stock only
        </button>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-pine/50 hover:text-signal underline underline-offset-2"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );

  const groups = useMemo(() => {
    if (!rowGroups) return [];
    return rowGroups
      .map((g) => ({
        ...g,
        products: applyFilters(products.filter((p) => categoryOf(p) === g.key)),
      }))
      .filter((g) => g.products.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowGroups, products, sort, inStockOnly, maxPrice]);

  const flat = useMemo(
    () => (rowGroups ? [] : applyFilters(products)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rowGroups, products, sort, inStockOnly, maxPrice]
  );

  const totalCount = rowGroups
    ? groups.reduce((n, g) => n + g.products.length, 0)
    : flat.length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Breadcrumbs trail={breadcrumbs} />

      <div className="mt-3 mb-6">
        <h1 className="font-display font-bold uppercase text-4xl md:text-5xl text-pine tracking-wide">
          {title}
        </h1>
        {subtitle && <p className="text-pine/60 mt-2 max-w-2xl">{subtitle}</p>}
        <p className="text-sm text-pine/40 mt-2">
          {totalCount} {totalCount === 1 ? "product" : "products"}
        </p>
      </div>

      {filterBar}

      {rowGroups ? (
        <>
          {groups.length > 1 && (
            <div className="mb-8">
              <CategoryJumpNav items={groups.map((g) => ({ id: g.id, label: g.label }))} />
            </div>
          )}
          {groups.length === 0 ? (
            <EmptyState onClear={clearFilters} />
          ) : (
            <div className="space-y-12">
              {groups.map((g) => (
                <ProductRow key={g.key} id={g.id} title={g.label} products={g.products} />
              ))}
            </div>
          )}
        </>
      ) : flat.length === 0 ? (
        <EmptyState onClear={clearFilters} />
      ) : (
        <ProductCarousel products={flat} cardWidth="w-[220px] md:w-[250px]" />
      )}
    </div>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="text-center py-20">
      <p className="text-pine/60 text-lg">No products match those filters.</p>
      <button onClick={onClear} className="mt-4 text-signal font-semibold hover:text-signal-dark">
        Clear all filters
      </button>
    </div>
  );
}
