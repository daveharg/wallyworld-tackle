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
        <div className="rounded-2xl bg-paper-deep border border-pine/10 p-8 text-center">
          <h2 className="font-display font-bold text-2xl text-pine uppercase">Store not connected yet</h2>
          <p className="text-pine/60 mt-2">Set your Shopify environment variables, then redeploy.</p>
        </div>
      </div>
    );
  }
  const product = await getProductByHandle(params.handle).catch(() => null);
  if (!product) notFound();

  // JSON-LD structured data for Google rich snippets
  const prices = product.variants.map((v) => parseFloat(v.price.amount));
  const lowPrice = Math.min(...prices);
  const highPrice = Math.max(...prices);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description.slice(0, 500),
    image: product.images.map((i) => i.url),
    brand: { "@type": "Brand", name: "Wallyworld Tackle" },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "CAD",
      lowPrice: lowPrice.toFixed(2),
      highPrice: highPrice.toFixed(2),
      offerCount: product.variants.length,
      availability: "https://schema.org/InStock",
    },
  };

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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductDetailClient product={product} related={related} />
    </>
  );
}
