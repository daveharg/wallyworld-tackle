// GET /api/fishmb/tournaments/by-code/[code] — resolve an invite code.

import { NextRequest, NextResponse } from "next/server";
import { notFound } from "@/lib/fish/auth";
import { getTournamentByInvite } from "@/lib/fish/tournaments";

export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  const t = await getTournamentByInvite(params.code);
  if (!t) return notFound("No tournament found for that invite code.");
  return NextResponse.json({ tournament: { id: t.id, name: t.name } });
}
