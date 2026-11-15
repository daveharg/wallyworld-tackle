import type { Metadata } from "next";
import Link from "next/link";
import { getFishSpecies } from "@/lib/fishmb-fish";

export const metadata: Metadata = {
  title: "Fish of Manitoba — full guides & where to find them",
  description:
    "Every fish species recorded in Manitoba's lakes: the full fishing guide for each one, plus a map of every Manitoba lake where it's found.",
  alternates: { canonical: "https://www.fishmb.ca/fishmb/fish" },
  openGraph: {
    title: "Fish of Manitoba | FishMB",
    description:
      "Full fishing guides for Manitoba's species, with a map of every lake where each fish is recorded.",
    url: "https://www.fishmb.ca/fishmb/fish",
  },
};

export default function FishIndexPage() {
  const species = [...getFishSpecies()].sort(
    (a, b) => b.lakeCount - a.lakeCount || a.name.localeCompare(b.name)
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 md:py-14">
      <Link href="/fishmb/home" className="text-sm font-bold text-signal uppercase tracking-wider">
        ← FishMB home
      </Link>
      <p className="text-signal font-bold uppercase tracking-[0.28em] text-sm mt-4 mb-3">
        Manitoba species
      </p>
      <h1 className="font-display font-bold uppercase text-pine text-4xl md:text-5xl tracking-wide mb-6">
        Fish of Manitoba
      </h1>
      <p className="text-pine/75 text-lg leading-relaxed mb-10">
        Every species recorded in the Manitoba lakes in our directory — the full
        fishing guide for each one, and a map of every lake where it&apos;s found.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        {species.map((s) => (
          <Link
            key={s.slug}
            href={`/fishmb/species/${s.slug}`}
            className="bg-white border border-pine/10 rounded-2xl px-5 py-4 hover:shadow-md transition-shadow"
          >
            <p className="font-display font-bold uppercase text-pine text-lg tracking-wide">
              {s.name}
            </p>
            {s.scientific && (
              <p className="text-pine/45 text-xs italic mt-0.5">{s.scientific}</p>
            )}
            <p className="text-pine/55 text-sm mt-1.5">
              Found in {s.lakeCount} Manitoba {s.lakeCount === 1 ? "lake" : "lakes"}
              {s.guideId ? " · Full guide" : ""}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
