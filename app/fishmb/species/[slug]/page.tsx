import Link from "next/link";
import { notFound } from "next/navigation";
import { getSpeciesAdvice, getSpeciesBySlug, slugifySpecies } from "@/lib/fishmb-species";
import { getLakes } from "@/lib/fishmb";
import { SpeciesTips } from "../_components/SpeciesTips";
import { LakeMap, type MapLake } from "../../lakes/_components/LakeMap";
import coordsJson from "@/public/fishmb/lake-coords.json";

const COORDS = coordsJson as Record<string, { lat: number; lng: number }>;

export async function generateStaticParams() {
  return getSpeciesAdvice().map((s) => ({ slug: slugifySpecies(s.species) }));
}

function lakesForSpecies(species: string, limit = 12) {
  const needle = species.toLowerCase();
  return getLakes()
    .filter((l) => l.species.some((s) => s.toLowerCase().includes(needle)))
    .slice(0, limit);
}

export default function SpeciesGuidePage({ params }: { params: { slug: string } }) {
  const advice = getSpeciesBySlug(params.slug);
  if (!advice) notFound();
  const lakes = lakesForSpecies(advice.species);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 md:py-14">
      <Link href="/fishmb" className="text-sm font-bold text-signal uppercase tracking-wider">
        ← FishMB home
      </Link>
      <p className="text-signal font-bold uppercase tracking-[0.28em] text-sm mt-4 mb-3">
        How to fish
      </p>
      <h1 className="font-display font-bold uppercase text-pine text-4xl md:text-5xl tracking-wide mb-6">
        {advice.species}
      </h1>

      <p className="text-pine/75 text-lg leading-relaxed mb-8">{advice.overview}</p>

      <Link
        href={`/fishmb/lakes?q=${encodeURIComponent(advice.species)}`}
        className="inline-block bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-7 py-3.5 rounded-full transition-colors mb-10"
      >
 Find {advice.species.toLowerCase()} lakes
      </Link>

      <div className="grid md:grid-cols-2 gap-5 mb-10">
        <div className="bg-white border border-pine/10 rounded-3xl p-6">
          <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-4">
            Techniques
          </h2>
          <ul className="space-y-2.5">
            {advice.techniques.map((t, i) => (
              <li key={i} className="flex gap-2.5 text-pine/75 text-sm">
                <span className="text-signal font-bold">▸</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white border border-pine/10 rounded-3xl p-6">
          <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-4">
            Baits & lures
          </h2>
          <ul className="space-y-2.5">
            {advice.baits.map((b, i) => (
              <li key={i} className="flex gap-2.5 text-pine/75 text-sm">
                <span className="text-signal font-bold">▸</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-paper-deep border border-pine/10 rounded-3xl p-6 mb-10">
        <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-4">
          Best seasons
        </h2>
        <p className="text-pine/75">{advice.best_seasons}</p>
      </div>

      {lakes.length > 0 && (
        <>
          <h2 className="font-display font-bold uppercase text-pine text-2xl md:text-3xl tracking-wide mb-4">
            Where to catch {advice.species.toLowerCase()}
          </h2>
          {(() => {
            const mapLakes: MapLake[] = lakes
              .filter((l) => COORDS[l.id])
              .map((l) => ({
                id: l.id,
                name: l.name,
                region: l.region,
                lat: COORDS[l.id].lat,
                lng: COORDS[l.id].lng,
              }));
            return mapLakes.length > 0 ? (
              <div className="mb-6">
                <LakeMap lakes={mapLakes} />
              </div>
            ) : null;
          })()}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
            {lakes.map((l) => (
              <Link
                key={l.id}
                href={`/fishmb/lakes/${l.id}`}
                className="bg-white border border-pine/10 rounded-2xl px-4 py-3.5 hover:shadow-md transition-shadow"
              >
                <p className="font-bold text-pine text-sm">{l.name}</p>
                <p className="text-pine/50 text-xs mt-0.5">{l.region}</p>
              </Link>
            ))}
          </div>
          <Link
            href="/fishmb/lakes"
            className="text-signal-dark font-bold text-sm uppercase tracking-wider"
          >
            Search all lakes →
          </Link>
        </>
      )}

      <SpeciesTips species={advice.species} />
    </div>
  );
}
