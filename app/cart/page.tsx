import { getProducts, isShopifyConfigured } from "../../lib/shopify";
import { productsInCategory } from "../../lib/categories";
import CategoryRow from "../../components/CategoryRow";

export const revalidate = 300;
export const metadata = { title: "Rods — Wallyworld Tackle" };

export default async function RodsPage() {
  if (!isShopifyConfigured()) {
    return (
      <div className="section">
        <p>Store not connected yet. Set your Shopify environment variables.</p>
      </div>
    );
  }
  const products = await getProducts(100);
  const rods = productsInCategory(products, "rods");

  // Split rods into simple sub-rows by keyword for horizontal scrolling sections.
  const spinning = rods.filter((p) => /spinning/i.test(p.title));
  const casting = rods.filter((p) => /casting/i.test(p.title));
  const rest = rods.filter((p) => !/spinning/i.test(p.title) && !/casting/i.test(p.title));

  return (
    <div className="section">
      <h1>Rods</h1>
      {rods.length === 0 && <p>No rods found yet — check back soon.</p>}
      <CategoryRow id="spinning" title="Spinning Rods" products={spinning} />
      <CategoryRow id="casting" title="Casting Rods" products={casting} />
      <CategoryRow id="other-rods" title="Other Rods" products={rest} />
    </div>
  );
}
