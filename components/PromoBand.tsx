import Link from "next/link";

/** Two-column promo band: Wallyworld Rewards + double-points weekends. */
export default function PromoBand() {
  return (
    <section className="max-w-7xl mx-auto px-4 mt-8 md:mt-12">
      <div className="grid md:grid-cols-2 gap-4 md:gap-5">
        {/* Rewards — dark red */}
        <div className="relative overflow-hidden rounded-2xl bg-[#7f1d1d] text-white p-8 md:p-10">
          <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/5" />
          <div className="absolute -right-4 top-16 w-24 h-24 rounded-full bg-white/5" />
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/70 mb-2">
            Wallyworld Rewards
          </p>
          <h2 className="font-display font-bold uppercase text-3xl md:text-4xl tracking-wide mb-3">
            Earn points on every cast
          </h2>
          <p className="text-white/80 max-w-md mb-6">
            Get 1 point for every $1 you spend and cash them in for tackle.
            Free to join, points never expire.
          </p>
          <Link
            href="/#newsletter"
            className="inline-block rounded-lg bg-white text-[#7f1d1d] font-display font-bold uppercase tracking-widest px-7 py-3 hover:bg-white/90 transition"
          >
            Join Free
          </Link>
        </div>

        {/* Double points — gold gradient */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gold via-[#d99a2b] to-[#f0be55] text-pine-deep p-8 md:p-10">
          <div className="absolute -left-10 -bottom-12 w-52 h-52 rounded-full bg-white/15" />
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-pine-deep/70 mb-2">
            Members only
          </p>
          <h2 className="font-display font-bold uppercase text-3xl md:text-4xl tracking-wide mb-3">
            Double points weekends
          </h2>
          <p className="text-pine-deep/80 max-w-md mb-6">
            Rewards members earn 2× points on all soft plastics and jig heads,
            every single weekend.
          </p>
          <Link
            href="/tackle"
            className="inline-block rounded-lg bg-pine-deep text-white font-display font-bold uppercase tracking-widest px-7 py-3 hover:bg-pine transition"
          >
            Stock Up
          </Link>
        </div>
      </div>
    </section>
  );
}
