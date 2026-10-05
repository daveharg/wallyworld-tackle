export const metadata = {
  title: "Best Budget Spinning Rods in Canada (2026) — Wallyworld Tackle",
  description:
    "Looking for a quality spinning rod without breaking the bank? Our guide to the best budget spinning rods available in Canada for 2026.",
};

const POSTS = [
  {
    slug: "best-budget-spinning-rods-canada",
    title: "Best Budget Spinning Rods in Canada (2026)",
    excerpt:
      "You don't need to spend $200+ for a great spinning rod. Here are our top picks for quality budget rods available in Canada.",
    date: "2026-10-05",
  },
  {
    slug: "best-budget-spinning-reels-under-50",
    title: "Best Budget Spinning Reels Under $50",
    excerpt:
      "Smooth drag, solid build, under fifty bucks. These are the spinning reels that punch way above their price.",
    date: "2026-10-05",
  },
  {
    slug: "walleye-fishing-gear-guide-beginners",
    title: "Walleye Fishing Gear Guide for Beginners",
    excerpt:
      "Everything you need to start catching walleye — rod, reel, line, and lures — without overspending.",
    date: "2026-10-05",
  },
  {
    slug: "best-travel-fishing-rods",
    title: "Best Travel Fishing Rods: 4-Piece Rods That Actually Perform",
    excerpt:
      "4-piece travel rods have come a long way. Here's what to look for and our top picks.",
    date: "2026-10-05",
  },
  {
    slug: "how-to-choose-first-fishing-combo",
    title: "How to Choose Your First Fishing Combo (Without Wasting Money)",
    excerpt:
      "A beginner's guide to picking a rod and reel combo that won't hold you back — or empty your wallet.",
    date: "2026-10-05",
  },
  {
    slug: "ice-fishing-gear-checklist-beginners",
    title: "Ice Fishing Gear Checklist for Beginners (Canada)",
    excerpt:
      "Everything you need for your first ice fishing trip — rods, jigs, safety gear, and what to skip.",
    date: "2026-10-05",
  },
  {
    slug: "best-walleye-jigs-guide",
    title: "Best Walleye Jigs: What Actually Works (2026 Guide)",
    excerpt:
      "The best walleye jigs for Canadian waters — weights, colors, and techniques that put more fish in the boat.",
    date: "2026-10-05",
  },
];

export default function BlogIndex() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="font-display font-bold uppercase text-4xl md:text-5xl text-pine tracking-wide mb-4">
        Fishing Guides
      </h1>
      <p className="text-pine/60 mb-10 max-w-2xl">
        Honest gear advice from people who actually fish. No fluff, no sponsored picks — just
        what works.
      </p>
      <div className="space-y-6">
        {POSTS.map((post) => (
          <a
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="block rounded-2xl bg-white border border-pine/10 p-6 hover:border-signal/40 hover:shadow-lg transition-all"
          >
            <p className="text-xs text-pine/40 mb-2">{post.date}</p>
            <h2 className="font-display font-bold text-2xl text-pine mb-2">{post.title}</h2>
            <p className="text-pine/60">{post.excerpt}</p>
            <span className="inline-block mt-4 text-signal font-semibold text-sm">
              Read guide →
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
