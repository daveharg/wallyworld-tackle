import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLodge, getLodges } from "@/lib/fishmb";
import { lodgePhotoUrl } from "@/lib/fishmb-constants";

export const revalidate = 3600;

export async function generateStaticParams() {
  return getLodges().map((l) => ({ id: l.id }));
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const lodge = getLodge(params.id);
  if (!lodge) return { title: "Lodge not found" };
  return {
    title: `${lodge.name} — Manitoba fishing lodge`,
    description: `${lodge.name} (${lodge.location}): species, waters, packages and contact info.`,
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-3xl border border-pine/10 p-6 md:p-7">
      <h2 className="font-display font-bold uppercase text-xl text-pine tracking-wide mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function LodgeDetailPage({ params }: { params: { id: string } }) {
  const lodge = getLodge(params.id);
  if (!lodge) notFound();
  const photo = lodgePhotoUrl(lodge.id);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
      <Link
        href="/fishmb/lodges"
        className="text-sm font-bold text-signal uppercase tracking-wider"
      >
        ← All lodges &amp; guides
      </Link>

      {photo && (
        <div className="relative mt-4 rounded-3xl overflow-hidden bg-pine-deep">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt={lodge.name} className="w-full h-64 md:h-96 object-cover" />
        </div>
      )}

      <div className="mt-4 mb-8">
        <p className="text-gold font-bold uppercase tracking-[0.24em] text-xs mb-2 capitalize">
          {lodge.kind}
          {lodge.established ? ` · Est. ${lodge.established}` : ""}
        </p>
        <h1 className="font-display font-bold uppercase text-4xl md:text-5xl text-pine tracking-wide">
          {lodge.name}
        </h1>
        {lodge.location && (
          <p className="text-pine/60 mt-2 text-lg">{lodge.location}</p>
        )}
        {lodge.access && (
          <p className="mt-3">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider rounded-full px-4 py-1.5 ${
                lodge.access.includes("fly-in")
                  ? "bg-sky-100 text-sky-800"
                  : "bg-pine/10 text-pine/70"
              }`}
            >
              {lodge.access.includes("fly-in") ? "✈️" : "🚗"} {lodge.access} lodge
            </span>
          </p>
        )}
        {lodge.species.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {lodge.species.map((s) => (
              <span
                key={s}
                className="text-xs font-bold bg-paper-deep text-pine/70 rounded-full px-3 py-1.5"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-6">
        {lodge.description && (
          <Section title="About">
            <p className="text-pine/75 leading-relaxed">{lodge.description}</p>
          </Section>
        )}

        {(lodge.website || lodge.phone || lodge.email || lodge.address) && (
          <Section title="Book direct">
            <ul className="space-y-2.5 text-[15px]">
              {lodge.website && (
                <li>
                  <a
                    href={lodge.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-signal font-bold hover:underline break-all"
                  >
                    {lodge.website.replace(/^https?:\/\//, "")} →
                  </a>
                </li>
              )}
              {lodge.phone && (
                <li>
                  <a href={`tel:${lodge.phone.replace(/[^+\d]/g, "")}`} className="text-pine font-bold hover:text-signal">
                    {lodge.phone}
                  </a>
                </li>
              )}
              {lodge.email && (
                <li>
                  <a href={`mailto:${lodge.email}`} className="text-pine/75 hover:text-signal break-all">
                    {lodge.email}
                  </a>
                </li>
              )}
              {lodge.address && <li className="text-pine/60">{lodge.address}</li>}
            </ul>
          </Section>
        )}

        {lodge.fishing_waters.length > 0 && (
          <Section title="Waters fished">
            <div className="flex flex-wrap gap-2">
              {lodge.fishing_waters.map((w) => (
                <span
                  key={w}
                  className="text-sm bg-pine/8 border border-pine/15 text-pine rounded-full px-3.5 py-1.5"
                >
                  {w}
                </span>
              ))}
            </div>
          </Section>
        )}

        {lodge.packages.length > 0 && (
          <Section title="Packages">
            <ul className="space-y-4">
              {lodge.packages.map((p, i) => (
                <li key={i} className="border-b border-pine/10 pb-4 last:border-0 last:pb-0">
                  <p className="font-bold text-pine">{p.name}</p>
                  {p.detail && <p className="text-sm text-pine/65 mt-1">{p.detail}</p>}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {lodge.rates_note && (
          <Section title="Rates">
            <p className="text-pine/75 leading-relaxed">{lodge.rates_note}</p>
          </Section>
        )}

        {lodge.amenities.length > 0 && (
          <Section title="Amenities">
            <div className="flex flex-wrap gap-2">
              {lodge.amenities.map((a) => (
                <span
                  key={a}
                  className="text-xs font-bold bg-paper-deep text-pine/70 rounded-full px-3 py-1.5"
                >
                  {a}
                </span>
              ))}
            </div>
          </Section>
        )}

        {(lodge.ice_fishing || lodge.ice_fishing_details) && (
          <Section title="Ice fishing">
            <p className="text-pine/75 leading-relaxed">
              {lodge.ice_fishing_details || "Ice fishing available — contact the lodge for details."}
            </p>
          </Section>
        )}
      </div>

      <p className="text-xs text-pine/40 mt-8">
        Details verified from public sources. Confirm rates and availability
        directly with the operator before booking.
      </p>
    </div>
  );
}
