import type { ShopifyVariant } from "../lib/shopify";

export function stockState(variant: ShopifyVariant | null | undefined): {
  label: string;
  tone: "in" | "low" | "out";
} {
  if (!variant || !variant.availableForSale) return { label: "Out of Stock", tone: "out" };
  const q = variant.quantityAvailable;
  if (q !== null && q <= 5) return { label: `Low Stock — only ${q} left`, tone: "low" };
  return { label: "In Stock", tone: "in" };
}

export default function StockBadge({ variant }: { variant: ShopifyVariant | null | undefined }) {
  const { label, tone } = stockState(variant);
  const styles =
    tone === "in"
      ? "bg-emerald-50 text-emerald-700 border-emerald-600/30"
      : tone === "low"
        ? "bg-amber-50 text-amber-700 border-amber-600/30"
        : "bg-red-50 text-red-700 border-red-600/30";
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider border rounded-full px-3 py-1.5 ${styles}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          tone === "in" ? "bg-emerald-600" : tone === "low" ? "bg-amber-600" : "bg-red-600"
        }`}
      />
      {label}
    </span>
  );
}
