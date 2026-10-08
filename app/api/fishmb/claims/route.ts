// /api/fishmb/claims — business-card proof claims.
// POST: a business account sends proof they own a business (business card photo).
// Review happens at /fishmb/admin (ADMIN_EMAILS).

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, badRequest, forbidden } from "@/lib/fish/auth";
import { ensureBusinessTables } from "@/lib/fish/business";
import { query } from "@/lib/fish/db";

export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  await ensureBusinessTables();
  const accountType = (me as { account_type?: string }).account_type ?? "personal";
  if (accountType !== "business") {
    return forbidden("Only business accounts can claim a business.");
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const businessName =
    typeof body.business_name === "string" ? body.business_name.trim().slice(0, 120) : "";
  const cardPhotoUrl =
    typeof body.card_photo_url === "string" ? body.card_photo_url.trim() : "";
  if (!businessName) return badRequest("Business name is required.");
  if (!/^https?:\/\//.test(cardPhotoUrl)) {
    return badRequest("A photo of your business card is required.");
  }
  const message =
    typeof body.message === "string" ? body.message.trim().slice(0, 500) : "";
  const rows = await query(
    `INSERT INTO fm_business_claims (user_id, business_name, card_photo_url, message)
     VALUES ($1, $2, $3, $4) RETURNING id, business_name, status, created_at`,
    [me.id, businessName, cardPhotoUrl, message]
  );
  return NextResponse.json({ claim: rows[0] }, { status: 201 });
}
