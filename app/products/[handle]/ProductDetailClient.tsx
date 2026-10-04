"use client";

import { useMemo, useState } from "react";
import { formatPrice, type ShopifyProduct } from "../../../lib/shopify";
import { variantDisplayLabel } from "../../../lib/variant-names";
import VariantSelector from "../../../components/VariantSelector";
import ProductGallery from "../../../components/ProductGallery";
import StockBadge from "../../../components/StockBadge";
import ProductTabs from "../../../components/ProductTabs";
import RelatedProducts from "../../../components/RelatedProducts";
import Breadcrumbs from "../../../components/Breadcrumbs";
import { useCart } from "../../../components/CartContext";

function categoryHref(handle: string, title: string): string {
  const t = `${title}`.toLowerCase();
  if (/\brod\b/.test(t)) return "/rods";
  if (/\breel\b/.test(t)) return "/reels";
  return "/tackle";
}

function categoryLabel(handle: string, title: string): string {
  const t = `${title}`.toLowerCase();
  if (/\brod\b/.test(t)) return "Rods";
  if (/\breel\b/.test(t)) return "Reels";
  return "Tackle & More";
}

export default function ProductDetailClient({
  product,
  related,
}: {
  product: ShopifyProduct;
  related: ShopifyProduct[];
}) {
  const { addItem, openDrawer } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const opt of product.options) {
      initial[opt.name] = opt.values[0];
    }
    return initial;
  });

  const selectedVariant = useMemo(() => {
    return (
      product.variants.find((v) =>
        v.selectedOptions.every((so) => selectedOptions[so.name] === so.value)
      ) ?? product.variants[0]
    );
  }, [product.variants, selectedOptions]);

  const selectedLabel = useMemo(() => {
    if (!selectedVariant) return product.title;
    const parts = selectedVariant.selectedOptions.map((so) =>
      variantDisplayLabel(product.handle, product.title, so.value)
    );
    const label = parts.join(" / ");
    return label === "Default Title" ? product.title : label;
  }, [selectedVariant, product]);

  const handleAdd = () => {
    if (!selectedVariant) return;
    addItem(
      {
        variantId: selectedVariant.id,
        productHandle: product.handle,
        productTitle: product.title,
        variantLabel: selectedLabel,
        imageUrl: selectedVariant.image?.url ?? product.images[0]?.url ?? null,
        price: selectedVariant.price,
      },
      quantity
    );
    setQuantity(1);
    setAdded(true);
    openDrawer();
    window.setTimeout(() => setAdded(false), 2500);
  };

  const galleryImages = useMemo(() => {
    const imgs = [...product.images];
    // Prefer the selected variant's image first when it exists.
    if (selectedVariant?.image && !imgs.some((i) => i.url === selectedVariant.image!.url)) {
      imgs.unshift(selectedVariant.image);
    }
    return imgs;
  }, [product.images, selectedVariant]);

  const specs = useMemo(() => {
    const rows: { label: string; value: string }[] = [];
    if (product.vendor) rows.push({ label: "Brand", value: product.vendor });
    if (selectedVariant) {
      for (const so of selectedVariant.selectedOptions) {
        if (so.value === "Default Title") continue;
        rows.push({
          label: so.name,
          value: variantDisplayLabel(product.handle, product.title, so.value),
        });
      }
    }
    rows.push({
      label: "Price",
      value: selectedVariant ? formatPrice(selectedVariant.price) : "—",
    });
    return rows;
  }, [product, selectedVariant]);

  const catHref = categoryHref(product.handle, product.title);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Breadcrumbs
        trail={[
          { label: "Home", href: "/" },
          { label: categoryLabel(product.handle, product.title), href: catHref },
          { label: product.title },
        ]}
      />

      <div className="grid lg:grid-cols-2 gap-10 mt-6">
        <ProductGallery images={galleryImages} title={product.title} />

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-signal mb-2">
            {categoryLabel(product.handle, product.title)}
          </p>
          <h1 className="font-display font-bold uppercase text-3xl md:text-4xl text-pine tracking-wide leading-tight">
            {product.title}
          </h1>

          <div className="flex items-center gap-3 mt-4">
            {selectedVariant && (
              <p className="font-display font-bold text-3xl text-signal">
                {formatPrice(selectedVariant.price)}
              </p>
            )}
            <StockBadge variant={selectedVariant} />
          </div>

          <div className="mt-6">
            {product.options
              .filter((opt) => !(opt.values.length === 1 && opt.values[0] === "Default Title"))
              .map((opt) => (
                <VariantSelector
                  key={opt.name}
                  optionName={opt.name}
                  productHandle={product.handle}
                  productTitle={product.title}
                  values={opt.values}
                  selected={selectedOptions[opt.name]}
                  onSelect={(value) =>
                    setSelectedOptions((prev) => ({ ...prev, [opt.name]: value }))
                  }
                />
              ))}
          </div>

          {/* qty + add to cart */}
          <div className="flex flex-wrap items-stretch gap-3 mt-2">
            <div className="flex items-center rounded-xl border-2 border-pine/15 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                className="px-4 py-3 text-xl text-pine/60 hover:bg-paper-deep hover:text-pine transition"
              >
                −
              </button>
              <span className="min-w-[3rem] text-center font-bold text-lg text-pine">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                aria-label="Increase quantity"
                className="px-4 py-3 text-xl text-pine/60 hover:bg-paper-deep hover:text-pine transition"
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!selectedVariant?.availableForSale}
              className="flex-1 min-w-[200px] rounded-xl bg-signal hover:bg-signal-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-lg px-8 py-3.5 transition shadow-lg"
            >
              {added ? "Added to Cart ✓" : "Add to Cart"}
            </button>
          </div>

          {/* reassurances */}
          <div className="grid grid-cols-3 gap-2 mt-6 text-center">
            {[
              { t: "Free ship $75+", s: "Tracked delivery" },
              { t: "30-Day Returns", s: "Hassle-free" },
              { t: "Secure Checkout", s: "Via Shopify" },
            ].map((r) => (
              <div key={r.t} className="rounded-xl bg-paper-deep border border-pine/10 px-2 py-3">
                <p className="text-xs font-bold text-pine">{r.t}</p>
                <p className="text-[11px] text-pine/50 mt-0.5">{r.s}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ProductTabs
        descriptionHtml={product.descriptionHtml}
        description={product.description}
        specs={specs}
      />

      <RelatedProducts products={related} />
    </div>
  );
}
