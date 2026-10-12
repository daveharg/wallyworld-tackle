// Measure a fish from a photo using a known-size reference object in the
// same photo (credit card, bump board, tape, …). The user taps both ends
// of the reference, then the fish's nose and tail; points stay draggable
// for fine-tuning. Length = fishPx / refPx * refInches.
//
// Rendered through a portal into document.body so no ancestor transform
// or overflow can clip it (same lesson as the story text sheet).

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Pt = { x: number; y: number }; // image-natural pixels

interface Props {
  imageUrl: string;
  onDone: (inches: number) => void;
  onClose: () => void;
}

const PRESETS: { id: string; label: string; inches: number | null }[] = [
  { id: "card", label: "Credit / debit card", inches: 3.37 },
  { id: "loonie", label: "Loonie (across)", inches: 1.04 },
  { id: "bill", label: "$20 bill (long side)", inches: 6.14 },
  { id: "custom", label: "Something else…", inches: null },
];

function dist(a: Pt, b: Pt) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function formatIn(v: number) {
  const q = Math.round(v * 4) / 4;
  return Number.isInteger(q) ? String(q) : String(q);
}

export default function FishMeasurer({ imageUrl, onDone, onClose }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [preset, setPreset] = useState(PRESETS[0]);
  const [customIn, setCustomIn] = useState("");
  const [phase, setPhase] = useState<"ref" | "fish">("ref");
  const [refPts, setRefPts] = useState<Pt[]>([]);
  const [fishPts, setFishPts] = useState<Pt[]>([]);
  const dragRef = useRef<{ which: "ref" | "fish"; idx: number } | null>(null);

  const refInches =
    preset.inches ?? (parseFloat(customIn) > 0 ? parseFloat(customIn) : null);

  const fishInches =
    refPts.length === 2 && fishPts.length === 2 && refInches
      ? (dist(fishPts[0], fishPts[1]) / dist(refPts[0], refPts[1])) * refInches
      : null;

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const toNatural = useCallback(
    (clientX: number, clientY: number): Pt | null => {
      const img = imgRef.current;
      if (!img || !natural) return null;
      const r = img.getBoundingClientRect();
      const x = ((clientX - r.left) / r.width) * natural.w;
      const y = ((clientY - r.top) / r.height) * natural.h;
      return {
        x: Math.max(0, Math.min(natural.w, x)),
        y: Math.max(0, Math.min(natural.h, y)),
      };
    },
    [natural]
  );

  const ptsFor = (which: "ref" | "fish") => (which === "ref" ? refPts : fishPts);
  const setPtsFor = (which: "ref" | "fish", pts: Pt[]) =>
    which === "ref" ? setRefPts(pts) : setFishPts(pts);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!natural) return;
    const p = toNatural(e.clientX, e.clientY);
    if (!p) return;
    // Near an existing point of the active phase? Start dragging it.
    const pts = ptsFor(phase);
    const thresh = natural.w * 0.06;
    const idx = pts.findIndex((q) => dist(q, p) < thresh);
    if (idx >= 0) {
      dragRef.current = { which: phase, idx };
      (e.target as Element).setPointerCapture?.(e.pointerId);
      return;
    }
    if (pts.length < 2) {
      setPtsFor(phase, [...pts, p]);
      dragRef.current = { which: phase, idx: pts.length };
      (e.target as Element).setPointerCapture?.(e.pointerId);
      if (phase === "ref" && pts.length === 1 && refInches) setPhase("fish");
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const p = toNatural(e.clientX, e.clientY);
    if (!p) return;
    const pts = [...ptsFor(d.which)];
    pts[d.idx] = p;
    setPtsFor(d.which, pts);
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const marker = (p: Pt, color: string, key: string) => (
    <span
      key={key}
      className="absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full border-[3px] pointer-events-none shadow-lg"
      style={{
        left: `${(p.x / (natural?.w ?? 1)) * 100}%`,
        top: `${(p.y / (natural?.h ?? 1)) * 100}%`,
        borderColor: color,
        background: "rgba(255,255,255,0.25)",
      }}
    />
  );

  const line = (pts: Pt[], color: string) =>
    pts.length === 2 && natural ? (
      <line
        x1={pts[0].x}
        y1={pts[0].y}
        x2={pts[1].x}
        y2={pts[1].y}
        stroke={color}
        strokeWidth={natural.w * 0.006}
        strokeDasharray={`${natural.w * 0.02} ${natural.w * 0.014}`}
      />
    ) : null;

  const sheet = (
    <div className="fixed inset-0 z-[1200] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <p className="text-white font-bold uppercase tracking-wider text-sm">📏 Measure fish</p>
        <button
          type="button"
          onClick={onClose}
          className="text-white/80 text-sm font-bold uppercase tracking-wider px-3 py-1.5"
        >
          Cancel
        </button>
      </div>

      {/* Step + reference picker */}
      <div className="px-4 pb-3 shrink-0">
        <div className="flex gap-2 mb-2.5">
          <button
            type="button"
            onClick={() => setPhase("ref")}
            className={`flex-1 rounded-full py-2 text-xs font-bold uppercase tracking-wider ${
              phase === "ref" ? "bg-gold text-pine-deep" : "bg-white/15 text-white/70"
            }`}
          >
            1 · Reference {refPts.length === 2 ? "✓" : ""}
          </button>
          <button
            type="button"
            onClick={() => refPts.length === 2 && setPhase("fish")}
            className={`flex-1 rounded-full py-2 text-xs font-bold uppercase tracking-wider ${
              phase === "fish" ? "bg-signal text-white" : "bg-white/15 text-white/70"
            }`}
          >
            2 · Fish {fishPts.length === 2 ? "✓" : ""}
          </button>
        </div>
        {phase === "ref" ? (
          <>
            <p className="text-white/85 text-sm mb-2">
              What&apos;s in the photo beside the fish? Tap its two ends on the photo.
            </p>
            <div className="flex gap-2 flex-wrap">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p)}
                  className={`rounded-full px-3.5 py-2 text-xs font-bold ${
                    preset.id === p.id ? "bg-white text-pine-deep" : "bg-white/15 text-white"
                  }`}
                >
                  {p.label}
                  {p.inches ? ` · ${p.inches}″` : ""}
                </button>
              ))}
              {preset.inches === null && (
                <input
                  value={customIn}
                  onChange={(e) => setCustomIn(e.target.value)}
                  inputMode="decimal"
                  placeholder="Its length (in)"
                  className="bg-white/15 text-white placeholder:text-white/50 rounded-full px-3.5 py-2 text-xs font-bold w-32 focus:outline-none"
                />
              )}
            </div>
          </>
        ) : (
          <p className="text-white/85 text-sm">
            Tap the tip of the nose, then the tip of the tail. Drag any dot to fine-tune.
          </p>
        )}
      </div>

      {/* Photo stage */}
      <div ref={wrapRef} className="flex-1 min-h-0 flex items-center justify-center px-3">
        <div
          className="relative touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Catch to measure"
            draggable={false}
            onLoad={(e) =>
              setNatural({
                w: e.currentTarget.naturalWidth,
                h: e.currentTarget.naturalHeight,
              })
            }
            className="max-w-full max-h-[52vh] w-auto h-auto rounded-xl pointer-events-none"
          />
          {natural && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${natural.w} ${natural.h}`}
              preserveAspectRatio="none"
            >
              {line(refPts, "#f5b921")}
              {line(fishPts, "#ff7847")}
            </svg>
          )}
          {natural && refPts.map((p, i) => marker(p, "#f5b921", `r${i}`))}
          {natural && fishPts.map((p, i) => marker(p, "#ff7847", `f${i}`))}
        </div>
      </div>

      {/* Result + actions */}
      <div className="px-4 py-4 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {fishInches ? (
          <p className="text-center text-white mb-3">
            <span className="font-display font-bold text-4xl">{formatIn(fishInches)}″</span>
            <span className="text-white/60 text-sm ml-2">
              ({(fishInches * 2.54).toFixed(1)} cm)
            </span>
          </p>
        ) : (
          <p className="text-center text-white/50 text-sm mb-3">
            {phase === "ref"
              ? refInches
                ? "Tap both ends of the reference in the photo"
                : "Enter the reference length first"
              : "Tap the nose, then the tail"}
          </p>
        )}
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => {
              setPtsFor(phase, []);
            }}
            className="px-5 py-3.5 rounded-full bg-white/15 text-white font-bold uppercase tracking-wider text-sm"
          >
            Clear {phase === "ref" ? "reference" : "fish"}
          </button>
          <button
            type="button"
            disabled={!fishInches}
            onClick={() => fishInches && onDone(Math.round(fishInches * 4) / 4)}
            className="flex-1 py-3.5 rounded-full bg-signal text-white font-bold uppercase tracking-wider text-sm disabled:opacity-40"
          >
            Use this length
          </button>
        </div>
        <p className="text-white/40 text-[11px] text-center mt-3 leading-snug">
          Most accurate when the reference lies flat beside the fish at the same
          level and the photo is taken straight down.
        </p>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(sheet, document.body);
}
