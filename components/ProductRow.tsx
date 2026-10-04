import Link from "next/link";
import type { ShopifyProduct } from "../lib/shopify";
import ProductCard from "./ProductCard";

/**
 * Horizontal-scroll product row: one category per row, same-sized cards.
 * Used across the homepage and tackle page, matching the original storefront.
 */
export default function ProductRow({
  id,
  eyebrow,
  title,
  href,
  linkLabel,
  products,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  href?: string;
  linkLabel?: string;
  products: ShopifyProduct[];
}) {
  if (products.length === 0) return null;
  return (
    <section id={id} className="scroll-mt-28">
      <div className="flex items-end justify-between mb-5">
        <div>
          {eyebrow && (
            <p className="text-signal text-xs font-bold uppercase tracking-[0.2em] mb-1.5">
              {eyebrow}
            </p>
          )}
          <h2 className="font-display font-bold uppercase text-3xl md:text-4xl text-pine tracking-wide">
            {title}
          </h2>
        </div>
        {href && (
          <Link
            href={href}
            className="hidden sm:inline text-sm font-semibold text-signal hover:text-signal-dark shrink-0"
          >
            {linkLabel ?? "View all →"}
          </Link>
        )}
      </div>
      <div className="flex gap-4 md:gap-5 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4">
        {products.map((p) => (
          <div key={p.id} className="w-[220px] md:w-[250px] shrink-0">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Category jump nav: pill buttons that scroll to each product row.
 */
export function CategoryJumpNav({
  items,
}: {
  items: { id: string; label: string }[];
}) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar py-1" aria-label="Jump to category">
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className="shrink-0 rounded-full border-2 border-pine/15 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-pine/75 hover:border-signal hover:text-signal transition whitespace-nowrap"
        >
          {item.label}
        </a>
      ))}
    </div>
  );
}
