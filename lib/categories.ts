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
  if (/\brod\b/.test(t)) return "rods";
  if (/\breel\b/.test(t)) return "reels";
  if (/\bjig\b/.test(t) || /jig head/.test(t)) return "jigHeads";
  if (/tackle box/.test(t) || /organizer/.test(t)) return "tackleBoxes";
  if (/\bgrub\b/.test(t) || /\bworm\b/.test(t) || /swimbait/.test(t)) return "softPlastics";
  if (
    /crankbait/.test(t) ||
    /spinnerbait/.test(t) ||
    /chatterbait/.test(t) ||
    /wobbler/.test(t) ||
    /minnow/.test(t) ||
    /frog/.test(t) ||
    /topwater/.test(t)
  )
    return "hardBaits";
  if (/plier/.test(t) || /knife/.test(t) || /net\b/.test(t) || /tool/.test(t) || /accessor/.test(t))
    return "tools";
  if (/hook/.test(t) || /sinker/.test(t) || /swivel/.test(t) || /snap/.test(t) || /leader/.test(t))
    return "terminalTackle";
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
