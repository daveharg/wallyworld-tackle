// Mux video API helper — direct uploads so phone video never touches our
// serverless functions (request bodies cap at ~4.5MB; videos are 30-80MB).
// Mux converts iPhone .mov to universal HLS/MP4 and serves the bandwidth.

const MUX_API = "https://api.mux.com/video/v1";

function authHeader(): string {
  const id = process.env.MUX_TOKEN_ID;
  const secret = process.env.MUX_TOKEN_SECRET;
  if (!id || !secret) throw new Error("Mux API credentials are not configured.");
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

async function mux(path: string, init?: RequestInit): Promise<any> {
  const r = await fetch(`${MUX_API}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = d?.error?.messages?.join("; ") || `Mux request failed (${r.status}).`;
    throw new Error(msg);
  }
  return d.data;
}

/** Create a direct upload; the browser PUTs the file to `url`. */
export async function createDirectUpload(corsOrigin: string): Promise<{
  uploadId: string;
  uploadUrl: string;
}> {
  const data = await mux("/uploads", {
    method: "POST",
    body: JSON.stringify({
      new_asset_settings: { playback_policy: ["public"] },
      cors_origin: corsOrigin,
    }),
  });
  return { uploadId: data.id as string, uploadUrl: data.url as string };
}

export type UploadStatus =
  | { state: "waiting" }
  | { state: "ready"; playbackId: string; duration: number | null }
  | { state: "errored" };

/** Resolve an upload to its asset's public playback id (poll until ready). */
export async function getUploadStatus(uploadId: string): Promise<UploadStatus> {
  const up = await mux(`/uploads/${uploadId}`);
  if (up.status === "errored") return { state: "errored" };
  const assetId = up.asset_id as string | undefined;
  if (!assetId) return { state: "waiting" };
  const asset = await mux(`/assets/${assetId}`);
  if (asset.status === "errored") return { state: "errored" };
  if (asset.status !== "ready") return { state: "waiting" };
  const pb = (asset.playback_ids ?? []).find((p: any) => p.policy === "public") ?? asset.playback_ids?.[0];
  if (!pb?.id) return { state: "waiting" };
  return {
    state: "ready",
    playbackId: pb.id as string,
    duration: typeof asset.duration === "number" ? asset.duration : null,
  };
}
