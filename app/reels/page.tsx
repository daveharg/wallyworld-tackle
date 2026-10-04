import { getProducts, isShopifyConfigured } from "../../lib/shopify";
import { productsInCategory } from "../../lib/categories";
import ReelsClient from "./ReelsClient";

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

  return <ReelsClient products={reels} />;
}
