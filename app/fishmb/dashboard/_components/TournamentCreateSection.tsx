// Inline tournament builder section for the HQ dashboard.
// Fetches the lake list client-side, then renders the TournamentBuilder.

"use client";

import { useEffect, useState } from "react";
import { TournamentBuilder } from "../../tournaments/_components/TournamentBuilder";
import { fishFetch } from "../../_components/fishFetch";

interface LakeOpt {
  id: string;
  name: string;
  region: string;
}

export default function TournamentCreateSection({ onDone }: { onDone?: () => void }) {
  const [lakes, setLakes] = useState<LakeOpt[] | null>(null);

  useEffect(() => {
    let live = true;
    fishFetch("/api/fishmb/lakes")
      .then((d) => {
        if (live) setLakes((d.lakes ?? []) as LakeOpt[]);
      })
      .catch(() => {
        if (live) setLakes([]);
      });
    return () => {
      live = false;
    };
  }, []);

  if (!lakes) {
    return (
      <div className="space-y-3">
        <div className="h-8 bg-pine/10 rounded-full w-48 animate-pulse" />
        <div className="h-32 bg-pine/10 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return <TournamentBuilder lakes={lakes} />;
}
