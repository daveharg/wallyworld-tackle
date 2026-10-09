// /api/fishmb/admin/stats — dashboard counts for the site owner.

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, forbidden } from "@/lib/fish/auth";
import { ensureBusinessTables, isAdminEmail } from "@/lib/fish/business";
import { ensureGuideClassifiedsTable } from "@/lib/fish/guide-classifieds";
import { ensureTournamentTables } from "@/lib/fish/tournaments";
import { queryOne } from "@/lib/fish/db";

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  if (!isAdminEmail(me.email)) return forbidden("Admin only.");
  await ensureBusinessTables();
  await ensureGuideClassifiedsTable();
  await ensureTournamentTables();

  const users = await queryOne<{ c: string }>(`SELECT COUNT(*)::text AS c FROM fm_users`);
  const businesses = await queryOne<{ c: string }>(`SELECT COUNT(*)::text AS c FROM fm_businesses`);
  const pendingClaims = await queryOne<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM fm_business_claims WHERE status = 'pending'`
  );
  const pendingAds = await queryOne<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM fm_ads WHERE status = 'pending'`
  );
  const activeAds = await queryOne<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM fm_ads WHERE status = 'active'`
  );
  const tournaments = await queryOne<{ c: string }>(`SELECT COUNT(*)::text AS c FROM fm_tournaments`);
  const classifieds = await queryOne<{ c: string }>(`SELECT COUNT(*)::text AS c FROM fm_classifieds`);

  return NextResponse.json({
    stats: {
      users: Number(users?.c ?? 0),
      businesses: Number(businesses?.c ?? 0),
      pendingClaims: Number(pendingClaims?.c ?? 0),
      pendingAds: Number(pendingAds?.c ?? 0),
      activeAds: Number(activeAds?.c ?? 0),
      tournaments: Number(tournaments?.c ?? 0),
      classifieds: Number(classifieds?.c ?? 0),
    },
  });
}
