// POST /api/fishmb/push/subscribe — save a push subscription for the current user.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";
import { ensurePushTable } from "@/lib/fish/push";
import { fishUserFromRequest } from "@/lib/fish/auth";

export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  const p256dh = body.keys?.p256dh ?? "";
  const auth = body.keys?.auth ?? "";
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });
  }
  await ensurePushTable();
  await query(
    `INSERT INTO fm_push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [me.id, endpoint, p256dh, auth]
  );
  return NextResponse.json({ ok: true });
}

// DELETE /api/fishmb/push/subscribe — remove the current user's subscription
// for one device endpoint (called on logout, while the token is still valid).
export async function DELETE(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  if (!endpoint) {
    return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });
  }
  await ensurePushTable();
  await query(
    `DELETE FROM fm_push_subscriptions WHERE endpoint = $1 AND user_id = $2`,
    [endpoint, me.id]
  );
  return NextResponse.json({ ok: true });
}
