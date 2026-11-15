"use client";

import { useState } from "react";

/**
 * "Get the app" button on the fishmb.ca home page. The native app isn't
 * on the stores yet, so the button expands a short coming-soon note.
 * The fishmb.ca home page deliberately links nowhere into the web app —
 * this component renders no links at all (Dave, 2026-11-15).
 */
export default function InstallExpander() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col items-center mb-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-block bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-10 py-4 rounded-full transition-colors"
      >
        📱 Get the app
      </button>

      {open && (
        <div className="w-full max-w-md mx-auto bg-white/5 border border-white/10 rounded-2xl p-4 mt-4 text-left">
          <p className="text-gold font-bold text-sm mb-2">Coming soon</p>
          <p className="text-white/70 text-sm">
            The FishMB app is coming soon to the App Store and Google Play.
            When it lands, this button will take you straight to it.
          </p>
        </div>
      )}
    </div>
  );
}
