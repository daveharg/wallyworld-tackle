import Link from "next/link";

export const metadata = {
  title: "Best Walleye Jigs: What Actually Works (2026 Guide) — Wallyworld Tackle",
  description:
    "The best walleye jigs for Canadian waters — weights, colors, and techniques that put more fish in the boat.",
};

export default function Post() {
  return (
    <article className="max-w-3xl mx-auto px-4 py-12">
      <Link href="/blog" className="text-signal text-sm font-semibold hover:underline">
        ← All guides
      </Link>
      <h1 className="font-display font-bold uppercase text-4xl md:text-5xl text-pine tracking-wide mt-4 mb-4">
        Best Walleye Jigs: What Actually Works
      </h1>
      <p className="text-pine/40 text-sm mb-8">October 5, 2026 · 5 min read</p>

      <div className="prose prose-lg max-w-none text-pine/80 space-y-6">
        <p>
          If you're fishing for walleye in Canada and you're not throwing jigs, you're
          leaving fish in the lake. The jig is the single most versatile walleye lure
          ever made — and the good news is you don't need to spend a fortune on them.
        </p>

        <h2 className="font-display font-bold text-2xl text-pine mt-10">Jig Weights That Matter</h2>
        <p>These four weights cover 95% of walleye jigging situations:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>1/32 oz (0.9g)</strong> — Ultra-finesse for shallow, calm water</li>
          <li><strong>1/16 oz (1.8g)</strong> — The go-to for most situations</li>
          <li><strong>1/8 oz (3.5g)</strong> — Wind, current, or deeper water</li>
          <li><strong>1/4 oz (7g)</strong> — Deep water, heavy current, aggressive fish</li>
        </ul>
        <p>
          Start with 1/8oz if you're only buying one size. It's the most versatile weight
          for Canadian walleye waters.
        </p>

        <h2 className="font-display font-bold text-2xl text-pine mt-10">Colors That Catch</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Chartreuse</strong> — The #1 walleye color, period. Works in stained and clear water.</li>
          <li><strong>White</strong> — Mimics baitfish. Deadly in clear water.</li>
          <li><strong>Orange/Pink</strong> — High-vis options for murky water or low light.</li>
          <li><strong>Natural (brown/green)</strong> — When fish are pressured and picky.</li>
        </ul>

        <h2 className="font-display font-bold text-2xl text-pine mt-10">How to Fish Them</h2>
        <p>
          The classic technique: cast out, let it hit bottom, then lift-drop-lift. Most
          strikes come on the fall, so watch your line for any tick or sudden slack.
        </p>
        <p>
          Tip a jig with a minnow, leech, or soft plastic trailer for extra action. In
          tough conditions, go smaller and slower — sometimes a 1/16oz jig barely crawled
          along bottom is what triggers the bite.
        </p>

        <h2 className="font-display font-bold text-2xl text-pine mt-10">Don't Overpay</h2>
        <p>
          Jigs are jigs. A well-made lead jig head with a sharp hook catches fish
          regardless of the brand name stamped on the package. Buy in bulk, try different
          colors, and spend the savings on more time on the water.
        </p>

        <div className="rounded-2xl bg-paper-deep border border-pine/10 p-6 mt-10">
          <p className="font-bold text-pine mb-2">Shop walleye jigs</p>
          <p className="text-pine/60 text-sm mb-4">
            Jig heads in all four key weights. Good gear, low prices. Free shipping across Canada.
          </p>
          <Link
            href="/tackle"
            className="inline-block bg-signal text-white font-bold px-6 py-3 rounded-xl hover:bg-signal/90 transition-colors"
          >
            Shop Jigs
          </Link>
        </div>
      </div>
    </article>
  );
}
