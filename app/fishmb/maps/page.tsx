"use client";

import { Suspense } from "react";
import { useFishAuth } from "../_components/FishAuth";
import FishingSpots from "../profile/_components/FishingSpots";
import LakeNotes from "../dashboard/_components/LakeNotes";

/**
 * /fishmb/maps — the angler's personal maps hub (separate from the public
 * lake directory): the regular FishMB map with all saved spots and lake notes.
 */
export default function MyMapsPage() {
  const { user, openLogin } = useFishAuth();

  if (!user) {
    const perks = [
      {
        icon: "📍",
        title: "Mark your honey holes",
        text: "Save GPS fishing spots with one tap — mark your current location or press and hold anywhere on the map to drop a pin.",
      },
      {
        icon: "🔒",
        title: "100% private",
        text: "Your spots are yours alone. Nobody sees them unless you deliberately share one with friends.",
      },
      {
        icon: "📝",
        title: "Lake notes",
        text: "Keep notes on depths, structure and what's biting at each lake — your personal playbook, always with you.",
      },
      {
        icon: "🗺️",
        title: "Depth contours",
        text: "Flip on depth contour maps to read the underwater structure before you even launch the boat.",
      },
      {
        icon: "🧭",
        title: "Navigate back",
        text: "Tap any saved spot to get distance and compass bearing from your current GPS position.",
      },
    ];
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-6xl mb-4">🗺️</div>
        <h1 className="font-display font-bold uppercase text-pine text-4xl tracking-wide mb-3">
          Your private fishing maps
        </h1>
        <p className="text-pine/60 text-sm mb-6">
          Save secret spots, keep lake notes and read depth contours — all
          on your own personal map.
        </p>
        <button
          onClick={openLogin}
          className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-8 py-3.5 rounded-full mb-8"
        >
          Log in — it's free
        </button>
        <div className="flex flex-col gap-3 text-left">
          {perks.map((p) => (
            <div
              key={p.title}
              className="bg-white border border-pine/10 rounded-2xl px-4 py-3.5 flex items-start gap-3"
            >
              <span className="text-2xl shrink-0">{p.icon}</span>
              <span>
                <span className="block text-sm font-black text-pine">{p.title}</span>
                <span className="block text-xs text-pine/65 leading-snug mt-0.5">{p.text}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 pt-4 md:pt-6 pb-32">
      <div className="space-y-8">
        <section>
          <Suspense>
            <FishingSpots />
          </Suspense>
        </section>
        <section>
          <h2 className="text-base font-black text-pine mb-3">📝 Lake notes</h2>
          <LakeNotes />
        </section>
      </div>
    </div>
  );
}
