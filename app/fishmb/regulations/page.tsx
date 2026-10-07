import type { Metadata } from "next";
import Link from "next/link";
import { getZones, getGuideUrl, getLakes } from "@/lib/fishmb";
import { LakeSearch } from "./_components/LakeSearch";

export const metadata: Metadata = {
  title: "Manitoba fishing regulations 2026",
  description:
    "2026 Manitoba Anglers' Guide regulations by division — possession limits, size restrictions, seasons — plus waterbody-specific rules for 271 lakes.",
};

export const revalidate = 3600;

export default function RegulationsPage() {
  const zones = getZones();
  const guideUrl = getGuideUrl();
  const specialCount = getLakes().filter((l) =>
    (l.regulations?.special ?? "").trim().length > 0
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 md:py-14">
      <p className="text-signal text-xs font-bold uppercase tracking-[0.24em] mb-2">
        2026 Manitoba Anglers&apos; Guide
      </p>
      <h1 className="font-display font-bold uppercase text-4xl md:text-5xl text-pine tracking-wide mb-3">
        Fishing regulations
      </h1>
      <p className="text-pine/65 max-w-2xl mb-4">
        Possession limits, size restrictions and seasons for every Manitoba
        division. {specialCount} lakes also carry waterbody-specific rules —
        those are flagged on each{" "}
        <Link href="/fishmb/lakes" className="text-signal font-bold">
          lake page
        </Link>
        .
      </p>
      <a
        href={guideUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 bg-pine text-white text-sm font-bold uppercase tracking-wider px-6 py-3 rounded-full hover:bg-pine-deep transition-colors mb-8"
      >
        Official Anglers&apos; Guide (PDF)
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M8 7h9v9" /></svg>
      </a>

      <LakeSearch />

      <div className="space-y-10">
        {zones.map((z) => (
          <section
            key={z.id}
            id={z.id}
            className="bg-white rounded-3xl border border-pine/10 p-6 md:p-8 scroll-mt-24"
          >
            <h2 className="font-display font-bold uppercase text-2xl md:text-3xl text-pine tracking-wide mb-2">
              {z.name}
            </h2>
            <p className="text-sm text-pine/60 mb-6 max-w-3xl">{z.description}</p>
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-sm min-w-[620px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-pine/45 border-b-2 border-pine/15">
                    <th className="py-2.5 pr-4 font-bold">Species</th>
                    <th className="py-2.5 pr-4 font-bold">Possession limit</th>
                    <th className="py-2.5 pr-4 font-bold">Size restriction</th>
                    <th className="py-2.5 font-bold">Season</th>
                  </tr>
                </thead>
                <tbody>
                  {z.limits.map((lim, i) => (
                    <tr key={i} className="border-b border-pine/8 align-top">
                      <td className="py-3 pr-4 font-bold text-pine">{lim.species}</td>
                      <td className="py-3 pr-4 text-pine/75 whitespace-nowrap">{lim.limit}</td>
                      <td className="py-3 pr-4 text-pine/75">{lim.size}</td>
                      <td className="py-3 text-pine/75 text-[13px] leading-relaxed">
                        {lim.season}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <div className="bg-gold/10 border border-gold/40 rounded-3xl p-6 md:p-8 mt-10">
        <h2 className="font-display font-bold uppercase text-xl text-pine tracking-wide mb-2">
          Before you fish
        </h2>
        <p className="text-sm text-pine/75 leading-relaxed max-w-3xl">
          These tables summarize the 2026 Manitoba Anglers&apos; Guide. Limits,
          seasons and waterbody-specific rules can change — always confirm
          against the{" "}
          <a href={guideUrl} target="_blank" rel="noreferrer" className="text-signal font-bold">
            official guide
          </a>{" "}
          and carry a valid Manitoba angling licence unless exempt.
        </p>
      </div>
    </div>
  );
}
