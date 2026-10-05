import Link from "next/link";

export const metadata = {
  title: "Best Crankbaits for Bass: A Beginner's Guide (2026) — Wallyworld Tackle",
  description:
    "The best crankbaits for bass fishing — diving depths, colors, and when to throw each one. Catch more bass on crankbaits.",
};

export default function Post() {
  return (
    <article className="max-w-3xl mx-auto px-4 py-12">
      <Link href="/blog" className="text-signal text-sm font-semibold hover:underline">
        ← All guides
      </Link>
      <h1 className="font-display font-bold uppercase text-4xl md:text-5xl text-pine tracking-wide mt-4 mb-4">
        Best Crankbaits for Bass: A Beginner&apos;s Guide
      </h1>
      <p className="text-pine/40 text-sm mb-8">October 5, 2026 · 5 min read</p>

      <div className="prose prose-lg max-w-none text-pine/80 space-y-6">
        <p>
          Crankbaits are one of the most effective bass lures ever made. They cover water
          fast, trigger reaction strikes, and work in almost any condition. But with
          hundreds of options, where do you start?
        </p>

        <h2 className="font-display font-bold text-2xl text-pine mt-10">Diving Depths Explained</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Shallow (0-5ft):</strong> Square bills for around cover, wake baits for the surface</li>
          <li><strong>Medium (5-10ft):</strong> The most versatile range — covers most bass situations</li>
          <li><strong>Deep (10ft+):</strong> For ledges, humps, and summer/winter bass holding deep</li>
        </ul>
        <p>
          If you're buying your first crankbaits, start with medium divers. They'll catch
          fish in the widest range of situations.
        </p>

        <h2 className="font-display font-bold text-2xl text-pine mt-10">Colors That Work</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Shad patterns:</strong> The #1 crankbait color. Matches what bass eat everywhere.</li>
          <li><strong>Chartreuse:</strong> For stained water — bass can see it from far away.</li>
          <li><strong>Crawfish:</strong> Spring killer when bass are feeding on craws.</li>
          <li><strong>Firetiger:</strong> Ugly color that catches big fish in murky water.</li>
        </ul>

        <h2 className="font-display font-bold text-2xl text-pine mt-10">When to Throw Them</h2>
        <p>
          Crankbaits shine when bass are actively feeding. Spring and fall are prime time.
          Bounce them off rocks, stumps, and other cover — the deflection triggers strikes.
        </p>
        <p>
          Pro tip: crank until your lure hits something, then pause. That moment of
          deflection is when most bass hit.
        </p>

        <div className="rounded-2xl bg-paper-deep border border-pine/10 p-6 mt-10">
          <p className="font-bold text-pine mb-2">Shop crankbaits</p>
          <p className="text-pine/60 text-sm mb-4">
            Hard baits that catch bass. Good gear, low prices. Free shipping across Canada.
          </p>
          <Link
            href="/tackle"
            className="inline-block bg-signal text-white font-bold px-6 py-3 rounded-xl hover:bg-signal/90 transition-colors"
          >
            Shop Hard Baits
          </Link>
        </div>
      </div>
    </article>
  );
}
