// /api/fishmb/tournaments/[id]/participants — organizer-only participant list
// with entry-fee payment status.
import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  forbidden,
  notFound,
} from "@/lib/fish/auth";
import {
  getTournament,
  listParticipants,
} from "@/lib/fish/tournaments";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const { id } = await params;
  const t = await getTournament(id);
  if (!t) return notFound("Tournament not found.");
  if (t.organizer_id !== me.id) return forbidden("Only the organizer can see this.");
  const participants = await listParticipants(id);
  return NextResponse.json({
    participants,
    entry_fee_cents: t.entry_fee_cents ?? 0,
  });
}
