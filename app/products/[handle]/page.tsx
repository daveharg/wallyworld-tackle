import { getProducts, isShopifyConfigured } from "../../lib/shopify";
import { productsInCategory } from "../../lib/categories";
import ProductCard from "../../components/ProductCard";

export const revalidate = 300;
export const metadata = { title: "Reels — Wallyworld Tackle" };

export default async function ReelsPage() {
  if (!isShopifyConfigured()) {
    return (
      <div className="section">
        <p>Store not connected yet. Set your Shopify environment variables.</p>
      </div>
    );
  }
  const products = await getProducts(100);
  const reels = productsInCategory(products, "reels");

  return (
    <div className="section">
      <h1>Reels</h1>
      {reels.length === 0 ? (
        <p>No reels found yet — check back soon.</p>
      ) : (
        <div className="product-grid">
          {reels.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
