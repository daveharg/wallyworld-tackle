"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fishFetch } from "../../_components/fishFetch";

interface SharedCatch {
  id: string;
  species: string;
  length_in: number | null;
  weight_lb: number | null;
  caught_at: string | null;
  photo_url: string | null;
  user_name: string | null;
  mine?: boolean;
}

/** Shared catches from users on this lake — top 3 biggest by default, view all. */
export function SharedCatchesList({ lakeId, lakeName }: { lakeId: string; lakeName: string }) {
  const [catches, setCatches] = useState<SharedCatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const dir = await fetch("/fish-manitoba/data.json").then((r) => r.json());
        const lake = ((dir.lakes ?? []) as { id: string; lat?: number; lng?: number }[]).find(
          (l) => l.id === lakeId
        );
        if (!lake || lake.lat == null || lake.lng == null) {
          setLoading(false);
          return;
        }
        const c = await fishFetch(
          `/api/fishmb/map-catches?lat=${lake.lat}&lng=${lake.lng}&radius_km=15`
        );
        const list = ((c.catches ?? []) as SharedCatch[]).filter((x) => !x.mine);
        // Sort by biggest first (length, then weight).
        list.sort((a, b) => {
          const la = a.length_in ?? 0;
          const lb = b.length_in ?? 0;
          if (lb !== la) return lb - la;
          return (b.weight_lb ?? 0) - (a.weight_lb ?? 0);
        });
        setCatches(list);
      } catch {
        // Show empty state.
      } finally {
        setLoading(false);
      }
    })();
  }, [lakeId]);

  if (loading) return null;
  if (catches.length === 0) return null;

  const visible = showAll ? catches : catches.slice(0, 3);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h2 className="font-display font-bold uppercase text-2xl text-pine tracking-wide">
          Shared catches <span className="text-pine/40 text-lg">({catches.length})</span>
        </h2>
      </div>
      <p className="text-sm text-pine/55 mb-3">
        Public catches shared by FishMB anglers on {lakeName} — biggest first.
      </p>
      <div className="rounded-2xl border border-pine/10 bg-white divide-y divide-pine/8 overflow-hidden">
        {visible.map((c) => (
          <Link key={c.id} href={`/fishmb/feed?catch=${c.id}`} className="px-4 py-3 flex items-center gap-3 hover:bg-pine/5">
            {c.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.photo_url} alt={c.species} className="w-12 h-12 rounded-xl object-cover shrink-0" />
            ) : (
              <span className="w-12 h-12 rounded-xl bg-pine/10 flex items-center justify-center text-xl shrink-0"></span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-pine truncate">{c.species}</p>
              <p className="text-xs text-pine/60 truncate">
                {c.user_name ?? "Angler"}
                {c.caught_at && ` · ${new Date(c.caught_at).toLocaleDateString()}`}
              </p>
            </div>
            <p className="text-sm font-bold text-pine whitespace-nowrap">
              {c.length_in ? `${c.length_in}″` : c.weight_lb ? `${c.weight_lb} lb` : ""}
            </p>
          </Link>
        ))}
      </div>
      {catches.length > 3 && (
        <button
          onClick={() => setShowAll((s) => !s)}
          className="mt-3 w-full py-3 rounded-full bg-pine/5 hover:bg-pine/10 text-pine font-bold text-sm uppercase tracking-wider transition-colors"
        >
          {showAll ? "Show less" : `View all ${catches.length} shared catches`}
        </button>
      )}
    </section>
  );
}
