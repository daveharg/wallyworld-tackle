import { getProducts, isShopifyConfigured } from "../../lib/shopify";
import { productsInCategory } from "../../lib/categories";
import ProductListing from "../../components/ProductListing";

export const revalidate = 300;
export const metadata = { title: "Ice Fishing — Wallyworld Tackle" };

export default async function IceFishingPage() {
  if (!isShopifyConfigured()) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <p className="text-pine/60">Store not connected yet. Set your Shopify environment variables.</p>
      </div>
    );
  }
  const products = await getProducts(250);
  const iceFishing = productsInCategory(products, "iceFishing");

  return (
    <ProductListing
      title="Ice Fishing"
      subtitle="Insulated pop-up shelters, ice rods and hardwater gear — everything you need to own the ice."
      products={iceFishing}
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Ice Fishing" }]}
    />
  );
}
