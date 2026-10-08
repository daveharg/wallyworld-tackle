// /api/fishmb/admin/contact-messages — read and triage contact-form
// messages (site owner only).

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, badRequest, forbidden } from "@/lib/fish/auth";
import { isAdminEmail } from "@/lib/fish/business";
import { ensureContactTables, listMessages, markMessage } from "@/lib/fish/contact";

function admin(me: { email: string | null }) {
  if (!isAdminEmail(me.email)) throw new Error("forbidden");
}

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  try {
    admin(me);
  } catch {
    return forbidden("Admin only.");
  }
  await ensureContactTables();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const allowed = status === "new" || status === "read" || status === "archived" ? status : null;
  const messages = await listMessages(allowed);
  return NextResponse.json({ messages });
}

export async function PATCH(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  try {
    admin(me);
  } catch {
    return forbidden("Admin only.");
  }
  await ensureContactTables();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const id = typeof body.id === "string" ? body.id : "";
  const status = body.status === "read" || body.status === "archived" ? body.status : null;
  if (!id || !status) return badRequest("id and status (read|archived) required.");
  await markMessage(id, status);
  return NextResponse.json({ ok: true });
}
