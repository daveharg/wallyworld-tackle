import { NextResponse } from "next/server";
import { searchAll } from "@/lib/fishmb";

/** Lightweight lake+lodge search for the FishMB site hero. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
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
    })),
    lodges: lodges.map((l) => ({
      id: l.id,
      name: l.name,
      kind: l.kind,
      location: l.location,
    })),
  });
}
