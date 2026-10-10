// Lake catches page — your catches on one lake, newest first.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fishFetch } from "../../../../_components/fishFetch";

interface LakeCatch {
  id: string;
  species: string;
  length_in: number | null;
  weight_lb: number | null;
  caught_at: string | null;
  photo_url: string | null;
  notes: string | null;
}

export default function LakeCatchesPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [lakeName, setLakeName] = useState("");
  const [catches, setCatches] = useState<LakeCatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Find the lake's coordinates from the lake directory.
        const dir = await fetch("/fish-manitoba/data.json").then((r) => r.json());
        const lake = ((dir.lakes ?? []) as { id: string; name: string; lat?: number; lng?: number }[]).find(
          (l) => l.id === params.id
        );
        if (!lake || lake.lat == null || lake.lng == null) {
          setLoading(false);
          return;
        }
        setLakeName(lake.name);
        const c = await fishFetch(
          `/api/fishmb/map-catches?lat=${lake.lat}&lng=${lake.lng}&radius_km=15&mine=1`
        );
        const list = ((c.catches ?? []) as LakeCatch[]).sort((a, b) => {
          const ta = a.caught_at ? new Date(a.caught_at).getTime() : 0;
          const tb = b.caught_at ? new Date(b.caught_at).getTime() : 0;
          return tb - ta;
        });
        setCatches(list);
      } catch {
        // Show empty state.
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-pine/60 hover:text-pine font-bold text-sm mb-6 transition-colors"
      >
        <span className="text-lg leading-none">‹</span> Back
      </button>
      <h1 className="font-display font-bold uppercase text-pine text-3xl md:text-4xl tracking-wide mb-1">
        {lakeName || "Lake catches"}
      </h1>
      <p className="text-pine/55 text-sm mb-8">Your catches on this lake — newest first.</p>

      {loading ? (
        <div className="h-32 bg-pine/10 rounded-3xl animate-pulse" />
      ) : catches.length === 0 ? (
        <div className="bg-white border border-pine/10 rounded-3xl p-10 text-center">
          <p className="text-pine/60 font-bold">No catches here yet</p>
          <p className="text-pine/50 text-sm mt-1">Log one from the map and it&apos;ll show up here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {catches.map((c) => (
            <div key={c.id} className="bg-white border border-pine/10 rounded-2xl p-4 flex gap-4">
              {c.photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.photo_url} alt={c.species} className="w-20 h-20 rounded-xl object-cover shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-pine">
                  {c.species}
                  {c.length_in ? ` · ${Number(c.length_in).toFixed(1)}"` : ""}
                  {c.weight_lb ? ` · ${Number(c.weight_lb).toFixed(1)} lb` : ""}
                </p>
                {c.caught_at && (
                  <p className="text-xs text-pine/50 mt-0.5">
                    {new Date(c.caught_at).toLocaleDateString("en-CA", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                )}
                {c.notes && <p className="text-sm text-pine/70 mt-1 line-clamp-2">{c.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
