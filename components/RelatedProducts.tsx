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
      <h2 className="font-display font-bold uppercase text-2xl md:text-3xl text-pine tracking-wide mb-6">
        {title}
      </h2>
      <div className="flex gap-4 md:gap-5 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4">
        {products.slice(0, 8).map((p) => (
          <div key={p.id} className="w-[220px] md:w-[250px] shrink-0">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
