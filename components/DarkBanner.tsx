import Link from "next/link";

/** Full-width dark value banner. */
export default function DarkBanner() {
  return (
    <section className="mt-12 md:mt-16 bg-pine-deep text-white">
      <div className="max-w-4xl mx-auto px-4 py-14 md:py-20 text-center">
        <p className="text-gold font-bold uppercase tracking-[0.28em] text-sm mb-4">
          The Wallyworld promise
        </p>
        <h2 className="font-display font-bold uppercase tracking-wide text-4xl md:text-6xl leading-[0.95] mb-5">
          Quality gear. Honest prices. No logo tax.
        </h2>
        <p className="text-white/70 text-lg max-w-2xl mx-auto mb-8">
          Every rod, reel and lure is chosen for performance per dollar and
          shipped direct from our suppliers — so you pay for the gear, not the
          name on the box.
        </p>
        <Link
          href="/tackle"
          className="inline-block rounded-lg bg-signal hover:bg-signal-dark text-white font-display font-bold uppercase tracking-widest text-lg px-10 py-4 shadow-xl transition"
        >
          Shop the Collection
        </Link>
      </div>
    </section>
  );
}
