import Link from "next/link";
import WalleyeCombos from "../../components/WalleyeCombos";

export const metadata = {
  title: "Fishing Packages — Wallyworld Tackle",
  description:
    "Hand-picked rod and reel packages matched to work together. Grab both and hit the water.",
};

export default function PackagesPage() {
  return (
    <div className="pb-16">
      <div className="max-w-7xl mx-auto px-4 pt-12 pb-2 text-center">
        <p className="text-signal text-xs font-bold uppercase tracking-[0.24em] mb-1.5">
          Bundle up &amp; save the guesswork
        </p>
        <h1 className="font-display font-bold uppercase text-4xl md:text-5xl text-pine tracking-wide mb-3">
          Fishing Packages
        </h1>
        <p className="text-pine/70 max-w-2xl mx-auto">
          Dave&apos;s hand-picked rod + reel pairings, matched to work together. One price for
          the pair — grab both and hit the water.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/rods"
            className="px-5 py-2.5 rounded-xl bg-pine text-white text-sm font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
          >
            Shop rods
          </Link>
          <Link
            href="/reels"
            className="px-5 py-2.5 rounded-xl bg-pine text-white text-sm font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
          >
            Shop reels
          </Link>
        </div>
      </div>
      <WalleyeCombos />
    </div>
  );
}
