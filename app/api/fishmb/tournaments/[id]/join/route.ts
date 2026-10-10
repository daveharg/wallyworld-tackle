// POST /api/fishmb/tournaments/[id]/join — join a tournament (auth required).
// An invite code is required to join someone else's tournament (Dave's rule —
// no open joins). The organizer is exempt.

import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
  notFound,
  suspendedCheck,
} from "@/lib/fish/auth";
import { getTournament, isParticipant } from "@/lib/fish/tournaments";
import { query } from "@/lib/fish/db";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const susp = suspendedCheck(me);
  if (susp) return susp;
  const t = await getTournament(params.id);
  if (!t) return notFound("Tournament not found.");
  if (t.status === "ended" || (t.ends_at && new Date(t.ends_at).getTime() < Date.now())) {
    return badRequest("This tournament has ended.");
  }
  if (await isParticipant(t.id, me.id)) {
    return NextResponse.json({ joined: true });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // no body — code check below will reject
  }
  const code =
    typeof body.invite_code === "string" ? body.invite_code.trim().toUpperCase() : "";
  const isOrganizer = t.organizer_id === me.id;
  // Entry keys work as invite codes too — redeem the key on join.
  let keyId: string | null = null;
  if (!isOrganizer && code !== t.invite_code.toUpperCase()) {
    const keyRow = await query(
      `SELECT id, status, max_uses, uses FROM fm_tournament_keys WHERE tournament_id = $1 AND key_code = $2`,
      [t.id, code]
    );
    const k = keyRow[0] as { id: string; status: string; max_uses: number | null; uses: number } | undefined;
    if (!k) {
      return NextResponse.json(
        { error: "You need the tournament's invite code to join." },
        { status: 403 }
      );
    }
    const unlimited = k.max_uses === null;
    if (!unlimited && k.status === "used") {
      return NextResponse.json({ error: "That entry key has already been used." }, { status: 403 });
    }
    keyId = k.id;
  }

  if (t.max_participants !== null && t.participant_count >= t.max_participants) {
    return badRequest("This tournament is full.");
  }
  await query(
    `INSERT INTO fm_tournament_participants (tournament_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [t.id, me.id]
  );
  // Consume the entry key if one was used.
  if (keyId) {
    await query(
      `UPDATE fm_tournament_keys SET status = 'used', used_by_user_id = $1, used_at = now(), uses = uses + 1 WHERE id = $2`,
      [me.id, keyId]
    );
  }
  return NextResponse.json({ joined: true });
}
