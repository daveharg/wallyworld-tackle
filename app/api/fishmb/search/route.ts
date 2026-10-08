import { NextResponse } from "next/server";
import { searchAll, getLake } from "@/lib/fishmb";
import coordsJson from "@/public/fishmb/lake-coords.json";

const COORDS = coordsJson as Record<string, { lat: number; lng: number }>;

/** Lightweight lake+lodge search for the FishMB site hero. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  // ?ids=a,b,c — resolve stored lake ids to id/name/region (used by the
  // tournament edit form's lake picker to show names for selected lakes).
  const idsParam = searchParams.get("ids");
  if (idsParam) {
    const lakes = idsParam
      .split(",")
      .map((id) => getLake(id.trim()))
      .filter((l): l is NonNullable<typeof l> => !!l)
      .map((l) => ({ id: l.id, name: l.name, region: l.region }));
    return NextResponse.json({ lakes });
  }
  const q = searchParams.get("q") ?? "";
  const { lakes, lodges } = searchAll(q, 6);
  return NextResponse.json({
    lakes: lakes.map((l) => ({
      id: l.id,
      name: l.name,
      region: l.region,
      species: l.species.slice(0, 4),
      stocked: l.stocked,
      photo: l.photo,
      lat: COORDS[l.id]?.lat ?? null,
      lng: COORDS[l.id]?.lng ?? null,
    })),
    lodges: lodges.map((l) => ({
      id: l.id,
      name: l.name,
      kind: l.kind,
      location: l.location,
    })),
  });
}
