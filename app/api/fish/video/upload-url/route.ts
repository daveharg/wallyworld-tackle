// POST /api/fish/video/upload-url — mint a Mux direct upload for one video.
// The browser PUTs the file straight to Mux (never through our functions).
import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized } from "@/lib/fish/auth";
import { createDirectUpload } from "@/lib/fish/mux";

export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  try {
    const origin =
      req.headers.get("origin") ?? "https://www.wallyworldtackle.ca";
    const { uploadId, uploadUrl } = await createDirectUpload(origin);
    return NextResponse.json({ upload_id: uploadId, upload_url: uploadUrl });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not start video upload." },
      { status: 500 }
    );
  }
}
