import { getProducts, isShopifyConfigured, type ShopifyProduct } from "../../lib/shopify";
import { productsInCategory, categoryOf, isIceEligibleReel } from "../../lib/categories";
import ProductListing from "../../components/ProductListing";

export const revalidate = 300;
export const metadata = { title: "Ice Fishing — Wallyworld Tackle" };

const ICE_ROW_GROUPS = [
  { key: "iceReels", id: "reels", label: "Reels" },
  { key: "iceRods", id: "rods", label: "Rods" },
  { key: "iceTackle", id: "tackle", label: "Tackle" },
  { key: "iceElectronics", id: "electronics", label: "Electronics" },
  { key: "iceTents", id: "tents", label: "Tents & Shelters" },
];

const has = (t: string, re: RegExp) => re.test(t);

export default async function IceFishingPage() {
  if (!isShopifyConfigured()) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <p className="text-pine/60">Store not connected yet. Set your Shopify environment variables.</p>
      </div>
    );
  }
  const products = await getProducts(250);
  const iceIds = new Set(productsInCategory(products, "iceFishing").map((p) => p.id));
  const inIce = (p: ShopifyProduct) => iceIds.has(p.id);
  // Portable fish finders (not the RC bait boat) double as ice electronics.
  const finderIds = new Set(
    products
      .filter((p) => categoryOf(p) === "electronics" && !/bait boat/i.test(p.title))
      .map((p) => p.id)
  );

  const groupBy = (p: ShopifyProduct, key: string): boolean => {
    const t = p.title.toLowerCase();
    const isRod = has(t, /\brod\b/);
    const isReel = has(t, /\breel\b/);
    const isTent = has(t, /tent|shelter|shack|hut/);
    const isElectronic = has(t, /camera|fish finder|sonar|depth finder|echo sounder/);
    switch (key) {
      case "iceReels":
        // Ice reels & combos, plus small (under-3000 series) reels from the main catalog.
        return (inIce(p) && isReel) || isIceEligibleReel(p);
      case "iceRods":
        return inIce(p) && isRod;
      case "iceTackle":
        return inIce(p) && !isRod && !isReel && !isTent && !isElectronic;
      case "iceElectronics":
        return (inIce(p) && isElectronic) || finderIds.has(p.id);
      case "iceTents":
        return inIce(p) && isTent;
      default:
        return false;
    }
  };

  // Feed ProductListing every product that can appear in any subsection,
  // plus a serializable id -> group-keys map (client components can't
  // receive function props).
  const groupKeys: Record<string, string[]> = {};
  const visible = products.filter((p) => {
    const keys = ICE_ROW_GROUPS.filter((g) => groupBy(p, g.key)).map((g) => g.key);
    if (!keys.length) return false;
    groupKeys[p.id] = keys;
    return true;
  });

  return (
    <ProductListing
      title="Ice Fishing"
      subtitle="Reels, rods, tackle, electronics and shelters — everything you need to own the hard water."
      products={visible}
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Ice Fishing" }]}
      rowGroups={ICE_ROW_GROUPS}
      groupKeys={groupKeys}
    />
  );
}
