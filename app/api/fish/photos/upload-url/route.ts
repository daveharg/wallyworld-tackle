// POST /api/fish/photos/upload-url — generate a direct upload URL for Vercel Blob.
// The client uploads directly to Blob, bypassing the serverless body limit.
// Auth required.

import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { fishUserFromRequest, unauthorized } from "@/lib/fish/auth";

export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();

  const body = (await req.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: ["image/*"],
          maximumSizeInBytes: 20 * 1024 * 1024, // 20MB
          validUntil: Date.now() + 60_000, // 1 minute
        };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
