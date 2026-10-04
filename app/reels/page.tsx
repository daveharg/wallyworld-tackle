import { getProducts, isShopifyConfigured } from "../../lib/shopify";
import { productsInCategory } from "../../lib/categories";
import ProductListing from "../../components/ProductListing";

export const revalidate = 300;
export const metadata = { title: "Fishing Reels — Wallyworld Tackle" };

export default async function ReelsPage() {
  if (!isShopifyConfigured()) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <p className="text-slate-400">Store not connected yet. Set your Shopify environment variables.</p>
      </div>
    );
  }
  const products = await getProducts(100);
  const reels = productsInCategory(products, "reels");

  return (
    <ProductListing
      title="Fishing Reels"
      subtitle="Spinning reels from 1000 to 5000 series — smooth drags, metal spools, prices that make sense."
      products={reels}
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Reels" }]}
    />
  );
}
