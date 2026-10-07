import type { Metadata } from "next";
import LakeDirectory from "./_components/LakeDirectory";
import { getLakes } from "@/lib/fishmb";

export const metadata: Metadata = {
  title: "Manitoba lake directory",
  description:
    "Search 271 Manitoba lakes — species, 2026 fishing regulations, stocking history, nearby towns and lodges.",
};

export const revalidate = 3600;

export default function LakesPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const lakes = getLakes().map((l) => ({
    id: l.id,
    name: l.name,
    region: l.region,
    species: l.species,
    stocked: l.stocked,
    photo: l.photo,
    regulations: { division: l.regulations?.division ?? "" },
  }));
  return (
    <div className="max-w-7xl mx-auto px-4 py-10 md:py-14">
      <p className="text-signal text-xs font-bold uppercase tracking-[0.24em] mb-2">
        Lake directory
      </p>
      <h1 className="font-display font-bold uppercase text-4xl md:text-5xl text-pine tracking-wide mb-3">
        Lake directory
      </h1>
      <p className="text-pine/65 max-w-2xl mb-8">
        {lakes.length} Manitoba lakes with species, 2026 Anglers&apos; Guide
        regulations, stocking history and nearby services. Pick a lake to see
        its full limits table — and if your lake isn&apos;t here yet,{" "}
        <a href="#request-lake" className="text-signal-dark font-bold">
          request it below
        </a>
        .
      </p>
      <LakeDirectory lakes={lakes} initialQuery={searchParams.q ?? ""} />
    </div>
  );
}
