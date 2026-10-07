import Link from "next/link";
import { getSpeciesAdvice, slugifySpecies } from "@/lib/fishmb-species";

export const metadata = {
  title: "Fishing Tips | FishMB",
  description: "Pick a fish and learn how to catch it — plus tips from Manitoba anglers.",
};

export default function TipsPage() {
  const species = getSpeciesAdvice();
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 md:py-14">
      <Link href="/fishmb" className="text-sm font-bold text-signal uppercase tracking-wider">
        ← FishMB home
      </Link>
      <p className="text-signal font-bold uppercase tracking-[0.28em] text-sm mt-4 mb-3">
        Fishing tips
      </p>
      <h1 className="font-display font-bold uppercase text-pine text-4xl md:text-5xl tracking-wide mb-3">
        Pick your fish
      </h1>
      <p className="text-pine/60 mb-10 max-w-2xl">
        Every guide has how-to techniques — and real tips from Manitoba anglers. Got one? Add it on
        the fish&apos;s page and it shows up in the community feed too.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {species.map((s) => (
          <Link
            key={s.species}
            href={`/fishmb/species/${slugifySpecies(s.species)}`}
            className="bg-white border border-pine/10 rounded-3xl p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            <h2 className="font-display font-bold uppercase text-pine text-2xl tracking-wide mb-2">
              {s.species}
            </h2>
            <p className="text-pine/60 text-sm line-clamp-3">{s.overview}</p>
            <p className="text-signal-dark font-bold text-sm uppercase tracking-wider mt-4">
              How to fish →
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
