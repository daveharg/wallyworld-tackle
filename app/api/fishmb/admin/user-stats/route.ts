// GET /api/fishmb/admin/user-stats — public-facing fishing stats for every
// angler, for the site owner's dashboard. Admin only.

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, forbidden } from "@/lib/fish/auth";
import { isAdminEmail } from "@/lib/fish/business";
import { getAllUserStats } from "@/lib/fish/stats";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  if (!isAdminEmail(me.email)) return forbidden("Admin only.");
  const users = await getAllUserStats();
  return NextResponse.json({ users });
}
