// POST /api/fishmb/tournaments/[id]/join — join a tournament (auth required).

import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
  notFound,
} from "@/lib/fish/auth";
import { getTournament, isParticipant } from "@/lib/fish/tournaments";
import { query } from "@/lib/fish/db";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const t = await getTournament(params.id);
  if (!t) return notFound("Tournament not found.");
  if (await isParticipant(t.id, me.id)) {
    return NextResponse.json({ joined: true });
  }
  if (t.max_participants !== null && t.participant_count >= t.max_participants) {
    return badRequest("This tournament is full.");
  }
  await query(
    `INSERT INTO fm_tournament_participants (tournament_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [t.id, me.id]
  );
  return NextResponse.json({ joined: true });
}
