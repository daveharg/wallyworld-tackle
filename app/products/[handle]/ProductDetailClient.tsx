"use client";

import { useMemo, useState } from "react";
import { formatPrice, type ShopifyProduct } from "../../../lib/shopify";
import { variantDisplayLabel } from "../../../lib/variant-names";
import VariantSelector from "../../../components/VariantSelector";
import { useCart } from "../../../components/CartContext";

export default function ProductDetailClient({ product }: { product: ShopifyProduct }) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);

  // One selector per product option (usually just one, e.g. "Size" or "Title").
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
  };

  const mainImage = selectedVariant?.image ?? product.images[0];

  return (
    <div className="product-detail">
      <div className="product-detail-image">
        {mainImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mainImage.url} alt={mainImage.altText ?? product.title} />
        ) : (
          <div className="product-card-placeholder">Wallyworld Tackle</div>
        )}
      </div>

      <div className="product-detail-info">
        <h1>{product.title}</h1>
        {selectedVariant && (
          <p className="product-detail-price">{formatPrice(selectedVariant.price)}</p>
        )}

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

        {selectedVariant && (
          <p style={{ color: selectedVariant.availableForSale ? "#15803d" : "#b91c1c" }}>
            {selectedVariant.availableForSale ? "In stock" : "Out of stock"}
          </p>
        )}

        <div className="qty-row">
          <div className="qty-control">
            <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
              −
            </button>
            <span>{quantity}</span>
            <button type="button" onClick={() => setQuantity((q) => q + 1)} aria-label="Increase quantity">
              +
            </button>
          </div>
          <button
            type="button"
            className="btn"
            onClick={handleAdd}
            disabled={!selectedVariant?.availableForSale}
          >
            Add to Cart
          </button>
        </div>

        {product.descriptionHtml ? (
          <div
            className="product-detail-description"
            dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
          />
        ) : (
          <p className="product-detail-description">{product.description}</p>
        )}
      </div>
    </div>
  );
}
