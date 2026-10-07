// PATCH /api/fishmb/tournaments/[id]/entries/[entryId] — organizer review.
// Body: { status: "approved" | "rejected", review_note?: string }

import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
  notFound,
} from "@/lib/fish/auth";
import { getTournament } from "@/lib/fish/tournaments";
import { queryOne } from "@/lib/fish/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; entryId: string } }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const t = await getTournament(params.id);
  if (!t) return notFound("Tournament not found.");
  if (t.organizer_id !== me.id) {
    return NextResponse.json({ error: "Only the organizer can review entries." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const status = body.status;
  if (status !== "approved" && status !== "rejected") {
    return badRequest("Status must be 'approved' or 'rejected'.");
  }
  const note = typeof body.review_note === "string" ? body.review_note.trim().slice(0, 500) : null;

  const entry = await queryOne(
    `UPDATE fm_tournament_entries
       SET status = $1, reviewed_by = $2, reviewed_at = now(), review_note = $3
     WHERE id = $4 AND tournament_id = $5
     RETURNING *`,
    [status, me.id, note, params.entryId, t.id]
  );
  if (!entry) return notFound("Entry not found.");
  return NextResponse.json({ entry });
}
