"use client";

import FishingSpots from "../profile/_components/FishingSpots";
import LakeNotes from "../dashboard/_components/LakeNotes";

/**
 * /fishmb/maps — the angler's personal maps hub (separate from the public
 * lake directory): the regular FishMB map with all saved spots and lake notes.
 */
export default function MyMapsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 pt-4 md:pt-6 pb-32">
      <h1 className="text-xl font-black text-pine tracking-tight mb-1">🗺️ My Maps</h1>
      <p className="text-sm text-pine/55 mb-4">Your private waters — spots and notes.</p>

      <div className="space-y-8">
        <section>
          <FishingSpots />
        </section>
        <section>
          <h2 className="text-base font-black text-pine mb-3">📝 Lake notes</h2>
          <LakeNotes />
        </section>
      </div>
    </div>
  );
}
