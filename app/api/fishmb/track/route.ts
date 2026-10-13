// POST /api/fishmb/track — first-party visit beacon (start / ping / end).
// Public: visitors may be signed out. If a valid session token rides
// along, the visit is tied to that angler; otherwise it's anonymous.
// Admin pages are never tracked.

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest } from "@/lib/fish/auth";
import { recordVisit, type VisitEvent } from "@/lib/fish/analytics";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const sessionId = typeof body.session_id === "string" ? body.session_id : "";
  const event = body.event as VisitEvent;
  const path = typeof body.path === "string" ? body.path : "";
  if (!sessionId || sessionId.length > 64) return NextResponse.json({ ok: false }, { status: 400 });
  if (event !== "start" && event !== "ping" && event !== "end")
    return NextResponse.json({ ok: false }, { status: 400 });
  if (!path.startsWith("/fishmb") || path.length > 300 || path.startsWith("/fishmb/admin"))
    return NextResponse.json({ ok: true }); // accepted, not tracked

  let userId: string | null = null;
  try {
    const me = await fishUserFromRequest(req);
    userId = me?.id ?? null;
  } catch {
    userId = null;
  }
  try {
    await recordVisit(sessionId, userId, event, path, body.new_view === true);
  } catch {
    // Analytics must never break the app — swallow and move on.
  }
  return NextResponse.json({ ok: true });
}
