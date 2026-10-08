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
