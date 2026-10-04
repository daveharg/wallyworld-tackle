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
      className="group relative flex flex-col rounded-2xl bg-night-900 border border-night-700 overflow-hidden hover:border-ember-500/60 hover:shadow-xl hover:shadow-ember-600/10 hover:-translate-y-1 transition-all duration-200"
    >
      <div className="relative aspect-square bg-white overflow-hidden">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.url}
            alt={image.altText ?? product.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-slate-400 text-sm bg-night-800">
            Wallyworld Tackle
          </div>
        )}
        {outOfStock && (
          <span className="absolute top-3 left-3 text-[11px] font-bold uppercase tracking-wider bg-night-950/85 text-slate-300 px-2.5 py-1 rounded-full">
            Out of stock
          </span>
        )}
        {/* quick add on hover */}
        {!outOfStock && defaultVariant && (
          <button
            onClick={quickAdd}
            className="absolute bottom-3 left-3 right-3 rounded-xl bg-ember-500 hover:bg-ember-600 text-night-950 font-bold text-sm py-2.5 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 shadow-lg"
            aria-label={`Quick add ${product.title} to cart`}
          >
            Quick Add
          </button>
        )}
      </div>
      <div className="flex flex-col flex-1 p-4">
        <h3 className="text-sm font-semibold text-slate-100 leading-snug line-clamp-2 group-hover:text-ember-400 transition-colors">
          {product.title}
        </h3>
        <p className="mt-auto pt-2 font-display font-bold text-lg text-ember-400">
          {priceText(product)}
        </p>
      </div>
    </Link>
  );
}
