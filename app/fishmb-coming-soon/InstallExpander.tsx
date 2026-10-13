"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Top buttons on the fishmb.ca home page. "Go to the app" expands the
 * make-it-a-web-app instructions (closed by default); the actual app link
 * sits below the instructions.
 */
export default function InstallExpander() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col items-center mb-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-block bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-10 py-4 rounded-full transition-colors"
        >
          📱 Go to the app
        </button>
        <Link
          href="/fishmb/home"
          className="inline-block bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold uppercase tracking-wider text-sm px-10 py-4 rounded-full transition-colors"
        >
          🌐 Website
        </Link>
      </div>

      {open && (
        <div className="w-full max-w-md mx-auto bg-white/5 border border-white/10 rounded-2xl p-4 mt-4 text-left">
          <p className="text-gold font-bold text-sm mb-2">
            🚧 The real FishMB app is coming soon to the App Store.
          </p>
          <p className="text-white/70 text-sm mb-4">
            Until it lands, this web app is the full FishMB — put it on your
            home screen and it opens just like an app:
          </p>
          <p className="text-white font-bold text-sm mb-2">📲 Make it a web app on your phone</p>
          <ol className="text-white/70 text-sm space-y-1 list-decimal list-inside mb-4">
            <li>Tap the app link below to open FishMB</li>
            <li>iPhone: tap Share → Add to Home Screen. Android: tap ⋮ → Add to Home Screen</li>
            <li>FishMB now opens full screen — no browser bars</li>
          </ol>
          <Link
            href="/fishmb/feed"
            className="block text-center bg-white text-pine font-bold uppercase tracking-wider text-sm px-8 py-3.5 rounded-full hover:bg-paper transition-colors"
          >
            Open FishMB →
          </Link>
        </div>
      )}
    </div>
  );
}
