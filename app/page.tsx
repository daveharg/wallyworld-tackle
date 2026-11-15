import Link from "next/link";
import { getProducts, isShopifyConfigured } from "../lib/shopify";
import Hero from "../components/Hero";
import PromoBand from "../components/PromoBand";
import WalleyeCombos from "../components/WalleyeCombos";
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

  return (
    <>
      <Hero />

      <PromoBand />

      <WalleyeCombos />

      <CategoryTiles />

      <DarkBanner />

      <ShopByCategory />

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

      {/* Fishing Guides */}
      <section className="max-w-7xl mx-auto px-4 mt-12 md:mt-16">
        <SectionHeading eyebrow="Fishing Guides" title="Learn something new" />
        <p className="text-pine/70 max-w-2xl -mt-3 mb-8">
          Honest gear advice from people who actually fish. No fluff, no sponsored picks.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <a
            href="/blog/best-budget-spinning-rods-canada"
            className="rounded-xl bg-white border border-pine/10 p-6 hover:border-signal/40 hover:shadow-lg transition-all"
          >
            <h3 className="font-display font-bold uppercase text-xl text-pine tracking-wide mb-2">
              Best Budget Spinning Rods in Canada
            </h3>
            <p className="text-sm text-pine/70 leading-relaxed">
              You don&apos;t need to spend $200+ for a great spinning rod. Our top picks for
              quality budget rods.
            </p>
            <span className="inline-block mt-4 text-signal font-semibold text-sm">Read guide →</span>
          </a>
          <a
            href="/blog/best-budget-spinning-reels-under-50"
            className="rounded-xl bg-white border border-pine/10 p-6 hover:border-signal/40 hover:shadow-lg transition-all"
          >
            <h3 className="font-display font-bold uppercase text-xl text-pine tracking-wide mb-2">
              Best Budget Spinning Reels Under $50
            </h3>
            <p className="text-sm text-pine/70 leading-relaxed">
              Smooth drag, solid build, under fifty bucks. Reels that punch way above their price.
            </p>
            <span className="inline-block mt-4 text-signal font-semibold text-sm">Read guide →</span>
          </a>
        </div>
        <div className="mt-6 text-center">
          <a href="/blog" className="text-signal font-semibold hover:underline">
            View all guides →
          </a>
        </div>
      </section>

      <Newsletter />
    </>
  );
}
