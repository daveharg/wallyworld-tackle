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
  const [multi, setMulti] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [step, setStep] = useState<"pick" | "edit">("pick");
  const [overlays, setOverlays] = useState<TextOverlay[]>([]);
  const [editingOverlay, setEditingOverlay] = useState<TextOverlay | null>(null);
  const [overlayText, setOverlayText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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
      const token = localStorage.getItem(FISHMB_TOKEN_KEY);
      const form = new FormData();
      const isVideo = file.type.startsWith("video/");
      form.append("file", isVideo ? file : await compressImage(file));
      const upRes = await fetch("/api/fish/photos/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const up = await upRes.json();
      if (!upRes.ok) throw new Error(up.error || "Upload failed.");
      await fishFetch("/api/fishmb/story-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_url: up.url, media_type: isVideo ? "video" : "photo" }),
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
      else {
        if (!multi) next.clear();
        next.add(id);
      }
      return next;
    });
  };

  const selectedDrafts = drafts.filter((d) => selected.has(d.id));

  const startEdit = () => {
    if (selectedDrafts.length === 0) {
      setNote("Pick at least one photo or video first.");
      return;
    }
    setStep("edit");
  };

  const addOverlay = () => {
    if (!overlayText.trim()) return;
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
      },
    ]);
    setOverlayText("");
  };

  const postStories = async () => {
    setPosting(true);
    setNote(null);
    try {
      for (const d of selectedDrafts) {
        await fishFetch("/api/fishmb/stories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            media_url: d.media_url,
            media_type: d.media_type,
            overlays,
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
          {/* Tool buttons */}
          <div className="flex gap-3 overflow-x-auto px-4 py-3" style={{ scrollbarWidth: "none" }}>
            <button
              onClick={startEdit}
              className="shrink-0 w-24 py-3 rounded-2xl bg-pine/5 flex flex-col items-center gap-1"
            >
              <span className="text-xl font-bold">Aa</span>
              <span className="text-xs font-bold text-pine/70">Text</span>
            </button>
            <button
              onClick={() => setNote("Music isn't available yet — licensed music needs deals with the record labels, which we don't have. Your stories post without music for now.")}
              className="shrink-0 w-24 py-3 rounded-2xl bg-pine/5 flex flex-col items-center gap-1"
            >
              <span className="text-xl"></span>
              <span className="text-xs font-bold text-pine/70">Music</span>
            </button>
            <div className="shrink-0 w-24 py-3 rounded-2xl bg-pine/5 flex flex-col items-center gap-1 opacity-40">
              <span className="text-xl">▦</span>
              <span className="text-xs font-bold text-pine/70">Templates</span>
            </div>
            <div className="shrink-0 w-24 py-3 rounded-2xl bg-pine/5 flex flex-col items-center gap-1 opacity-40">
              <span className="text-xl">∞</span>
              <span className="text-xs font-bold text-pine/70">Boomerang</span>
            </div>
          </div>

          {/* Camera roll bar */}
          <div className="flex items-center justify-between px-4 py-2">
            <span className="font-bold text-pine/60">Camera roll ▾</span>
            <button
              onClick={() => setMulti((m) => !m)}
              className={`px-4 py-2 rounded-full text-sm font-bold ${multi ? "bg-pine text-white" : "bg-pine/10 text-pine"}`}
            >
               Select multiple
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
              {drafts.map((d) => (
                <div key={d.id} className="relative aspect-square">
                  <button
                    onClick={() => toggleSelect(d.id)}
                    className="absolute inset-0 rounded-xl overflow-hidden"
                  >
                    {d.media_type === "video" ? (
                      <video src={d.media_url} className="w-full h-full object-cover" muted playsInline />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.media_url} alt="" className="w-full h-full object-cover" />
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
              ))}
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
                ? "Select photos"
                : selected.size === 1
                  ? "Continue"
                  : `Continue with ${selected.size} (reel)`}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Edit step — text overlays */}
          <div className="flex-1 overflow-y-auto">
            {/* Preview */}
            <div className="relative bg-black aspect-[9/16] max-h-[50vh] mx-auto">
              {selectedDrafts[0] && (
                selectedDrafts[0].media_type === "video" ? (
                  <video src={selectedDrafts[0].media_url} className="w-full h-full object-contain" muted playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedDrafts[0].media_url} alt="" className="w-full h-full object-contain" />
                )
              )}
              {overlays.map((o, i) => (
                <div
                  key={i}
                  className="absolute"
                  style={{ left: `${o.x}%`, top: `${o.y}%`, transform: "translate(-50%, -50%)" }}
                >
                  <span
                    style={{
                      ...fontStyle(o.font),
                      color: o.color,
                      background: o.bg,
                      fontSize: `${o.size}px`,
                      padding: o.bg !== "transparent" ? "4px 12px" : undefined,
                      borderRadius: o.bg !== "transparent" ? "12px" : undefined,
                      WebkitTextStroke: o.font === "outline" ? `1.5px ${o.color}` : undefined,
                    }}
                    className="whitespace-nowrap"
                  >
                    {o.text}
                  </span>
                </div>
              ))}
            </div>

            {/* Text input */}
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <input
                  value={overlayText}
                  onChange={(e) => setOverlayText(e.target.value)}
                  placeholder="Add text…"
                  maxLength={100}
                  className="flex-1 bg-pine/5 border border-pine/15 rounded-full px-4 py-3 text-pine text-sm placeholder:text-pine/40 focus:outline-none focus:border-signal"
                />
                <button
                  onClick={addOverlay}
                  disabled={!overlayText.trim()}
                  className="px-5 rounded-full bg-pine text-white font-bold text-sm disabled:opacity-40"
                >
                  Add
                </button>
              </div>

              {/* Font styles */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-pine/50 mb-2">Style</p>
                <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                  {FONTS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setEditingOverlay((o) => ({ ...(o ?? { text: "", x: 50, y: 50, color: "#ffffff", bg: "transparent", size: 28 }), font: f.id }))}
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
                      onClick={() => setEditingOverlay((o) => ({ ...(o ?? { text: "", x: 50, y: 50, font: "bold", bg: "transparent", size: 28 }), color: c }))}
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
                      onClick={() => setEditingOverlay((o) => ({ ...(o ?? { text: "", x: 50, y: 50, font: "bold", color: "#ffffff", size: 28 }), bg: b.value }))}
                      className={`px-4 py-2 rounded-full text-xs font-bold border-2 ${
                        (editingOverlay?.bg ?? "transparent") === b.value ? "border-signal" : "border-pine/15"
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-pine/50 mb-2">Size</p>
                <input
                  type="range"
                  min={16}
                  max={64}
                  value={editingOverlay?.size ?? 28}
                  onChange={(e) => setEditingOverlay((o) => ({ ...(o ?? { text: "", x: 50, y: 50, font: "bold", color: "#ffffff", bg: "transparent" }), size: Number(e.target.value) }))}
                  className="w-full"
                />
              </div>

              {/* Current overlays */}
              {overlays.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-pine/50 mb-2">Added ({overlays.length})</p>
                  <div className="space-y-1">
                    {overlays.map((o, i) => (
                      <div key={i} className="flex items-center gap-2 bg-pine/5 rounded-xl px-3 py-2">
                        <span className="flex-1 text-sm text-pine truncate" style={fontStyle(o.font)}>{o.text}</span>
                        <button
                          onClick={() => setOverlays((list) => list.filter((_, j) => j !== i))}
                          className="text-red-500 font-bold"
                          aria-label="Remove text"
                        >
                          ×
                        </button>
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
              {posting ? "Posting…" : selectedDrafts.length > 1 ? `Post ${selectedDrafts.length} stories` : "Post story"}
            </button>
          </div>
          {note && <p className="px-4 pb-2 text-sm text-red-600 text-center">{note}</p>}
        </>
      )}
    </div>
  );
}
