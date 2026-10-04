import { getProducts, isShopifyConfigured } from "../../lib/shopify";
import { productsInCategory } from "../../lib/categories";
import ProductListing from "../../components/ProductListing";

export const revalidate = 300;
export const metadata = { title: "Fishing Rods — Wallyworld Tackle" };

export default async function RodsPage() {
  if (!isShopifyConfigured()) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <p className="text-pine/60">Store not connected yet. Set your Shopify environment variables.</p>
      </div>
    );
  }
  const products = await getProducts(100);
  const rods = productsInCategory(products, "rods");

  return (
    <ProductListing
      title="Fishing Rods"
      subtitle="Spinning and casting rods from 2-piece value sticks to carbon fiber — every length with its own honest price."
      products={rods}
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Rods" }]}
    />
  );
}
