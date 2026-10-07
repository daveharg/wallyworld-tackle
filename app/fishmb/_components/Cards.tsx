import Link from "next/link";
import type { Lodge, HotLake } from "@/lib/fishmb";
import { lakePhotoUrl } from "@/lib/fishmb-constants";

function SpeciesLine({ species }: { species: string[] }) {
  return (
    <p className="text-xs text-pine/55 truncate">
      {species.slice(0, 4).join(" · ")}
    </p>
  );
}

export interface LakeCardLake {
  id: string;
  name: string;
  region: string;
  species: string[];
  stocked: boolean;
  photo: string | null;
  regulations?: { division: string };
}

export function LakeCard({
  lake,
  className = "snap-start shrink-0 w-[240px] md:w-[280px]",
}: {
  lake: LakeCardLake;
  className?: string;
}) {
  return (
    <Link
      href={`/fishmb/lakes/${lake.id}`}
      className={`${className} bg-white rounded-2xl overflow-hidden border border-pine/10 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all block`}
    >
      <div className="relative h-36 md:h-44 bg-pine-deep/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={lakePhotoUrl(lake.id)} alt={lake.name} className="w-full h-full object-cover" loading="lazy" />
        {lake.stocked && (
          <span className="absolute top-2.5 left-2.5 text-[10px] font-black uppercase tracking-wider text-white bg-[#5E8F3E] rounded-md px-2 py-1">
            Stocked
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-signal mb-1">
          {lake.region}
        </p>
        <h3 className="font-display font-bold text-lg text-pine leading-tight mb-1 truncate">
          {lake.name}
        </h3>
        <SpeciesLine species={lake.species} />
        <p className="text-xs text-pine/45 mt-2">
          {lake.regulations?.division?.replace(" Division", "") ?? ""} regs
        </p>
      </div>
    </Link>
  );
}

export function LodgeCard({ lodge }: { lodge: Lodge }) {
  return (
    <Link
      href={`/fishmb/lodges/${lodge.id}`}
      className="snap-start shrink-0 w-[240px] md:w-[280px] bg-white rounded-2xl overflow-hidden border border-pine/10 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all"
    >
      <div className="p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold mb-1.5 capitalize">
          {lodge.kind}
        </p>
        <h3 className="font-display font-bold text-lg text-pine leading-tight mb-2">
          {lodge.name}
        </h3>
        <p className="text-xs text-pine/55 mb-3">{lodge.location}</p>
        <SpeciesLine species={lodge.species} />
        {lodge.ice_fishing && (
          <p className="text-[11px] font-bold uppercase tracking-wider text-pine/60 mt-3">
            ❄ Ice fishing available
          </p>
        )}
      </div>
    </Link>
  );
}

export function HotLakeCard({
  hot,
  className = "snap-start shrink-0 w-[300px] md:w-[360px]",
}: {
  hot: HotLake;
  className?: string;
}) {
  return (
    <div className={`${className} bg-pine-deep text-white rounded-2xl p-5 md:p-6 flex flex-col shadow-sm`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-signal" />
        </span>
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-gold">
          Biting now
        </p>
      </div>
      <h3 className="font-display font-bold text-xl leading-tight mb-1">
        {hot.lake}
      </h3>
      <p className="text-signal text-sm font-bold mb-3">{hot.species}</p>
      <p className="text-white/70 text-sm leading-relaxed line-clamp-4 flex-1">
        {hot.report}
      </p>
      <p className="text-white/35 text-xs mt-4">Reported {hot.date}</p>
    </div>
  );
}
