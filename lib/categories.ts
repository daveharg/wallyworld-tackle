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

export function rodsAndReels(products: ShopifyProduct[]) {
  return {
    rods: productsInCategory(products, "rods"),
    reels: productsInCategory(products, "reels"),
  };
}
