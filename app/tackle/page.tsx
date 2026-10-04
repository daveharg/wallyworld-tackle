import { getProducts, isShopifyConfigured } from "../../lib/shopify";
import { productsInCategory } from "../../lib/categories";
import CategoryRow from "../../components/CategoryRow";

export const revalidate = 300;
export const metadata = { title: "Tackle & More — Wallyworld Tackle" };

export default async function TacklePage() {
  if (!isShopifyConfigured()) {
    return (
      <div className="section">
        <p>Store not connected yet. Set your Shopify environment variables.</p>
      </div>
    );
  }
  const products = await getProducts(100);

  const rows = [
    { id: "jig-heads", title: "Jig Heads", key: "jigHeads" },
    { id: "soft-plastics", title: "Soft Plastics", key: "softPlastics" },
    { id: "hard-baits", title: "Hard Baits", key: "hardBaits" },
    { id: "tackle-boxes", title: "Tackle Boxes", key: "tackleBoxes" },
    { id: "tools", title: "Tools & Accessories", key: "tools" },
    { id: "terminal-tackle", title: "Terminal Tackle", key: "terminalTackle" },
  ] as const;

  return (
    <div className="section">
      <h1>Tackle &amp; More</h1>
      {rows.map((row) => (
        <CategoryRow
          key={row.id}
          id={row.id}
          title={row.title}
          products={productsInCategory(products, row.key)}
        />
      ))}
    </div>
  );
}
