import type { ShopifyProduct } from "./shopify";

export interface SaleInfo {
  /** lowest sale price amount across variants */
  price: number;
  /** highest compare-at amount across variants */
  compareAt: number;
  /** whole-number discount percent */
  pct: number;
  currencyCode: string;
}

/**
 * Best honest discount for a product, derived ONLY from real Shopify
 * compareAtPrice values. Returns null when no variant is discounted.
 */
export function saleInfo(product: ShopifyProduct): SaleInfo | null {
  let best: SaleInfo | null = null;
  for (const v of product.variants) {
    if (!v.compareAtPrice) continue;
    const price = parseFloat(v.price.amount);
    const compareAt = parseFloat(v.compareAtPrice.amount);
    if (!(compareAt > price)) continue;
    const pct = Math.round(((compareAt - price) / compareAt) * 100);
    if (!best || pct > best.pct) {
      best = { price, compareAt, pct, currencyCode: v.price.currencyCode };
    }
  }
  return best;
}

/** Discount percent for sorting deals; 0 when not on sale. */
export function discountPct(product: ShopifyProduct): number {
  return saleInfo(product)?.pct ?? 0;
}
