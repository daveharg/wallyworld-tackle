import Link from "next/link";
import { searchAll } from "@/lib/fishmb";

export const dynamic = "force-dynamic";

export default function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? "").trim();
  const { lakes, lodges } = q.length >= 2 ? searchAll(q, 50) : { lakes: [], lodges: [] };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 md:py-14">
      <Link href="/fishmb" className="text-sm font-bold text-signal uppercase tracking-wider">
        ← FishMB home
      </Link>
      <h1 className="font-display font-bold uppercase text-pine text-4xl md:text-5xl tracking-wide mt-4 mb-2">
        Search results
      </h1>
      <p className="text-pine/60 mb-8">
        {q ? (
          <>
            {lakes.length + lodges.length} result{lakes.length + lodges.length === 1 ? "" : "s"} for{" "}
            <strong className="text-pine">“{q}”</strong>
          </>
        ) : (
          "Type a lake or lodge name in the search bar to get started."
        )}
      </p>

      {q.length >= 2 && lakes.length === 0 && lodges.length === 0 && (
        <p className="text-pine/60 bg-white border border-pine/10 rounded-2xl p-6">
          Nothing found for “{q}”. Try a lake name, a town, or a lodge.
        </p>
      )}

      {lakes.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-pine/50 mb-3">
            Lakes ({lakes.length})
          </h2>
          <ul className="grid sm:grid-cols-2 gap-3">
            {lakes.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/fishmb/lakes/${l.id}`}
                  className="block bg-white border border-pine/10 rounded-2xl px-5 py-4 hover:shadow-md transition-shadow"
                >
                  <p className="font-bold text-pine">{l.name}</p>
                  <p className="text-pine/55 text-sm mt-0.5">
                    {l.region}
                    {l.species.length > 0 && ` · ${l.species.slice(0, 4).join(", ")}`}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lodges.length > 0 && (
        <section>
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-pine/50 mb-3">
            Lodges & guides ({lodges.length})
          </h2>
          <ul className="grid sm:grid-cols-2 gap-3">
            {lodges.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/fishmb/lodges/${l.id}`}
                  className="block bg-white border border-pine/10 rounded-2xl px-5 py-4 hover:shadow-md transition-shadow"
                >
                  <p className="font-bold text-pine">{l.name}</p>
                  <p className="text-pine/55 text-sm mt-0.5">
                    {l.kind}
                    {l.location && ` · ${l.location}`}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
