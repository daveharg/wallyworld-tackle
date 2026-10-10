import type { Metadata } from "next";
import LodgeDirectory from "./_components/LodgeDirectory";
import Classifieds from "./_components/Classifieds";
import { getLodges } from "@/lib/fishmb";
import BackArrow from "../_components/BackArrow";

export const metadata: Metadata = {
  title: "Manitoba lodges & fishing guides",
  description:
    "127 Manitoba fishing lodges and guides — plus community guide classifieds and ice shack rentals.",
};

export const revalidate = 3600;

export default function LodgesPage() {
  const lodges = getLodges().map((l) => ({
    id: l.id,
    name: l.name,
    location: l.location,
    kind: l.kind,
    species: l.species,
    ice_fishing: l.ice_fishing,
    access: l.access ?? null,
  }));
  return (
    <div className="max-w-7xl mx-auto px-4 py-10 md:py-14">
      <BackArrow />
      <p className="text-signal text-xs font-bold uppercase tracking-[0.24em] mb-2">
        Lodges &amp; guides
      </p>
      <h1 className="font-display font-bold uppercase text-4xl md:text-5xl text-pine tracking-wide mb-3">
        Stay where the fish are
      </h1>
      <p className="text-pine/65 max-w-2xl mb-8">
        {lodges.length} verified Manitoba fishing lodges, guides and outfitters —
        waters they fish, species, packages and how to book.
      </p>
      <LodgeDirectory lodges={lodges} />
      <Classifieds category="guide" />
      <Classifieds category="shack" />
    </div>
  );
}
