// Share-a-spot composer: write a post, attach photos and/or a short video,
// then submit — the spot card rides along on the feed post.

"use client";

import { useEffect, useRef, useState } from "react";
import { fishFetch } from "./fishFetch";
import { compressImage } from "./compressImage";
import { FISHMB_TOKEN_KEY } from "@/lib/fishmb-constants";
import { useSheetDrag, SheetGrabber } from "./sheetDrag";

export interface ShareSpotTarget {
  id: string;
  name: string;
}

type VideoState =
  | { phase: "idle" }
  | { phase: "uploading"; progress: number }
  | { phase: "processing" }
  | { phase: "ready"; playback_id: string; duration: number | null }
  | { phase: "error"; message: string };

export default function ShareSpotSheet({
  spot,
  onClose,
  onShared,
}: {
  spot: ShareSpotTarget;
  onClose: () => void;
  onShared: () => void;
}) {
  const [caption, setCaption] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [video, setVideo] = useState<VideoState>({ phase: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { dragHandlers, dragStyle } = useSheetDrag(onClose);
  const videoRef = useRef<HTMLInputElement>(null);

  // iOS-proof background lock while the composer is open.
  useEffect(() => {
    const y = window.scrollY;
    const b = document.body.style;
    const prev = {
      position: b.position,
      top: b.top,
      left: b.left,
      right: b.right,
      width: b.width,
      overflow: b.overflow,
    };
    b.position = "fixed";
    b.top = `-${y}px`;
    b.left = "0";
    b.right = "0";
    b.width = "100%";
    b.overflow = "hidden";
    return () => {
      b.position = prev.position;
      b.top = prev.top;
      b.left = prev.left;
      b.right = prev.right;
      b.width = prev.width;
      b.overflow = prev.overflow;
      window.scrollTo(0, y);
    };
  }, []);

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadPhoto = async (file: File): Promise<string> => {
    const token = localStorage.getItem(FISHMB_TOKEN_KEY);
    const form = new FormData();
    form.append("file", await compressImage(file, true));
    const upRes = await fetch("/api/fish/photos/upload", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const up = await upRes.json().catch(() => ({}));
    if (!upRes.ok) throw new Error(up.error || "Photo upload failed.");
    return up.url as string;
  };

  const pickVideo = async (file: File) => {
    setErr(null);
    // 60-second cap, checked on-device before uploading.
    const duration = await new Promise<number>((resolve) => {
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(v.duration || 0);
      };
      v.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(0);
      };
      v.src = url;
    });
    if (duration > 65) {
      setVideo({ phase: "error", message: "Videos are capped at 60 seconds — trim it and try again." });
      return;
    }
    setVideo({ phase: "uploading", progress: 0 });
    try {
      const { upload_id, upload_url } = (await fishFetch("/api/fish/video/upload-url", {
        method: "POST",
      })) as { upload_id: string; upload_url: string };
      const payload = await file.arrayBuffer();
      if (!payload.byteLength) throw new Error("That video file looks empty.");
      let sentBytes = 0;
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", upload_url);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            sentBytes = e.loaded;
            setVideo({ phase: "uploading", progress: e.loaded / e.total });
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            if (sentBytes > 0 && sentBytes < payload.byteLength * 0.99) {
              reject(new Error("Video upload was cut off — try again on Wi-Fi."));
              return;
            }
            resolve();
          } else {
            reject(new Error(`Video upload failed (network ${xhr.status}).`));
          }
        };
        xhr.onerror = () => reject(new Error("Video upload failed — check your connection."));
        xhr.timeout = 10 * 60 * 1000;
        xhr.send(payload);
      });
      setVideo({ phase: "processing" });
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const s = (await fishFetch(
          `/api/fish/video/status?upload_id=${encodeURIComponent(upload_id)}`
        )) as { status: string; playback_id?: string; duration?: number | null; error?: string };
        if (s.status === "ready" && s.playback_id) {
          setVideo({ phase: "ready", playback_id: s.playback_id, duration: s.duration ?? null });
          return;
        }
        if (s.status === "errored") {
          throw new Error("The video arrived damaged and couldn't be processed. Try again.");
        }
      }
      throw new Error("Video is taking too long — try again.");
    } catch (e) {
      setVideo({
        phase: "error",
        message: e instanceof Error ? e.message : "Video upload failed.",
      });
    }
  };

  const videoBusy = video.phase === "uploading" || video.phase === "processing";

  const submit = async () => {
    if (submitting || videoBusy) return;
    setSubmitting(true);
    setErr(null);
    try {
      const urls: string[] = [];
      for (const f of photoFiles) urls.push(await uploadPhoto(f));
      await fishFetch(`/api/fishmb/spots/${spot.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption: caption.trim(),
          photos: urls,
          video:
            video.phase === "ready"
              ? { playback_id: video.playback_id, duration: video.duration }
              : null,
        }),
      });
      onShared();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not share the spot.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1300] flex items-end justify-center">
      <div className="absolute inset-0 bg-pine-deep/60" onClick={onClose} />
      <div
        style={dragStyle}
        className="relative bg-white w-full sm:max-w-lg rounded-t-3xl max-h-[88vh] overflow-y-auto overscroll-contain px-5 pb-32 pt-3"
      >
        <div className="touch-none cursor-grab" {...dragHandlers}>
          <SheetGrabber onClose={onClose} />
        </div>
        <h3 className="font-display font-bold uppercase text-pine text-xl tracking-wide mt-2">
          Share spot to feed
        </h3>
        <p className="text-sm text-pine/60 mt-1">
          📍 {spot.name} — shared with your friends. They'll see its location.
        </p>

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Say something about this spot…"
          className="w-full mt-4 bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-sm placeholder:text-pine/40 focus:outline-none focus:border-signal"
        />

        {previews.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {previews.map((p, i) => (
              <span key={p} className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt="" className="w-16 h-16 rounded-xl object-cover" />
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => {
                    URL.revokeObjectURL(p);
                    setPreviews(previews.filter((_, j) => j !== i));
                    setPhotoFiles(photoFiles.filter((_, j) => j !== i));
                  }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-pine text-white text-[11px] leading-none flex items-center justify-center"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <label className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white bg-pine hover:bg-pine-deep px-3.5 py-2.5 rounded-full cursor-pointer transition-colors">
            📷 Photos{photoFiles.length > 0 ? ` (${photoFiles.length}/4)` : ""}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []).slice(0, 4 - photoFiles.length);
                if (picked.length) {
                  setPhotoFiles([...photoFiles, ...picked].slice(0, 4));
                  setPreviews([...previews, ...picked.map((f) => URL.createObjectURL(f))].slice(0, 4));
                }
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => videoRef.current?.click()}
            disabled={videoBusy || video.phase === "ready"}
            className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white bg-pine hover:bg-pine-deep px-3.5 py-2.5 rounded-full transition-colors disabled:opacity-40"
          >
            🎬 Video
          </button>
          <input
            ref={videoRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pickVideo(f);
              e.target.value = "";
            }}
          />
        </div>

        {video.phase !== "idle" && (
          <div className="mt-3 text-sm">
            {video.phase === "uploading" && (
              <p className="text-pine/60 font-semibold">
                Uploading video… {Math.round(video.progress * 100)}%
              </p>
            )}
            {video.phase === "processing" && (
              <p className="text-pine/60 font-semibold">Processing video…</p>
            )}
            {video.phase === "ready" && (
              <p className="text-pine font-semibold">
                ✓ Video attached{" "}
                <button
                  type="button"
                  onClick={() => setVideo({ phase: "idle" })}
                  className="text-signal-dark font-bold uppercase tracking-wider text-xs ml-1"
                >
                  Remove
                </button>
              </p>
            )}
            {video.phase === "error" && (
              <p className="text-red-600 font-semibold">
                {video.message}{" "}
                <button
                  type="button"
                  onClick={() => setVideo({ phase: "idle" })}
                  className="text-signal-dark font-bold uppercase tracking-wider text-xs ml-1"
                >
                  Dismiss
                </button>
              </p>
            )}
          </div>
        )}

        {err && <p className="text-sm text-red-600 font-semibold mt-3">{err}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={submitting || videoBusy}
          className="w-full mt-5 bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-3.5 rounded-full disabled:opacity-40 transition-colors"
        >
          {submitting ? "Sharing…" : videoBusy ? "Waiting for video…" : "Submit"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full mt-1 text-pine/60 text-xs font-bold uppercase tracking-wider px-4 py-2.5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
