import Link from "next/link";
import type { Metadata } from "next";
import InstallExpander from "./InstallExpander";

/** fishmb.ca root — coming soon page with detailed feature explanations. */

export const metadata: Metadata = {
  // absolute bypasses the root layout's "%s | Wallyworld Tackle" title template
  title: { absolute: "FishMB — Manitoba's fishing app: maps, catches, tournaments & community" },
  description:
    "Manitoba's fishing companion — fishing maps, a social feed for anglers, encrypted messaging, AI fish-activity weather, catch logging, tournaments and provincial leaderboards. All free.",
  openGraph: {
    title: "FishMB — Manitoba's fishing app: maps, catches, tournaments & community",
    description:
      "Manitoba's fishing companion — fishing maps, a social feed for anglers, encrypted messaging, AI fish-activity weather, catch logging, tournaments and provincial leaderboards. All free.",
    url: "https://www.fishmb.ca",
    siteName: "FishMB",
    images: [
      {
        url: "https://www.fishmb.ca/fishmb/icon-512.png",
        width: 512,
        height: 512,
        alt: "FishMB — Manitoba's fishing app",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "FishMB — Manitoba's fishing app: maps, catches, tournaments & community",
    description:
      "Manitoba's fishing companion — fishing maps, a social feed for anglers, encrypted messaging, AI fish-activity weather, catch logging, tournaments and provincial leaderboards. All free.",
    images: ["https://www.fishmb.ca/fishmb/icon-512.png"],
  },
};

const SECTIONS = [
  {
    icon: "📏",
    title: "Auto-Measure Catches",
    text: "Take a picture of your fish and the app measures it for you — then logs the catch with the size already filled in. No bump board, no tape measure, no typing with wet hands. Check the numbers, tweak them if you like, and you're done: photo, measurement and catch record, all from one shot.",
    href: "/fishmb/app",
    cta: "Get the app",
  },
  {
    icon: "📰",
    title: "The Feed",
    text: "A social-media-style feed built for Manitoba anglers. Post catches with photos and video, share lake reports and tips, and post stories that stick around for a week. React, comment, and choose who sees each post — everyone, friends only, or followers only. The feed also carries a daily morning weather report, a Manitoba fishing video of the day, lake, lodge and hotspot spotlights, and Manitoba's own fishing YouTube channels.",
    href: "/fishmb/feed",
    cta: "Open the feed",
  },
  {
    icon: "🗺️",
    title: "Fishing Maps & Your Spots",
    text: "An interactive map of Manitoba's lakes. Press and hold to drop a spot, save spots from right where you're standing, keep private notes on any lake, and toggle the contours layer where chart data exists. Your spots are private by default — or send one to a friend in a message and they can save it as their own. When the FishMB app lands, Garmin Navionics depth contours join the map: bring your own Navionics account and pay Garmin directly — FishMB never touches chart money.",
    href: "/fishmb/maps",
    cta: "Open maps",
  },
  {
    icon: "🏆",
    title: "Tournaments",
    text: "Run your own catch-photo-release tournaments, or join one with an invite code. Build one in three steps — basics, payment & rules, review — and pick your scoring: biggest fish, total length, or most fish. Catches are logged in the app with camera-only fresh photos, GPS stamps and the phone's capture time as the official clock, and organizers review flagged entries and get join alerts. Entry fees and prizes are set by the organizer and change hands directly — FishMB never touches the money. Heads up: events with 25 or more anglers need Manitoba's free Competitive Fishing Event licence.",
    href: "/fishmb/tournaments",
    cta: "Browse tournaments",
  },
  {
    icon: "🏅",
    title: "Provincial Leaderboards",
    text: "Leaderboards for Manitoba's biggest catches — longest and heaviest by species, built from verified catches across the province. Every lake page keeps its own trophy list with Master Angler records, and your profile tracks your personal bests with a you-vs-friends board for every stat.",
    href: "/fishmb/leaderboards",
    cta: "See the leaderboards",
  },
  {
    icon: "🌦️",
    title: "AI Fish-Activity Forecast",
    text: "Weather with one job: predicting how active the fish will be. The fish-activity forecast blends barometric pressure and its trend, wind speed and gusts, storm fronts and moon phase into a bite outlook for your lake — with a pressure gauge, a wind map, storm-front tracking, and hourly and 7-day forecasts. Check it before you hook up the boat.",
    href: "/fishmb/weather",
    cta: "Check the forecast",
  },
  {
    icon: "🔒",
    title: "Encrypted Messages",
    text: "End-to-end encrypted chats — one-on-one, or a group for the whole crew. Plan trips, send photos, and share a spot right inside the conversation; the friend who receives it can save it as their own. Unread badges keep you in the loop, and not even FishMB can read your messages.",
    href: "/fishmb/messages",
    cta: "Open inbox",
  },
  {
    icon: "🐟",
    title: "Catch Logging",
    text: "Log every catch with a photo, length, weight and the spot it came from. A photo makes the catch verified; no photo is fine too — it just counts as unverified (tournament entries still need one). Your records build themselves: species counts, personal bests, Master Angler-class fish, and a stat page with a you-vs-friends leaderboard for every number.",
    href: "/fishmb/feed?log=catch",
    cta: "Log a catch",
  },
  {
    icon: "📖",
    title: "Lakes, Regulations & Stocking",
    text: "271 Manitoba lakes, each with its 2026 regulations, species, stocking history and Master Angler trophy records — plus 175 lodges and guides with ratings from real anglers. Every lake page shows what's biting, where to stay, and the official rules for that water. No guessing.",
    href: "/fishmb/lakes",
    cta: "Explore lakes",
  },
  {
    icon: "💡",
    title: "Fishing Tips",
    text: "Pick a species and learn how to catch it in Manitoba: where it lives (lake maps included), what it eats, and the techniques that work here — through the open-water season and on the hard water. Cracked the code yourself? Add your own tip to the fish's page for every Manitoba angler to learn from.",
    href: "/fishmb/tips",
    cta: "Get fishing tips",
  },
  {
    icon: "👥",
    title: "Friends",
    text: "Find anglers, send friend requests, and follow the ones whose catches you want in your feed. Friends-only posts, shared spots, and head-to-head stat comparisons. Your fishing circle, in one place.",
    href: "/fishmb/friends",
    cta: "Find friends",
  },
  {
    icon: "🏷️",
    title: "Classifieds",
    text: "Buy and sell gear, Manitoba angler to Manitoba angler. Rods, reels, ice shacks, boats — list it free with photos, share it to the feed, and message the seller right in the app.",
    href: "/fishmb/classifieds",
    cta: "Browse classifieds",
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
          Manitoba&apos;s fishing community — fishing maps, a social feed,
          encrypted messaging, AI fishing weather, catch logging, tournaments
          and provincial leaderboards. All of it free, built by anglers, for
          anglers.
        </p>
        <InstallExpander />

        <h2 className="font-display font-bold uppercase tracking-wide text-2xl md:text-3xl mb-4 mt-16 text-left">
          What&apos;s inside
        </h2>
        <p className="text-white/50 text-sm text-left mb-8">
          Every section of the app, explained — and all of it is free.
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
              <p className="text-white/60 text-sm leading-relaxed mb-3">{s.text}</p>
              <Link
                href={s.href}
                className="inline-block text-signal font-bold text-sm uppercase tracking-wider hover:underline"
              >
                {s.cta} →
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-gold/10 border border-gold/40 rounded-3xl p-8 text-left">
          <p className="font-display font-bold uppercase tracking-wide text-2xl mb-3">
            🧪 We&apos;re in beta — help us make it perfect
          </p>
          <p className="text-white/70 text-sm leading-relaxed mb-4">
            FishMB is live but still being built, and we want to get it right
            for Manitoba anglers. Got an idea for a feature we should add? Run
            into something that&apos;s broken or confusing? Tell us — we read
            every message and try to fix issues or ship requested features
            within 48 hours.
          </p>
          <Link
            href="/fishmb/contact"
            className="inline-block bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-8 py-3.5 rounded-full transition-colors"
          >
            Suggest a feature / report an issue
          </Link>
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
