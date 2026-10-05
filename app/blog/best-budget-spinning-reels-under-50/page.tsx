import Link from "next/link";

export const metadata = {
  title: "Best Budget Spinning Reels Under $50 — Wallyworld Tackle",
  description:
    "Smooth drag, solid build, under fifty bucks. The spinning reels that punch way above their price in 2026.",
};

export default function Post() {
  return (
    <article className="max-w-3xl mx-auto px-4 py-12">
      <Link href="/blog" className="text-signal text-sm font-semibold hover:underline">
        ← All guides
      </Link>
      <h1 className="font-display font-bold uppercase text-4xl md:text-5xl text-pine tracking-wide mt-4 mb-4">
        Best Budget Spinning Reels Under $50
      </h1>
      <p className="text-pine/40 text-sm mb-8">October 5, 2026 · 4 min read</p>

      <div className="prose prose-lg max-w-none text-pine/80 space-y-6">
        <p>
          The reel is where budget gear either shines or falls apart. A bad reel will ruin
          your day with tangles, a sticky drag, and a handle that feels like it's grinding
          coffee. A good budget reel? You'll forget what you paid for it.
        </p>

        <h2 className="font-display font-bold text-2xl text-pine mt-10">What Matters Most</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Drag smoothness:</strong> This is #1. A jerky drag loses fish. Test it
            by pulling line off the spool — it should come off evenly with no sticking.
          </li>
          <li>
            <strong>Size:</strong> 2000–2500 for trout/panfish/walleye. 3000–4000 for bass
            and pike. When in doubt, go 2500 — it's the most versatile size.
          </li>
          <li>
            <strong>Gear ratio:</strong> 5.2:1 is the all-around standard. Higher ratios
            (6.2:1+) retrieve faster but sacrifice cranking power.
          </li>
          <li>
            <strong>Weight:</strong> Lighter is better for all-day casting, but don't
            sacrifice durability. Under 10oz for a 2500-size is good.
          </li>
        </ul>

        <h2 className="font-display font-bold text-2xl text-pine mt-10">The Off-Brand Secret</h2>
        <p>
          Here's something the big brands don't want you to know: many budget reels come
          from the same factories as the mid-range name-brand ones. You're paying for the
          logo, the marketing, and the pro staff — not necessarily better engineering.
        </p>
        <p>
          We've chosen reels across the price spectrum for this guide. The gap between
          a $35 reel and a $80 reel is much smaller than the gap between a $15 reel and a
          $35 reel. That $30–50 sweet spot is where the real value lives.
        </p>

        <h2 className="font-display font-bold text-2xl text-pine mt-10">What to Avoid</h2>
        <p>
          Anything under $20 is a gamble. The drags are inconsistent, the gears wear fast,
          and you'll replace it within a season. Spend the extra $15 — it's the best money
          in fishing.
        </p>

        <div className="rounded-2xl bg-paper-deep border border-pine/10 p-6 mt-10">
          <p className="font-bold text-pine mb-2">Shop budget spinning reels</p>
          <p className="text-pine/60 text-sm mb-4">
            Good gear, low prices. Free shipping across Canada.
          </p>
          <Link
            href="/reels"
            className="inline-block bg-signal text-white font-bold px-6 py-3 rounded-xl hover:bg-signal/90 transition-colors"
          >
            See the Reels
          </Link>
        </div>
      </div>
    </article>
  );
}
