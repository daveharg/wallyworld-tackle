import { notFound } from "next/navigation";
import { getProductByHandle, getProducts, isShopifyConfigured } from "../../../lib/shopify";
import { categoryOf } from "../../../lib/categories";
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
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="rounded-2xl bg-night-900 border border-night-700 p-8 text-center">
          <h2 className="font-display font-bold text-2xl text-white uppercase">Store not connected yet</h2>
          <p className="text-slate-400 mt-2">Set your Shopify environment variables, then redeploy.</p>
        </div>
      </div>
    );
  }
  const product = await getProductByHandle(params.handle).catch(() => null);
  if (!product) notFound();

  // Related: same category, excluding this product.
  let related: Awaited<ReturnType<typeof getProducts>> = [];
  try {
    const all = await getProducts(100);
    const cat = categoryOf(product);
    related = all.filter((p) => p.handle !== product.handle && categoryOf(p) === cat);
    if (related.length < 4) {
      const others = all.filter(
        (p) => p.handle !== product.handle && categoryOf(p) !== cat
      );
      related = [...related, ...others];
    }
  } catch {
    related = [];
  }

  return <ProductDetailClient product={product} related={related} />;
}
