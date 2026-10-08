// GET /api/fishmb/users/[id]/stats — public fishing stats for an angler.
// Privacy is enforced inside getUserStats: strangers see public catches only,
// the owner sees everything.

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, notFound } from "@/lib/fish/auth";
import { getUserStats } from "@/lib/fish/stats";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let viewerId: string | null = null;
  try {
    const me = await fishUserFromRequest(req);
    viewerId = me ? me.id : null;
  } catch {
    // guests see public stats only
  }
  const stats = await getUserStats(params.id, viewerId);
  if (!stats) return notFound("Angler not found.");
  return NextResponse.json({ stats });
}
