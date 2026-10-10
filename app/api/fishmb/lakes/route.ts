// /api/fishmb/lakes — lightweight lake list for the tournament builder.
import { NextResponse } from "next/server";
import { getLakes } from "@/lib/fishmb";

export async function GET() {
  const lakes = getLakes().map((l) => ({
    id: l.id,
    name: l.name,
    region: l.region,
  }));
  return NextResponse.json({ lakes });
}
