import Link from "next/link";
import type { ShopifyProduct } from "../lib/shopify";

type ComboDef = {
  name: string;
  tagline: string;
  badge: string;
  rodHandle: string;
  reelHandle: string;
  accent: string;
};

const COMBOS: ComboDef[] = [
  {
    name: "Walleye Slayer Combo",
    tagline: "Our #1 recommended walleye setup — light, sensitive, and ready to jig.",
    badge: "Best Seller",
    rodHandle:
      "casting-spinning-lure-fishing-rod-solid-ml-tip-1-8-2-1m-ultralight-trout-jigging-pole-4-5-sections-pesca",
    reelHandle:
      "billings-spinning-fishing-reel-for-freshwater-saltwater-ultralight-spool-fold-rocker-left-right-interchangeable-easy-to-carry",
    accent: "from-amber-400 to-orange-600",
  },
  {
    name: "Walleye Pro 2000 Combo",
    tagline: "Step up with the 2000-series reel — smoother drag, more backbone.",
    badge: "Pro Pick",
    rodHandle:
      "sougayilang-1-8m-2-sections-carbon-fishing-rod-spinning-casting-rod-ultralight-solid-tip-lure-rod-portable-travel-fishing-pole",
    reelHandle:
      "billings-spinning-reel-metal-spinning-fishing-reel-12kg-max-drag-for-freshwater-saltwater-5-2-1-gear-ratio-fishing-reels",
    accent: "from-sky-400 to-blue-700",
  },
];

function priceOf(p: ShopifyProduct | undefined): number {
  if (!p || !p.variants.length) return 0;
  const prices = p.variants.map((v) => parseFloat(v.price.amount));
  return Math.min(...prices);
}

function ComboCard({ combo, products }: { combo: ComboDef; products: ShopifyProduct[] }) {
  const rod = products.find((p) => p.handle === combo.rodHandle);
  const reel = products.find((p) => p.handle === combo.reelHandle);
  if (!rod || !reel) return null;

  const rodPrice = priceOf(rod);
  const reelPrice = priceOf(reel);
  const total = rodPrice + reelPrice;
  const fmt = (n: number) =>
    `$${n.toFixed(2)}`;

  return (
    <div className="relative rounded-3xl overflow-hidden bg-pine text-white shadow-2xl">
      {/* flashy gradient glow */}
      <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${combo.accent}`} />
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/5 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-white/5 blur-2xl pointer-events-none" />

      <div className="relative p-6 md:p-8">
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-gradient-to-r ${combo.accent} text-white mb-4`}>
          {combo.badge}
        </span>
        <h3 className="font-display font-bold uppercase text-2xl md:text-3xl tracking-wide mb-2">
          {combo.name}
        </h3>
        <p className="text-white/70 text-sm md:text-base mb-6">{combo.tagline}</p>

        {/* rod + reel */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {[
            { product: rod, label: "Rod", price: rodPrice },
            { product: reel, label: "Reel", price: reelPrice },
          ].map(({ product, label, price }) => (
            <Link
              key={product.id}
              href={`/products/${product.handle}`}
              className="group bg-white/10 hover:bg-white/15 rounded-2xl p-3 transition-colors"
            >
              <div className="aspect-square rounded-xl overflow-hidden bg-white mb-3">
                {product.images[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.images[0].url}
                    alt={product.images[0].altText ?? product.title}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                    loading="lazy"
                  />
                )}
              </div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/50 mb-1">{label}</p>
              <p className="text-sm font-semibold leading-tight line-clamp-2 mb-1.5">{product.title}</p>
              <p className="text-lg font-bold text-amber-300">{fmt(price)}</p>
            </Link>
          ))}
        </div>

        {/* total + CTA */}
        <div className="flex items-center justify-between gap-4 bg-white/10 rounded-2xl px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/50">Combo total</p>
            <p className="text-3xl font-display font-bold text-amber-300">{fmt(total)}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/products/${rod.handle}`}
              className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-bold uppercase tracking-wider transition-colors"
            >
              Rod
            </Link>
            <Link
              href={`/products/${reel.handle}`}
              className={`px-4 py-2.5 rounded-xl bg-gradient-to-r ${combo.accent} text-sm font-bold uppercase tracking-wider hover:opacity-90 transition-opacity`}
            >
              Reel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WalleyeCombos({ products }: { products: ShopifyProduct[] }) {
  return (
    <section id="walleye-combos" className="max-w-7xl mx-auto px-4 mt-12 md:mt-16 scroll-mt-32">
      <div className="text-center mb-8">
        <p className="text-signal text-xs font-bold uppercase tracking-[0.24em] mb-1.5">
          Dave&apos;s hand-picked pairings
        </p>
        <h2 className="font-display font-bold uppercase text-3xl md:text-5xl text-pine tracking-wide mb-3">
          Recommended Walleye Combos
        </h2>
        <p className="text-pine/70 max-w-2xl mx-auto">
          Rod + reel, matched to work together. Grab both and hit the water.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {COMBOS.map((combo) => (
          <ComboCard key={combo.name} combo={combo} products={products} />
        ))}
      </div>
    </section>
  );
}
