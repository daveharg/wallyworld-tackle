"use client";

import Link from "next/link";
import { formatPrice, type ShopifyProduct } from "../lib/shopify";
import { useCart } from "./CartContext";
import { variantDisplayLabel } from "../lib/variant-names";

function priceText(product: ShopifyProduct): string {
  const min = product.priceRange.minVariantPrice;
  const max = product.priceRange.maxVariantPrice;
  return min.amount === max.amount
    ? formatPrice(min)
    : `${formatPrice(min)} – ${formatPrice(max)}`;
}

export default function ProductCard({ product }: { product: ShopifyProduct }) {
  const { addItem, openDrawer } = useCart();
  const image = product.images[0];
  const defaultVariant =
    product.variants.find((v) => v.availableForSale) ?? product.variants[0];

  const quickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!defaultVariant) return;
    const label = defaultVariant.selectedOptions
      .map((so) => variantDisplayLabel(product.handle, product.title, so.value))
      .join(" / ");
    addItem(
      {
        variantId: defaultVariant.id,
        productHandle: product.handle,
        productTitle: product.title,
        variantLabel: label === "Default Title" ? product.title : label,
        imageUrl: defaultVariant.image?.url ?? image?.url ?? null,
        price: defaultVariant.price,
      },
      1
    );
    openDrawer();
  };

  const outOfStock = !product.availableForSale;

  return (
    <Link
      href={`/products/${product.handle}`}
      className="group relative flex flex-col rounded-2xl bg-white border border-pine/10 overflow-hidden hover:border-signal/60 hover:shadow-xl hover:-translate-y-1 transition-all duration-200"
    >
      <div className="relative aspect-square bg-paper-deep overflow-hidden">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.url}
            alt={image.altText ?? product.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-pine/40 text-sm">
            Wallyworld Tackle
          </div>
        )}
        {outOfStock && (
          <span className="absolute top-3 left-3 text-[11px] font-bold uppercase tracking-wider bg-pine/90 text-paper px-2.5 py-1 rounded-full">
            Out of stock
          </span>
        )}
        {/* quick add on hover */}
        {!outOfStock && defaultVariant && (
          <button
            onClick={quickAdd}
            className="absolute bottom-3 left-3 right-3 rounded-xl bg-signal hover:bg-signal-dark text-white font-bold text-sm py-2.5 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 shadow-lg"
            aria-label={`Quick add ${product.title} to cart`}
          >
            Quick Add
          </button>
        )}
      </div>
      <div className="flex flex-col flex-1 p-4">
        <h3 className="text-sm font-semibold text-pine leading-snug line-clamp-2 group-hover:text-signal transition-colors">
          {product.title}
        </h3>
        <p className="mt-auto pt-2 font-display font-bold text-lg text-signal">
          {priceText(product)}
        </p>
      </div>
    </Link>
  );
}
