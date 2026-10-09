// FishMB classifieds — client-safe metadata (no DB imports).
// Category list, labels, emoji, and price formatting for UI components.

export const CLASSIFIED_CATEGORIES = [
  { key: "tackle", emoji: "🪝", label: "Tackle" },
  { key: "rods-reels", emoji: "🎣", label: "Rods & Reels" },
  { key: "boats-motors", emoji: "🚤", label: "Boats & Motors" },
  { key: "ice-fishing", emoji: "🧊", label: "Ice Fishing" },
  { key: "electronics", emoji: "📡", label: "Electronics" },
  { key: "services", emoji: "🛠️", label: "Services" },
  { key: "other", emoji: "📦", label: "Other" },
] as const;

export type ClassifiedCategoryKey = (typeof CLASSIFIED_CATEGORIES)[number]["key"];

export function classifiedCategoryMeta(key: string) {
  return (
    CLASSIFIED_CATEGORIES.find((c) => c.key === key) ??
    CLASSIFIED_CATEGORIES[CLASSIFIED_CATEGORIES.length - 1]
  );
}

export function isClassifiedCategoryKey(key: string): key is ClassifiedCategoryKey {
  return CLASSIFIED_CATEGORIES.some((c) => c.key === key);
}

/** Format cents for display: $1,250 or "Contact" when null. */
export function formatPrice(price_cents: number | null): string {
  if (price_cents === null || price_cents === undefined) return "Contact";
  const dollars = price_cents / 100;
  return "$" + dollars.toLocaleString("en-CA", { maximumFractionDigits: dollars % 1 === 0 ? 0 : 2 });
}
