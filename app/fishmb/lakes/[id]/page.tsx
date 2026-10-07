import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLake, getLakes, getZone, getGuideUrl } from "@/lib/fishmb";

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

export default function LakeDetailPage({ params }: { params: { id: string } }) {
  const lake = getLake(params.id);
  if (!lake) notFound();

  const zone = getZone(lake.limits_zone);
  const regs = lake.regulations;
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

      {/* Hero */}
      <div className="relative mt-4 rounded-3xl overflow-hidden bg-pine-deep">
        {lake.photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lake.photo}
            alt={lake.name}
            className="w-full h-64 md:h-96 object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-pine-deep/85 via-pine-deep/20 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 p-6 md:p-8">
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
            {lake.species.map((s) => (
              <span
                key={s}
                className="text-[11px] font-bold uppercase tracking-wider text-white/90 bg-white/15 rounded-md px-2.5 py-1"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

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

          {/* Regulations */}
          <section className="bg-white rounded-3xl border border-pine/10 p-6 md:p-8">
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
              <div className="overflow-x-auto -mx-2 px-2">
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
                    {zone.limits.map((lim, i) => (
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
              <div className="flex flex-wrap gap-2">
                {lake.stocked_species.map((s) => (
                  <Chip key={s}>{s}</Chip>
                ))}
              </div>
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
              Log it in the app
            </h3>
            <p className="text-white/70 text-sm mb-4">
              Catch something here? Log it in FishMB with a photo and it counts
              toward your stats.
            </p>
            <Link
              href="/fish-manitoba-preview/"
              className="inline-block bg-signal hover:bg-signal-dark text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full transition-colors"
            >
              Open the app
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
