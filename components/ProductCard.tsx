import Link from "next/link";
import { formatPrice, type ShopifyProduct } from "../lib/shopify";

export default function ProductCard({ product }: { product: ShopifyProduct }) {
  const image = product.images[0];
  const price = product.priceRange.minVariantPrice;
  const maxPrice = product.priceRange.maxVariantPrice;
  const priceText =
    price.amount === maxPrice.amount
      ? formatPrice(price)
      : `${formatPrice(price)} – ${formatPrice(maxPrice)}`;

  return (
    <Link href={`/products/${product.handle}`} className="product-card">
      <div className="product-card-image">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt={image.altText ?? product.title} loading="lazy" />
        ) : (
          <div className="product-card-placeholder">Wallyworld Tackle</div>
        )}
      </div>
      <div className="product-card-body">
        <h3 className="product-card-title">{product.title}</h3>
        <p className="product-card-price">{priceText}</p>
      </div>
    </Link>
  );
}
