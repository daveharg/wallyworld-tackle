import { getProducts, isShopifyConfigured } from "../../lib/shopify";
import ProductCard from "../../components/ProductCard";
import Breadcrumbs from "../../components/Breadcrumbs";

export const revalidate = 300;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = (searchParams.q ?? "").trim().toLowerCase();

  if (!isShopifyConfigured()) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <p className="text-slate-400">Store not connected yet. Set your Shopify environment variables.</p>
      </div>
    );
  }

  const products = await getProducts(150);
  const results = q
    ? products.filter((p) =>
        `${p.title} ${p.description} ${p.tags.join(" ")} ${p.productType}`.toLowerCase().includes(q)
      )
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Breadcrumbs trail={[{ label: "Home", href: "/" }, { label: "Search" }]} />
      <h1 className="font-display font-bold uppercase text-4xl text-white tracking-wide mt-3">
        {q ? (
          <>
            Results for <span className="text-ember-400">“{searchParams.q}”</span>
          </>
        ) : (
          "Search"
        )}
      </h1>
      <p className="text-slate-500 text-sm mt-2">
        {results.length} {results.length === 1 ? "product" : "products"} found
      </p>

      {results.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-slate-400 text-lg">
            {q ? "Nothing matched that search. Try “rod”, “reel”, “jig” or “crankbait”." : "Type something in the search bar above."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5 mt-8">
          {results.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
