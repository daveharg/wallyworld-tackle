import Link from "next/link";

export const metadata = {
  title: "Our Story — Wallyworld Tackle",
  description:
    "How Wallyworld Tackle started: fishing with direct-from-factory rods and realizing the big stores charge more than double for the same quality.",
};

export default function StoryPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <Link href="/" className="text-signal text-sm font-semibold hover:underline">
        ← Back home
      </Link>
      <h1 className="font-display font-bold uppercase text-4xl md:text-5xl text-pine tracking-wide mt-4 mb-8">
        Our Story
      </h1>

      <div className="space-y-6 text-pine/80 text-lg leading-relaxed">
        <p>
          Wallyworld Tackle started with a simple observation on the water.
        </p>
        <p>
          We were fishing with rods bought direct from the factory — no middleman, no
          retail markup, no fancy packaging. They cast great, had solid backbone, and
          handled everything from walleye to pike without a complaint.
        </p>
        <p>
          Then we walked into one of the big bulk outdoor stores and saw rods of the{" "}
          <strong className="text-pine">same quality selling for more than double the
          price</strong>. Same carbon blanks, same guides, same actions — but with a
          brand name on them and a price tag that made our jaws drop.
        </p>
        <p>
          That's when it clicked: anglers aren't paying for better rods. They're paying
          for the logo, the retail overhead, and the marketing budget.
        </p>
        <p>
          So we cut all of that out.
        </p>
        <p>
          Wallyworld Tackle connects Canadian anglers directly with quality factory gear —
          the same rods, reels, and tackle you'd find at the big stores, without the
          massive markup. We keep it simple:{" "}
          <strong className="text-pine">good gear, low prices</strong>.
        </p>
        <p>
          No inflated MSRPs. No fake "sales." No paying extra for a name on the blank.
          Just solid fishing gear at honest prices, shipped free anywhere in Canada.
        </p>
        <p>
          Because the fish don't care what brand your rod is. And neither should your
          wallet.
        </p>

        <div className="rounded-2xl bg-paper-deep border border-pine/10 p-6 mt-10">
          <p className="font-bold text-pine mb-2">See for yourself</p>
          <p className="text-pine/60 text-sm mb-4">
            Browse the gear and compare. We think you'll notice the difference — in the
            price, not the quality.
          </p>
          <Link
            href="/rods"
            className="inline-block bg-signal text-white font-bold px-6 py-3 rounded-xl hover:bg-signal/90 transition-colors"
          >
            See the Rods
          </Link>
        </div>
      </div>
    </div>
  );
}
