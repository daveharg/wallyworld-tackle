import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFishGuide, getFishSpecies, getFishSpeciesBySlug, type FishGuideBlock } from "@/lib/fishmb-fish";
import { getSpeciesBySlug } from "@/lib/fishmb-species";
import { getLakes, type Lake } from "@/lib/fishmb";
import { SpeciesTips } from "../_components/SpeciesTips";
import { LakeMap, type MapLake } from "../../lakes/_components/LakeMap";
import coordsJson from "@/public/fishmb/lake-coords.json";

const COORDS = coordsJson as Record<string, { lat: number; lng: number }>;

export async function generateStaticParams() {
  return getFishSpecies().map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const fish = getFishSpeciesBySlug(params.slug);
  if (!fish) return { title: "Species not found" };
  const description = fish.guideId
    ? `How to catch ${fish.name} in Manitoba — the full guide: best techniques, movement, weather and spawning patterns, plus a map of the ${fish.lakeCount} Manitoba lakes where it's found.`
    : `Where to find ${fish.name} in Manitoba — a map and list of the ${fish.lakeCount} Manitoba lakes where it's recorded.`;
  return {
    title: `How to catch ${fish.name} in Manitoba`,
    description,
    alternates: { canonical: `https://www.fishmb.ca/fishmb/species/${fish.slug}` },
    openGraph: {
      title: `How to catch ${fish.name} in Manitoba | FishMB`,
      description,
      url: `https://www.fishmb.ca/fishmb/species/${fish.slug}`,
    },
  };
}

const H2 = "font-display font-bold uppercase text-pine text-2xl md:text-3xl tracking-wide mb-4";
const H3 = "font-display font-bold uppercase text-pine text-xl tracking-wide mb-3";
const CARD = "bg-white border border-pine/10 rounded-3xl p-6";
const PROSE = "text-pine/75 leading-relaxed";

function BulletList({ lines }: { lines: string[] }) {
  return (
    <ul className="space-y-2.5">
      {lines.map((l, i) => (
        <li key={i} className="flex gap-2.5 text-pine/75 text-sm">
          <span className="text-signal font-bold">▸</span>
          <span>{l}</span>
        </li>
      ))}
    </ul>
  );
}

/** A guide block (heading + bullet lines), the shape movement/weather/spawning use. */
function BulletBlock({ block }: { block: FishGuideBlock }) {
  return (
    <div className={CARD}>
      <h3 className={H3}>{block.heading}</h3>
      <BulletList lines={block.lines} />
    </div>
  );
}

/** A guide block rendered as prose paragraphs (daily movement patterns). */
function ProseBlock({ block }: { block: FishGuideBlock }) {
  return (
    <div className={CARD}>
      <h3 className={H3}>{block.heading}</h3>
      <div className="space-y-3">
        {block.lines.map((l, i) => (
          <p key={i} className={PROSE}>
            {l}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function SpeciesGuidePage({ params }: { params: { slug: string } }) {
  const fish = getFishSpeciesBySlug(params.slug);
  if (!fish) notFound();
  const guide = getFishGuide(fish);
  const advice = !guide ? getSpeciesBySlug(fish.slug) : null;

  const lakes: Lake[] = getLakes().filter((l) => l.species.includes(fish.name));
  const total = lakes.length;
  const mapLakes: MapLake[] = lakes
    .filter((l) => COORDS[l.id])
    .map((l) => ({
      id: l.id,
      name: l.name,
      region: l.region,
      lat: COORDS[l.id].lat,
      lng: COORDS[l.id].lng,
    }));
  const pinned = mapLakes.length;

  // Waters list grouped by region, biggest region first.
  const byRegion = new Map<string, Lake[]>();
  for (const l of lakes) {
    const arr = byRegion.get(l.region) ?? [];
    arr.push(l);
    byRegion.set(l.region, arr);
  }
  const regionGroups = Array.from(byRegion.entries()).sort((a, b) => b[1].length - a[1].length);

  const notResearched = `${fish.name} isn't in the researched fishing library yet — nothing is invented here to fill the space.`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 md:py-14">
      <Link href="/fishmb" className="text-sm font-bold text-signal uppercase tracking-wider">
        ← FishMB home
      </Link>
      <p className="text-signal font-bold uppercase tracking-[0.28em] text-sm mt-4 mb-3">
        How to fish
      </p>
      <h1 className="font-display font-bold uppercase text-pine text-4xl md:text-5xl tracking-wide mb-3">
        {fish.name}
      </h1>
      {fish.scientific && <p className="text-pine/45 italic mb-6">{fish.scientific}</p>}

      {guide?.hasLibrary && (
        <p className="text-pine/75 text-lg leading-relaxed mb-8">
          The complete guide to {fish.name} — best techniques, fish movement
          patterns, weather patterns and spawning patterns, season by season
          and through the ice.
        </p>
      )}

      <Link
        href={`/fishmb/lakes?q=${encodeURIComponent(fish.name)}`}
        className="inline-block bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-7 py-3.5 rounded-full transition-colors mb-10"
      >
        Find {fish.name.toLowerCase()} lakes
      </Link>

      {guide ? (
        <>
          {guide.about.length > 0 && (
            <section className="mb-10">
              <h2 className={H2}>About</h2>
              <div className={CARD}>
                <div className="space-y-3">
                  {guide.about.map((p, i) => (
                    <p key={i} className={PROSE}>
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            </section>
          )}

          <section className="mb-10">
            <h2 className={H2}>Best techniques</h2>
            {guide.hasLibrary ? (
              <div className="space-y-5">
                {guide.techniques.map((season, i) => (
                  <div key={i} className={CARD}>
                    <h3 className={H3}>{season.heading}</h3>
                    <div className="space-y-5">
                      {season.groups.map((g, j) => (
                        <div key={j}>
                          <h4 className="text-sm font-bold uppercase tracking-wider text-signal-dark mb-2.5">
                            {g.label}
                          </h4>
                          <BulletList lines={g.lines} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={PROSE}>{notResearched}</p>
            )}
          </section>

          <section className="mb-10">
            <h2 className={H2}>Movement patterns</h2>
            {guide.hasLibrary ? (
              <div className="space-y-5">
                {guide.movementSeasons.map((b, i) => (
                  <BulletBlock key={`s${i}`} block={b} />
                ))}
                {guide.movementDaily.map((b, i) => (
                  <ProseBlock key={`d${i}`} block={b} />
                ))}
              </div>
            ) : (
              <p className={PROSE}>{notResearched}</p>
            )}
          </section>

          <section className="mb-10">
            <h2 className={H2}>Weather patterns</h2>
            {guide.hasLibrary ? (
              <div className="space-y-5">
                {guide.weatherFacts.length > 0 && (
                  <div className={CARD}>
                    <div className="space-y-3">
                      {guide.weatherFacts.map((f, i) => (
                        <p key={i} className={PROSE}>
                          {f}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                {guide.weatherOverlays.map((b, i) => (
                  <BulletBlock key={i} block={b} />
                ))}
                {guide.weatherNotCounted.length > 0 && (
                  <div className={CARD}>
                    <h3 className={H3}>Measured, and set aside</h3>
                    <ul className="space-y-2.5">
                      {guide.weatherNotCounted.map((r, i) => (
                        <li key={i} className="flex gap-2.5 text-pine/75 text-sm">
                          <span className="text-signal font-bold">▸</span>
                          <span>
                            <strong className="text-pine">{r.factor}:</strong> {r.reason}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className={PROSE}>{notResearched}</p>
            )}
          </section>

          <section className="mb-10">
            <h2 className={H2}>Spawning</h2>
            {guide.hasLibrary ? (
              guide.spawningSeasons.length || guide.spawningSources.length ? (
                <div className="space-y-5">
                  {guide.spawningSeasons.map((b, i) => (
                    <BulletBlock key={i} block={b} />
                  ))}
                  {guide.spawningSources.length > 0 && (
                    <div className={CARD}>
                      <h3 className={H3}>From the research file</h3>
                      <div className="space-y-2">
                        {guide.spawningSources.map((src, i) => (
                          <p key={i} className="text-pine/55 text-xs leading-relaxed">
                            <strong className="text-pine/75">{src.factor}:</strong> {src.citation}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className={PROSE}>
                  The research file for {fish.name} doesn&apos;t cover its spawning yet.
                </p>
              )
            ) : (
              <p className={PROSE}>{notResearched}</p>
            )}
          </section>
        </>
      ) : advice ? (
        <>
          <p className="text-pine/75 text-lg leading-relaxed mb-8">{advice.overview}</p>
          <div className="grid md:grid-cols-2 gap-5 mb-10">
            <div className={CARD}>
              <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-4">
                Techniques
              </h2>
              <BulletList lines={advice.techniques} />
            </div>
            <div className={CARD}>
              <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-4">
                Baits &amp; lures
              </h2>
              <BulletList lines={advice.baits} />
            </div>
          </div>
          <div className="bg-paper-deep border border-pine/10 rounded-3xl p-6 mb-10">
            <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-4">
              Best seasons
            </h2>
            <p className="text-pine/75">{advice.best_seasons}</p>
          </div>
        </>
      ) : (
        <div className={`${CARD} mb-10`}>
          <p className={PROSE}>{notResearched}</p>
        </div>
      )}

      {fish.maMin && (
        <section className="mb-10">
          <h2 className={H2}>Manitoba Master Angler</h2>
          <p className="text-pine/75 text-lg leading-relaxed">
            A {fish.name} of {fish.maMin} or better qualifies for Manitoba&apos;s
            Master Angler Program.
          </p>
        </section>
      )}

      {total > 0 && (
        <section className="mb-10">
          <h2 className={H2}>Where to find {fish.name} in Manitoba</h2>
          <p className="text-pine/55 text-sm mb-4">
            {total} Manitoba {total === 1 ? "water" : "waters"} in the FishMB
            directory hold {fish.name}.
          </p>
          {pinned > 0 ? (
            <>
              <div className="mb-4">
                <LakeMap lakes={mapLakes} />
              </div>
              <p className="text-pine/55 text-sm mb-8">
                {pinned === total
                  ? "Every one of those waters is pinned on the map — tap a pin, then “View lake” to open that lake's page."
                  : `${pinned} of those waters are pinned on the map — tap a pin, then “View lake” to open that lake's page. The rest are in the list below; their records carry no coordinates to pin.`}
              </p>
            </>
          ) : (
            <p className="text-pine/55 text-sm mb-8">
              None of the records for these waters carry coordinates, so
              there&apos;s no map to pin — the full list is below.
            </p>
          )}
          {regionGroups.map(([region, regionLakes]) => (
            <div key={region} className="mb-8">
              <h3 className={H3}>{region}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {regionLakes.map((l) => (
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
            </div>
          ))}
          <Link
            href="/fishmb/lakes"
            className="text-signal-dark font-bold text-sm uppercase tracking-wider"
          >
            Search all lakes →
          </Link>
        </section>
      )}

      {guide && (
        <p className="text-pine/45 text-xs leading-relaxed mb-4">
          Guide built from the researched fishing library and rating model
          behind the Bump Board app — the same full guide as the{" "}
          {fish.name} page on bumpboard.ca.
        </p>
      )}

      <SpeciesTips species={fish.name} />
    </div>
  );
}
