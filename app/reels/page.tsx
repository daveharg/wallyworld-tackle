import { getProducts, isShopifyConfigured } from "../../lib/shopify";
import {
  productsInCategory,
  reelSubcategoryOf,
  hasLargeSeriesVariants,
  hasStandardSeriesVariants,
} from "../../lib/categories";
import ProductRow, { CategoryJumpNav } from "../../components/ProductRow";
import Breadcrumbs from "../../components/Breadcrumbs";

export const revalidate = 300;
export const metadata = { title: "Fishing Reels — Wallyworld Tackle" };

export default async function ReelsPage() {
  if (!isShopifyConfigured()) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <p className="text-pine/60">Store not connected yet. Set your Shopify environment variables.</p>
      </div>
    );
  }
  const products = await getProducts(100);
  const reels = productsInCategory(products, "reels");

  // Baitcaster Reels: baitcaster type with standard (≤5000) series variants.
  // If a baitcaster also has >5000 series variants, it appears in both rows.
  const baitcasters = reels.filter(
    (p) => reelSubcategoryOf(p) === "baitcaster" && hasStandardSeriesVariants(p)
  );
  // Spinner Reels: spinner type with standard (≤5000) series variants.
  // If a spinner also has >5000 series variants, it appears in both rows.
  const spinners = reels.filter(
    (p) => reelSubcategoryOf(p) === "spinner" && hasStandardSeriesVariants(p)
  );
  // Large Species Reels: any reel with >5000 series variants.
  const largeSpecies = reels.filter((p) => hasLargeSeriesVariants(p));
  // Other reels that don't fit the above (e.g., trolling reels without series info).
  const otherReels = reels.filter(
    (p) =>
      reelSubcategoryOf(p) === "other" &&
      !hasLargeSeriesVariants(p)
  );

  const groups = [
    { id: "baitcaster-reels", label: "Baitcaster Reels", products: baitcasters },
    { id: "spinner-reels", label: "Spinner Reels", products: spinners },
    { id: "large-species-reels", label: "Large Species Reels", products: largeSpecies },
    { id: "other-reels", label: "Other Reels", products: otherReels },
  ].filter((g) => g.products.length > 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Breadcrumbs trail={[{ label: "Home", href: "/" }, { label: "Reels" }]} />

      <div className="mt-3 mb-6">
        <h1 className="font-display font-bold uppercase text-4xl md:text-5xl text-pine tracking-wide">
          Fishing Reels
        </h1>
        <p className="text-pine/60 mt-2 max-w-2xl">
          Baitcasting, spinning, and large species reels — smooth drags, metal spools, prices that make sense.
        </p>
        <p className="text-sm text-pine/40 mt-2">
          {reels.length} {reels.length === 1 ? "product" : "products"}
        </p>
      </div>

      {groups.length > 1 && (
        <div className="mb-8">
          <CategoryJumpNav items={groups.map((g) => ({ id: g.id, label: g.label }))} />
        </div>
      )}

      <div className="space-y-12">
        {groups.map((g) => (
          <ProductRow key={g.id} id={g.id} title={g.label} products={g.products} />
        ))}
      </div>
    </div>
  );
}
