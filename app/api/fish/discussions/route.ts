// /api/fish/discussions — the Feed.
// GET  → newest-first paginated {discussions, total, limit, offset}.
//        Public; no auth needed. ?limit (1-50, default 20) & ?offset.
//        Items include kind ('post'|'ad'), photo_url, and comment_count.
// POST → create a feed post (auth required). body: 1-500 chars.
//        Optional kind ('post'|'ad', default 'post') and photo_url
//        (https URL, max 500 chars). Rate limit: 10 posts per rolling hour.

import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/fish/db";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
} from "@/lib/fish/auth";

export interface DiscussionRow {
  id: string;
  user_id: string;
  body: string;
  kind: string;
  photo_url: string | null;
  comment_count: string;
  created_at: string;
  name: string;
  avatar_url: string | null;
}

function toItem(d: DiscussionRow) {
  return {
    id: d.id,
    body: d.body,
    kind: d.kind === "ad" ? "ad" : "post",
    photo_url: d.photo_url,
    comment_count: Number(d.comment_count ?? 0),
    created_at: d.created_at,
    user: { id: d.user_id, name: d.name, avatar_url: d.avatar_url },
  };
}

const SELECT = `SELECT d.*, u.name, u.avatar_url,
                (SELECT COUNT(*) FROM fm_comments c WHERE c.post_id = d.id) AS comment_count
                FROM fm_discussions d
                JOIN fm_users u ON u.id = d.user_id`;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 1), 50);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0);

  const rows = await query<DiscussionRow>(
    `${SELECT} ORDER BY d.created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  const total = await queryOne<{ n: string }>(
    `SELECT COUNT(*) AS n FROM fm_discussions`
  );
  return NextResponse.json({
    discussions: rows.map(toItem),
    total: Number(total?.n ?? 0),
    limit,
    offset,
  });
}

const RATE_LIMIT = 10; // posts per rolling hour per user

export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return badRequest("body is required.");
  if (text.length > 500) {
    return badRequest("body must be 500 characters or fewer.");
  }

  const kind = body.kind === "ad" ? "ad" : "post";

  let photoUrl: string | null = null;
  if (body.photo_url != null && body.photo_url !== "") {
    if (typeof body.photo_url !== "string") {
      return badRequest("photo_url must be a URL string.");
    }
    const p = body.photo_url.trim();
    if (p.length > 500) return badRequest("photo_url is too long.");
    if (!/^https:\/\//i.test(p)) return badRequest("photo_url must be an https URL.");
    photoUrl = p;
  }

  const recent = await queryOne<{ n: string }>(
    `SELECT COUNT(*) AS n FROM fm_discussions
      WHERE user_id = $1 AND created_at > now() - INTERVAL '1 hour'`,
    [me.id]
  );
  if (Number(recent?.n ?? 0) >= RATE_LIMIT) {
    return NextResponse.json(
      { error: "Slow down — you can post up to 10 times per hour." },
      { status: 429 }
    );
  }

  const rows = await query<DiscussionRow>(
    `INSERT INTO fm_discussions (user_id, body, kind, photo_url)
     VALUES ($1, $2, $3, $4)
     RETURNING *, 0 AS comment_count,
                   (SELECT name FROM fm_users WHERE id = $1) AS name,
                   (SELECT avatar_url FROM fm_users WHERE id = $1) AS avatar_url`,
    [me.id, text, kind, photoUrl]
  );
  return NextResponse.json({ discussion: toItem(rows[0]) }, { status: 201 });
}
