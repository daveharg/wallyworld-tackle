"use client";

import { Suspense } from "react";
import { useFishAuth } from "../_components/FishAuth";
import MapsHub from "./_components/MapsHub";

/**
 * /fishmb/maps — fullscreen map hub. Signed-in anglers get the full-screen
 * map with the peeking bottom sheet (Catches / Saved spots / Settings).
 */
export default function MyMapsPage() {
  const { user, openLogin } = useFishAuth();

  if (!user) {
    const perks = [
      {
 icon: "",
        title: "Mark your honey holes",
        text: "Save GPS fishing spots with one tap — mark your current location or press and hold anywhere on the map to drop a pin.",
      },
      {
 icon: "",
        title: "Your catches on the map",
        text: "Every catch you log with GPS shows up as a pin — plus public catches from other anglers on the same lake.",
      },
      {
 icon: "",
        title: "100% private",
        text: "Your spots are yours alone. Nobody sees them unless you deliberately share one with friends.",
      },
      {
 icon: "",
        title: "Wind + satellite views",
        text: "Flip on live wind at your map's centre or switch to satellite view to read the water before you launch.",
      },
      {
 icon: "",
        title: "Garmin import",
        text: "Bring in tracks and waypoints from your Garmin with one GPX upload.",
      },
    ];
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="font-display font-bold uppercase text-pine text-4xl tracking-wide mb-3">
          Your private fishing maps
        </h1>
        <p className="text-pine/60 text-sm mb-6">
          Full-screen map, GPS catches, secret spots and lake notes — all in
          one place.
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
    <Suspense>
      <MapsHub />
    </Suspense>
  );
}
