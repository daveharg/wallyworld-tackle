import Link from "next/link";
import type { ReactNode } from "react";

/** Shared shell for FishMB legal pages (Terms, Privacy). */
export function LegalDoc({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: { heading: string; body: ReactNode }[];
}) {
  return (
    <div className="max-w-3xl mx-auto px-4 pt-6 md:pt-10 pb-32">
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-signal-dark mb-2">
        FishMB
      </p>
      <h1 className="text-3xl font-black text-pine tracking-tight mb-2">{title}</h1>
      <p className="text-xs text-pine/50 mb-6">Last updated: {updated}</p>
      <p className="text-pine/80 leading-relaxed mb-8">{intro}</p>
      <div className="space-y-8">
        {sections.map((s, i) => (
          <section key={i}>
            <h2 className="text-lg font-black text-pine mb-2">
              {i + 1}. {s.heading}
            </h2>
            <div className="text-pine/80 text-sm leading-relaxed space-y-3">{s.body}</div>
          </section>
        ))}
      </div>
      <p className="text-sm text-pine/60 mt-10">
        Questions about this document?{" "}
        <Link href="/fishmb/contact" className="font-bold text-signal-dark hover:underline">
          Contact us
        </Link>
        .
      </p>
    </div>
  );
}
