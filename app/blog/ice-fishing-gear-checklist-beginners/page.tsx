import Link from "next/link";

export const metadata = {
  title: "Ice Fishing Gear Checklist for Beginners (Canada) — Wallyworld Tackle",
  description:
    "Everything you need for your first ice fishing trip in Canada — rods, reels, line, lures, and safety gear. Don't hit the ice unprepared.",
};

export default function Post() {
  return (
    <article className="max-w-3xl mx-auto px-4 py-12">
      <Link href="/blog" className="text-signal text-sm font-semibold hover:underline">
        ← All guides
      </Link>
      <h1 className="font-display font-bold uppercase text-4xl md:text-5xl text-pine tracking-wide mt-4 mb-4">
        Ice Fishing Gear Checklist for Beginners
      </h1>
      <p className="text-pine/40 text-sm mb-8">October 5, 2026 · 6 min read</p>

      <div className="prose prose-lg max-w-none text-pine/80 space-y-6">
        <p>
          Ice fishing season is almost here. If you've never been, you're missing out on some
          of the best fishing of the year — and you don't need a ton of expensive gear to
          get started.
        </p>
        <p>Here's everything you need for your first trip on the ice.</p>

        <h2 className="font-display font-bold text-2xl text-pine mt-10">The Essentials</h2>

        <h3 className="font-bold text-xl text-pine mt-8">Ice Rod & Reel</h3>
        <p>
          Ice rods are short (24" to 36") because you're fishing directly below you. A
          medium-light rod paired with a small spinning reel (500–1000 size) handles
          walleye, perch, and trout. Don't overthink it — a $30–40 ice combo will catch
          fish.
        </p>

        <h3 className="font-bold text-xl text-pine mt-8">Line</h3>
        <p>
          4–6lb monofilament or fluorocarbon for panfish and trout. Bump up to 8lb if
          you're targeting walleye or pike. Cold weather makes line stiffer, so avoid
          going too heavy.
        </p>

        <h3 className="font-bold text-xl text-pine mt-8">Jigs & Lures</h3>
        <p>
          This is where ice fishing shines. Stock up on:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Tungsten jigs (1/16oz to 1/8oz) — they sink fast and fish love them</li>
          <li>Spoons — great for aggressive walleye and pike</li>
          <li>Soft plastics — small grubs and minnow imitations on a jig head</li>
          <li>Live bait — minnows on a hook under a bobber is deadly simple</li>
        </ul>

        <h3 className="font-bold text-xl text-pine mt-8">Auger</h3>
        <p>
          You need a way through the ice. A hand auger works fine for ice under 12" and
          costs way less than powered. If you're drilling lots of holes, consider
          upgrading later.
        </p>

        <h3 className="font-bold text-xl text-pine mt-8">Safety Gear (Non-Negotiable)</h3>
        <ul className="list-disc pl-6 space-y-2">
          <li>Ice picks — wear them around your neck, every time</li>
          <li>A spud bar to check ice thickness as you walk</li>
          <li>4" of clear ice minimum for walking, 8" for a snowmobile</li>
        </ul>

        <h2 className="font-display font-bold text-2xl text-pine mt-10">Nice to Have</h2>
        <p>
          A portable shelter makes a huge difference on windy days. A sled to haul your
          gear saves your back. And hand warmers — trust us on this one.
        </p>

        <h2 className="font-display font-bold text-2xl text-pine mt-10">The Bottom Line</h2>
        <p>
          You can get on the ice for under $150 in gear if you shop smart. The fish don't
          care what brand your rod is — they care about what's on the hook.
        </p>

        <div className="rounded-2xl bg-paper-deep border border-pine/10 p-6 mt-10">
          <p className="font-bold text-pine mb-2">Shop ice fishing tackle</p>
          <p className="text-pine/60 text-sm mb-4">
            Jigs, spoons, and soft plastics. Good gear, low prices. Free shipping across Canada.
          </p>
          <Link
            href="/tackle"
            className="inline-block bg-signal text-white font-bold px-6 py-3 rounded-xl hover:bg-signal/90 transition-colors"
          >
            Shop Tackle
          </Link>
        </div>
      </div>
    </article>
  );
}
