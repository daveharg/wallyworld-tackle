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

export async function GET(req: NextRequest) {
  await ensureTournamentTables();
  const mine = new URL(req.url).searchParams.get("mine") === "1";
  if (mine) {
    let me: { id: string } | null = null;
    try {
      me = await fishUserFromRequest(req);
    } catch {
      return NextResponse.json({ tournaments: [] });
    }
    if (!me) return NextResponse.json({ tournaments: [] });
    const { query } = await import("@/lib/fish/db");
    const tournaments = await query(
      `SELECT t.*, u.name AS organizer_name,
         (SELECT COUNT(*) FROM fm_tournament_participants p WHERE p.tournament_id = t.id)::int AS participant_count,
         (SELECT COUNT(*) FROM fm_tournament_entries e WHERE e.tournament_id = t.id AND e.status = 'approved')::int AS entry_count
       FROM fm_tournaments t
       JOIN fm_users u ON u.id = t.organizer_id
       JOIN fm_tournament_participants p ON p.tournament_id = t.id AND p.user_id = $1
       WHERE t.status IN ('upcoming', 'active')
       ORDER BY t.starts_at ASC`,
      [me.id]
    );
    return NextResponse.json({ tournaments });
  }
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
  const entryFeeCents =
    typeof body.entry_fee_cents === "number" && body.entry_fee_cents > 0
      ? Math.min(Math.floor(body.entry_fee_cents), 10000000)
      : 0;
  const payouts = Array.isArray(body.payouts)
    ? body.payouts
        .filter(
          (p): p is { place: number; type: string; value: number } =>
            typeof p === "object" &&
            p !== null &&
            typeof p.place === "number" &&
            (p.type === "percent" || p.type === "amount") &&
            typeof p.value === "number" &&
            p.value > 0
        )
        .map((p) => ({
          place: Math.min(Math.max(Math.floor(p.place), 1), 100),
          type: p.type as "percent" | "amount",
          value: p.type === "percent" ? Math.min(p.value, 100) : Math.min(p.value, 1000000),
        }))
        .sort((a, b) => a.place - b.place)
        .slice(0, 20)
    : [];

  const inviteCode = await generateInviteCode();
  const coverPhotoUrl =
    typeof body.cover_photo_url === "string" && /^https?:\/\//.test(body.cover_photo_url.trim())
      ? body.cover_photo_url.trim()
      : null;
  const venueName = typeof body.venue_name === "string" ? body.venue_name.trim().slice(0, 120) : null;
  const venueAddress = typeof body.venue_address === "string" ? body.venue_address.trim().slice(0, 200) : null;
  const photoMode = body.photo_mode === "measure_only" ? "measure_only" : "standard";
  const created = await queryOne<{ id: string }>(
    `INSERT INTO fm_tournaments
       (name, description, organizer_id, lake_ids, species, starts_at, ends_at, rules, scoring, invite_code, max_participants, entry_fee_cents, payouts, auto_approve_entries, cover_photo_url, venue_name, venue_address, photo_mode)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING id`,
    [name, description, me.id, lakeIds, species, start.toISOString(), end.toISOString(), rules, scoring, inviteCode, maxParticipants, entryFeeCents, JSON.stringify(payouts), body.auto_approve_entries === true, coverPhotoUrl, venueName, venueAddress, photoMode]
  );
  // The organizer is automatically a participant.
  await queryOne(
    `INSERT INTO fm_tournament_participants (tournament_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [created!.id, me.id]
  );
  const tournament = await getTournament(created!.id);
  return NextResponse.json({ tournament }, { status: 201 });
}
