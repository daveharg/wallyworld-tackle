import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "../_components/FishHeader";

export const metadata: Metadata = {
  title: "Get the FishMB app",
  description:
    "FishMB for iPhone and web — Manitoba lake directory, regulations, catch log, angler feed and contests. Free.",
};

const FEATURES = [
  {
    title: "271 lakes in your pocket",
    body: "Every walleye lake plus all fishable stocked waters — species, 2026 regulations, stocking history and nearby towns, even with no signal.",
  },
  {
    title: "Catch log & stats",
    body: "Log catches with photos, track your biggest fish by species, and watch your personal stats grow season over season.",
  },
  {
    title: "Angler feed",
    body: "See what Manitoba anglers are catching right now. Post your own, follow the bite, talk fishing.",
  },
  {
    title: "Contests",
    body: "Run your own small tournaments with friends — live leaderboards and verified catches.",
  },
  {
    title: "Lodges & guides",
    body: "127 verified lodges, guides and outfitters with contact info, waters, packages and ice-fishing options.",
  },
  {
    title: "Free, no sign-in needed",
    body: "Browse everything as a guest. Sign in with Google only if you want your log on all your devices.",
  },
];

export default function AppPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-10 md:py-14">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <Wordmark />
        <h1 className="font-display font-bold uppercase text-4xl md:text-6xl text-pine tracking-wide mt-4 mb-4">
          Manitoba fishing,<br />in your pocket
        </h1>
        <p className="text-pine/65 text-lg mb-8">
          The FishMB app puts every lake, regulation, lodge and the whole
          angler community one tap away — on the water or on the couch.
        </p>
        <Link
          href="/fish-manitoba-preview/"
          className="inline-block bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider px-9 py-4 rounded-full transition-colors text-base"
        >
          Open the web app now
        </Link>
        <p className="text-pine/45 text-sm mt-4">
          Free · No sign-in required to browse · iPhone app coming soon
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="bg-white rounded-3xl border border-pine/10 p-6 md:p-7"
          >
            <h2 className="font-display font-bold uppercase text-xl text-pine tracking-wide mb-2">
              {f.title}
            </h2>
            <p className="text-pine/65 text-[15px] leading-relaxed">{f.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
