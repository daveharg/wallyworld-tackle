import Link from "next/link";
import { getProducts, isShopifyConfigured, type ShopifyProduct } from "../../lib/shopify";
import { productsInCategory, rodSubcategoriesOf } from "../../lib/categories";
import ProductCard from "../../components/ProductCard";
import Breadcrumbs from "../../components/Breadcrumbs";
import WalleyeRodGuide from "../../components/WalleyeRodGuide";

export const revalidate = 300;
export const metadata = { title: "Fishing Rods — Wallyworld Tackle" };

function RodGrid({ id, title, products }: { id: string; title: string; products: ShopifyProduct[] }) {
  if (products.length === 0) return null;
  return (
    <section id={id} className="scroll-mt-28">
      <div className="flex items-end justify-between mb-5">
        <h2 className="font-display font-bold uppercase text-3xl md:text-4xl text-pine tracking-wide">
          {title}
        </h2>
      </div>
      {/* Two rows: 2 cols mobile (4 products), 4 cols desktop (8 products) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
        {products.slice(0, 8).map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      {products.length > 8 && (
        <p className="text-sm text-pine/50 mt-4 text-center">
          Showing 8 of {products.length} rods
        </p>
      )}
    </section>
  );
}

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
          <p className="text-sm text-pine/40 mt-2">
            {rods.length} {rods.length === 1 ? "product" : "products"}
          </p>
        </div>

        <div className="space-y-12">
          <RodGrid id="spinning-rods" title="Spinning Rods" products={spinning} />
          <RodGrid id="casting-rods" title="Casting Rods" products={casting} />
        </div>
      </div>
    </>
  );
}
