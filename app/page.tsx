import Link from "next/link";
import { getProducts, isShopifyConfigured } from "../lib/shopify";
import { productsInCategory, type CategoryKey } from "../lib/categories";
import Hero from "../components/Hero";
import ProductRow, { CategoryJumpNav } from "../components/ProductRow";
import ProductCard from "../components/ProductCard";

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

const ROWS: { key: CategoryKey; id: string; label: string; href: string; eyebrow: string }[] = [
  { key: "rods", id: "row-rods", label: "Rods", href: "/rods", eyebrow: "Top sellers" },
  { key: "reels", id: "row-reels", label: "Reels", href: "/reels", eyebrow: "Top sellers" },
  { key: "jigHeads", id: "row-jig-heads", label: "Jig Heads", href: "/tackle#jig-heads", eyebrow: "Tackle & more" },
  { key: "softPlastics", id: "row-soft-plastics", label: "Soft Plastics", href: "/tackle#soft-plastics", eyebrow: "Tackle & more" },
  { key: "hardBaits", id: "row-hard-baits", label: "Hard Baits", href: "/tackle#hard-baits", eyebrow: "Tackle & more" },
  { key: "tackleBoxes", id: "row-tackle-boxes", label: "Tackle Boxes", href: "/tackle#tackle-boxes", eyebrow: "Tackle & more" },
  { key: "tools", id: "row-tools", label: "Tools & Accessories", href: "/tackle#tools", eyebrow: "Tackle & more" },
  { key: "terminalTackle", id: "row-terminal-tackle", label: "Terminal Tackle", href: "/tackle#terminal-tackle", eyebrow: "Tackle & more" },
];

const SPECIES: { name: string; blurb: string; img: string; href: string }[] = [
  {
    name: "Walleye",
    blurb: "Jigs, crankbaits & live-bait rigs",
    img: "https://images.unsplash.com/photo-1524704654690-b56c05c78a00?auto=format&fit=crop&w=800&q=70",
    href: "/tackle",
  },
  {
    name: "Pike",
    blurb: "Spinnerbaits, spoons & leaders",
    img: "https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b3?auto=format&fit=crop&w=800&q=70",
    href: "/tackle",
  },
  {
    name: "Trout",
    blurb: "Light rods, spinners & plastics",
    img: "https://images.unsplash.com/photo-1499242611767-cf8b9be02854?auto=format&fit=crop&w=800&q=70",
    href: "/rods",
  },
  {
    name: "Perch",
    blurb: "Small jigs & soft plastics",
    img: "https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=800&q=70",
    href: "/tackle",
  },
  {
    name: "Crappie",
    blurb: "Panfish jigs & light tackle",
    img: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=70",
    href: "/tackle",
  },
  {
    name: "Bass",
    blurb: "Casting gear & hard baits",
    img: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=70",
    href: "/rods",
  },
];

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

  const rows = ROWS.map((r) => ({ ...r, products: productsInCategory(products, r.key).slice(0, 12) }))
    .filter((r) => r.products.length > 0);

  // "Dave's Picks": prefer products tagged daves-pick / dave's pick, else top reels/rods.
  const davesPicks = products.filter((p) => p.tags.some((t) => /dave'?s.?pick/i.test(t)));
  const picks =
    davesPicks.length > 0
      ? davesPicks.slice(0, 8)
      : [...productsInCategory(products, "reels"), ...productsInCategory(products, "rods")].slice(0, 8);

  return (
    <>
      <Hero />

      {/* origin / value note */}
      <section className="bg-paper-deep border-y border-pine/10">
        <div className="max-w-4xl mx-auto px-4 py-10 text-center">
          <p className="text-pine/70 leading-relaxed">
            We&apos;re anglers from Winnipeg who got tired of paying the logo tax. Every rod,
            reel and lure here was <strong className="text-pine">chosen</strong> for
            performance per dollar and shipped direct from our suppliers — so you pay for
            the gear, not the brand name on the box.{" "}
            <span className="italic">Good gear, low prices.</span>
          </p>
        </div>
      </section>

      {/* Dave's Picks — dark pine band */}
      {picks.length > 0 && (
        <section className="bg-pine text-paper">
          <div className="max-w-7xl mx-auto px-4 py-12">
            <div className="flex items-center gap-3 mb-1.5">
              <span className="grid place-items-center w-10 h-10 rounded-full bg-signal text-white font-display font-bold text-lg">
                D
              </span>
              <p className="text-gold text-xs font-bold uppercase tracking-[0.2em]">
                Hand-chosen by Dave
              </p>
            </div>
            <h2 className="font-display font-bold uppercase text-3xl md:text-4xl tracking-wide mb-6">
              Dave&apos;s Picks
            </h2>
            <div className="flex gap-4 md:gap-5 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4">
              {picks.map((p) => (
                <div key={p.id} className="w-[220px] md:w-[250px] shrink-0">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* category jump nav + horizontal product rows */}
      <section className="max-w-7xl mx-auto px-4 pt-10 pb-4">
        <CategoryJumpNav items={rows.map((r) => ({ id: r.id, label: r.label }))} />
      </section>
      <section className="max-w-7xl mx-auto px-4 pb-14 space-y-12">
        {rows.map((row) => (
          <ProductRow
            key={row.key}
            id={row.id}
            eyebrow={row.eyebrow}
            title={row.label}
            href={row.href}
            products={row.products}
          />
        ))}
      </section>

      {/* species tiles */}
      <section className="bg-paper-deep border-y border-pine/10">
        <div className="max-w-7xl mx-auto px-4 py-14">
          <p className="text-signal text-xs font-bold uppercase tracking-[0.2em] mb-1.5">
            Shop by species
          </p>
          <h2 className="font-display font-bold uppercase text-3xl md:text-4xl text-pine tracking-wide mb-7">
            What are you chasing?
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {SPECIES.map((s) => (
              <Link
                key={s.name}
                href={s.href}
                className="group relative rounded-2xl overflow-hidden aspect-[3/4] bg-pine"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.img}
                  alt={s.name}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-pine-deep/90 via-pine-deep/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="font-display font-bold uppercase text-xl text-paper tracking-wide">
                    {s.name}
                  </h3>
                  <p className="text-paper/70 text-xs mt-0.5">{s.blurb}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* playbook */}
      <section id="playbook" className="max-w-7xl mx-auto px-4 py-14 scroll-mt-28">
        <p className="text-signal text-xs font-bold uppercase tracking-[0.2em] mb-1.5">
          The Playbook
        </p>
        <h2 className="font-display font-bold uppercase text-3xl md:text-4xl text-pine tracking-wide mb-3">
          Read the water like a local
        </h2>
        <p className="text-pine/70 max-w-2xl mb-8">
          Gear matters, but timing matters more. Here&apos;s how the conditions tell you
          whether the fish are biting — before you even launch the boat.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLAYBOOK_TIPS.map((tip) => (
            <div key={tip.title} className="rounded-2xl bg-white border border-pine/10 p-6">
              <h3 className="font-display font-bold uppercase text-xl text-pine tracking-wide mb-2">
                {tip.title}
              </h3>
              <p className="text-sm text-pine/70 leading-relaxed">{tip.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <p className="font-display font-bold uppercase text-2xl text-pine tracking-wide mb-4">
            Rigged up and ready?
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/rods"
              className="rounded-xl bg-signal hover:bg-signal-dark text-white font-bold px-8 py-3.5 transition shadow-lg"
            >
              See the Rods
            </Link>
            <Link
              href="/reels"
              className="rounded-xl bg-signal hover:bg-signal-dark text-white font-bold px-8 py-3.5 transition shadow-lg"
            >
              See the Reels
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
