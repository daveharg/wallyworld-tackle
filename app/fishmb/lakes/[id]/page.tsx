import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLake, getLakes, getZone, getGuideUrl, getStockingHistory, getTrophyCatches, type StockingEvent, type TrophyCatch } from "@/lib/fishmb";
import { slugifySpecies, getSpeciesAdvice } from "@/lib/fishmb-species";
import { lakePhotoUrl, hasRealLakePhoto, lakePhotoCredit } from "@/lib/fishmb-constants";
import { LakeMap } from "../_components/LakeMap";
import { TrophyCatchesList } from "./TrophyCatchesList";
import coordsJson from "@/public/fishmb/lake-coords.json";

const COORDS = coordsJson as Record<string, { lat: number; lng: number }>;

export const revalidate = 3600;

export async function generateStaticParams() {
  return getLakes().map((l) => ({ id: l.id }));
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const lake = getLake(params.id);
  if (!lake) return { title: "Lake not found" };
  return {
    title: `${lake.name} — fishing regulations & lake info`,
    description: `${lake.name}, ${lake.region} Manitoba: 2026 fishing regulations, species, stocking history and nearby lodges.`,
  };
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-bold bg-paper-deep text-pine/70 rounded-full px-3 py-1.5">
      {children}
    </span>
  );
}

const GUIDE_SLUGS = new Set(getSpeciesAdvice().map((a) => slugifySpecies(a.species)));
function speciesGuideSlug(name: string): string | null {
  const slug = slugifySpecies(name);
  return GUIDE_SLUGS.has(slug) ? slug : null;
}

function LakeTitle({ lake, light }: { lake: { name: string; region: string; stocked: boolean; species: string[] }; light?: boolean }) {
  const chip = light
    ? "text-white/90 bg-white/15 hover:bg-white/30"
    : "text-pine bg-pine/10 hover:bg-pine/20";
  return (
    <>
      <p className="text-gold font-bold uppercase tracking-[0.24em] text-xs mb-2">
        {lake.region} Manitoba
      </p>
      <h1 className="font-display font-bold uppercase text-white text-4xl md:text-6xl tracking-wide">
        {lake.name}
      </h1>
      <div className="flex flex-wrap gap-2 mt-3">
        {lake.stocked && (
          <span className="text-[11px] font-black uppercase tracking-wider text-white bg-[#5E8F3E] rounded-md px-2.5 py-1">
            Stocked
          </span>
        )}
        {lake.species.map((s) => {
          const guide = speciesGuideSlug(s);
          return guide ? (
            <Link
              key={s}
              href={`/fishmb/species/${guide}`}
              className={`text-[11px] font-bold uppercase tracking-wider rounded-md px-2.5 py-1 transition-colors ${chip}`}
              title={`How to fish ${s}`}
            >
              {s}
            </Link>
          ) : (
            <span
              key={s}
              className="text-[11px] font-bold uppercase tracking-wider text-white/90 bg-white/15 rounded-md px-2.5 py-1"
            >
              {s}
            </span>
          );
        })}
      </div>
    </>
  );
}

/** Does a division limit row apply to this lake? Matches if any of the lake's
 *  species appears in the limit row's species label (e.g. "Walleye" matches
 *  "Walleye (Pickerel) & Sauger (either or combined)"). */
function limitAppliesToLake(limitSpecies: string, lakeSpecies: string[]): boolean {
  const label = limitSpecies.toLowerCase();
  return lakeSpecies.some((s) => label.includes(s.toLowerCase()));
}

function formatStockDate(iso: string | null): string {  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (!y || !m || !d) return iso;
  return `${months[m - 1]} ${d}, ${y}`;
}

/** Biggest documented catches for one lake, from the Master Angler record book.
 *  Scrollable with sort by date, species, or size. */
function TrophyCatches({ lakeId }: { lakeId: string }) {
  const catches: TrophyCatch[] = getTrophyCatches(lakeId);
  if (catches.length === 0) return null;
  return <TrophyCatchesList catches={catches} />;
}

/** Provincial stocking records table for one lake (exact dates + quantities). */
function StockingTable({ lakeId }: { lakeId: string }) {
  const events: StockingEvent[] = getStockingHistory(lakeId);
  if (events.length === 0) {
    return (
      <p className="text-sm text-pine/60">
        Detailed stocking records for this lake aren&apos;t in the provincial
        dataset yet.
      </p>
    );
  }
  return (
    <div>
      {/* Desktop: full table */}
      <div className="overflow-x-auto rounded-2xl border border-pine/10 bg-white hidden md:block">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="bg-pine/5 text-left">
              <th className="px-4 py-2.5 text-xs font-black uppercase tracking-wider text-pine/60">Date</th>
              <th className="px-4 py-2.5 text-xs font-black uppercase tracking-wider text-pine/60">Species</th>
              <th className="px-4 py-2.5 text-xs font-black uppercase tracking-wider text-pine/60">Size</th>
              <th className="px-4 py-2.5 text-xs font-black uppercase tracking-wider text-pine/60 text-right">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-pine/[0.03]"}>
                <td className="px-4 py-2.5 text-pine font-bold whitespace-nowrap">
                  {formatStockDate(e.date)}
                </td>
                <td className="px-4 py-2.5 text-pine/80">{e.species}</td>
                <td className="px-4 py-2.5 text-pine/80 whitespace-nowrap">{e.size || "—"}</td>
                <td className="px-4 py-2.5 text-pine font-bold text-right tabular-nums whitespace-nowrap">
                  {e.quantity != null ? e.quantity.toLocaleString("en-US") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile: compact stacked list, no sideways scrolling */}
      <div className="md:hidden rounded-2xl border border-pine/10 bg-white divide-y divide-pine/8">
        {events.map((e, i) => (
          <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-pine">{formatStockDate(e.date)}</p>
              <p className="text-xs text-pine/60 truncate">
                {e.species}
                {e.size ? ` · ${e.size}` : ""}
              </p>
            </div>
            <p className="text-sm font-bold text-pine tabular-nums whitespace-nowrap">
              {e.quantity != null ? e.quantity.toLocaleString("en-US") : "—"}
            </p>
          </div>
        ))}
      </div>
      <p className="text-xs text-pine/40 mt-3">
        {events.length} stocking event{events.length === 1 ? "" : "s"} · Source:
        Manitoba Waterbody Stocking Records, Manitoba Wildlife and Fisheries
        Branch (open.canada.ca)
      </p>
    </div>
  );
}

export default function LakeDetailPage({ params }: { params: { id: string } }) {
  const lake = getLake(params.id);  if (!lake) notFound();

  const zone = getZone(lake.limits_zone);
  const regs = lake.regulations;
  const coords = COORDS[lake.id];
  // Only show limit rows for species this lake actually has. If none of the
  // lake's species match a division row (e.g. stocked-trout-only waters),
  // fall back to the full division table rather than showing nothing.
  const matchedLimits = zone
    ? zone.limits.filter((lim) => limitAppliesToLake(lim.species, lake.species))
    : [];
  const shownLimits = matchedLimits.length > 0 ? matchedLimits : (zone?.limits ?? []);
  const towns: string[] = Array.isArray(lake.towns)
    ? lake.towns.map((t) => (typeof t === "string" ? t : t.name))
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
      <Link
        href="/fishmb/lakes"
        className="text-sm font-bold text-signal uppercase tracking-wider"
      >
        ← All lakes
      </Link>

      {/* Hero — real photo only when we have a verified true photo of this lake */}
      {hasRealLakePhoto(lake.id) ? (
        <div className="relative mt-4 rounded-3xl overflow-hidden bg-pine-deep">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lakePhotoUrl(lake.id, 1600)}
            alt={lake.name}
            className="w-full h-64 md:h-96 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-pine-deep/85 via-pine-deep/20 to-transparent" />
          <div className="absolute bottom-0 inset-x-0 p-6 md:p-8">
            <LakeTitle lake={lake} light />
          </div>
          <p className="absolute top-3 right-4 text-[11px] text-white/70">
            {lakePhotoCredit(lake.id)}
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-3xl bg-pine-deep p-6 md:p-8">
          <LakeTitle lake={lake} light />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8 mt-8">
        <div className="lg:col-span-2 space-y-8">
          {/* About */}
          {lake.description && (
            <section>
              <h2 className="font-display font-bold uppercase text-2xl text-pine tracking-wide mb-3">
                About this lake
              </h2>
              <p className="text-pine/75 leading-relaxed">{lake.description}</p>
              <div className="flex flex-wrap gap-x-8 gap-y-2 mt-4 text-sm">
                {lake.size_text && (
                  <p className="text-pine/60">
                    <span className="font-bold text-pine">Size:</span> {lake.size_text}
                  </p>
                )}
                {lake.max_depth_text && (
                  <p className="text-pine/60">
                    <span className="font-bold text-pine">Max depth:</span>{" "}
                    {lake.max_depth_text}
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Trophy catches from the Master Angler record book */}
          <TrophyCatches lakeId={lake.id} />

          {/* Location map */}
          {coords && (
            <section>
              <h2 className="font-display font-bold uppercase text-2xl text-pine tracking-wide mb-3">
                Where it is
              </h2>
              <LakeMap
                lakes={[
                  {
                    id: lake.id,
                    name: lake.name,
                    region: lake.region,
                    lat: coords.lat,
                    lng: coords.lng,
                  },
                ]}
              />
            </section>
          )}

          {/* Regulations */}
          <section className="bg-white rounded-3xl border border-pine/10 p-6 md:p-8">
            {lake.id === "clear-lake" && (
              <div className="bg-pine text-white rounded-2xl p-5 md:p-6 mb-6">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-gold mb-2">
                  🏛️ National park water — different rules
                </p>
                <p className="text-white/90 text-sm leading-relaxed mb-3">
                  Clear Lake is inside Riding Mountain National Park, so the
                  Manitoba Anglers&apos; Guide does <strong>not</strong> apply here.
                  Your provincial licence is <strong>not valid</strong> — you need
                  a Parks Canada national park fishing permit instead (youth under
                  16 fish free with a permit-holding adult).
                </p>
                <ul className="text-white/85 text-sm space-y-1.5 list-disc pl-5 mb-3">
                  <li>Season: May 15 to March 31.</li>
                  <li>Barbless hooks only — pinch every barb.</li>
                  <li>No lead tackle under 50 g.</li>
                  <li>No live or dead fish bait (earthworms &amp; nightcrawlers OK).</li>
                  <li>One line at a time, angling only, no night fishing.</li>
                  <li>Limits: pike 3 (only 1 over 76 cm), walleye 2, perch 5, whitefish 5 — 5 fish combined max.</li>
                  <li>Smallmouth bass are invasive here: <strong>kill and keep every one</strong>, no limit, and report them to Parks Canada.</li>
                  <li>All watercraft and gear need a Parks Canada invasive-species inspection — Clean, Drain, Dry.</li>
                </ul>
                <a
                  href="https://parks.canada.ca/pn-np/mb/riding/activ/rec/activ1-fsh?wbdisable=true"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-gold text-pine font-bold uppercase tracking-wider text-xs px-5 py-2.5 rounded-full hover:bg-white transition-colors"
                >
                  Parks Canada fishing rules →
                </a>
              </div>
            )}
            <p className="text-signal text-xs font-bold uppercase tracking-[0.24em] mb-2">
              2026 Manitoba Anglers&apos; Guide
            </p>
            <h2 className="font-display font-bold uppercase text-2xl md:text-3xl text-pine tracking-wide mb-1">
              Fishing regulations
            </h2>
            <p className="text-pine/60 text-sm mb-6">
              {regs.division}
              {regs.division_approximate && " (best match — confirm in the guide)"}
            </p>

            {regs.division_approximate && (
              <div className="bg-gold/10 border border-gold/40 rounded-2xl p-4 mb-6 text-sm text-pine/80">
                <span className="font-bold">Heads up:</span> this lake&apos;s
                division is our best match, not an official assignment. Double
                check it against the current Anglers&apos; Guide before you fish.
              </div>
            )}

            {regs.special && (
              <div className="bg-signal/10 border border-signal/40 rounded-2xl p-4 mb-6">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-signal mb-1.5">
                  Special rules for this waterbody
                </p>
                <p className="text-sm text-pine/85 leading-relaxed">{regs.special}</p>
              </div>
            )}

            {regs.note && (
              <p className="text-sm text-pine/65 italic mb-6">{regs.note}</p>
            )}

            {zone ? (
              <>
                {matchedLimits.length === 0 && (
                  <p className="text-sm text-pine/60 mb-4">
                    None of this lake&apos;s species have their own row below, so
                    here are the division&apos;s general limits instead.
                  </p>
                )}
                {/* Desktop: full table */}
                <div className="overflow-x-auto -mx-2 px-2 hidden md:block">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-pine/45 border-b-2 border-pine/15">
                        <th className="py-2.5 pr-4 font-bold">Species</th>
                        <th className="py-2.5 pr-4 font-bold">Possession limit</th>
                        <th className="py-2.5 pr-4 font-bold">Size restriction</th>
                        <th className="py-2.5 font-bold">Season</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shownLimits.map((lim, i) => (
                        <tr key={i} className="border-b border-pine/8 align-top">
                          <td className="py-3 pr-4 font-bold text-pine">{lim.species}</td>
                          <td className="py-3 pr-4 text-pine/75">{lim.limit}</td>
                          <td className="py-3 pr-4 text-pine/75">{lim.size}</td>
                          <td className="py-3 text-pine/75 text-[13px] leading-relaxed">
                            {lim.season}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile: stacked cards, no sideways scrolling */}
                <div className="md:hidden space-y-3">
                  {shownLimits.map((lim, i) => (
                    <div key={i} className="bg-paper-deep rounded-2xl p-4 border border-pine/10">
                      <p className="font-display font-bold uppercase text-pine tracking-wide mb-2">{lim.species}</p>
                      <dl className="text-sm space-y-1.5">
                        <div className="flex justify-between gap-3">
                          <dt className="text-pine/50 text-xs uppercase tracking-wider font-bold">Limit</dt>
                          <dd className="text-pine font-bold text-right">{lim.limit}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-pine/50 text-xs uppercase tracking-wider font-bold">Size</dt>
                          <dd className="text-pine/75 text-right">{lim.size}</dd>
                        </div>
                        <div>
                          <dt className="text-pine/50 text-xs uppercase tracking-wider font-bold mb-0.5">Season</dt>
                          <dd className="text-pine/75 text-[13px] leading-relaxed">{lim.season}</dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-pine/60">
                Division limits table not available for this lake — check the{" "}
                <a href={getGuideUrl()} className="text-signal font-bold" target="_blank" rel="noreferrer">
                  official Anglers&apos; Guide
                </a>
                .
              </p>
            )}

            <p className="text-xs text-pine/40 mt-6">
              Source: {regs.source || "2026 Manitoba Anglers' Guide"}. Summaries
              only —{" "}
              <a href={getGuideUrl()} className="text-signal font-bold" target="_blank" rel="noreferrer">
                confirm in the official guide
              </a>
              .
            </p>
          </section>

          {/* Stocking */}
          {lake.stocked && lake.stocked_species.length > 0 && (
            <section>
              <h2 className="font-display font-bold uppercase text-2xl text-pine tracking-wide mb-3">
                Stocking history
              </h2>
              <div className="flex flex-wrap gap-2 mb-5">
                {lake.stocked_species.map((s) => (
                  <Chip key={s}>{s}</Chip>
                ))}
              </div>
              <StockingTable lakeId={lake.id} />
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {towns.length > 0 && (
            <div className="bg-white rounded-3xl border border-pine/10 p-6">
              <h3 className="font-display font-bold uppercase text-lg text-pine tracking-wide mb-3">
                Nearby towns
              </h3>
              <div className="flex flex-wrap gap-2">
                {towns.map((t) => (
                  <Chip key={t}>{t}</Chip>
                ))}
              </div>
            </div>
          )}
          {lake.lodging.length > 0 && (
            <div className="bg-white rounded-3xl border border-pine/10 p-6">
              <h3 className="font-display font-bold uppercase text-lg text-pine tracking-wide mb-3">
                Where to stay
              </h3>
              <ul className="space-y-2.5 text-sm">
                {lake.lodging.map((l, i) => (
                  <li key={i}>
                    {l.detail ? (
                      <a href={l.detail} target="_blank" rel="noreferrer" className="text-signal font-bold hover:underline">
                        {l.name} →
                      </a>
                    ) : (
                      <span className="text-pine/80">{l.name}</span>
                    )}
                  </li>
                ))}
              </ul>
              <Link href="/fishmb/lodges" className="inline-block mt-4 text-xs font-bold text-signal uppercase tracking-wider">
                All lodges &amp; guides →
              </Link>
            </div>
          )}
          {lake.boat_rentals.length > 0 && (
            <div className="bg-white rounded-3xl border border-pine/10 p-6">
              <h3 className="font-display font-bold uppercase text-lg text-pine tracking-wide mb-3">
                Boat rentals
              </h3>
              <ul className="space-y-2.5 text-sm text-pine/80">
                {lake.boat_rentals.map((b, i) => (
                  <li key={i}>{b.name}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="bg-pine rounded-3xl p-6 text-white">
            <h3 className="font-display font-bold uppercase text-lg tracking-wide mb-2">
              Fished here lately?
            </h3>
            <p className="text-white/70 text-sm mb-4">
              Share your report with Manitoba anglers in the community feed.
            </p>
            <Link
              href="/fishmb/feed"
              className="inline-block bg-signal hover:bg-signal-dark text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full transition-colors"
            >
              Join the feed
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
