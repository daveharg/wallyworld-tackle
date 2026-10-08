// /api/fishmb/contact — public contact form. No login required; attaches
// the user when one is signed in. Rate-limited to 5 messages per email/hour.

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, badRequest } from "@/lib/fish/auth";
import {
  ensureContactTables,
  saveMessage,
  countRecentByEmail,
} from "@/lib/fish/contact";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  await ensureContactTables();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";
  const subject =
    typeof body.subject === "string" ? body.subject.trim().slice(0, 160) : "";
  const message =
    typeof body.message === "string" ? body.message.trim().slice(0, 3000) : "";

  if (!name) return badRequest("Please add your name.");
  if (!EMAIL_RE.test(email)) return badRequest("That email address doesn't look right.");
  if (message.length < 10)
    return badRequest("Please write a little more — at least 10 characters.");

  const recent = await countRecentByEmail(email);
  if (recent >= 5) {
    return NextResponse.json(
      { error: "You've sent a few messages already — please try again in an hour." },
      { status: 429 }
    );
  }

  const me = await fishUserFromRequest(req);
  await saveMessage({ name, email, subject, message, user_id: me?.id ?? null });
  return NextResponse.json({ ok: true });
}
