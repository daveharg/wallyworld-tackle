// Admin FB mirror outbox — the server-side replacement for the VM's
// fb-outbox.jsonl. The Facebook Page mirror reads unposted entries here
// (GET) and marks them posted after publishing to the Fishmb.ca Page
// (POST { ids: [...] }).
// Same ADMIN_EMAILS allowlist as every other admin route.

import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  forbidden,
} from "@/lib/fish/auth";
import { isAdminEmail } from "@/lib/fish/business";
import {
  listUnpostedFbOutbox,
  markFbOutboxPosted,
} from "@/lib/fish/autopost-server";

async function requireAdmin(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  if (!isAdminEmail(me.email)) return forbidden("Admin only.");
  return null;
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const entries = await listUnpostedFbOutbox();
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const rawIds = Array.isArray(body.ids) ? body.ids : [];
  const ids = rawIds.filter(
    (x): x is string =>
      typeof x === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x)
  );
  if (ids.length === 0) {
    return NextResponse.json(
      { error: "ids must be a non-empty array of entry ids." },
      { status: 400 }
    );
  }
  const marked = await markFbOutboxPosted(ids);
  return NextResponse.json({ ok: true, marked });
}
