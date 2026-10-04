import Link from "next/link";
import { getProducts, isShopifyConfigured } from "../lib/shopify";
import { productsInCategory } from "../lib/categories";
import Hero from "../components/Hero";
import TrustBar from "../components/TrustBar";
import CategoryCards from "../components/CategoryCards";
import Testimonials from "../components/Testimonials";
import ProductCard from "../components/ProductCard";

export const revalidate = 300;

function NotConfigured() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <div className="rounded-2xl bg-night-900 border border-ember-500/30 p-8 text-center">
        <h2 className="font-display font-bold text-2xl text-white uppercase">Store not connected yet</h2>
        <p className="text-slate-400 mt-2">
          Set <code className="text-ember-400">NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN</code> and{" "}
          <code className="text-ember-400">NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN</code> in
          your environment (see <code className="text-ember-400">.env.example</code>), then redeploy.
        </p>
      </div>
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  href,
  linkLabel,
}: {
  eyebrow: string;
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-end justify-between mb-7">
      <div>
        <p className="text-ember-400 text-xs font-bold uppercase tracking-[0.2em] mb-2">{eyebrow}</p>
        <h2 className="font-display font-bold uppercase text-3xl md:text-4xl text-white tracking-wide">
          {title}
        </h2>
      </div>
      {href && (
        <Link href={href} className="hidden sm:inline text-sm font-semibold text-ember-400 hover:text-ember-500 shrink-0">
          {linkLabel ?? "View all →"}
        </Link>
      )}
    </div>
  );
}

export default async function HomePage() {
  if (!isShopifyConfigured()) return <NotConfigured />;

  let products: Awaited<ReturnType<typeof getProducts>> = [];
  try {
    products = await getProducts(100);
  } catch (e) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="rounded-2xl bg-night-900 border border-red-500/30 p-8 text-center">
          <h2 className="font-display font-bold text-2xl text-white uppercase">Couldn&apos;t load products</h2>
          <p className="text-slate-400 mt-2">{e instanceof Error ? e.message : "Unknown error"}</p>
        </div>
      </div>
    );
  }

  const featured = products.slice(0, 8);
  // "Dave's Picks": prefer products tagged daves-pick / dave's pick, else top reels/rods.
  const davesPicks = products.filter((p) =>
    p.tags.some((t) => /dave'?s.?pick/i.test(t))
  );
  const picks =
    davesPicks.length > 0
      ? davesPicks.slice(0, 4)
      : [...productsInCategory(products, "reels"), ...productsInCategory(products, "rods")].slice(0, 4);

  const rods = productsInCategory(products, "rods").slice(0, 10);
  const reels = productsInCategory(products, "reels").slice(0, 10);
  const hardBaits = productsInCategory(products, "hardBaits").slice(0, 10);

  return (
    <>
      <Hero />
      <TrustBar />
      <CategoryCards />

      {/* featured products */}
      <section className="max-w-7xl mx-auto px-4 py-6">
        <SectionHead eyebrow="Fresh stock" title="Featured Tackle" href="/tackle" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Dave's picks banner */}
      {picks.length > 0 && (
        <section className="my-14 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-ember-600/15 via-night-900 to-night-900" />
          <div className="absolute inset-0 hero-grid-overlay opacity-60" />
          <div className="relative max-w-7xl mx-auto px-4 py-12">
            <div className="flex items-center gap-3 mb-2">
              <span className="grid place-items-center w-10 h-10 rounded-full bg-ember-500 text-night-950 font-display font-bold text-lg">
                D
              </span>
              <p className="text-ember-400 text-xs font-bold uppercase tracking-[0.2em]">
                Hand-chosen by Dave
              </p>
            </div>
            <h2 className="font-display font-bold uppercase text-3xl md:text-4xl text-white tracking-wide mb-7">
              Dave&apos;s Picks
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
              {picks.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      <Testimonials />

      {/* category rows */}
      <section className="max-w-7xl mx-auto px-4 py-14 space-y-12">
        {[
          { title: "Rods", href: "/rods", items: rods },
          { title: "Reels", href: "/reels", items: reels },
          { title: "Hard Baits", href: "/tackle#hard-baits", items: hardBaits },
        ].map(
          (row) =>
            row.items.length > 0 && (
              <div key={row.title}>
                <SectionHead eyebrow="Top sellers" title={row.title} href={row.href} />
                <div className="flex gap-4 md:gap-5 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4">
                  {row.items.map((p) => (
                    <div key={p.id} className="w-[220px] md:w-[250px] shrink-0">
                      <ProductCard product={p} />
                    </div>
                  ))}
                </div>
              </div>
            )
        )}
      </section>

      {/* value prop band */}
      <section className="max-w-7xl mx-auto px-4 pb-16">
        <div className="rounded-3xl overflow-hidden border border-night-700 bg-gradient-to-br from-night-800 to-night-900 p-8 md:p-12 text-center relative">
          <div className="absolute inset-0 hero-grid-overlay opacity-40" />
          <div className="relative">
            <h2 className="font-display font-bold uppercase text-3xl md:text-4xl text-white tracking-wide">
              Why Wallyworld?
            </h2>
            <p className="text-slate-300 max-w-2xl mx-auto mt-4 leading-relaxed">
              We cut out the middleman markup. Every rod, reel and lure is chosen for
              performance per dollar and shipped direct from our suppliers — so you pay
              for the gear, not the brand name on the box.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link
                href="/rods"
                className="rounded-xl bg-ember-500 hover:bg-ember-600 text-night-950 font-bold px-7 py-3.5 transition shadow-xl shadow-ember-600/25"
              >
                See the Rods
              </Link>
              <Link
                href="/tackle"
                className="rounded-xl bg-night-700 hover:bg-night-600 border border-night-600 text-white font-bold px-7 py-3.5 transition"
              >
                Browse Tackle
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
