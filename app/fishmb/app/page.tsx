"use client";

import Link from "next/link";

/** "Get the FishMB app" — simple: the whole site is a web app, app stores soon. */
export default function FishMBAppPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 md:py-14 text-center">
      <p className="text-gold font-bold uppercase tracking-[0.28em] text-sm mb-3">
        The FishMB app
      </p>
      <h1 className="font-display font-bold uppercase text-pine text-4xl md:text-5xl tracking-wide mb-6">
        This website <span className="text-signal">is</span> the app
      </h1>
      <p className="text-pine/75 text-lg leading-relaxed max-w-xl mx-auto mb-6">
        FishMB is a web app — everything you see here runs like an app right
        on your phone. Add it to your Home Screen and it launches full-screen,
        no download needed.
      </p>
      <p className="text-pine/75 text-lg leading-relaxed max-w-xl mx-auto mb-6">
        FishMB is also coming to the App Store and Google Play soon.
      </p>
      <div className="bg-pine rounded-3xl p-6 md:p-8 mb-10">
        <p className="text-white/90 text-base leading-relaxed max-w-xl mx-auto">
          📡 Once the app-store version launches, tournaments will keep working
          even without cell service — log your catches offline on the water
          and they&apos;ll sync when you&apos;re back in range.
        </p>
      </div>
      <Link
        href="/fishmb/feed"
        className="inline-block bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-10 py-4 rounded-full transition-colors"
      >
        Open the feed
      </Link>
    </div>
  );
}
