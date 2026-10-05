import Link from "next/link";

export const metadata = {
  title: "How to Choose Your First Fishing Combo (2026) — Wallyworld Tackle",
  description:
    "A beginner's guide to picking a rod and reel combo that won't hold you back — or empty your wallet.",
};

export default function Post() {
  return (
    <article className="max-w-3xl mx-auto px-4 py-12">
      <Link href="/blog" className="text-signal text-sm font-semibold hover:underline">
        ← All guides
      </Link>
      <h1 className="font-display font-bold uppercase text-4xl md:text-5xl text-pine tracking-wide mt-4 mb-4">
        How to Choose Your First Fishing Combo
      </h1>
      <p className="text-pine/40 text-sm mb-8">October 5, 2026 · 5 min read</p>

      <div className="prose prose-lg max-w-none text-pine/80 space-y-6">
        <p>
          Buying your first rod and reel combo shouldn't be stressful. Here's everything
          you need to know to pick the right setup without wasting money.
        </p>

        <h2 className="font-display font-bold text-2xl text-pine mt-10">Spinning vs Baitcasting</h2>
        <p>
          <strong>Start with spinning.</strong> It's easier to learn, more versatile, and
          handles light lures better. Baitcasters are great, but they have a learning curve
          (backlashes) that frustrates beginners. Master spinning first, then add a
          baitcaster later if you want.
        </p>

        <h2 className="font-display font-bold text-2xl text-pine mt-10">What Size?</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Rod:</strong> 6'6" to 7', medium power, fast action. This handles 90% of freshwater fishing.</li>
          <li><strong>Reel:</strong> 2500 size. Big enough for bass and walleye, small enough for trout and panfish.</li>
        </ul>

        <h2 className="font-display font-bold text-2xl text-pine mt-10">How Much to Spend</h2>
        <p>
          $60–100 gets you a solid combo that will last for years. Below $40, quality drops
          off fast — sticky drags, weak guides, rods with no sensitivity. Above $150,
          you're paying for refinements a beginner won't notice.
        </p>
        <p>
          The sweet spot: spend more on the reel than the rod. A smooth drag matters more
          than a fancy blank when you're learning.
        </p>

        <h2 className="font-display font-bold text-2xl text-pine mt-10">What Else You Need</h2>
        <p>Don't blow your whole budget on the combo. You'll also need:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Fishing line (8-10lb monofilament to start)</li>
          <li>A small tackle box</li>
          <li>Hooks, sinkers, and bobbers</li>
          <li>A few jigs and soft plastics</li>
        </ul>

        <div className="rounded-2xl bg-paper-deep border border-pine/10 p-6 mt-10">
          <p className="font-bold text-pine mb-2">Shop starter combos</p>
          <p className="text-pine/60 text-sm mb-4">
            Rod and reel combos picked for beginners. Good gear, low prices. Free shipping across Canada.
          </p>
          <Link
            href="/"
            className="inline-block bg-signal text-white font-bold px-6 py-3 rounded-xl hover:bg-signal/90 transition-colors"
          >
            See Combos
          </Link>
        </div>
      </div>
    </article>
  );
}
