import type { ShopifyProduct } from "../lib/shopify";
import ProductCard from "./ProductCard";

export default function RelatedProducts({
  products,
  title = "You may also like",
}: {
  products: ShopifyProduct[];
  title?: string;
}) {
  if (products.length === 0) return null;
  return (
    <section className="mt-14">
      <h2 className="font-display font-bold uppercase text-2xl md:text-3xl text-white tracking-wide mb-6">
        {title}
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
        {products.slice(0, 4).map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
