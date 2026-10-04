import Link from "next/link";

const HERO_IMG =
  "https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=2000&q=80";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-paper-deep">
      {/* misty-lake sunrise background */}
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_IMG}
          alt="Misty lake at sunrise"
          className="w-full h-full object-cover"
        />
        {/* warm paper wash so pine text reads over the photo */}
        <div className="absolute inset-0 bg-gradient-to-r from-paper via-paper/85 to-paper/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-paper via-transparent to-paper/40" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-20 md:py-32">
        <div className="max-w-2xl animate-fade-up">
          <p className="text-[12px] font-bold uppercase tracking-[0.28em] text-pine/70 mb-5">
            Chosen by real Canadian anglers
          </p>
          <h1 className="font-display font-bold uppercase leading-[0.95] text-5xl md:text-7xl text-pine">
            Good gear,
            <br />
            <span className="text-gold">low prices.</span>
          </h1>
          <p className="mt-5 text-lg text-pine/75 max-w-xl leading-relaxed">
            Rods, reels, jigs, plastics and hard baits — hand-chosen for walleye, pike,
            trout and perch anglers who want quality without the markup.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/rods"
              className="rounded-xl bg-signal hover:bg-signal-dark text-white font-bold px-8 py-4 text-base transition shadow-lg hover:-translate-y-0.5"
            >
              See the Rods
            </Link>
            <Link
              href="/reels"
              className="rounded-xl bg-signal hover:bg-signal-dark text-white font-bold px-8 py-4 text-base transition shadow-lg hover:-translate-y-0.5"
            >
              See the Reels
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-pine/60">
            <span className="flex items-center gap-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e4572e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              84+ products in stock
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e4572e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              Secure Shopify checkout
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
