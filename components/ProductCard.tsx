"use client";

import Link from "next/link";
import { formatPrice, type ShopifyProduct } from "../lib/shopify";
import { saleInfo } from "../lib/deals";
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
  const sale = saleInfo(product);
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
      className="group relative flex flex-col rounded-xl bg-white border border-pine/10 overflow-hidden hover:border-signal/50 hover:shadow-lg transition-all duration-200"
    >
      {/* image tile */}
      <div className="relative aspect-square bg-[#f1efe9] overflow-hidden">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.url}
            alt={image.altText ?? product.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-pine/30 font-display font-bold uppercase tracking-widest">
            Wallyworld
          </div>
        )}
        {sale && (
          <span className="absolute top-2.5 left-2.5 text-[11px] font-bold uppercase tracking-wide bg-signal text-white px-2 py-1 rounded">
            Save {sale.pct}%
          </span>
        )}
        {outOfStock && (
          <span className="absolute top-2.5 left-2.5 text-[11px] font-bold uppercase tracking-wide bg-pine/90 text-white px-2 py-1 rounded">
            Out of stock
          </span>
        )}
        {!outOfStock && defaultVariant && (
          <button
            onClick={quickAdd}
            className="absolute bottom-2.5 left-2.5 right-2.5 rounded-lg bg-signal hover:bg-signal-dark text-white font-bold text-sm py-2 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 shadow"
            aria-label={`Quick add ${product.title} to cart`}
          >
            Quick Add
          </button>
        )}
      </div>

      {/* details */}
      <div className="flex flex-col flex-1 p-3.5">
        <h3 className="text-sm font-semibold text-pine leading-snug line-clamp-2 group-hover:text-signal transition-colors min-h-[2.6em]">
          {product.title}
        </h3>
        <div className="mt-2 flex items-baseline gap-2 flex-wrap">
          {sale ? (
            <>
              <span className="font-bold text-lg text-signal">
                {formatPrice({
                  amount: String(sale.price),
                  currencyCode: sale.currencyCode,
                })}
              </span>
              <span className="text-sm text-pine/45 line-through">
                {formatPrice({
                  amount: String(sale.compareAt),
                  currencyCode: sale.currencyCode,
                })}
              </span>
            </>
          ) : (
            <span className="font-bold text-lg text-pine">{priceText(product)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
