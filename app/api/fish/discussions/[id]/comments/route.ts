// /api/fish/discussions/[id]/comments — comments on a feed post.
// GET  → oldest-first paginated {comments, total, limit, offset}.
//        Public; no auth needed. ?limit (1-50, default 20) & ?offset.
// POST → add a comment (auth required). body: 1-500 chars.
//        Rate limit: 30 comments per rolling hour per user.

import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/fish/db";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
  notFound,
} from "@/lib/fish/auth";

export interface CommentRow {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  name: string;
  avatar_url: string | null;
}

function toItem(c: CommentRow) {
  return {
    id: c.id,
    body: c.body,
    created_at: c.created_at,
    user: { id: c.user_id, name: c.name, avatar_url: c.avatar_url },
  };
}

const SELECT = `SELECT c.*, u.name, u.avatar_url FROM fm_comments c
                JOIN fm_users u ON u.id = c.user_id`;

async function postExists(id: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM fm_discussions WHERE id = $1`,
    [id]
  );
  return !!row;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await postExists(params.id))) return notFound("Post not found.");

  const url = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 1), 50);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0);

  const rows = await query<CommentRow>(
    `${SELECT} WHERE c.post_id = $1 ORDER BY c.created_at ASC LIMIT $2 OFFSET $3`,
    [params.id, limit, offset]
  );
  const total = await queryOne<{ n: string }>(
    `SELECT COUNT(*) AS n FROM fm_comments WHERE post_id = $1`,
    [params.id]
  );
  return NextResponse.json({
    comments: rows.map(toItem),
    total: Number(total?.n ?? 0),
    limit,
    offset,
  });
}

const RATE_LIMIT = 30; // comments per rolling hour per user

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  if (!(await postExists(params.id))) return notFound("Post not found.");

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

  const recent = await queryOne<{ n: string }>(
    `SELECT COUNT(*) AS n FROM fm_comments
      WHERE user_id = $1 AND created_at > now() - INTERVAL '1 hour'`,
    [me.id]
  );
  if (Number(recent?.n ?? 0) >= RATE_LIMIT) {
    return NextResponse.json(
      { error: "Slow down — you can comment up to 30 times per hour." },
      { status: 429 }
    );
  }

  const rows = await query<CommentRow>(
    `INSERT INTO fm_comments (post_id, user_id, body)
     VALUES ($1, $2, $3)
     RETURNING *, (SELECT name FROM fm_users WHERE id = $2) AS name,
                  (SELECT avatar_url FROM fm_users WHERE id = $2) AS avatar_url`,
    [params.id, me.id, text]
  );
  return NextResponse.json({ comment: toItem(rows[0]) }, { status: 201 });
}
