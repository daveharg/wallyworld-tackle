// /api/fishmb/license — the signed-in angler's fishing-licence wallet.
// GET: fetch the saved licence (or null). POST: upload licence file
// (multipart "file": JPEG/PNG/PDF, max 8MB; optional "expiry_date" YYYY-MM-DD).
// DELETE: remove it. FishMB only stores the user's own government-issued
// document; it never issues or generates licences.

import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
} from "@/lib/fish/auth";
import { getLicense, saveLicense, deleteLicense } from "@/lib/fish/license";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};

function validDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const lic = await getLicense(me.id);
  return NextResponse.json({ license: lic });
}

export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Licence uploads are not configured yet." },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest("Expected multipart form data.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return badRequest("Missing 'file' field.");
  if (file.size === 0) return badRequest("File is empty.");
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large. Maximum is 8MB." },
      { status: 413 }
    );
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return badRequest("Unsupported file type. Use JPEG, PNG or PDF.");
  }
  const expiryRaw = form.get("expiry_date");
  const expiry =
    typeof expiryRaw === "string" && expiryRaw.trim() !== ""
      ? expiryRaw.trim()
      : null;
  if (expiry && !validDate(expiry)) {
    return badRequest("expiry_date must be YYYY-MM-DD.");
  }

  // Remove the previous file so only one licence is ever stored.
  const prev = await getLicense(me.id);
  if (prev) {
    try {
      await del(prev.file_url);
    } catch {
      // Non-fatal; the DB row is replaced below.
    }
  }

  const blob = await put(`fish-licenses/${me.id}/license.${ext}`, file, {
    access: "public",
    contentType: file.type,
  });
  const lic = await saveLicense(me.id, blob.url, file.type, expiry);
  return NextResponse.json({ license: lic });
}

export async function DELETE(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const prev = await getLicense(me.id);
  if (prev) {
    try {
      await del(prev.file_url);
    } catch {
      // Continue with the DB delete regardless.
    }
  }
  await deleteLicense(me.id);
  return NextResponse.json({ ok: true });
}
