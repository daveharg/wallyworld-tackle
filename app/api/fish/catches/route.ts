// /api/fish/catches — the social feed.
// GET  → newest-first feed. Public catches always; with auth also friends'
//        catches and your own. ?limit (1-50, default 20) & ?offset.
// POST → log a catch (auth required). Validates species, length, visibility
//        and requires BOTH photo URLs (measure + holding).

import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/fish/db";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
  publicUser,
  type FishUser,
} from "@/lib/fish/auth";

export interface CatchRow {
  id: string;
  user_id: string;
  species: string;
  length_in: string;
  weight_lb: string | null;
  photo_measure_url: string;
  photo_hold_url: string;
  visibility: "public" | "friends" | "private";
  note: string | null;
  caught_at: string;
  created_at: string;
  name: string;
  avatar_url: string | null;
}

function toItem(c: CatchRow) {
  return {
    id: c.id,
    species: c.species,
    length_in: Number(c.length_in),
    weight_lb: c.weight_lb === null ? null : Number(c.weight_lb),
    photo_measure_url: c.photo_measure_url,
    photo_hold_url: c.photo_hold_url,
    visibility: c.visibility,
    note: c.note,
    caught_at: c.caught_at,
    created_at: c.created_at,
    user: { id: c.user_id, name: c.name, avatar_url: c.avatar_url },
  };
}

const SELECT = `SELECT c.*, u.name, u.avatar_url FROM fm_catches c
                JOIN fm_users u ON u.id = c.user_id`;

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  const url = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 1), 50);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0);

  let where: string;
  let params: unknown[];
  if (!me) {
    where = `c.visibility = 'public'`;
    params = [];
  } else {
    // Public catches, friends' catches (both directions), and your own.
    where = `(
      c.visibility = 'public'
      OR c.user_id = $1
      OR (c.visibility = 'friends' AND EXISTS (
            SELECT 1 FROM fm_friendships f
             WHERE f.status = 'accepted'
               AND ((f.requester_id = $1 AND f.addressee_id = c.user_id)
                 OR (f.addressee_id = $1 AND f.requester_id = c.user_id))
          ))
    )`;
    params = [me.id];
  }

  const rows = await query<CatchRow>(
    `${SELECT} WHERE ${where} ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  const total = await queryOne<{ n: string }>(
    `SELECT COUNT(*) AS n FROM fm_catches c WHERE ${where}`,
    params
  );
  return NextResponse.json({
    catches: rows.map(toItem),
    total: Number(total?.n ?? 0),
    limit,
    offset,
  });
}

const VISIBILITIES = ["public", "friends", "private"] as const;

export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const species = typeof body.species === "string" ? body.species.trim().slice(0, 80) : "";
  if (!species) return badRequest("species is required.");
  const lengthIn = Number(body.length_in);
  if (!Number.isFinite(lengthIn) || lengthIn <= 0 || lengthIn > 999) {
    return badRequest("length_in must be a positive number of inches.");
  }
  const weightLb =
    body.weight_lb === undefined || body.weight_lb === null ? null : Number(body.weight_lb);
  if (weightLb !== null && (!Number.isFinite(weightLb) || weightLb <= 0 || weightLb > 999)) {
    return badRequest("weight_lb must be a positive number of pounds.");
  }
  const visibility = body.visibility ?? "public";
  if (!VISIBILITIES.includes(visibility as (typeof VISIBILITIES)[number])) {
    return badRequest("visibility must be public, friends or private.");
  }
  const photoMeasure = typeof body.photo_measure_url === "string" ? body.photo_measure_url : "";
  const photoHold = typeof body.photo_hold_url === "string" ? body.photo_hold_url : "";
  for (const [label, v] of [["photo_measure_url", photoMeasure], ["photo_hold_url", photoHold]] as const) {
    if (!v || !/^https?:\/\//.test(v) || v.length > 2048) {
      return badRequest(`${label} is required and must be an http(s) URL.`);
    }
  }
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null;
  let caughtAt: string | null = null;
  if (body.caught_at !== undefined && body.caught_at !== null) {
    const d = new Date(String(body.caught_at));
    if (Number.isNaN(d.getTime())) return badRequest("caught_at must be an ISO date.");
    caughtAt = d.toISOString();
  }

  const rows = await query<CatchRow>(
    `INSERT INTO fm_catches
       (user_id, species, length_in, weight_lb, photo_measure_url, photo_hold_url, visibility, note, caught_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::timestamptz, now()))
     RETURNING *, (SELECT name FROM fm_users WHERE id = $1) AS name,
                   (SELECT avatar_url FROM fm_users WHERE id = $1) AS avatar_url`,
    [me.id, species, lengthIn, weightLb, photoMeasure, photoHold, visibility, note, caughtAt]
  );
  return NextResponse.json({ catch: toItem(rows[0]) }, { status: 201 });
}
