// GET /api/fish/video/status?upload_id= — poll until Mux has the video ready.
import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, badRequest } from "@/lib/fish/auth";
import { getUploadStatus } from "@/lib/fish/mux";

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const uploadId = req.nextUrl.searchParams.get("upload_id");
  if (!uploadId) return badRequest("Missing upload_id.");
  try {
    const s = await getUploadStatus(uploadId);
    if (s.state === "ready")
      return NextResponse.json({
        status: "ready",
        playback_id: s.playbackId,
        duration: s.duration,
      });
    return NextResponse.json({ status: s.state });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not check video status." },
      { status: 500 }
    );
  }
}
