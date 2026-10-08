// /api/fishmb/tournaments/[id]/keys — single-use entry keys (organizer only).
// GET: list keys with status + who used them.
// POST: { count: 1–200 } → generates that many unused keys.

import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
  notFound,
} from "@/lib/fish/auth";
import {
  getTournament,
  generateTournamentKeys,
  listTournamentKeys,
} from "@/lib/fish/tournaments";

async function organizerOr(
  req: NextRequest,
  id: string
): Promise<{ t: Awaited<ReturnType<typeof getTournament>> } | NextResponse> {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const t = await getTournament(id);
  if (!t) return notFound("Tournament not found.");
  if (t.organizer_id !== me.id) {
    return NextResponse.json(
      { error: "Only the organizer can manage entry keys." },
      { status: 403 }
    );
  }
  return { t };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const res = await organizerOr(req, params.id);
  if (res instanceof NextResponse) return res;
  const keys = await listTournamentKeys(params.id);
  return NextResponse.json({ keys });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const res = await organizerOr(req, params.id);
  if (res instanceof NextResponse) return res;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const count =
    typeof body.count === "number" ? Math.floor(body.count) : 0;
  if (count < 1 || count > 200) {
    return badRequest("Count must be between 1 and 200.");
  }
  const keys = await generateTournamentKeys(params.id, count);
  return NextResponse.json({ keys }, { status: 201 });
}
