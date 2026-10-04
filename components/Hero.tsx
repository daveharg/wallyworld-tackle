import Link from "next/link";

const HERO_IMG =
  "https://images.unsplash.com/photo-1445112098124-3e76dd67983c?auto=format&fit=crop&w=2000&q=80";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-night-950">
      {/* background image + overlays */}
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_IMG}
          alt=""
          aria-hidden
          className="w-full h-full object-cover opacity-40"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-night-950 via-night-950/80 to-night-950/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-night-950 via-transparent to-night-950/60" />
        <div className="absolute inset-0 hero-grid-overlay" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-20 md:py-32">
        <div className="max-w-2xl animate-fade-up">
          <p className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.2em] text-ember-400 bg-ember-500/10 border border-ember-500/30 rounded-full px-4 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-ember-400 animate-pulse" />
            Freshwater tackle, direct to you
          </p>
          <h1 className="font-display font-bold uppercase leading-[0.95] text-5xl md:text-7xl text-white">
            Good Gear,
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-ember-400 to-ember-600">
              Low Prices.
            </span>
          </h1>
          <p className="mt-5 text-lg text-slate-300 max-w-xl leading-relaxed">
            Rods, reels, jigs, plastics and hard baits — hand-chosen for walleye, pike,
            trout and perch anglers who want quality without the markup.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/rods"
              className="rounded-xl bg-ember-500 hover:bg-ember-600 text-night-950 font-bold px-8 py-4 text-base transition shadow-xl shadow-ember-600/25 hover:shadow-ember-500/40 hover:-translate-y-0.5"
            >
              See the Rods
            </Link>
            <Link
              href="/reels"
              className="rounded-xl bg-night-800/80 hover:bg-night-700 border border-night-600 hover:border-ember-500/50 text-white font-bold px-8 py-4 text-base transition backdrop-blur hover:-translate-y-0.5"
            >
              See the Reels
            </Link>
          </div>
          <div className="mt-8 flex items-center gap-6 text-sm text-slate-400">
            <span className="flex items-center gap-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              84+ products in stock
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              Secure Shopify checkout
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
