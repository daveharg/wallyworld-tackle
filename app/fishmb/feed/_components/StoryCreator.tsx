// Full-screen story creator — Facebook-style.
// Grid of saved draft photos/videos with plus boxes, multi-select to make a
// reel, then text overlay options before posting.

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fishFetch } from "../../_components/fishFetch";
import { compressImage } from "../../_components/compressImage";
import { FISHMB_TOKEN_KEY } from "@/lib/fishmb-constants";

interface Draft {
  id: string;
  media_url: string;
  media_type: string;
  duration?: number | null;
  created_at: string;
}

interface TextOverlay {
  text: string;
  x: number;
  y: number;
  font: string;
  color: string;
  bg: string;
  size: number;
  clipIds: string[];
}

const FONTS = [
  { id: "bold", label: "Bold", style: { fontWeight: 800 } },
  { id: "elegant", label: "Elegant", style: { fontFamily: "Georgia, serif", fontStyle: "italic" } },
  { id: "mono", label: "Mono", style: { fontFamily: "monospace", fontWeight: 700 } },
  { id: "playful", label: "Playful", style: { fontFamily: "cursive", fontWeight: 700 } },
  { id: "outline", label: "Outline", style: { fontWeight: 900, WebkitTextStroke: "1px currentColor", color: "transparent" } },
  { id: "neon", label: "Neon", style: { fontWeight: 800, textShadow: "0 0 12px currentColor" } },
];

const COLORS = ["#ffffff", "#000000", "#ff3b5c", "#ff9500", "#ffd60a", "#34c759", "#0a84ff", "#bf5af2", "#64d2ff", "#ff6482"];

const BACKGROUNDS = [
  { id: "none", label: "None", value: "transparent" },
  { id: "black", label: "Black", value: "rgba(0,0,0,0.7)" },
  { id: "white", label: "White", value: "rgba(255,255,255,0.9)" },
  { id: "signal", label: "Red", value: "#ff3b5c" },
  { id: "pine", label: "Green", value: "#1d4d2b" },
  { id: "gold", label: "Gold", value: "#c9a227" },
];

export default function StoryCreator({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [step, setStep] = useState<"pick" | "edit">("pick");
  const [overlays, setOverlays] = useState<TextOverlay[]>([]);
  const [editingOverlay, setEditingOverlay] = useState<TextOverlay | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [textSheetOpen, setTextSheetOpen] = useState(false);
  // The visible viewport box (visualViewport). The text sheet lives inside a
  // wrapper pinned to exactly this box, so when the iOS keyboard opens and
  // the browser pans/shrinks the visible area, the sheet rides with it —
  // no offset math that can overshoot and push the input off-screen.
  const [vvBox, setVvBox] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    if (!textSheetOpen) {
      setVvBox(null);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setVvBox({ top: vv.offsetTop, height: vv.height });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [textSheetOpen]);
  // Lock background scrolling while the text sheet is open — otherwise touch
  // scrolls bleed through and the creator/feed behind tries to scroll.
  useEffect(() => {
    if (!textSheetOpen) return;
    const prevOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [textSheetOpen]);
  const [overlayText, setOverlayText] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  // Reel state — ordered clips, active clip for preview, per-clip zoom/volume.
  const [clipOrder, setClipOrder] = useState<string[]>([]);
  const [activeClip, setActiveClip] = useState(0);
  const [clipZooms, setClipZooms] = useState<Record<string, number>>({});
  const [clipVolumes, setClipVolumes] = useState<Record<string, number>>({});
  const [expiresHours, setExpiresHours] = useState(24);
  // Reel posting is parked for now (Dave, 2026-10-12) — everything posts as a story.
  const previewRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Web Audio for real volume control on iOS (iOS Safari ignores video.volume).
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const routedVideoRef = useRef<HTMLVideoElement | null>(null);

  // Set up Web Audio routing for the active video so the slider changes the
  // ACTUAL audible volume on iOS. NOTE: the <video> must carry
  // crossOrigin="anonymous" — without it, cross-origin (Mux) media routes
  // as silence through createMediaElementSource.
  const ensureAudioRouting = (volume: number) => {
    const vid = videoRef.current;
    if (!vid) return;
    if (routedVideoRef.current === vid) {
      // Already routed (React reuses the same <video> node across clips) —
      // just sync the gain to this clip's volume.
      if (gainNodeRef.current && audioCtxRef.current) {
        gainNodeRef.current.gain.setTargetAtTime(volume, audioCtxRef.current.currentTime, 0.01);
      }
      return;
    }
    try {
      if (!audioCtxRef.current) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AC();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      try {
        sourceNodeRef.current?.disconnect();
      } catch { /* noop */ }
      try {
        gainNodeRef.current?.disconnect();
      } catch { /* noop */ }
      // createMediaElementSource throws if this element was already routed —
      // routedVideoRef guards that, but a remount can theoretically beat it.
      sourceNodeRef.current = ctx.createMediaElementSource(vid);
      gainNodeRef.current = ctx.createGain();
      sourceNodeRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(ctx.destination);
      gainNodeRef.current.gain.value = volume;
      routedVideoRef.current = vid;
    } catch {
      // Web Audio unavailable — fall back to video.volume.
    }
  };

  const clips = clipOrder
    .map((id) => drafts.find((d) => d.id === id))
    .filter((d): d is Draft => Boolean(d));
  const activeDraft = clips[activeClip] ?? null;
  const activeZoom = activeDraft ? (clipZooms[activeDraft.id] ?? 1) : 1;
  const setActiveZoom = (z: number) => {
    if (!activeDraft) return;
    setClipZooms((m) => ({ ...m, [activeDraft.id]: z }));
  };
  // Sync the gain when switching clips (the same <video> node is reused).
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (activeDraft?.media_type === "video") {
        ensureAudioRouting(clipVolumes[activeDraft.id] ?? 0.5);
      }
    }, 100);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClip]);
  const activeVolume = activeDraft ? (clipVolumes[activeDraft.id] ?? 0.5) : 0.5;
  const setActiveVolume = (v: number) => {
    if (!activeDraft) return;
    setClipVolumes((m) => ({ ...m, [activeDraft.id]: v }));
    const vid = videoRef.current;
    if (vid) {
      // Route through Web Audio FIRST so the slider changes the actual
      // audible volume on iOS, then unmute and keep it playing so the
      // change is heard live.
      ensureAudioRouting(v);
      vid.muted = false;
      vid.volume = v; // fallback for browsers without Web Audio routing
      vid.play().catch(() => {});
    }
  };

  // Drag a text overlay around the preview with pointer events.
  // A tap (no drag) opens the overlay for editing.
  const tapRef = useRef<{ x: number; y: number; idx: number } | null>(null);
  const onOverlayPointerDown = (e: React.PointerEvent, i: number) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragIdx(i);
    tapRef.current = { x: e.clientX, y: e.clientY, idx: i };
  };

  const onOverlayPointerUp = (e: React.PointerEvent) => {
    const tap = tapRef.current;
    tapRef.current = null;
    if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 8) {
      // It was a tap, not a drag — load this overlay into the editor.
      const o = overlays[tap.idx];
      if (o) {
        setOverlayText(o.text);
        setEditingOverlay(o);
        setEditingIdx(tap.idx);
        setTextSheetOpen(true);
        // Focus the text input so the keyboard opens.
        setTimeout(() => textInputRef.current?.focus(), 100);
      }
    }
  };

  const onPreviewPointerMove = (e: React.PointerEvent) => {
    if (dragIdx === null) return;
    const el = previewRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(95, Math.max(5, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(95, Math.max(5, ((e.clientY - rect.top) / rect.height) * 100));
    setOverlays((list) => list.map((o, idx) => (idx === dragIdx ? { ...o, x, y } : o)));
  };

  const endDrag = () => setDragIdx(null);

  // Photo zoom — scale the media to fill the story box (per clip).
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);

  const onPreviewTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { dist: Math.hypot(dx, dy), zoom: activeZoom };
    }
  };

  const onPreviewTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (dist > 0) {
        const next = Math.min(3, Math.max(0.5, pinchRef.current.zoom * (dist / pinchRef.current.dist)));
        setActiveZoom(next);
      }
    }
  };

  const onPreviewTouchEnd = () => {
    pinchRef.current = null;
  };

  // Timeline drag-to-reorder.
  const [timelineDrag, setTimelineDrag] = useState<number | null>(null);

  const onTimelinePointerDown = (e: React.PointerEvent, idx: number) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setTimelineDrag(idx);
  };

  const onTimelinePointerMove = (e: React.PointerEvent) => {
    if (timelineDrag === null) return;
    const el = timelineRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const thumbW = 72; // thumbnail width + gap
    const target = Math.max(0, Math.min(clips.length - 1, Math.floor((e.clientX - rect.left + el.scrollLeft) / thumbW)));
    if (target !== timelineDrag) {
      setClipOrder((order) => {
        const next = [...order];
        const [moved] = next.splice(timelineDrag, 1);
        next.splice(target, 0, moved);
        return next;
      });
      setActiveClip((a) => {
        if (a === timelineDrag) return target;
        if (timelineDrag < a && target >= a) return a - 1;
        if (timelineDrag > a && target <= a) return a + 1;
        return a;
      });
      setTimelineDrag(target);
    }
  };

  const endTimelineDrag = () => setTimelineDrag(null);

  const toggleOverlayClip = (overlayIdx: number, clipId: string) => {
    setOverlays((list) =>
      list.map((o, i) =>
        i === overlayIdx
          ? { ...o, clipIds: o.clipIds.includes(clipId) ? o.clipIds.filter((c) => c !== clipId) : [...o.clipIds, clipId] }
          : o
      )
    );
  };



  const uploadDraft = async (file: File) => {
    setUploading(true);
    setNote(null);
    try {
      const isVideo = file.type.startsWith("video/");
      let mediaUrl: string;
      let videoDuration: number | null = null;
      if (isVideo) {
        // Videos go through Mux direct upload (the photo endpoint rejects them).
        const { upload_id, upload_url } = (await fishFetch("/api/fish/video/upload-url", {
          method: "POST",
        })) as { upload_id: string; upload_url: string };
        let payload: ArrayBuffer;
        try {
          payload = await file.arrayBuffer();
        } catch {
          throw new Error("Couldn't read that video file — try saving it to the Files app first, then upload it.");
        }
        if (!payload.byteLength) {
          throw new Error("That video file looks empty — try saving it to the Files app first, then upload it.");
        }
        let sentBytes = 0;
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", upload_url);
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) sentBytes = e.loaded;
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
          xhr.onerror = () => reject(new Error("Video upload failed — check your connection and try again."));
          xhr.onabort = () => reject(new Error("Video upload was interrupted — try again."));
          xhr.ontimeout = () => reject(new Error("Video upload timed out — try again on Wi-Fi."));
          xhr.timeout = 10 * 60 * 1000;
          xhr.send(payload);
        });
        // Poll Mux until the video is converted and playable.
        let playbackId: string | null = null;
        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, 5000));
          const s = (await fishFetch(
            `/api/fish/video/status?upload_id=${encodeURIComponent(upload_id)}`
          )) as { status: string; playback_id?: string; duration?: number | null; error?: string };
          if (s.status === "ready" && s.playback_id) {
            playbackId = s.playback_id;
            videoDuration = s.duration ?? null;
            break;
          }
          if (s.status === "errored")
            throw new Error(
              s.error
                ? `The video arrived damaged (${s.error}). Try again.`
                : "The video arrived damaged and couldn't be processed. Try again."
            );
        }
        if (!playbackId) throw new Error("Video is taking too long — try again.");
        mediaUrl = `https://stream.mux.com/${playbackId}.m3u8`;
      } else {
        const token = localStorage.getItem(FISHMB_TOKEN_KEY);
        const form = new FormData();
        form.append("file", await compressImage(file, true));
        const upRes = await fetch("/api/fish/photos/upload", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        });
        const up = await upRes.json();
        if (!upRes.ok) throw new Error(up.error || "Upload failed.");
        mediaUrl = up.url;
      }
      return {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `clip-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        media_url: mediaUrl,
        media_type: isVideo ? "video" : "photo",
        duration: isVideo ? videoDuration : null,
        created_at: new Date().toISOString(),
      } as Draft;
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not upload.");
      return null;
    } finally {
      setUploading(false);
    }
  };

  /** One pick, straight to the editor: upload everything chosen and
   *  make it the story being edited. Nothing is saved as a draft. */
  const addFiles = async (files: File[]) => {
    const picked: Draft[] = [];
    for (const f of files) {
      const clip = await uploadDraft(f);
      if (clip) picked.push(clip);
    }
    if (picked.length === 0) return;
    setDrafts(picked);
    setClipOrder(picked.map((d) => d.id));
    setActiveClip(0);
    setOverlays([]);
    setClipZooms({});
    setClipVolumes({});
    setStep("edit");
  };





  const addOverlay = () => {
    if (!overlayText.trim() || !activeDraft) {
      setTextSheetOpen(false);
      setEditingIdx(null);
      setEditingOverlay(null);
      setOverlayText("");
      return;
    }
    if (editingIdx !== null) {
      // Update the existing overlay being edited.
      const idx = editingIdx;
      setOverlays((list) =>
        list.map((o, i) =>
          i === idx
            ? {
                ...o,
                text: overlayText.trim(),
                font: editingOverlay?.font ?? o.font,
                color: editingOverlay?.color ?? o.color,
                bg: editingOverlay?.bg ?? o.bg,
                size: editingOverlay?.size ?? o.size,
              }
            : o
        )
      );
      setEditingIdx(null);
    } else {
      setOverlays((list) => [
        ...list,
        {
          text: overlayText.trim(),
          x: 50,
          y: 30 + list.length * 12,
          font: editingOverlay?.font ?? "bold",
          color: editingOverlay?.color ?? "#ffffff",
          bg: editingOverlay?.bg ?? "transparent",
          size: editingOverlay?.size ?? 28,
          clipIds: [activeDraft.id],
        },
      ]);
    }
    setOverlayText("");
    setEditingOverlay(null);
    setTextSheetOpen(false);
  };

  const cancelOverlayEdit = () => {
    setEditingIdx(null);
    setEditingOverlay(null);
    setOverlayText("");
    setTextSheetOpen(false);
  };

  const postStories = async () => {
    setPosting(true);
    setNote(null);
    try {
      for (const d of clips) {
        const clipOverlays = overlays
          .filter((o) => o.clipIds.includes(d.id))
          .map(({ clipIds, ...rest }) => rest);
        await fishFetch("/api/fishmb/stories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            media_url: d.media_url,
            media_type: d.media_type,
            overlays: clipOverlays,
            zoom: clipZooms[d.id] ?? 1,
            volume: d.media_type === "video" ? (clipVolumes[d.id] ?? 0.5) : null,
            expires_hours: expiresHours,
            is_reel: false,
          }),
        });
      }
      onCreated();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not post stories.");
    } finally {
      setPosting(false);
    }
  };

  const fontStyle = (f: string) => FONTS.find((x) => x.id === f)?.style ?? {};

  return (
    <div className="fixed inset-0 z-[1400] bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-pine/10">
        <button onClick={onClose} aria-label="Close" className="text-3xl text-pine leading-none">×</button>
        <h2 className="font-bold text-pine text-lg">Create story</h2>
              </div>

      {step === "pick" ? (
        <>
          {/* One picker for everything — photos and videos, as many as you
              want at once, then straight into the editor. Nothing is saved. */}
          <div className="px-4 py-3">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full py-3.5 rounded-full bg-signal text-white text-sm font-bold uppercase tracking-wider disabled:opacity-50"
            >
              {uploading ? "Adding…" : "＋ Add photos & videos"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) void addFiles(files);
                e.target.value = "";
              }}
            />
            <p className="text-center text-pine/40 text-xs mt-2">
              Pick as many as you want at once — you'll go straight into the editor. Nothing is saved here.
            </p>
          </div>

          {note && <p className="px-4 py-2 text-sm text-amber-700 bg-amber-50">{note}</p>}

          {/* Loading overlay while a video/photo uploads */}
          {uploading && (
            <div className="mx-4 mb-3 bg-pine/5 border border-pine/10 rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-pine/20 border-t-signal rounded-full animate-spin shrink-0" />
              <p className="text-sm font-bold text-pine/70">Adding your photos & videos… this can take a moment</p>
            </div>
          )}

          </>
      ) : (
        <>
          {/* Edit step — reel editor */}
          <div
            className="flex-1 overflow-y-auto"
            onClick={(e) => {
              // Tap anywhere outside text editing controls — save and exit editing.
              if (editingIdx !== null || textSheetOpen) {
                const t = e.target as HTMLElement;
                const inEditControls = t.closest("[data-edit-controls]");
                const inTextOverlay = t.closest("[data-text-overlay]");
                const inSlider = t.closest('input[type="range"]');
                if (!inEditControls && !inTextOverlay && !inSlider) {
                  addOverlay();
                }
              }
            }}
          >
            {/* Preview — active clip */}
            <div
              ref={previewRef}
              className="relative bg-black aspect-[9/16] max-h-[42vh] mx-auto touch-none select-none overflow-hidden"
              onPointerMove={onPreviewPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onTouchStart={onPreviewTouchStart}
              onTouchMove={onPreviewTouchMove}
              onTouchEnd={onPreviewTouchEnd}
            >
              {activeDraft && (
                <div
                  className="absolute inset-0"
                  style={{ transform: `scale(${activeZoom})`, transformOrigin: "center" }}
                >
                  {activeDraft.media_type === "video" ? (
                    <video
                      ref={videoRef}
                      src={activeDraft.media_url}
                      crossOrigin="anonymous"
                      className="w-full h-full object-contain"
                      playsInline
                      loop
                      autoPlay
                      muted
                      onLoadedMetadata={(e) => {
                        // Start muted for autoplay; unmuted when user touches volume.
                        e.currentTarget.volume = activeVolume;
                      }}
                      onPlay={() => {
                        // Set up Web Audio routing when playback starts.
                        ensureAudioRouting(activeVolume);
                      }}
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={activeDraft.media_url} alt="" className="w-full h-full object-contain" />
                  )}
                </div>
              )}
              {/* Clip number badge */}
              {clips.length > 1 && (
                <span className="absolute top-2 left-2 bg-black/60 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                  {activeClip + 1} / {clips.length}
                </span>
              )}
              {/* Text overlays for the active clip */}
              {overlays
                .map((o, i) => ({ o, i }))
                .filter(({ o }) => activeDraft && o.clipIds.includes(activeDraft.id))
                .map(({ o, i }) => {
                // When this overlay is being edited, show live values from the editor.
                const isEditing = editingIdx === i;
                const liveText = isEditing ? overlayText : o.text;
                const liveFont = isEditing ? (editingOverlay?.font ?? o.font) : o.font;
                const liveColor = isEditing ? (editingOverlay?.color ?? o.color) : o.color;
                const liveBg = isEditing ? (editingOverlay?.bg ?? o.bg) : o.bg;
                const liveSize = isEditing ? (editingOverlay?.size ?? o.size) : o.size;
                return (
                <div
                  key={i}
                  data-text-overlay
                  className="absolute cursor-grab active:cursor-grabbing"
                  style={{ left: `${o.x}%`, top: `${o.y}%`, transform: "translate(-50%, -50%)", touchAction: "none" }}
                  onPointerDown={(e) => onOverlayPointerDown(e, i)}
                  onPointerUp={onOverlayPointerUp}
                >
                  <span
                    style={{
                      ...fontStyle(liveFont),
                      color: liveColor,
                      background: liveBg,
                      fontSize: `${liveSize}px`,
                      padding: liveBg !== "transparent" ? "4px 12px" : undefined,
                      borderRadius: liveBg !== "transparent" ? "12px" : undefined,
                      WebkitTextStroke: liveFont === "outline" ? `1.5px ${liveColor}` : undefined,
                      // Highlight box when selected for editing.
                      outline: isEditing ? "2px dashed #e8622c" : undefined,
                      outlineOffset: isEditing ? "4px" : undefined,
                    }}
                    className="whitespace-nowrap"
                  >
                    {liveText}
                  </span>
                  {isEditing && (
                    <button
                      type="button"
                      aria-label="Delete text"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOverlays((list) => list.filter((_, j) => j !== i));
                        setEditingIdx(null);
                        setEditingOverlay(null);
                        setOverlayText("");
                      }}
                      className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-red-500 text-white text-sm font-bold leading-none flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                      style={{ transform: "translate(50%, -50%)" }}
                    >
                      ×
                    </button>
                  )}
                  {isEditing && (
                    <div
                      aria-label="Resize text"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        const startX = e.clientX;
                        const startY = e.clientY;
                        const startSize = editingOverlay?.size ?? o.size ?? 28;
                        const onMove = (ev: PointerEvent) => {
                          const dx = ev.clientX - startX;
                          const dy = ev.clientY - startY;
                          const delta = Math.max(dx, dy);
                          const newSize = Math.min(96, Math.max(12, Math.round(startSize + delta * 0.3)));
                          setEditingOverlay((prev) => ({ ...(prev ?? { text: "", x: 50, y: 50, font: "bold", color: "#ffffff", bg: "transparent", clipIds: [] }), size: newSize }));
                        };
                        const onUp = () => {
                          window.removeEventListener("pointermove", onMove);
                          window.removeEventListener("pointerup", onUp);
                        };
                        window.addEventListener("pointermove", onMove);
                        window.addEventListener("pointerup", onUp);
                      }}
                      className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-[#e8622c] text-white flex items-center justify-center shadow-lg cursor-nwse-resize active:scale-90 transition-transform"
                      style={{ transform: "translate(50%, 50%)", touchAction: "none" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 3L3 9M9 9H3V3" />
                      </svg>
                    </div>
                  )}
                </div>
                );
                })}
            </div>

            {/* Timeline — drag to reorder clips */}
            {clips.length > 1 && (
              <div className="px-4 pt-3">
                <p className="text-xs font-bold uppercase tracking-wider text-pine/50 mb-2">
                  Timeline — drag to reorder
                </p>
                <div
                  ref={timelineRef}
                  className="flex gap-2 overflow-x-auto pb-2 touch-none select-none"
                  style={{ scrollbarWidth: "none" }}
                  onPointerMove={onTimelinePointerMove}
                  onPointerUp={endTimelineDrag}
                  onPointerCancel={endTimelineDrag}
                >
                  {clips.map((d, idx) => {
                    const hasText = overlays.some((o) => o.clipIds.includes(d.id));
                    return (
                      <div
                        key={d.id}
                        onPointerDown={(e) => onTimelinePointerDown(e, idx)}
                        onClick={() => setActiveClip(idx)}
                        className={`relative shrink-0 w-16 h-24 rounded-xl overflow-hidden border-2 cursor-grab active:cursor-grabbing ${
                          idx === activeClip ? "border-signal" : "border-transparent"
                        } ${timelineDrag === idx ? "opacity-60 scale-105" : ""}`}
                      >
                        {d.media_type === "video" ? (
                          <video src={d.media_url} className="w-full h-full object-cover pointer-events-none" muted playsInline />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={d.media_url} alt="" className="w-full h-full object-cover pointer-events-none" draggable={false} />
                        )}
                        <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] font-bold px-1.5 rounded">
                          {idx + 1}
                        </span>
                        {d.media_type === "video" && (
                          <span className="absolute top-1 right-1 bg-black/60 text-white text-[10px] px-1 rounded">▶</span>
                        )}
                        {hasText && (
                          <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-bold px-1.5 rounded">
                            Aa
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add text button */}
            {!textSheetOpen && editingIdx === null && (
              <div className="px-4 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setOverlayText("");
                    setEditingOverlay(null);
                    setEditingIdx(null);
                    setTextSheetOpen(true);
                    setTimeout(() => textInputRef.current?.focus(), 100);
                  }}
                  className="w-full py-3 rounded-full bg-pine text-white font-bold text-sm"
                >
                  + Add text
                </button>
              </div>
            )}

            {/* Zoom control — hidden when editing text */}
            {editingIdx === null && (
            <div className="px-4 pt-2 pb-2 flex items-center gap-3">
              <span className="text-pine/60 text-lg leading-none">−</span>
              <input
                type="range"
                min={0.5}
                max={3}
                step={0.05}
                value={activeZoom}
                onChange={(e) => setActiveZoom(parseFloat(e.target.value))}
                className="flex-1 accent-[#e8622c]"
                aria-label="Photo zoom"
              />
              <span className="text-pine/60 text-lg leading-none">＋</span>
              <button
                onClick={() => setActiveZoom(0.5)}
                className="text-xs font-bold uppercase tracking-wider text-pine/50"
              >
                Fit
              </button>
              {activeZoom !== 1 && (
                <button
                  onClick={() => setActiveZoom(1)}
                  className="text-xs font-bold uppercase tracking-wider text-pine/50"
                >
                  Reset
                </button>
              )}
            </div>
            )}

            {/* Text size hint — drag the orange corner handle to resize */}

            {/* Volume control — videos only, hidden when editing text */}
            {activeDraft?.media_type === "video" && editingIdx === null && (
              <div className="px-4 pt-1 pb-2 flex items-center gap-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-pine/60 shrink-0">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                </svg>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={activeVolume}
                  onChange={(e) => setActiveVolume(parseFloat(e.target.value))}
                  className="flex-1 accent-[#e8622c]"
                  aria-label="Video volume"
                />
                <span className="text-xs font-bold text-pine/50 w-10 text-right">
                  {Math.round(activeVolume * 100)}%
                </span>
              </div>
            )}

            {/* Text editor — bottom sheet rendered via portal so it escapes
                the scroll container (fixed positioning breaks inside it on
                iOS). The wrapper is pinned to the visual viewport so the
                sheet docks exactly at the visible bottom, above the keyboard. */}
            {textSheetOpen && typeof document !== "undefined" && createPortal(
            <div
              className="fixed z-[1500] left-0 right-0 pointer-events-none"
              style={{ top: vvBox?.top ?? 0, height: vvBox?.height ?? "100dvh" }}
            >
            <div
              className="absolute left-0 right-0 bottom-0 pointer-events-auto bg-white rounded-t-3xl shadow-2xl border-t border-pine/10 p-4 space-y-3 max-h-[92%] min-h-[56%] overflow-y-auto overscroll-contain touch-auto"
              data-edit-controls
            >
              <div className="flex gap-2">
                <input
                  ref={textInputRef}
                  value={overlayText}
                  onChange={(e) => setOverlayText(e.target.value)}
                  placeholder={clips.length > 1 ? `Add text to clip ${activeClip + 1}…` : "Add text…"}
                  maxLength={100}
                  className="flex-1 bg-pine/5 border border-pine/15 rounded-full px-4 py-3 text-pine text-sm placeholder:text-pine/40 focus:outline-none focus:border-signal"
                />
                <button
                  onClick={addOverlay}
                  disabled={!overlayText.trim()}
                  className="px-5 rounded-full bg-pine text-white font-bold text-sm disabled:opacity-40"
                >
                  {editingIdx !== null ? "Save" : "Add"}
                </button>
                {editingIdx !== null && (
                  <button
                    onClick={cancelOverlayEdit}
                    className="px-4 rounded-full bg-pine/10 text-pine font-bold text-sm"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {/* Font styles */}
              {true && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-pine/50 mb-2">Style</p>
                <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                  {FONTS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setEditingOverlay((o) => ({ ...(o ?? { text: "", x: 50, y: 50, color: "#ffffff", bg: "transparent", size: 28, clipIds: [] }), font: f.id }))}
                      className={`shrink-0 px-4 py-2.5 rounded-2xl border-2 text-sm ${
                        (editingOverlay?.font ?? "bold") === f.id ? "border-signal bg-signal/10" : "border-pine/10"
                      }`}
                      style={f.style}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              )}

              {/* Colors */}
              {true && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-pine/50 mb-2">Color</p>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setEditingOverlay((o) => ({ ...(o ?? { text: "", x: 50, y: 50, font: "bold", bg: "transparent", size: 28, clipIds: [] }), color: c }))}
                      className={`w-9 h-9 rounded-full border-2 ${(editingOverlay?.color ?? "#ffffff") === c ? "border-signal" : "border-pine/15"}`}
                      style={{ background: c }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
              </div>
              )}

              {/* Backgrounds */}
              {true && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-pine/50 mb-2">Background</p>
                <div className="flex gap-2 flex-wrap">
                  {BACKGROUNDS.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setEditingOverlay((o) => ({ ...(o ?? { text: "", x: 50, y: 50, font: "bold", color: "#ffffff", size: 28, clipIds: [] }), bg: b.value }))}
                      className={`px-4 py-2 rounded-full text-xs font-bold border-2 ${
                        (editingOverlay?.bg ?? "transparent") === b.value ? "border-signal" : "border-pine/15"
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
              )}
            </div>
            </div>, document.body)}

              {/* Current overlays — tap clips to choose when text shows */}
              {overlays.length > 0 && (
                <div className="px-4 pb-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-pine/50 mb-2">
                    Text ({overlays.length}) — tap clips to set when it shows
                  </p>
                  <div className="space-y-2">
                    {overlays.map((o, i) => (
                      <div key={i} className="bg-pine/5 rounded-xl px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="flex-1 text-sm text-pine truncate" style={fontStyle(o.font)}>{o.text}</span>
                          <button
                            onClick={() => setOverlays((list) => list.filter((_, j) => j !== i))}
                            className="text-red-500 font-bold"
                            aria-label="Remove text"
                          >
                            ×
                          </button>
                        </div>
                        {clips.length > 1 && (
                          <div className="flex gap-1.5 mt-2 flex-wrap">
                            {clips.map((d, idx) => (
                              <button
                                key={d.id}
                                onClick={() => toggleOverlayClip(i, d.id)}
                                className={`w-7 h-7 rounded-lg text-[11px] font-bold ${
                                  o.clipIds.includes(d.id)
                                    ? "bg-signal text-white"
                                    : "bg-pine/10 text-pine/50"
                                }`}
                                aria-label={`Show on clip ${idx + 1}`}
                              >
                                {idx + 1}
                              </button>
                            ))}
                            <button
                              onClick={() =>
                                setOverlays((list) =>
                                  list.map((ov, j) =>
                                    j === i ? { ...ov, clipIds: clips.map((d) => d.id) } : ov
                                  )
                                )
                              }
                              className="px-2.5 h-7 rounded-lg text-[11px] font-bold bg-pine/10 text-pine/60"
                            >
                              All
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>

          {/* Bottom bar */}
          <div className="px-4 pt-3 border-t border-pine/10">
            <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-pine/50 shrink-0">
                  Visible for
                </span>
                <div className="flex gap-1.5 flex-wrap">
                  {[6, 12, 24, 48, 72, 168].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setExpiresHours(h)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                        expiresHours === h
                          ? "bg-pine text-white"
                          : "bg-pine/10 text-pine/60 hover:bg-pine/15"
                      }`}
                    >
                      {h >= 168 ? "1 week" : `${h}h`}
                    </button>
                  ))}
                </div>
              </div>
            <div className="flex gap-2 pb-4">
              <button
                onClick={() => setStep("pick")}
                className="px-6 py-4 rounded-full border border-pine/20 text-pine font-bold text-sm uppercase"
              >
                Back
              </button>
              <button
                onClick={postStories}
                disabled={posting}
                className="flex-1 py-4 rounded-full bg-signal text-white font-bold uppercase tracking-wider disabled:opacity-50"
              >
                {posting ? "Posting…" : "Post story"}
              </button>
            </div>
          </div>
          {note && <p className="px-4 pb-2 text-sm text-red-600 text-center">{note}</p>}
        </>
      )}
    </div>
  );
}
