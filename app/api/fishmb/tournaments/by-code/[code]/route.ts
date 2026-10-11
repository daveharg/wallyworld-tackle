// GET /api/fishmb/tournaments/by-code/[code] — resolve an entry key.

import { NextRequest, NextResponse } from "next/server";
import { notFound } from "@/lib/fish/auth";
import { getTournamentByKey } from "@/lib/fish/tournaments";

export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  const t = await getTournamentByKey(params.code);
  if (!t) return notFound("No tournament found for that entry key.");
  return NextResponse.json({
    tournament: { id: t.id, name: t.name },
    entry_key: params.code.toUpperCase(),
  });
}
