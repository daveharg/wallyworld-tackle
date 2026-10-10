// Full-screen story creator — Facebook-style.
// Grid of saved draft photos/videos with plus boxes, multi-select to make a
// reel, then text overlay options before posting.

"use client";

import { useEffect, useRef, useState } from "react";
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [step, setStep] = useState<"pick" | "edit">("pick");
  const [overlays, setOverlays] = useState<TextOverlay[]>([]);
  const [editingOverlay, setEditingOverlay] = useState<TextOverlay | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [overlayText, setOverlayText] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  // Reel state — ordered clips, active clip for preview, per-clip zoom/volume.
  const [clipOrder, setClipOrder] = useState<string[]>([]);
  const [activeClip, setActiveClip] = useState(0);
  const [clipZooms, setClipZooms] = useState<Record<string, number>>({});
  const [clipVolumes, setClipVolumes] = useState<Record<string, number>>({});
  const previewRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Web Audio for real volume control on iOS (iOS Safari ignores video.volume).
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Set up Web Audio routing for the active video so the volume slider works on iOS.
  const ensureAudioRouting = () => {
    const vid = videoRef.current;
    if (!vid) return;
    try {
      if (!audioCtxRef.current) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AC();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      // Create source node once per video element.
      if (!sourceNodeRef.current || (sourceNodeRef.current as unknown as { mediaElement?: HTMLVideoElement }).mediaElement !== vid) {
        try {
          sourceNodeRef.current?.disconnect();
        } catch { /* noop */ }
        sourceNodeRef.current = ctx.createMediaElementSource(vid);
        gainNodeRef.current = ctx.createGain();
        sourceNodeRef.current.connect(gainNodeRef.current);
        gainNodeRef.current.connect(ctx.destination);
        gainNodeRef.current.gain.value = activeVolume;
      }
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
  // Reset audio routing when switching clips (new video element).
  useEffect(() => {
    sourceNodeRef.current = null;
    gainNodeRef.current = null;
    // Set up routing for the new video once it's in the DOM.
    const t = window.setTimeout(() => {
      if (activeDraft?.media_type === "video") ensureAudioRouting();
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
      vid.muted = false;
      vid.volume = v;
      // Route through Web Audio so the slider actually changes volume on iOS.
      ensureAudioRouting();
      if (gainNodeRef.current && audioCtxRef.current) {
        gainNodeRef.current.gain.setTargetAtTime(v, audioCtxRef.current.currentTime, 0.01);
      }
      // Ensure it's playing so the user hears the change.
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

  const loadDrafts = async () => {
    try {
      const d = await fishFetch("/api/fishmb/story-drafts");
      setDrafts(((d as { drafts?: Draft[] }).drafts ?? []) as Draft[]);
    } catch {
      // Drafts stay empty.
    }
  };

  useEffect(() => {
    loadDrafts();
  }, []);

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
        form.append("file", await compressImage(file));
        const upRes = await fetch("/api/fish/photos/upload", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        });
        const up = await upRes.json();
        if (!upRes.ok) throw new Error(up.error || "Upload failed.");
        mediaUrl = up.url;
      }
      await fishFetch("/api/fishmb/story-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_url: mediaUrl,
          media_type: isVideo ? "video" : "photo",
          duration: isVideo ? videoDuration : null,
        }),
      });
      await loadDrafts();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not upload.");
    } finally {
      setUploading(false);
    }
  };

  const deleteDraft = async (id: string) => {
    try {
      await fishFetch(`/api/fishmb/story-drafts?id=${id}`, { method: "DELETE" });
      setDrafts((list) => list.filter((d) => d.id !== id));
      setSelected((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    } catch {
      // Best effort.
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedDrafts = drafts.filter((d) => selected.has(d.id));

  const startEdit = () => {
    if (selectedDrafts.length === 0) {
      setNote("Pick at least one photo or video first.");
      return;
    }
    // Preserve selection order as the reel timeline.
    setClipOrder(drafts.filter((d) => selected.has(d.id)).map((d) => d.id));
    setActiveClip(0);
    setStep("edit");
  };

  const addOverlay = () => {
    if (!overlayText.trim() || !activeDraft) return;
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
  };

  const cancelOverlayEdit = () => {
    setEditingIdx(null);
    setEditingOverlay(null);
    setOverlayText("");
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
        <div className="flex gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            aria-label="Take photo"
            className="text-pine/70 text-2xl"
          >
            
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadDraft(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {step === "pick" ? (
        <>
          {/* Camera roll bar */}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="font-bold text-pine/60">Camera roll ▾</span>
            <button
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*,video/*";
                input.onchange = () => {
                  const f = input.files?.[0];
                  if (f) void uploadDraft(f);
                };
                input.click();
              }}
              disabled={uploading}
              className="px-4 py-2 rounded-full text-sm font-bold bg-pine/10 text-pine disabled:opacity-50"
            >
              ＋ Add
            </button>
          </div>

          {note && <p className="px-4 py-2 text-sm text-amber-700 bg-amber-50">{note}</p>}

          {/* Draft grid with plus boxes */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="grid grid-cols-3 gap-1">
              {/* Plus boxes — upload slots */}
              {[0, 1, 2].map((i) => (
                <button
                  key={`plus-${i}`}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*,video/*";
                    input.onchange = () => {
                      const f = input.files?.[0];
                      if (f) void uploadDraft(f);
                    };
                    input.click();
                  }}
                  disabled={uploading}
                  className="aspect-square bg-pine/5 rounded-xl flex items-center justify-center text-4xl text-pine/30 hover:text-pine/50 disabled:opacity-50"
                  aria-label="Add photo or video"
                >
                  {uploading ? "…" : "+"}
                </button>
              ))}
              {/* Saved drafts */}
              {drafts.map((d) => {
                // Videos store a Mux HLS URL; use the Mux thumbnail image for the grid.
                const videoThumb =
                  d.media_type === "video"
                    ? d.media_url.replace("stream.mux.com/", "image.mux.com/").replace(/\.m3u8.*$/, "/thumbnail.jpg")
                    : null;
                return (
                <div key={d.id} className="relative aspect-square">
                  <button
                    onClick={() => toggleSelect(d.id)}
                    className="absolute inset-0 rounded-xl overflow-hidden"
                  >
                    {d.media_type === "video" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={videoThumb ?? ""} alt="" className="w-full h-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.media_url} alt="" className="w-full h-full object-cover" />
                    )}
                    {/* Type icon top-right: camera for photos, film for videos */}
                    <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center">
                      {d.media_type === "video" ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                          <rect x="2" y="4" width="20" height="16" rx="2" />
                          <path d="M7 4v16M17 4v16M2 9h5M2 15h5M17 9h5M17 15h5" />
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                          <circle cx="12" cy="13" r="4" />
                        </svg>
                      )}
                    </span>
                    {/* Video duration bottom-left */}
                    {d.media_type === "video" && d.duration != null && (
                      <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-bold">
                        {Math.floor(d.duration / 60)}:{String(Math.floor(d.duration % 60)).padStart(2, "0")}
                      </span>
                    )}
                    {selected.has(d.id) && (
                      <span className="absolute inset-0 bg-signal/30 flex items-center justify-center">
                        <span className="w-8 h-8 rounded-full bg-signal text-white flex items-center justify-center font-bold">✓</span>
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => deleteDraft(d.id)}
                    aria-label="Remove"
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white text-xs"
                  >
                    ×
                  </button>
                </div>
                );
              })}
            </div>
            {drafts.length === 0 && !uploading && (
              <p className="text-center text-pine/40 text-sm mt-6">
                Hit + to add photos or videos — they stay saved here until you need them.
              </p>
            )}
          </div>

          {/* Bottom bar */}
          <div className="p-4 border-t border-pine/10">
            <button
              onClick={startEdit}
              disabled={selected.size === 0}
              className="w-full py-4 rounded-full bg-signal text-white font-bold uppercase tracking-wider disabled:opacity-40"
            >
              {selected.size === 0
                ? "Select photos and videos"
                : selected.size === 1
                  ? "Continue"
                  : `Continue with ${selected.size} (reel)`}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Edit step — reel editor */}
          <div className="flex-1 overflow-y-auto">
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
              onClick={(e) => {
                // Tap on video/photo background (not on text) — save and deselect.
                if (editingIdx !== null && (e.target as HTMLElement).closest('[data-text-overlay]') === null) {
                  addOverlay();
                }
              }}
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
                        ensureAudioRouting();
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
                </div>
                );
                })}
            </div>

            {/* Timeline — drag to reorder clips */}
            {clips.length > 1 && (
              <div className="px-4 pt-3">
                <p className="text-xs font-bold uppercase tracking-wider text-pine/50 mb-2">
                  Reel timeline — drag to reorder
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

            {/* Text size — with the other sliders */}
            {(editingIdx !== null || overlayText.trim()) && (
              <div className="px-4 pt-1 pb-2 flex items-center gap-3">
                <span className="text-pine/60 text-sm font-bold shrink-0 w-8">Aa</span>
                <input
                  type="range"
                  min={16}
                  max={64}
                  value={editingOverlay?.size ?? 28}
                  onChange={(e) => setEditingOverlay((o) => ({ ...(o ?? { text: "", x: 50, y: 50, font: "bold", color: "#ffffff", bg: "transparent", clipIds: [] }), size: Number(e.target.value) }))}
                  className="flex-1 accent-[#e8622c]"
                  aria-label="Text size"
                />
                <span className="text-xs font-bold text-pine/50 w-10 text-right">
                  {editingOverlay?.size ?? 28}px
                </span>
              </div>
            )}

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

            {/* Text input */}
            <div className="p-4 space-y-3">
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

              {/* Colors */}
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

              {/* Backgrounds */}
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

              {/* Current overlays — tap clips to choose when text shows */}
              {overlays.length > 0 && (
                <div>
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
          </div>

          {/* Bottom bar */}
          <div className="p-4 border-t border-pine/10 flex gap-2">
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
              {posting ? "Posting…" : clips.length > 1 ? `Post ${clips.length}-clip reel` : "Post story"}
            </button>
          </div>
          {note && <p className="px-4 pb-2 text-sm text-red-600 text-center">{note}</p>}
        </>
      )}
    </div>
  );
}
