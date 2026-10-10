// POST /api/fish/photos/upload — upload a catch photo (auth required).
//
// Multipart form with a single "file" field. Max 8MB; jpeg/png/webp only.
// Stored in Vercel Blob. Requires BLOB_READ_WRITE_TOKEN in the environment;
// without it the route returns 503 with instructions for the operator.

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import { fishUserFromRequest, unauthorized, badRequest } from "@/lib/fish/auth";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "Photo uploads are not configured. The operator must create a Vercel Blob store " +
          "and set the BLOB_READ_WRITE_TOKEN environment variable on this deployment.",
      },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest("Couldn't read your photo. If it's a screenshot, use the original camera photo instead — screenshots don't carry a timestamp.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return badRequest("No photo was attached. Try choosing it again.");
  if (file.size === 0) return badRequest("That photo looks empty. Try choosing a different one.");
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "That photo is too large. Try a smaller one (max 8MB)." },
      { status: 413 }
    );
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return badRequest("That file isn't a photo. Use JPEG, PNG or WebP.");
  }

  const blob = await put(`fish-catches/${me.id}/${randomUUID()}.${ext}`, file, {
    access: "public",
    contentType: file.type,
  });
  return NextResponse.json({ url: blob.url });
}
