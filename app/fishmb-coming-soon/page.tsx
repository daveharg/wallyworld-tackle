import Link from "next/link";
import type { Metadata } from "next";

/** fishmb.ca root — coming soon page with detailed feature explanations. */

export const metadata: Metadata = {
  // absolute bypasses the root layout's "%s | Wallyworld Tackle" title template
  title: { absolute: "FishMB — Coming Soon" },
  description:
    "FishMB — Manitoba's fishing community. Tournaments, private maps with Garmin Navionics contours, encrypted messaging and bite weather. Coming soon.",
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

const SECTIONS = [
  {
    icon: "📰",
    title: "The Feed",
    text: "An Instagram-style feed for Manitoba anglers. Share catches with up to 4 photos, videos, lake reports and fishing tips. React, comment, and follow the anglers you fish with. No two posts of the same type back to back — every scroll stays fresh.",
  },
  {
    icon: "🗺️",
    title: "Garmin maps & spots",
    text: "Your private GPS map. Mark honey holes with a press-and-hold, save spots from your current location, and add lake notes. Your spots are private by default — share them with friends only when you choose to. And when the FishMB mobile app lands, flip any map to Garmin Navionics depth contours: bring your own Navionics account, toggle the contour layer over the FishMB base map, and your spots and catches render on both. You pay Garmin directly — FishMB never touches chart money.",
  },
  {
    icon: "🏆",
    title: "Tournaments",
    text: "Run your own catch-photo-release tournaments. Build one in three steps — basics, waters & species, review — then share the invite code. Live leaderboards, GPS-verified catches, photo anti-cheat, and entry fees with prize payouts. Organizers get join alerts and a full manage page. Strict camera-only fresh photos keep real-money events honest.",
  },
  {
    icon: "🌦️",
    title: "Bite Weather",
    text: "Manitoba fishing weather that actually helps you decide. Barometric pressure gauge, wind map, and a bite outlook for your lakes. Check the pressure trend before you hook up the boat.",
  },
  {
    icon: "🔒",
    title: "Messages",
    text: "End-to-end encrypted chats with your fishing buddies. Plan trips, share spots, send photos — not even FishMB can read them. Unread badges keep you in the loop.",
  },
  {
    icon: "🐟",
    title: "Catch Logging",
    text: "Log every catch with photos, lengths and GPS. Build your lifetime record — species counts, biggest fish, tournament catches — with stat pages and a you-vs-friends leaderboard for every stat.",
  },
  {
    icon: "📖",
    title: "Lakes, Regulations & Stocking",
    text: "271 Manitoba lakes with 2026 regulations, verified lodging, and Master Angler trophy records. Every lake page shows what's biting, where to stay, the official rules — plus provincial fish stocking reports so you know what's been put in the water and when. No guessing.",
  },
  {
    icon: "👥",
    title: "Friends",
    text: "Find anglers, send friend requests, and build your crew. Friends-only posts, shared spots, and head-to-head stat comparisons. Your fishing circle, in one place.",
  },
  {
    icon: "🏷️",
    title: "Classifieds",
    text: "Buy and sell gear Manitoba-angler to Manitoba-angler. Rods, reels, ice shacks, boats — list it, share it to the feed, and message the seller directly.",
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
          Manitoba&apos;s fishing community — tournaments, private maps with
          Garmin Navionics contours, encrypted messaging and bite weather.
          Built by anglers, for anglers.
        </p>
        <Link
          href="/fishmb/feed"
          className="inline-block bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-10 py-4 rounded-full transition-colors mb-4"
        >
          🎣 Try the live demo
        </Link>
        <p className="text-white/40 text-xs mb-16">
          The full app, running right now — no signup needed to look around.
        </p>

        <h2 className="font-display font-bold uppercase tracking-wide text-2xl md:text-3xl mb-4 text-left">
          What&apos;s coming
        </h2>
        <p className="text-white/50 text-sm text-left mb-8">
          Every section of the app, explained.
        </p>
        <div className="flex flex-col gap-4 text-left">
          {SECTIONS.map((s) => (
            <div
              key={s.title}
              className="bg-white/5 border border-white/10 rounded-3xl p-6"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">{s.icon}</span>
                <p className="font-bold text-lg">{s.title}</p>
              </div>
              <p className="text-white/60 text-sm leading-relaxed">{s.text}</p>
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
