import { getProducts, isShopifyConfigured } from "../../lib/shopify";
import { productsInCategory, rodSubcategoriesOf } from "../../lib/categories";
import Breadcrumbs from "../../components/Breadcrumbs";
import WalleyeRodGuide from "../../components/WalleyeRodGuide";
import RodsClient from "./RodsClient";

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
  const products = await getProducts(250);
  const rods = productsInCategory(products, "rods");

  const spinning = rods.filter((p) => rodSubcategoriesOf(p).includes("spinning"));
  const casting = rods.filter((p) => rodSubcategoriesOf(p).includes("casting"));

  return (
    <>
      <WalleyeRodGuide />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Breadcrumbs trail={[{ label: "Home", href: "/" }, { label: "Rods" }]} />

        <div className="mt-3 mb-6">
          <h1 className="font-display font-bold uppercase text-4xl md:text-5xl text-pine tracking-wide">
            Fishing Rods
          </h1>
          <p className="text-pine/60 mt-2 max-w-2xl">
            Spinning and casting rods — every length with its own honest price.
          </p>
        </div>

        <RodsClient spinning={spinning} casting={casting} total={rods.length} />
      </div>
    </>
  );
}
