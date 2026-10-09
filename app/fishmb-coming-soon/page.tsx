import Link from "next/link";
import type { Metadata } from "next";

/** fishmb.ca root — coming soon page with features list. */

export const metadata: Metadata = {
  // absolute bypasses the root layout's "%s | Wallyworld Tackle" title template
  title: { absolute: "FishMB — Coming Soon" },
  description:
    "FishMB — Manitoba's fishing community. Tournaments, private maps, encrypted messaging and bite weather. Coming soon.",
  openGraph: {
    title: "FishMB — Coming Soon",
    description:
      "Manitoba's fishing community — tournaments, private maps, encrypted messaging and bite weather.",
    url: "https://www.fishmb.ca",
    siteName: "FishMB",
  },
  twitter: {
    card: "summary",
    title: "FishMB — Coming Soon",
    description:
      "Manitoba's fishing community — tournaments, private maps, encrypted messaging and bite weather.",
  },
};

const FEATURES = [
  {
    icon: "🏆",
    title: "Tournaments",
    text: "Run your own catch-photo-release tournaments. Invite codes, live leaderboards, GPS-verified catches and anti-cheat built in.",
  },
  {
    icon: "🗺️",
    title: "Private maps & spots",
    text: "Save your secret honey holes on a private GPS map. Only you see them — unless you choose to share with friends.",
  },
  {
    icon: "🔒",
    title: "Encrypted messaging",
    text: "End-to-end encrypted chats with your fishing buddies. Plan trips and share spots — not even FishMB can read them.",
  },
  {
    icon: "🌦️",
    title: "Bite weather",
    text: "Barometric pressure, wind and bite outlook for Manitoba lakes. Know before you go.",
  },
  {
    icon: "🐟",
    title: "Catch logging",
    text: "Log every catch with photos, lengths and GPS. Build your lifetime record on the water.",
  },
  {
    icon: "📖",
    title: "Regulations & lakes",
    text: "271 Manitoba lakes with 2026 regulations, verified lodging and real angler info.",
  },
];

export default function FishMBComingSoon() {
  return (
    <div className="min-h-screen bg-pine-deep text-white font-body">
      <div className="max-w-3xl mx-auto px-6 py-16 md:py-24 text-center">
        <p className="font-display font-bold uppercase tracking-[0.3em] text-gold text-sm mb-4">
          Coming soon
        </p>
        <h1 className="font-display font-bold uppercase tracking-wide text-5xl md:text-7xl mb-4">
          <span className="text-white">Fish</span>
          <span className="text-signal">MB</span>
        </h1>
        <p className="text-white/70 text-lg md:text-xl max-w-xl mx-auto mb-8">
          Manitoba&apos;s fishing community — tournaments, private maps,
          encrypted messaging and bite weather. Built by anglers, for anglers.
        </p>
        <Link
          href="/demo"
          className="inline-block bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-10 py-4 rounded-full transition-colors mb-4"
        >
          🎣 Try the live demo
        </Link>
        <p className="text-white/40 text-xs mb-16">
          The full app, running right now — no signup needed to look around.
        </p>

        <h2 className="font-display font-bold uppercase tracking-wide text-2xl md:text-3xl mb-8 text-left">
          What&apos;s coming
        </h2>
        <div className="grid sm:grid-cols-2 gap-4 text-left">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white/5 border border-white/10 rounded-3xl p-6"
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <p className="font-bold text-lg mb-1">{f.title}</p>
              <p className="text-white/60 text-sm leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-white/10">
          <p className="text-white/40 text-sm">
            FishMB — Manitoba fishing, together.
          </p>
        </div>
      </div>
    </div>
  );
}
