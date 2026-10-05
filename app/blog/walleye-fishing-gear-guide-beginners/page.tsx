import Link from "next/link";

export const metadata = {
  title: "Walleye Fishing Gear Guide for Beginners (2026) — Wallyworld Tackle",
  description:
    "Everything a beginner needs to start catching walleye — rod, reel, line, jigs and rigs — without overspending.",
};

export default function Post() {
  return (
    <article className="max-w-3xl mx-auto px-4 py-12">
      <Link href="/blog" className="text-signal text-sm font-semibold hover:underline">
        ← All guides
      </Link>
      <h1 className="font-display font-bold uppercase text-4xl md:text-5xl text-pine tracking-wide mt-4 mb-4">
        Walleye Fishing Gear Guide for Beginners
      </h1>
      <p className="text-pine/40 text-sm mb-8">October 5, 2026 · 6 min read</p>

      <div className="prose prose-lg max-w-none text-pine/80 space-y-6">
        <p>
          Walleye are Canada's most popular game fish, and the good news for beginners
          is that you don't need a boat full of expensive gear to catch them. A simple,
          well-chosen setup will outfish a pricey one in the wrong hands every time.
        </p>

        <h2 className="font-display font-bold text-2xl text-pine mt-10">The Rod</h2>
        <p>
          Start with a 6'6" to 7' medium-light spinning rod with fast action. That
          combination gives you the sensitivity to feel a jig tick bottom and the
          backbone to set the hook. A two-piece rod is easier to transport and stores
          anywhere. Check our <Link href="/rods" className="text-signal font-semibold hover:underline">rods</Link> for
          budget-friendly options that don't fish like budget rods.
        </p>

        <h2 className="font-display font-bold text-2xl text-pine mt-10">The Reel</h2>
        <p>
          A 2000 or 2500-size spinning reel is the sweet spot for walleye. Look for a
          smooth drag — that's what protects light line when a big fish runs. You don't
          need 10 bearings; you need a reel that doesn't bind up after a season.
          Browse <Link href="/reels" className="text-signal font-semibold hover:underline">reels under $50</Link> that
          get the job done.
        </p>

        <h2 className="font-display font-bold text-2xl text-pine mt-10">Line</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>6-8 lb monofilament</strong> — Forgiving, easy to tie, fine for most jigging.</li>
          <li><strong>10 lb braid + fluorocarbon leader</strong> — Maximum sensitivity for feeling light bites. The upgrade worth making once you're hooked.</li>
        </ul>

        <h2 className="font-display font-bold text-2xl text-pine mt-10">The Lures</h2>
        <p>
          If you buy one lure type for walleye, make it jigs. Four weights cover nearly
          every situation: 1/16, 1/8, 1/4 oz, plus a few 1/32 oz for finesse days.
          Add a handful of soft plastic trailers (grubs and paddle tails) and a couple
          of crankbaits for covering water, and you're set. See our{" "}
          <Link href="/blog/best-walleye-jigs-guide" className="text-signal font-semibold hover:underline">walleye jigs guide</Link>{" "}
          for the full breakdown.
        </p>

        <h2 className="font-display font-bold text-2xl text-pine mt-10">Rigs Worth Knowing</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Jig + minnow</strong> — The classic. Hard to beat, especially in spring.</li>
          <li><strong>Slip bobber + leech</strong> — Deadly when walleye are suspended or finicky.</li>
          <li><strong>Lindy rig</strong> — For slow-trolling live bait along breaks and flats.</li>
        </ul>

        <h2 className="font-display font-bold text-2xl text-pine mt-10">Where to Start</h2>
        <p>
          Fish the edges: weed lines, rocky points, and drop-offs near shore, especially
          at dawn and dusk. Walleye move shallow to feed in low light. A jig worked
          slowly along bottom in 8-15 feet of water will catch fish on most Canadian
          lakes, most days of the season.
        </p>

        <div className="bg-pine/5 rounded-xl p-6 mt-10">
          <p className="font-semibold text-pine mb-2">Ready to gear up?</p>
          <p>
            Our <Link href="/tackle" className="text-signal font-semibold hover:underline">tackle section</Link> has
            jigs, soft plastics, and everything above with free shipping across Canada.
            Good gear, low prices.
          </p>
        </div>
      </div>
    </article>
  );
}
