import Link from "next/link";
import { getProducts, isShopifyConfigured } from "../lib/shopify";
import { productsInCategory } from "../lib/categories";
import Hero from "../components/Hero";
import PromoBand from "../components/PromoBand";
import ProductCarousel from "../components/ProductCarousel";
import CategoryTiles from "../components/CategoryTiles";
import DarkBanner from "../components/DarkBanner";
import ShopByCategory from "../components/ShopByCategory";
import Newsletter from "../components/Newsletter";

export const revalidate = 300;

function NotConfigured() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <div className="rounded-2xl bg-paper-deep border border-signal/30 p-8 text-center">
        <h2 className="font-display font-bold text-2xl text-pine uppercase">Store not connected yet</h2>
        <p className="text-pine/60 mt-2">
          Set <code className="text-signal">NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN</code> and{" "}
          <code className="text-signal">NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN</code> in
          your environment, then redeploy.
        </p>
      </div>
    </div>
  );
}

const PLAYBOOK_TIPS = [
  {
    title: "Cloud cover",
    body: "Overcast skies push walleye and pike shallow and keep them feeding longer. Bright bluebird days? Fish deeper structure or wait for low light.",
  },
  {
    title: "Barometric pressure",
    body: "A steady or slowly falling barometer ahead of a front is prime time. After the front passes and pressure spikes, slow down and downsize your presentation.",
  },
  {
    title: "Wind & waves",
    body: "Wind stacking into a shoreline concentrates baitfish — and the predators follow. A chop also breaks up light penetration, making fish less wary.",
  },
  {
    title: "Storm fronts",
    body: "The hours before a storm front arrives can be the best bite of the week. Fish it hard, then give the lake a day to settle after it passes.",
  },
];

function SectionHeading({
  eyebrow,
  title,
  href,
  linkLabel,
}: {
  eyebrow?: string;
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        {eyebrow && (
          <p className="text-signal text-xs font-bold uppercase tracking-[0.24em] mb-1.5">
            {eyebrow}
          </p>
        )}
        <h2 className="font-display font-bold uppercase text-3xl md:text-4xl text-pine tracking-wide">
          {title}
        </h2>
      </div>
      {href && (
        <Link
          href={href}
          className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold text-signal hover:text-signal-dark uppercase tracking-wider"
        >
          {linkLabel ?? "Shop all"}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14m-6-6 6 6-6 6" />
          </svg>
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
        <div className="rounded-2xl bg-paper-deep border border-red-500/30 p-8 text-center">
          <h2 className="font-display font-bold text-2xl text-pine uppercase">Couldn&apos;t load products</h2>
          <p className="text-pine/60 mt-2">{e instanceof Error ? e.message : "Unknown error"}</p>
        </div>
      </div>
    );
  }

  // Recommended Walleye Products: jig heads first, then walleye-sized
  // spinning reels (1000–4000 series), then walleye hard baits (minnow/crankbait).
  const walleyeSizeRe = /(1000|2000|2500|3000|4000)/;
  const walleyeHardBaitRe = /(minnow|crankbait|jerkbait)/;
  const jigs = productsInCategory(products, "jigHeads");
  const reels = productsInCategory(products, "reels");
  const walleyeReels = reels.filter((p) =>
    walleyeSizeRe.test(`${p.title} ${p.tags.join(" ")}`.toLowerCase())
  );
  const otherReels = reels.filter((p) => !walleyeReels.includes(p));
  const walleyeBaits = productsInCategory(products, "hardBaits").filter((p) =>
    walleyeHardBaitRe.test(`${p.title} ${p.tags.join(" ")}`.toLowerCase())
  );
  const walleyePicks = [...jigs, ...walleyeReels, ...walleyeBaits, ...otherReels].slice(0, 8);

  // Dave's Picks: prefer tagged products, else top reels/rods.
  const tagged = products.filter((p) => p.tags.some((t) => /dave'?s.?pick/i.test(t)));
  const picks =
    tagged.length > 0
      ? tagged.slice(0, 10)
      : [...productsInCategory(products, "reels"), ...productsInCategory(products, "rods")].slice(0, 10);

  return (
    <>
      <Hero />

      <PromoBand />

      {/* Recommended Walleye Products */}
      {walleyePicks.length > 0 && (
        <section id="walleye-picks" className="max-w-7xl mx-auto px-4 mt-12 md:mt-16 scroll-mt-32">
          <SectionHeading eyebrow="Dave's walleye picks" title="Recommended Walleye Products" href="/tackle" />
          <ProductCarousel products={walleyePicks} />
        </section>
      )}

      <CategoryTiles />

      <DarkBanner />

      <ShopByCategory />

      {/* Dave's Picks */}
      {picks.length > 0 && (
        <section id="daves-picks" className="max-w-7xl mx-auto px-4 mt-12 md:mt-16 scroll-mt-32">
          <SectionHeading eyebrow="Hand-chosen by Dave" title="Dave's Picks" href="/reels" />
          <ProductCarousel products={picks} />
        </section>
      )}

      {/* Playbook */}
      <section id="playbook" className="max-w-7xl mx-auto px-4 mt-12 md:mt-16 scroll-mt-32">
        <SectionHeading eyebrow="The Playbook" title="Read the water like a local" />
        <p className="text-pine/70 max-w-2xl -mt-3 mb-8">
          Gear matters, but timing matters more. Here&apos;s how the conditions tell you
          whether the fish are biting — before you even launch the boat.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLAYBOOK_TIPS.map((tip) => (
            <div key={tip.title} className="rounded-xl bg-white border border-pine/10 p-6">
              <h3 className="font-display font-bold uppercase text-xl text-pine tracking-wide mb-2">
                {tip.title}
              </h3>
              <p className="text-sm text-pine/70 leading-relaxed">{tip.body}</p>
            </div>
          ))}
        </div>
      </section>

      <Newsletter />
    </>
  );
}
