import type { Metadata } from "next";
import InstallExpander from "./InstallExpander";

/**
 * fishmb.ca root — the main FishMB landing page (Dave, 2026-11-15).
 * Lists the app's features and keeps a "Get the app" button; it
 * deliberately links NOWHERE into the web app (no /fishmb routes).
 * Served on fishmb.ca via the middleware rewrite of "/" to this route.
 */

export const metadata: Metadata = {
  // absolute bypasses the root layout's "%s | Wallyworld Tackle" title template
  title: { absolute: "FishMB — Manitoba's fishing app: maps, catches, tournaments & community" },
  description:
    "Manitoba's fishing companion — fishing maps, a social feed for anglers, encrypted messaging, AI fish-activity weather, catch logging, tournaments and provincial leaderboards. All free.",
  alternates: { canonical: "https://www.fishmb.ca/" },
  openGraph: {
    title: "FishMB — Manitoba's fishing app: maps, catches, tournaments & community",
    description:
      "Manitoba's fishing companion — fishing maps, a social feed for anglers, encrypted messaging, AI fish-activity weather, catch logging, tournaments and provincial leaderboards. All free.",
    url: "https://www.fishmb.ca",
    siteName: "FishMB",
    images: [
      {
        url: "https://www.fishmb.ca/fishmb/og-share.png",
        width: 1200,
        height: 630,
        alt: "FishMB — Manitoba's fishing app",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FishMB — Manitoba's fishing app: maps, catches, tournaments & community",
    description:
      "Manitoba's fishing companion — fishing maps, a social feed for anglers, encrypted messaging, AI fish-activity weather, catch logging, tournaments and provincial leaderboards. All free.",
    images: ["https://www.fishmb.ca/fishmb/og-share.png"],
  },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://www.fishmb.ca/#organization",
      name: "FishMB",
      url: "https://www.fishmb.ca/",
      logo: "https://www.fishmb.ca/fishmb/icon-512.png",
      description:
        "FishMB is Manitoba's fishing app: lake maps, 2026 fishing regulations for 271 lakes, catch logging, tournaments, leaderboards and a fish-activity forecast. Free for Manitoba anglers.",
      email: "hello@fishmb.ca",
      sameAs: ["https://www.facebook.com/profile.php?id=61594977917533"],
    },
    {
      "@type": "WebSite",
      "@id": "https://www.fishmb.ca/#website",
      name: "FishMB",
      url: "https://www.fishmb.ca/",
      publisher: { "@id": "https://www.fishmb.ca/#organization" },
      inLanguage: "en-CA",
    },
  ],
};

const GROUPS = [
  {
    heading: "Know when they're biting",
    items: [
      {
        icon: "🎯",
        title: "Bite Scores & Analysis",
        text: "Daily and hourly bite scores for your lake and your species — with the full analysis behind every score, so you can see why the fish are on, or why they're off.",
      },
      {
        icon: "📖",
        title: "Species Guides",
        text: "How to fish each species: where they are, what to tie on, and how the weather and the time of year are moving them.",
      },
      {
        icon: "🌦️",
        title: "Full Weather",
        text: "A complete weather app — gauge, hourly and 10-day — that teaches you to read wind, pressure and fronts for fish patterns.",
      },
    ],
  },
  {
    heading: "Know your water",
    items: [
      {
        icon: "🗺️",
        title: "Lake Maps",
        text: "Real depth charts for thousands of lakes, plus full country maps across Canada and the US.",
      },
      {
        icon: "📄",
        title: "Lake Pages & Regulations",
        text: "Every lake has its own page: species, records, stocking history, and that lake's regulations — limits, seasons and sizes.",
      },
    ],
  },
  {
    heading: "Measure & log",
    items: [
      {
        icon: "🔍",
        title: "Fish ID Scanner",
        text: "Point your camera at a fish and the app names it.",
      },
      {
        icon: "📏",
        title: "Measure Any Fish",
        text: "Measure with LiDAR, from a photo, or on the AR bump board — no tape, no board, no typing with wet hands.",
      },
      {
        icon: "👥",
        title: "Log for Your Crew",
        text: "Log catches for everyone on the boat, not just yourself.",
      },
      {
        icon: "📍",
        title: "Spots & Catches on the Map",
        text: "Mark your spots — ice spots too — and pin every catch right where it happened.",
      },
      {
        icon: "🖼️",
        title: "The Album",
        text: "Every photo stamped with the weather and GPS, so you can track your trends season after season.",
      },
      {
        icon: "🪪",
        title: "Offline Licence",
        text: "A copy of your fishing licence stored in the app — there when you need it, even with no signal.",
      },
    ],
  },
  {
    heading: "Fish with friends",
    items: [
      {
        icon: "🏆",
        title: "Challenges & Tournaments",
        text: "Start your own challenge with friends, or join a tournament — anti-cheat photo verification keeps it honest, and standings run live on your lock screen.",
      },
      {
        icon: "📰",
        title: "The Fishing Feed",
        text: "Your friends' catches and posts — and yours. A feed built for anglers.",
      },
      {
        icon: "🔒",
        title: "Encrypted Messaging",
        text: "End-to-end encrypted chats: texts, photos, and spots you can share right inside the conversation.",
      },
      {
        icon: "📱",
        title: "Widgets",
        text: "Home-screen widgets put the bite score a glance away — and log a catch in one tap.",
      },
    ],
  },
];

export default function FishMBHome() {
  return (
    <div className="min-h-screen bg-pine-deep text-white font-body">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <div className="max-w-3xl mx-auto px-6 py-16 md:py-24 text-center">
        <p className="font-display font-bold uppercase tracking-[0.3em] text-gold text-sm mb-4">
          Manitoba&apos;s fishing app
        </p>
        <h1 className="font-display font-bold uppercase tracking-wide text-5xl md:text-7xl mb-4">
          <span className="text-white">Fish</span>
          <span className="text-signal">MB</span>
        </h1>
        <p className="text-white/70 text-lg md:text-xl max-w-xl mx-auto mb-8">
          Bite scores, lake maps, fish measuring, tournaments and your whole
          fishing circle — one app for Manitoba anglers, built by anglers,
          for anglers.
        </p>
        <InstallExpander />

        <h2 className="font-display font-bold uppercase tracking-wide text-2xl md:text-3xl mb-4 mt-16 text-left">
          What&apos;s inside
        </h2>
        <p className="text-white/50 text-sm text-left mb-8">
          Every feature of the app, grouped the way you&apos;d use it.
        </p>
        {GROUPS.map((g) => (
          <div key={g.heading} className="mb-10">
            <h3 className="font-display font-bold uppercase tracking-[0.2em] text-gold text-sm mb-4 text-left">
              {g.heading}
            </h3>
            <div className="flex flex-col gap-4 text-left">
              {g.items.map((s) => (
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
          </div>
        ))}

        <div className="mt-12 bg-gold/10 border border-gold/40 rounded-3xl p-8 text-left">
          <p className="font-display font-bold uppercase tracking-wide text-2xl mb-3">
            🧪 We&apos;re in beta — help us make it perfect
          </p>
          <p className="text-white/70 text-sm leading-relaxed mb-4">
            FishMB is live but still being built, and we want to get it right
            for Manitoba anglers. Got an idea for a feature we should add? Run
            into something that&apos;s broken or confusing? Tell us — we read
            every message.
          </p>
          <a
            href="mailto:hello@fishmb.ca"
            className="inline-block bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-8 py-3.5 rounded-full transition-colors"
          >
            Email us — hello@fishmb.ca
          </a>
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
