"use client";

import { useState } from "react";
import FishingSpots from "../profile/_components/FishingSpots";
import LakeNotes from "../dashboard/_components/LakeNotes";

/**
 * /fishmb/maps — the angler's personal maps hub (separate from the public
 * lake directory). Two views: the regular FishMB map with all saved spots
 * and lake notes, and the coming depth-contours view.
 */
export default function MyMapsPage() {
  const [view, setView] = useState<"spots" | "contours">("spots");

  return (
    <div className="max-w-4xl mx-auto px-4 pt-4 md:pt-6 pb-32">
      <h1 className="text-xl font-black text-pine tracking-tight mb-1">🗺️ My Maps</h1>
      <p className="text-sm text-pine/55 mb-4">Your private waters — spots, notes and contours.</p>

      {/* View switcher */}
      <div className="flex bg-pine/10 rounded-full p-1 mb-5 max-w-md">
        {(
          [
            ["spots", "📍 My spots"],
            ["contours", "🗺️ Contours"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 rounded-full py-2.5 text-xs font-black uppercase tracking-wider transition-colors ${
              view === v ? "bg-pine text-white shadow" : "text-pine/55 hover:text-pine"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "spots" ? (
        <div className="space-y-8">
          <section>
            <FishingSpots />
          </section>
          <section>
            <h2 className="text-base font-black text-pine mb-3">📝 Lake notes</h2>
            <LakeNotes />
          </section>
        </div>
      ) : (
        <section className="bg-white border border-pine/10 rounded-3xl p-8 text-center">
          <p className="text-5xl mb-4">🗺️</p>
          <h2 className="font-bold text-pine text-xl mb-3">Depth contours coming soon</h2>
          <p className="text-pine/70 text-sm leading-relaxed mb-2 max-w-md mx-auto">
            We&apos;re bringing Navionics-style depth contour maps to FishMB. Flip any map
            between the regular view and contours — your spots and notes work on both.
          </p>
          <p className="text-pine/50 text-xs max-w-md mx-auto">
            You&apos;ll use your own Navionics account for charts — FishMB never touches
            chart subscriptions.
          </p>
          <button
            onClick={() => setView("spots")}
            className="mt-6 bg-pine text-white text-xs font-black uppercase tracking-wider px-6 py-3 rounded-full"
          >
            Back to my spots
          </button>
        </section>
      )}
    </div>
  );
}
