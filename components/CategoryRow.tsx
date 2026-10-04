import type { ShopifyProduct } from "../lib/shopify";
import ProductCard from "./ProductCard";

export default function CategoryRow({
  id,
  title,
  products,
}: {
  id?: string;
  title: string;
  products: ShopifyProduct[];
}) {
  if (products.length === 0) return null;
  return (
    <section className="category-row" id={id}>
      <h2 className="category-row-title">{title}</h2>
      <div className="category-row-scroll">
        {products.map((p) => (
          <div className="category-row-item" key={p.id}>
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
