import { getProducts, isShopifyConfigured } from "../../lib/shopify";
import { categoryOf, type CategoryKey } from "../../lib/categories";
import ProductListing from "../../components/ProductListing";

export const revalidate = 300;
export const metadata = { title: "Tackle & More — Wallyworld Tackle" };

const TACKLE_KEYS: CategoryKey[] = [
  "jigHeads",
  "softPlastics",
  "hardBaits",
  "tackleBoxes",
  "tools",
  "terminalTackle",
];

const ROW_GROUPS: { key: CategoryKey; id: string; label: string }[] = [
  { key: "jigHeads", id: "jig-heads", label: "Jig Heads" },
  { key: "softPlastics", id: "soft-plastics", label: "Soft Plastics" },
  { key: "hardBaits", id: "hard-baits", label: "Hard Baits" },
  { key: "tackleBoxes", id: "tackle-boxes", label: "Tackle Boxes" },
  { key: "tools", id: "tools", label: "Tools & Accessories" },
  { key: "terminalTackle", id: "terminal-tackle", label: "Terminal Tackle" },
];

export default async function TacklePage() {
  if (!isShopifyConfigured()) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <p className="text-pine/60">Store not connected yet. Set your Shopify environment variables.</p>
      </div>
    );
  }
  const products = await getProducts(100);
  const tackle = products.filter((p) => TACKLE_KEYS.includes(categoryOf(p)));

  return (
    <ProductListing
      title="Tackle & More"
      subtitle="Jigs, plastics, hard baits, boxes, tools and terminal tackle — everything else you need in the boat."
      products={tackle}
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Tackle & More" }]}
      rowGroups={ROW_GROUPS}
    />
  );
}
