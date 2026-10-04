import Link from "next/link";
import { getProducts, isShopifyConfigured } from "../lib/shopify";
import { productsInCategory } from "../lib/categories";
import CategoryRow from "../components/CategoryRow";
import ProductCard from "../components/ProductCard";

export const revalidate = 300;

function NotConfigured() {
  return (
    <div className="section">
      <div className="not-configured">
        <h2>Store not connected yet</h2>
        <p>
          Set <code>NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN</code> and{" "}
          <code>NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN</code> in your environment
          (see <code>.env.example</code>), then redeploy.
        </p>
      </div>
    </div>
  );
}

export default async function HomePage() {
  if (!isShopifyConfigured()) return <NotConfigured />;

  let products: Awaited<ReturnType<typeof getProducts>> = [];
  try {
    products = await getProducts(100);
  } catch (e) {
    return (
      <div className="section">
        <div className="not-configured">
          <h2>Couldn&apos;t load products</h2>
          <p>{e instanceof Error ? e.message : "Unknown error"}</p>
        </div>
      </div>
    );
  }

  const featured = products.slice(0, 8);
  const rods = productsInCategory(products, "rods").slice(0, 10);
  const reels = productsInCategory(products, "reels").slice(0, 10);
  const hardBaits = productsInCategory(products, "hardBaits").slice(0, 10);

  return (
    <>
      <section className="hero">
        <h1>Wallyworld Tackle</h1>
        <p>good gear, low prices</p>
        <div className="hero-ctas">
          <Link href="/rods" className="btn">
            See the Rods
          </Link>
          <Link href="/reels" className="btn">
            See the Reels
          </Link>
        </div>
      </section>

      <div className="section">
        <h2>Featured Tackle</h2>
        <div className="product-grid">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>

      <CategoryRow title="Rods" products={rods} />
      <CategoryRow title="Reels" products={reels} />
      <CategoryRow title="Hard Baits" products={hardBaits} />

      <div className="section" style={{ textAlign: "center" }}>
        <Link href="/tackle" className="btn btn-secondary">
          See all tackle &amp; more
        </Link>
      </div>
    </>
  );
}
