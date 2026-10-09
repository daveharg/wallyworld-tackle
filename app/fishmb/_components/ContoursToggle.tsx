"use client";

import { useState } from "react";

/**
 * "Contours" map toggle. For now it opens a coming-soon box — the
 * Navionics contour layer ships with the FishMB mobile app, where anglers
 * can flip any map between the FishMB base map and depth contours.
 */
export default function ContoursToggle() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute top-3 right-3 z-[500] bg-white/95 backdrop-blur border border-pine/15 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider text-pine shadow-md hover:bg-white transition-colors"
      >
        🗺️ Contours
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-pine-deep/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-paper rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-5xl mb-4">🗺️</p>
            <h3 className="font-display font-bold uppercase text-pine text-2xl tracking-wide mb-3">
              Depth contours coming soon
            </h3>
            <p className="text-pine/70 text-sm leading-relaxed mb-2">
              We're bringing Garmin Navionics depth contour maps to FishMB.
              Flip any map between the regular view and contours — your spots
              work on both.
            </p>
            <p className="text-pine/50 text-xs mb-6">
              Arriving with the FishMB mobile app.
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-8 py-3 rounded-full transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
