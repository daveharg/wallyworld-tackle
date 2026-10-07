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
    return badRequest("Expected multipart form data with a 'file' field.");
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
    return badRequest("Unsupported image type. Use JPEG, PNG or WebP.");
  }

  const blob = await put(`fish-catches/${me.id}/${randomUUID()}.${ext}`, file, {
    access: "public",
    contentType: file.type,
  });
  return NextResponse.json({ url: blob.url });
}
