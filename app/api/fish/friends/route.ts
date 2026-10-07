// GET /api/fish/friends — your friends + pending requests (auth required).

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";
import { fishUserFromRequest, unauthorized } from "@/lib/fish/auth";

interface FriendRow {
  other_id: string;
  name: string;
  avatar_url: string | null;
  direction: "in" | "out";
  status: string;
  created_at: string;
}

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();

  const rows = await query<FriendRow>(
    `SELECT CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END AS other_id,
            u.name, u.avatar_url,
            CASE WHEN f.requester_id = $1 THEN 'out' ELSE 'in' END AS direction,
            f.status, f.created_at
       FROM fm_friendships f
       JOIN fm_users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
      WHERE (f.requester_id = $1 OR f.addressee_id = $1)
        AND f.status IN ('pending', 'accepted')
      ORDER BY f.created_at DESC`,
    [me.id]
  );

  const friends = rows
    .filter((r) => r.status === "accepted")
    .map((r) => ({ id: r.other_id, name: r.name, avatar_url: r.avatar_url }));
  const pending_incoming = rows
    .filter((r) => r.status === "pending" && r.direction === "in")
    .map((r) => ({ id: r.other_id, name: r.name, avatar_url: r.avatar_url }));
  const pending_outgoing = rows
    .filter((r) => r.status === "pending" && r.direction === "out")
    .map((r) => ({ id: r.other_id, name: r.name, avatar_url: r.avatar_url }));

  return NextResponse.json({ friends, pending_incoming, pending_outgoing });
}
