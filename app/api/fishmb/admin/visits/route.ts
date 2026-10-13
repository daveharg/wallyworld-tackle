// GET /api/fishmb/admin/visits — visit counts, durations, top pages.
// Admin only (same ADMIN_EMAILS allowlist as every other admin route).

import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  forbidden,
} from "@/lib/fish/auth";
import { isAdminEmail } from "@/lib/fish/business";
import { getVisitStats } from "@/lib/fish/analytics";

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  if (!isAdminEmail(me.email)) return forbidden("Admin only.");
  const stats = await getVisitStats();
  return NextResponse.json({ stats });
}
