import Link from "next/link";

export const metadata = {
  title: "Best Soft Plastics for Walleye (2026) — Wallyworld Tackle",
  description:
    "The best soft plastic baits for walleye — swimbaits, grubs, and creature baits that catch more fish.",
};

export default function Post() {
  return (
    <article className="max-w-3xl mx-auto px-4 py-12">
      <Link href="/blog" className="text-signal text-sm font-semibold hover:underline">
        ← All guides
      </Link>
      <h1 className="font-display font-bold uppercase text-4xl md:text-5xl text-pine tracking-wide mt-4 mb-4">
        Best Soft Plastics for Walleye
      </h1>
      <p className="text-pine/40 text-sm mb-8">October 5, 2026 · 4 min read</p>

      <div className="prose prose-lg max-w-none text-pine/80 space-y-6">
        <p>
          Live bait works, but soft plastics are more convenient, last longer, and often
          outfish the real thing. Here are the soft plastics every walleye angler should
          have in their tackle box.
        </p>

        <h2 className="font-display font-bold text-2xl text-pine mt-10">Paddle Tail Swimbaits</h2>
        <p>
          The #1 soft plastic for walleye. Rig on a jig head and swim it, jig it, or drag
          it along bottom. The paddle tail creates vibration that walleye can't resist.
          3" to 4" is the sweet spot for most situations.
        </p>

        <h2 className="font-display font-bold text-2xl text-pine mt-10">Curly Tail Grubs</h2>
        <p>
          The classic. A curly tail grub on a jig head has caught more walleye than any
          other lure in history. Cheap, effective, and available in every color imaginable.
          When in doubt, tie on a grub.
        </p>

        <h2 className="font-display font-bold text-2xl text-pine mt-10">Minnow Imitations</h2>
        <p>
          Soft plastic minnows (like flukes and split-tail minnows) are deadly when walleye
          are feeding on baitfish. Jerk them, swim them, or deadstick them — the lifelike
          profile does the work.
        </p>

        <h2 className="font-display font-bold text-2xl text-pine mt-10">Colors for Walleye</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>White/Pearl:</strong> Matches emerald shiners and other baitfish</li>
          <li><strong>Chartreuse:</strong> High-vis for stained water</li>
          <li><strong>Motor oil:</strong> Subtle, natural — great in clear water</li>
          <li><strong>Purple:</strong> Weirdly effective, especially in low light</li>
        </ul>

        <div className="rounded-2xl bg-paper-deep border border-pine/10 p-6 mt-10">
          <p className="font-bold text-pine mb-2">Shop soft plastics</p>
          <p className="text-pine/60 text-sm mb-4">
            Swimbaits, grubs, and more. Good gear, low prices. Free shipping across Canada.
          </p>
          <Link
            href="/tackle"
            className="inline-block bg-signal text-white font-bold px-6 py-3 rounded-xl hover:bg-signal/90 transition-colors"
          >
            Shop Soft Plastics
          </Link>
        </div>
      </div>
    </article>
  );
}
