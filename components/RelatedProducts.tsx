import type { ShopifyProduct } from "../lib/shopify";
import ProductCarousel from "./ProductCarousel";

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
      <ProductCarousel products={products.slice(0, 8)} cardWidth="w-[220px] md:w-[250px]" />
    </section>
  );
}
