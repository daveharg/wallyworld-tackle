"use client";

import { useEffect, useMemo, useState } from "react";
import type { ShopifyProduct } from "../lib/shopify";
import { categoryOf, type CategoryKey } from "../lib/categories";
import ProductCard from "./ProductCard";
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

export default function ProductListing({
  title,
  subtitle,
  products,
  breadcrumbs,
  showCategoryFilter = false,
  categoryLabels,
}: {
  title: string;
  subtitle?: string;
  products: ShopifyProduct[];
  breadcrumbs: { label: string; href?: string }[];
  showCategoryFilter?: boolean;
  categoryLabels?: Partial<Record<CategoryKey, string>>;
}) {
  const [sort, setSort] = useState<SortKey>("featured");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [activeCat, setActiveCat] = useState<CategoryKey | "all">("all");

  // Honor /tackle#<section> anchor links from the nav.
  useEffect(() => {
    if (!showCategoryFilter) return;
    const map: Record<string, CategoryKey> = {
      "jig-heads": "jigHeads",
      "soft-plastics": "softPlastics",
      "hard-baits": "hardBaits",
      "tackle-boxes": "tackleBoxes",
      tools: "tools",
      "terminal-tackle": "terminalTackle",
    };
    const hash = window.location.hash.replace(/^#/, "");
    if (hash && map[hash]) setActiveCat(map[hash]);
  }, [showCategoryFilter]);

  const availableCats = useMemo(() => {
    const set = new Map<CategoryKey, number>();
    for (const p of products) {
      const c = categoryOf(p);
      set.set(c, (set.get(c) ?? 0) + 1);
    }
    return Array.from(set.entries()).filter(([k]) => k !== "other");
  }, [products]);

  const priceCap = useMemo(() => {
    let m = 0;
    for (const p of products) m = Math.max(m, priceOf(p));
    return Math.ceil(m);
  }, [products]);

  const filtered = useMemo(() => {
    let list = [...products];
    if (showCategoryFilter && activeCat !== "all") {
      list = list.filter((p) => categoryOf(p) === activeCat);
    }
    if (inStockOnly) list = list.filter((p) => p.availableForSale);
    if (maxPrice !== null) list = list.filter((p) => priceOf(p) <= maxPrice);
    switch (sort) {
      case "price-asc":
        list.sort((a, b) => priceOf(a) - priceOf(b));
        break;
      case "price-desc":
        list.sort((a, b) => priceOf(b) - priceOf(a));
        break;
      case "name":
        list.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }
    return list;
  }, [products, sort, inStockOnly, maxPrice, activeCat, showCategoryFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Breadcrumbs trail={breadcrumbs} />

      <div className="mt-3 mb-6">
        <h1 className="font-display font-bold uppercase text-4xl md:text-5xl text-white tracking-wide">
          {title}
        </h1>
        {subtitle && <p className="text-slate-400 mt-2 max-w-2xl">{subtitle}</p>}
        <p className="text-sm text-slate-500 mt-2">
          {filtered.length} {filtered.length === 1 ? "product" : "products"}
        </p>
      </div>

      {/* filter bar */}
      <div className="rounded-2xl bg-night-900 border border-night-700 p-4 mb-8">
        <div className="flex flex-wrap items-center gap-3">
          {/* sort */}
          <label className="flex items-center gap-2 text-sm text-slate-400">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg bg-night-800 border border-night-600 text-slate-100 text-sm px-3 py-2 outline-none focus:border-ember-500"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          {/* price */}
          {priceCap > 0 && (
            <label className="flex items-center gap-2 text-sm text-slate-400">
              Max price
              <select
                value={maxPrice ?? ""}
                onChange={(e) =>
                  setMaxPrice(e.target.value === "" ? null : Number(e.target.value))
                }
                className="rounded-lg bg-night-800 border border-night-600 text-slate-100 text-sm px-3 py-2 outline-none focus:border-ember-500"
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

          {/* in stock toggle */}
          <button
            onClick={() => setInStockOnly((v) => !v)}
            aria-pressed={inStockOnly}
            className={`flex items-center gap-2 text-sm font-semibold rounded-lg border px-3 py-2 transition ${
              inStockOnly
                ? "bg-ember-500/15 border-ember-500/50 text-ember-400"
                : "bg-night-800 border-night-600 text-slate-400 hover:text-slate-200"
            }`}
          >
            <span
              className={`w-3.5 h-3.5 rounded border grid place-items-center ${
                inStockOnly ? "bg-ember-500 border-ember-500" : "border-slate-500"
              }`}
            >
              {inStockOnly && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0a0f1a" strokeWidth="4" strokeLinecap="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </span>
            In stock only
          </button>

          {(inStockOnly || maxPrice !== null || (showCategoryFilter && activeCat !== "all")) && (
            <button
              onClick={() => {
                setInStockOnly(false);
                setMaxPrice(null);
                setActiveCat("all");
              }}
              className="text-sm text-slate-500 hover:text-ember-400 underline underline-offset-2"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* category chips */}
        {showCategoryFilter && availableCats.length > 1 && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-night-800">
            <FilterChip
              active={activeCat === "all"}
              onClick={() => setActiveCat("all")}
              label={`All (${products.length})`}
            />
            {availableCats.map(([key, n]) => (
              <FilterChip
                key={key}
                active={activeCat === key}
                onClick={() => setActiveCat(key)}
                label={`${categoryLabels?.[key] ?? key} (${n})`}
              />
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-slate-400 text-lg">No products match those filters.</p>
          <button
            onClick={() => {
              setInStockOnly(false);
              setMaxPrice(null);
              setActiveCat("all");
            }}
            className="mt-4 text-ember-400 font-semibold hover:text-ember-500"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`text-xs font-bold uppercase tracking-wider rounded-full px-4 py-2 border transition ${
        active
          ? "bg-ember-500 border-ember-500 text-night-950"
          : "bg-night-800 border-night-600 text-slate-300 hover:border-ember-500/50 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}
