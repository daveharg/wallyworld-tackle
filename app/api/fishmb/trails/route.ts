// /api/fishmb/trails — the signed-in user's recorded boat trails (private).
// GET lists them; POST saves one.

import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
} from "@/lib/fish/auth";
import { listTrails, createTrail } from "@/lib/fish/trails";

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const trails = await listTrails(me.id);
  return NextResponse.json({ trails });
}

export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  try {
    const trail = await createTrail(me.id, {
      name: typeof body.name === "string" ? body.name : "",
      points: body.points,
      distance_m: body.distance_m,
    });
    return NextResponse.json({ trail }, { status: 201 });
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Could not save trail.");
  }
}
