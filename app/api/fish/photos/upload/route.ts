// POST /api/fish/photos/upload — upload a photo (auth required).
//
// Multipart form with a single "file" field. Max 8MB; any image format accepted.
// Stored in Vercel Blob. Requires BLOB_READ_WRITE_TOKEN in the environment;
// without it the route returns 503 with instructions for the operator.

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import { fishUserFromRequest, unauthorized, badRequest } from "@/lib/fish/auth";

const MAX_BYTES = 8 * 1024 * 1024;

/** Map an image MIME type to a file extension. */
function extForType(type: string): string {
  const sub = type.split("/")[1]?.split("+")[0] ?? "jpg";
  // Normalize common types.
  if (sub === "jpeg") return "jpg";
  if (sub === "heic" || sub === "heif") return "heic";
  // Sanitize: letters and numbers only, max 5 chars.
  const clean = sub.replace(/[^a-z0-9]/gi, "").slice(0, 5);
  return clean || "jpg";
}

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
    return badRequest("Couldn't read your photo. Try choosing it again.");
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
  const ext = extForType(file.type);
  if (!file.type.startsWith("image/")) {
    return badRequest("That file isn't a photo. Choose an image file.");
  }

  const blob = await put(`fish-catches/${me.id}/${randomUUID()}.${ext}`, file, {
    access: "public",
    contentType: file.type,
  });
  return NextResponse.json({ url: blob.url });
}
