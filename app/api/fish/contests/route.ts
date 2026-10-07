// /api/fish/contests
// GET  → list contests. Public contests always visible; with auth also
//        friends-visible, your own, and ones you've joined. ?status=open|settled|all
// POST → create a contest (auth required). Stakes are PLAY MONEY chips.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";
import {
  fishUserFromRequest,
  badRequest,
  publicUser,
  type FishUser,
} from "@/lib/fish/auth";
import { makeInviteCode, type Contest } from "@/lib/fish/scoring";

const TYPES = ["most_fish", "biggest_fish", "most_over_size", "most_over_size_daily_limit"] as const;
const PERIODS = ["daily", "weekly", "monthly", "seasonal"] as const;
const VISIBILITIES = ["public", "friends", "invite"] as const;

function toSummary(c: Contest & { name: string; avatar_url: string | null; entrants: string; pot: string }, me: FishUser | null) {
  return {
    id: c.id,
    title: c.title,
    type: c.type,
    species: c.species,
    size_threshold_in: c.size_threshold_in === null ? null : Number(c.size_threshold_in),
    daily_limit: c.daily_limit,
    period: c.period,
    starts_at: c.starts_at,
    ends_at: c.ends_at,
    visibility: c.visibility,
    stake: c.stake,
    status: c.status,
    entrants: Number(c.entrants),
    pot: Number(c.pot),
    creator: { id: c.creator_id, name: c.name, avatar_url: c.avatar_url },
    is_creator: me?.id === c.creator_id,
    // invite codes are only revealed to the creator (and to joiners via detail)
    invite_code: me?.id === c.creator_id ? c.invite_code : undefined,
  };
}

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "open";
  const statusWhere =
    status === "all" ? "" : status === "settled" ? `AND c.status = 'settled'` : `AND c.status = 'open'`;

  let visibilityWhere: string;
  let params: unknown[];
  if (!me) {
    visibilityWhere = `AND c.visibility = 'public'`;
    params = [];
  } else {
    visibilityWhere = `AND (
      c.visibility = 'public'
      OR c.creator_id = $1
      OR (c.visibility = 'friends' AND EXISTS (
            SELECT 1 FROM fm_friendships f
             WHERE f.status = 'accepted'
               AND ((f.requester_id = $1 AND f.addressee_id = c.creator_id)
                 OR (f.addressee_id = $1 AND f.requester_id = c.creator_id))
          ))
      OR EXISTS (SELECT 1 FROM fm_contest_entries e WHERE e.contest_id = c.id AND e.user_id = $1)
    )`;
    params = [me.id];
  }

  const rows = await query<Contest & { name: string; avatar_url: string | null; entrants: string; pot: string }>(
    `SELECT c.*, u.name, u.avatar_url,
            (SELECT COUNT(*) FROM fm_contest_entries e WHERE e.contest_id = c.id) AS entrants,
            (SELECT COALESCE(SUM(stake_paid),0) FROM fm_contest_entries e WHERE e.contest_id = c.id) AS pot
       FROM fm_contests c
       JOIN fm_users u ON u.id = c.creator_id
      WHERE 1=1 ${statusWhere} ${visibilityWhere}
      ORDER BY c.starts_at DESC`,
    params
  );
  return NextResponse.json({ contests: rows.map((c) => toSummary(c, me)) });
}

export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  if (!title) return badRequest("title is required (max 120 chars).");
  const type = body.type;
  if (!TYPES.includes(type as (typeof TYPES)[number])) {
    return badRequest(`type must be one of: ${TYPES.join(", ")}.`);
  }
  const period = body.period;
  if (!PERIODS.includes(period as (typeof PERIODS)[number])) {
    return badRequest(`period must be one of: ${PERIODS.join(", ")}.`);
  }
  const startsAt = new Date(String(body.starts_at));
  const endsAt = new Date(String(body.ends_at));
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return badRequest("starts_at and ends_at must be ISO dates.");
  }
  if (endsAt <= startsAt) return badRequest("ends_at must be after starts_at.");

  const species =
    body.species === null || body.species === undefined
      ? null
      : String(body.species).trim().slice(0, 80) || null;

  let threshold: number | null = null;
  if (type === "most_over_size" || type === "most_over_size_daily_limit") {
    threshold = Number(body.size_threshold_in);
    if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 999) {
      return badRequest("size_threshold_in (inches) is required for this contest type.");
    }
  }
  let dailyLimit: number | null = null;
  if (type === "most_over_size_daily_limit") {
    dailyLimit = Number(body.daily_limit);
    if (!Number.isInteger(dailyLimit) || dailyLimit <= 0 || dailyLimit > 100) {
      return badRequest("daily_limit (positive integer) is required for this contest type.");
    }
  }

  const visibility = body.visibility ?? "public";
  if (!VISIBILITIES.includes(visibility as (typeof VISIBILITIES)[number])) {
    return badRequest("visibility must be public, friends or invite.");
  }
  const stake = body.stake === undefined || body.stake === null ? 0 : Number(body.stake);
  if (!Number.isInteger(stake) || stake < 0 || stake > 1_000_000) {
    return badRequest("stake must be a non-negative integer number of play-money chips.");
  }
  let inviteCode: string | null = null;
  if (visibility === "invite") {
    inviteCode =
      typeof body.invite_code === "string" && body.invite_code.trim()
        ? body.invite_code.trim().slice(0, 16).toUpperCase()
        : makeInviteCode();
  }

  const rows = await query<Contest>(
    `INSERT INTO fm_contests
       (creator_id, title, type, species, size_threshold_in, daily_limit, period,
        starts_at, ends_at, visibility, invite_code, stake)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [me.id, title, type, species, threshold, dailyLimit, period,
     startsAt.toISOString(), endsAt.toISOString(), visibility, inviteCode, stake]
  );
  const c = rows[0];
  return NextResponse.json(
    {
      contest: {
        ...toSummary({ ...c, name: me.name, avatar_url: me.avatar_url, entrants: "0", pot: "0" }, me),
        invite_code: inviteCode, // creator sees it on creation
      },
    },
    { status: 201 }
  );
}
