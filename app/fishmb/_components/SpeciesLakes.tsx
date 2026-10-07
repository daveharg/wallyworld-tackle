"use client";

import { useState } from "react";
import Link from "next/link";
import HSlider, { SectionHeading } from "./HSlider";
import { LakeCard, type LakeCardLake } from "./Cards";
import { slugifySpecies } from "@/lib/fishmb-species";

export interface SpeciesTab {
  species: string;
  lakes: LakeCardLake[];
}

/**
 * "Walleye lakes" row with species tabs — pick a fish, see where to catch it.
 * Each tab also links to the how-to-fish guide for that species.
 */
export function SpeciesLakes({ tabs }: { tabs: SpeciesTab[] }) {
  const [active, setActive] = useState(0);
  const tab = tabs[active];
  const guideSlug = slugifySpecies(tab.species);

  return (
    <section className="max-w-7xl mx-auto px-4 mt-12 md:mt-16">
      <SectionHeading
        eyebrow="Find your fish"
        title={`${tab.species} lakes`}
        href="/fishmb/lakes"
        linkLabel="All lakes"
      />
      <div className="flex gap-2 overflow-x-auto pb-4 -mt-2 mb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t, i) => (
          <button
            key={t.species}
            onClick={() => setActive(i)}
            className={`shrink-0 px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
              i === active
                ? "bg-signal text-white"
                : "bg-pine/5 text-pine/60 hover:bg-pine/10"
            }`}
          >
            {t.species}
          </button>
        ))}
      </div>
      {tab.lakes.length === 0 ? (
        <p className="text-pine/55 py-8">No lakes listed for {tab.species} yet.</p>
      ) : (
        <HSlider>
          {tab.lakes.map((l) => (
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
