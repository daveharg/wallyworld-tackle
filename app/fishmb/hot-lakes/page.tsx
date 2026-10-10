import type { Metadata } from "next";
import Link from "next/link";
import { HotLakeCard } from "../_components/Cards";
import { getHotLakes } from "@/lib/fishmb";
import BackArrow from "../_components/BackArrow";

export const metadata: Metadata = {
  title: "Hot lakes — what's biting now in Manitoba",
  description:
    "Where Manitoba anglers are catching fish right now — recent bite reports from around the province.",
};

export const revalidate = 3600;

export default function HotLakesPage() {
  const hot = getHotLakes();
  return (
    <div className="max-w-7xl mx-auto px-4 py-10 md:py-14">
      <BackArrow />
      <p className="text-signal text-xs font-bold uppercase tracking-[0.24em] mb-2">
        Bite reports
      </p>
      <h1 className="font-display font-bold uppercase text-4xl md:text-5xl text-pine tracking-wide mb-3">
        Hot lakes
      </h1>
      <p className="text-pine/65 max-w-2xl mb-8">
        Where Manitoba anglers are finding fish right now. Reports are
        collected from angler posts and local sources — conditions change fast,
        so check the date on each one.
      </p>
      <div className="grid md:grid-cols-2 gap-5">
        {hot.map((h, i) => (
          <HotLakeCard key={i} hot={h} className="w-full" />
        ))}
      </div>
      <div className="mt-10 bg-pine rounded-3xl p-8 text-center">
        <h2 className="font-display font-bold uppercase text-2xl text-white tracking-wide mb-2">
          Fishing one of these?
        </h2>
        <p className="text-white/70 mb-5">
          Share your report and it shows up in the angler feed.
        </p>
        <Link
          href="/fishmb/feed"
          className="inline-block bg-signal hover:bg-signal-dark text-white text-sm font-bold uppercase tracking-wider px-7 py-3 rounded-full transition-colors"
        >
          Join the feed
        </Link>
      </div>
    </div>
  );
}
