// /api/fishmb/tournaments/[id]/participants/[userId] — organizer manages a
// participant: marks entry fee paid/unpaid, checks in, saves a private note,
// or removes them. Money itself stays manual/off-platform; this only records
// what the organizer confirms.
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
  setParticipantCheckedIn,
  setParticipantNote,
  removeParticipant,
} from "@/lib/fish/tournaments";

async function organizerCheck(req: NextRequest, id: string) {
  const me = await fishUserFromRequest(req);
  if (!me) return { error: unauthorized() };
  const t = await getTournament(id);
  if (!t) return { error: notFound("Tournament not found.") };
  if (t.organizer_id !== me.id)
    return { error: forbidden("Only the organizer can do this.") };
  return { me, t };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { id, userId } = await params;
  const check = await organizerCheck(req, id);
  if (check.error) return check.error;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  if (typeof body.paid === "boolean") {
    const p = await setParticipantPaid(id, userId, body.paid, check.me!.id);
    if (!p) return notFound("Participant not found.");
    return NextResponse.json({ participant: p });
  }
  if (typeof body.checked_in === "boolean") {
    const ok = await setParticipantCheckedIn(id, userId, body.checked_in);
    if (!ok) return notFound("Participant not found.");
    return NextResponse.json({ ok: true });
  }
  if (typeof body.organizer_note === "string") {
    const ok = await setParticipantNote(id, userId, body.organizer_note);
    if (!ok) return notFound("Participant not found.");
    return NextResponse.json({ ok: true });
  }
  return badRequest("Nothing to update.");
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { id, userId } = await params;
  const check = await organizerCheck(req, id);
  if (check.error) return check.error;
  const ok = await removeParticipant(id, userId);
  if (!ok) return notFound("Participant not found.");
  return NextResponse.json({ ok: true });
}
