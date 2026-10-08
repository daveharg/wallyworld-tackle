// /api/fishmb/lake-notes/[lakeId] — delete a personal lake note.
import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized } from "@/lib/fish/auth";
import { deleteLakeNote } from "@/lib/fish/lake-notes";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ lakeId: string }> }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const { lakeId } = await params;
  await deleteLakeNote(me.id, lakeId);
  return NextResponse.json({ ok: true });
}
