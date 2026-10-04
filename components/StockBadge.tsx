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
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
      : tone === "low"
        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
        : "bg-red-500/10 text-red-400 border-red-500/30";
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider border rounded-full px-3 py-1.5 ${styles}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          tone === "in" ? "bg-emerald-400" : tone === "low" ? "bg-amber-400" : "bg-red-400"
        }`}
      />
      {label}
    </span>
  );
}
