// /api/fishmb/tournaments/[id] — tournament detail + leaderboard (public).
// PATCH — update details (organizer only).

import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
  notFound,
} from "@/lib/fish/auth";
import {
  getTournament,
  getEntries,
  getLeaderboard,
  isParticipant,
} from "@/lib/fish/tournaments";
import { query } from "@/lib/fish/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const t = await getTournament(params.id);
  if (!t) return notFound("Tournament not found.");
  const me = await fishUserFromRequest(req);
  const leaderboard = await getLeaderboard(t.id, t.scoring);
  const entries = await getEntries(t.id, ["approved"]);
  const mine = me ? await isParticipant(t.id, me.id) : false;
  const participantCount = t.participant_count;
  return NextResponse.json({
    tournament: t,
    leaderboard,
    entries,
    joined: mine,
    is_organizer: !!me && me.id === t.organizer_id,
    participant_count: participantCount,
  });
}

const SCORING = ["longest", "total", "count"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const t = await getTournament(params.id);
  if (!t) return notFound("Tournament not found.");
  if (t.organizer_id !== me.id) {
    return NextResponse.json({ error: "Only the organizer can edit this tournament." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  const set = (col: string, val: unknown) => {
    values.push(val);
    updates.push(`${col} = $${values.length}`);
  };

  if (typeof body.name === "string" && body.name.trim()) set("name", body.name.trim().slice(0, 80));
  if (typeof body.description === "string") set("description", body.description.trim().slice(0, 2000));
  if (Array.isArray(body.lake_ids))
    set("lake_ids", body.lake_ids.filter((x): x is string => typeof x === "string").slice(0, 50));
  if (Array.isArray(body.species))
    set(
      "species",
      body.species.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean).slice(0, 20)
    );
  if (typeof body.rules === "string") set("rules", body.rules.trim().slice(0, 5000));
  if (typeof body.scoring === "string" && SCORING.includes(body.scoring)) set("scoring", body.scoring);
  if (typeof body.status === "string" && ["upcoming", "live", "ended"].includes(body.status))
    set("status", body.status);
  if (body.max_participants === null || (typeof body.max_participants === "number" && body.max_participants > 0))
    set("max_participants", body.max_participants === null ? null : Math.min(Math.floor(body.max_participants as number), 10000));

  if (updates.length === 0) return badRequest("Nothing to update.");
  values.push(t.id);
  await query(`UPDATE fm_tournaments SET ${updates.join(", ")} WHERE id = $${values.length}`, values);
  const updated = await getTournament(t.id);
  return NextResponse.json({ tournament: updated });
}
