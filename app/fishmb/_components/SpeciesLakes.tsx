"use client";

import { useState } from "react";
import Link from "next/link";
import HSlider, { SectionHeading } from "./HSlider";
import { LakeCard, type LakeCardLake } from "./Cards";
import { slugifySpecies } from "@/lib/fishmb-species";
import coordsJson from "@/public/fishmb/lake-coords.json";

const COORDS = coordsJson as Record<string, { lat: number; lng: number }>;

export interface SpeciesTab {
  species: string;
  lakes: LakeCardLake[];
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * "Walleye lakes" row with species tabs — pick a fish, see where to catch it.
 * Each tab also links to the how-to-fish guide for that species.
 * "Closest to you" sorts the current species' lakes by distance.
 */
export function SpeciesLakes({
  tabs,
  allLakes,
}: {
  tabs: SpeciesTab[];
  allLakes: LakeCardLake[];
}) {
  const [active, setActive] = useState(0);
  const [nearby, setNearby] = useState<LakeCardLake[] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const tab = tabs[active];
  const guideSlug = slugifySpecies(tab.species);

  const shown = nearby ?? tab.lakes;

  const closestToMe = () => {
    if (!("geolocation" in navigator)) {
      setLocError("Your device doesn't share location.");
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const needle = tab.species.toLowerCase();
        const ranked = allLakes
          .filter(
            (l) =>
              COORDS[l.id] &&
              l.species.some((s) => s.toLowerCase().includes(needle))
          )
          .map((l) => ({
            lake: l,
            km: haversineKm(latitude, longitude, COORDS[l.id].lat, COORDS[l.id].lng),
          }))
          .sort((a, b) => a.km - b.km)
          .slice(0, 12)
          .map((r) => r.lake);
        setNearby(ranked);
        setLocating(false);
      },
      () => {
        setLocError("Couldn't get your location — check location permission.");
        setLocating(false);
      },
      { timeout: 10000 }
    );
  };

  const clearNearby = () => {
    setNearby(null);
    setLocError(null);
  };

  const switchTab = (i: number) => {
    setActive(i);
    setNearby(null);
    setLocError(null);
  };

  return (
    <section className="max-w-7xl mx-auto px-4 mt-12 md:mt-16">
      <SectionHeading
        eyebrow="Find your fish"
        title={nearby ? `${tab.species} lakes near you` : `${tab.species} lakes`}
        href="/fishmb/lakes"
        linkLabel="All lakes"
      />
      <div className="flex gap-2 overflow-x-auto pb-4 -mt-2 mb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          onClick={nearby ? clearNearby : closestToMe}
          disabled={locating}
          className={`shrink-0 px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-60 ${
            nearby
              ? "bg-pine text-white"
              : "bg-gold/25 text-pine hover:bg-gold/40"
          }`}
        >
          {locating ? "Locating…" : nearby ? "✕ Clear" : "📍 Closest to you"}
        </button>
        {tabs.map((t, i) => (
          <button
            key={t.species}
            onClick={() => switchTab(i)}
            className={`shrink-0 px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
              i === active && !nearby
                ? "bg-signal text-white"
                : "bg-pine/5 text-pine/60 hover:bg-pine/10"
            }`}
          >
            {t.species}
          </button>
        ))}
      </div>
      {locError && <p className="text-signal-dark text-sm mb-3">{locError}</p>}
      {shown.length === 0 ? (
        <p className="text-pine/55 py-8">No lakes listed for {tab.species} yet.</p>
      ) : (
        <HSlider>
          {shown.map((l) => (
            <LakeCard key={l.id} lake={l} />
          ))}
        </HSlider>
      )}
      <Link
        href={`/fishmb/species/${guideSlug}`}
        className="inline-block mt-4 text-signal-dark font-bold text-sm uppercase tracking-wider"
      >
        How to fish {tab.species.toLowerCase()} →
      </Link>
    </section>
  );
}
