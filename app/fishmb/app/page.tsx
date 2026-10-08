"use client";

import Link from "next/link";

/** "Get the FishMB app" — the native app is coming soon; the web app is the feed. */
export default function FishMBAppPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 md:py-14 text-center">
      <p className="text-5xl mb-5">📱</p>
      <p className="text-gold font-bold uppercase tracking-[0.28em] text-sm mb-3">
        The FishMB app
      </p>
      <h1 className="font-display font-bold uppercase text-pine text-4xl md:text-5xl tracking-wide mb-6">
        Coming soon to app stores
      </h1>
      <p className="text-pine/75 text-lg leading-relaxed max-w-xl mx-auto mb-6">
        We&apos;re building native FishMB apps for the App Store and Google
        Play. Once they launch, tournaments will keep working even without
        cell service — log your catches offline on the water and they&apos;ll
        sync when you&apos;re back in range.
      </p>
      <div className="bg-pine rounded-3xl p-6 md:p-8 mb-10">
        <p className="text-white font-bold uppercase tracking-wider text-sm mb-2">
          Don&apos;t want to wait?
        </p>
        <p className="text-white/85 text-base leading-relaxed max-w-xl mx-auto mb-6">
          The entire website already runs as a web app — add it to your Home
          Screen and it launches full-screen, no download needed. Jump into
          the community feed right now:
        </p>
        <Link
          href="/fishmb/feed"
          className="inline-block bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-10 py-4 rounded-full transition-colors"
        >
          Open the web app →
        </Link>
      </div>
      <Link
        href="/fishmb"
        className="text-signal-dark font-bold text-sm uppercase tracking-wider"
      >
        ← Back to FishMB
      </Link>
    </div>
  );
}
