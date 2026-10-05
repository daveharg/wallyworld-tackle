// Category sorting: assign products to store sections by title keywords.
// rod → Rods, reel → Reels, jig → Jig Heads, tackle box/organizer → Tackle Boxes,
// grub/worm/swimbait → Soft Plastics, everything else → Tackle & More.

import type { ShopifyProduct } from "./shopify";

export type CategoryKey =
  | "rods"
  | "reels"
  | "jigHeads"
  | "softPlastics"
  | "hardBaits"
  | "tackleBoxes"
  | "tools"
  | "terminalTackle"
  | "other";

export interface Category {
  key: CategoryKey;
  label: string;
  href: string;
}

export const CATEGORIES: Category[] = [
  { key: "rods", label: "Rods", href: "/rods" },
  { key: "reels", label: "Reels", href: "/reels" },
  { key: "jigHeads", label: "Jig Heads", href: "/tackle#jig-heads" },
  { key: "softPlastics", label: "Soft Plastics", href: "/tackle#soft-plastics" },
  { key: "hardBaits", label: "Hard Baits", href: "/tackle#hard-baits" },
  { key: "tackleBoxes", label: "Tackle Boxes", href: "/tackle#tackle-boxes" },
  { key: "tools", label: "Tools & Accessories", href: "/tackle#tools" },
  { key: "terminalTackle", label: "Terminal Tackle", href: "/tackle#terminal-tackle" },
];

function titleOf(p: ShopifyProduct): string {
  return `${p.title} ${p.tags.join(" ")}`.toLowerCase();
}

export function categoryOf(product: ShopifyProduct): CategoryKey {
  const t = titleOf(product);

  // Rods & reels first — most specific.
  if (/\brod\b/.test(t) && !/jig head/.test(t)) return "rods";
  if (/\breel\b/.test(t) && !/repair/.test(t) && !/tool/.test(t)) return "reels";

  // Jig heads — specific "jig head" or standalone "jig" (not "jigging" rod).
  if (/jig head/.test(t) || /\bjig\b/.test(t)) return "jigHeads";

  // Soft plastics — expanded keywords.
  if (
    /\bgrub\b/.test(t) ||
    /\bworm\b/.test(t) ||
    /swimbait/.test(t) ||
    /paddle tail/.test(t) ||
    /soft plastic/.test(t) ||
    /soft lure/.test(t) ||
    /soft bait/.test(t) ||
    /\bshad\b/.test(t) ||
    /crawfish/.test(t) ||
    /craw\b/.test(t) ||
    /creature/.test(t) ||
    /rubber/.test(t) && /lure|bait/.test(t)
  )
    return "softPlastics";

  // Hard baits — BEFORE terminal tackle so "treble hook" doesn't misroute.
  // Expanded: spoon, spinner (lure), jerkbait, popper, vib, hard lure.
  if (
    /crankbait/.test(t) ||
    /spinnerbait/.test(t) ||
    /chatterbait/.test(t) ||
    /wobbler/.test(t) ||
    /minnow/.test(t) ||
    /frog/.test(t) ||
    /topwater/.test(t) ||
    /jerkbait/.test(t) ||
    /\bspoon\b/.test(t) ||
    /spinner lure/.test(t) ||
    /metal lure/.test(t) ||
    /hard bait/.test(t) ||
    /hard lure/.test(t) ||
    /\bpopper\b/.test(t) ||
    /\bvib\b/.test(t)
  )
    return "hardBaits";

  // Tackle boxes.
  if (/tackle box/.test(t) || /organizer/.test(t)) return "tackleBoxes";

  // Terminal tackle — hooks, sinkers, swivels, snaps, leaders, line.
  if (
    /fish.?hook/.test(t) ||
    /\bhooks\b/.test(t) ||
    /sinker/.test(t) ||
    /swivel/.test(t) ||
    /\bsnap\b/.test(t) ||
    /leader/.test(t) ||
    /fishing line/.test(t) ||
    /braided line/.test(t) ||
    /nylon line/.test(t)
  )
    return "terminalTackle";

  // Tools & accessories — specific tool words only (not greedy).
  if (
    /plier/.test(t) ||
    /\bknife\b/.test(t) ||
    /fillet/.test(t) ||
    /scissor/.test(t) ||
    /\bnet\b/.test(t) ||
    /landing net/.test(t) ||
    /tool set/.test(t) ||
    /repair kit/.test(t) ||
    /rod holder/.test(t) ||
    /line winder/.test(t) ||
    /hook remover/.test(t) ||
    /lip grip/.test(t)
  )
    return "tools";

  return "other";
}

export function productsInCategory(products: ShopifyProduct[], key: CategoryKey): ShopifyProduct[] {
  return products.filter((p) => categoryOf(p) === key);
}

export type ReelSubcategory = "baitcaster" | "spinner" | "other";

/** Split reels into baitcaster vs spinner rows for the Reels page. */
export function reelSubcategoryOf(product: ShopifyProduct): ReelSubcategory {
  const t = titleOf(product);
  if (/baitcast/.test(t)) return "baitcaster";
  if (/spinning/.test(t) || /\bspinner\b/.test(t)) return "spinner";
  return "other";
}

/**
 * Check if a reel product has any variants over 5000 series (large species).
 * Parses series numbers like 6000, 7000, 8000, 10000, 14000 from variant titles.
 */
export function hasLargeSeriesVariants(product: ShopifyProduct): boolean {
  const seriesPattern = /\b([5-9]\d{3}|\d{5,})\b/; // 5000+ (5000, 6000, 8000, 10000, 14000, etc.)
  // Check variant titles/options
  for (const v of product.variants) {
    const text = `${v.title} ${v.selectedOptions.map((o) => o.value).join(" ")}`;
    const match = text.match(/\b(\d{4,5})\b/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > 5000) return true;
    }
  }
  // Fallback: check product title
  const titleMatch = product.title.match(/\b(\d{4,5})\b/g);
  if (titleMatch) {
    for (const m of titleMatch) {
      const num = parseInt(m, 10);
      if (num > 5000) return true;
    }
  }
  return false;
}

/**
 * Check if a reel product has any variants at or under 5000 series.
 */
export function hasStandardSeriesVariants(product: ShopifyProduct): boolean {
  for (const v of product.variants) {
    const text = `${v.title} ${v.selectedOptions.map((o) => o.value).join(" ")}`;
    const match = text.match(/\b(\d{3,5})\b/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num <= 5000) return true;
    }
  }
  // If no series numbers found in variants, assume standard (under 5000)
  // to ensure the product appears in its type row.
  const hasAnySeries = product.variants.some((v) => {
    const text = `${v.title} ${v.selectedOptions.map((o) => o.value).join(" ")}`;
    return /\b\d{3,5}\b/.test(text);
  });
  if (!hasAnySeries) {
    // Check title for series numbers
    const titleHasSeries = /\b\d{3,5}\b/.test(product.title);
    if (!titleHasSeries) return true; // No series info, treat as standard
  }
  return false;
}

export function rodsAndReels(products: ShopifyProduct[]) {
  return {
    rods: productsInCategory(products, "rods"),
    reels: productsInCategory(products, "reels"),
  };
}

export type RodSubcategory = "spinning" | "casting";

/**
 * Split rods into spinning vs casting. A rod can match both (e.g. "Spinning
 * Casting Rod" in the title) and will then appear in both sections.
 */
export function rodSubcategoriesOf(product: ShopifyProduct): RodSubcategory[] {
  const t = titleOf(product);
  const out: RodSubcategory[] = [];
  if (/spinning/.test(t)) out.push("spinning");
  if (/casting/.test(t) || /baitcast/.test(t)) out.push("casting");
  // Default: if neither matched, treat as spinning (most common).
  if (out.length === 0) out.push("spinning");
  return out;
}
