import { notFound } from "next/navigation";
import { getProductByHandle, isShopifyConfigured } from "../../../lib/shopify";
import ProductDetailClient from "./ProductDetailClient";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: { handle: string } }) {
  if (!isShopifyConfigured()) return { title: "Product — Wallyworld Tackle" };
  const product = await getProductByHandle(params.handle).catch(() => null);
  return {
    title: product ? `${product.title} — Wallyworld Tackle` : "Product — Wallyworld Tackle",
  };
}

export default async function ProductPage({ params }: { params: { handle: string } }) {
  if (!isShopifyConfigured()) {
    return (
      <div className="section">
        <p>Store not connected yet. Set your Shopify environment variables.</p>
      </div>
    );
  }
  const product = await getProductByHandle(params.handle).catch(() => null);
  if (!product) notFound();
  return <ProductDetailClient product={product} />;
}
