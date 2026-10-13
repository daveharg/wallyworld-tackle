// Admin recommendations inbox — list + mark read/done/dismissed.
// Same ADMIN_EMAILS allowlist as every other admin route.

import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  forbidden,
} from "@/lib/fish/auth";
import { isAdminEmail } from "@/lib/fish/business";
import {
  listRecommendations,
  setRecommendationStatus,
} from "@/lib/fish/recommendations";

async function requireAdmin(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  if (!isAdminEmail(me.email)) return forbidden("Admin only.");
  return null;
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const status = req.nextUrl.searchParams.get("status");
  const recommendations = await listRecommendations(
    status && status !== "all" ? status : null
  );
  return NextResponse.json({ recommendations });
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  const status = typeof body.status === "string" ? body.status : "";
  if (!id || !["new", "read", "done", "dismissed"].includes(status)) {
    return NextResponse.json({ error: "id and a valid status are required." }, { status: 400 });
  }
  const ok = await setRecommendationStatus(id, status);
  if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
