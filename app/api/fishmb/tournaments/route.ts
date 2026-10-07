// /api/fishmb/tournaments — list tournaments / create a tournament (auth).

import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
} from "@/lib/fish/auth";
import {
  ensureTournamentTables,
  generateInviteCode,
  listTournaments,
  getTournament,
} from "@/lib/fish/tournaments";
import { queryOne } from "@/lib/fish/db";

export async function GET() {
  await ensureTournamentTables();
  const tournaments = await listTournaments();
  return NextResponse.json({ tournaments });
}

const SCORING = ["longest", "total", "count"];

export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  await ensureTournamentTables();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  if (!name) return badRequest("Tournament name is required.");
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 2000) : "";
  const lakeIds = Array.isArray(body.lake_ids)
    ? body.lake_ids.filter((x): x is string => typeof x === "string").slice(0, 50)
    : [];
  const species = Array.isArray(body.species)
    ? body.species.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean).slice(0, 20)
    : [];
  const startsAt = typeof body.starts_at === "string" ? body.starts_at : "";
  const endsAt = typeof body.ends_at === "string" ? body.ends_at : "";
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return badRequest("Valid start and end dates are required.");
  if (end <= start) return badRequest("End date must be after the start date.");
  const rules = typeof body.rules === "string" ? body.rules.trim().slice(0, 5000) : "";
  const scoring = typeof body.scoring === "string" && SCORING.includes(body.scoring) ? body.scoring : "longest";
  const maxParticipants =
    typeof body.max_participants === "number" && body.max_participants > 0
      ? Math.min(Math.floor(body.max_participants), 10000)
      : null;

  const inviteCode = await generateInviteCode();
  const created = await queryOne<{ id: string }>(
    `INSERT INTO fm_tournaments
       (name, description, organizer_id, lake_ids, species, starts_at, ends_at, rules, scoring, invite_code, max_participants)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [name, description, me.id, lakeIds, species, start.toISOString(), end.toISOString(), rules, scoring, inviteCode, maxParticipants]
  );
  // The organizer is automatically a participant.
  await queryOne(
    `INSERT INTO fm_tournament_participants (tournament_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [created!.id, me.id]
  );
  const tournament = await getTournament(created!.id);
  return NextResponse.json({ tournament }, { status: 201 });
}
