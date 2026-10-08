// POST /api/fishmb/tournaments/[id]/redeem — redeem a single-use entry key
// (auth required). Marks the key used and adds the angler as a participant.
// If the angler already joined, the key is NOT consumed.

import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
  notFound,
} from "@/lib/fish/auth";
import { getTournament, redeemTournamentKey } from "@/lib/fish/tournaments";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const t = await getTournament(params.id);
  if (!t) return notFound("Tournament not found.");

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const key = typeof body.key === "string" ? body.key : "";
  const result = await redeemTournamentKey(params.id, key, me.id);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ joined: true, tournament_id: result.tournament_id });
}
