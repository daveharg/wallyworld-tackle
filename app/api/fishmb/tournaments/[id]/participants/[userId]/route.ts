// /api/fishmb/tournaments/[id]/participants/[userId] — organizer marks a
// participant's entry fee paid/unpaid. Money itself stays manual/off-platform;
// this only records what the organizer confirms.
import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
} from "@/lib/fish/auth";
import {
  getTournament,
  setParticipantPaid,
} from "@/lib/fish/tournaments";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const { id, userId } = await params;
  const t = await getTournament(id);
  if (!t) return notFound("Tournament not found.");
  if (t.organizer_id !== me.id) return forbidden("Only the organizer can do this.");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  if (typeof body.paid !== "boolean") return badRequest("paid must be true or false.");
  const p = await setParticipantPaid(id, userId, body.paid, me.id);
  if (!p) return notFound("Participant not found.");
  return NextResponse.json({ participant: p });
}
