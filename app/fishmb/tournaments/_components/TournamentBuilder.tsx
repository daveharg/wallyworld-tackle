"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useFishAuth } from "../../_components/FishAuth";
import { fishFetch } from "../../_components/fishFetch";
import { compressImage } from "../../_components/compressImage";
import { PayoutEditor } from "./PayoutEditor";
import { RULE_TEMPLATES } from "./ruleTemplates";
import type { PayoutTier } from "@/lib/fish/tournaments";
import { FISHMB_TOKEN_KEY } from "@/lib/fishmb-constants";
import type { ZoneBox, ZonePoint } from "./ZoneMapPicker";

const ZoneMapPicker = dynamic(() => import("./ZoneMapPicker"), { ssr: false });

interface LakeOpt {
  id: string;
  name: string;
  region: string;
}

const inputCls =
  "w-full bg-white border border-pine/20 rounded-2xl px-4 py-3 text-pine focus:outline-none focus:border-signal";
const labelCls = "block text-xs font-bold uppercase tracking-[0.18em] text-pine/60 mb-1.5";

function splitDateTime(v: string): [string, string] {
  if (!v) return ["", ""];
  const [d, t] = v.split("T");
  return [d || "", (t || "").slice(0, 5)];
}

// Separate date + time inputs: iOS Safari renders a single datetime-local
// input as an oversized empty box, so we split them for a clean compact look.
export function DateTimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [d, t] = splitDateTime(value);
  const update = (nd: string, nt: string) => {
    if (!nd) return onChange("");
    onChange(`${nd}T${nt || "08:00"}`);
  };
  return (
    <div className="min-w-0">
      {label && <label className={labelCls}>{label}</label>}
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={d}
          onChange={(e) => update(e.target.value, t)}
          className={`${inputCls} min-w-0 block`}
          aria-label="Date"
        />
        <input
          type="time"
          value={t}
          onChange={(e) => update(d, e.target.value)}
          className={`${inputCls} min-w-0 block`}
          aria-label="Time"
        />
      </div>
    </div>
  );
}

function fmtDT(v: string): string {
  if (!v) return "Not set";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "Not set";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Rough circular boundary around a lake center (degrees). Editable on the map. */
function circleAround(lat: number, lng: number, radiusDeg = 0.12, points = 16): ZonePoint[] {
  const pts: ZonePoint[] = [];
  const cosLat = Math.cos((lat * Math.PI) / 180) || 1;
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    pts.push({
      lat: lat + Math.sin(a) * radiusDeg,
      lng: lng + (Math.cos(a) * radiusDeg) / cosLat,
    });
  }
  return pts;
}

/** Checkbox row that expands a section when checked. */
function CheckRow({
  checked,
  onChange,
  title,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-start gap-3 bg-white border border-pine/15 rounded-2xl px-4 py-3 text-left"
    >
      <span
        className={`mt-0.5 w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
          checked ? "bg-signal border-signal" : "border-pine/30"
        }`}
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12.5l5 5L20 6.5" />
          </svg>
        )}
      </span>
      <span>
        <span className="font-bold text-sm text-pine">{title}</span>
        {hint && <span className="block text-xs text-pine/50 mt-0.5">{hint}</span>}
      </span>
    </button>
  );
}

/** Selectable pill button (selected = orange). */
function Pill({
  selected,
  onClick,
  children,
  className = "",
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-3 px-4 rounded-2xl text-sm font-bold transition-colors ${
        selected ? "bg-signal text-white" : "bg-white border border-pine/20 text-pine/70"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function TournamentBuilder({ lakes }: { lakes: LakeOpt[] }) {
  const router = useRouter();
  const { user, openLogin } = useFishAuth();
  const [step, setStep] = useState(0);

  // Step 0 — Basics
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [showVenueName, setShowVenueName] = useState(false);
  const [venueName, setVenueName] = useState("");
  const [showVenueAddress, setShowVenueAddress] = useState(false);
  const [venueAddress, setVenueAddress] = useState("");
  const [speciesInput, setSpeciesInput] = useState("");
  const [species, setSpecies] = useState<string[]>(["Walleye"]);

  // Step 1 — Payment and rules
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [datesOpen, setDatesOpen] = useState(false);
  const [picking, setPicking] = useState<"start" | "end" | null>(null);
  const [scoring, setScoring] = useState<"biggest" | "total" | "count">("biggest");
  const [biggestBy, setBiggestBy] = useState<"length" | "weight">("length");
  const [totalMode, setTotalMode] = useState<"all" | "top">("all");
  const [totalN, setTotalN] = useState("5");
  const [rules, setRules] = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [optEntryFee, setOptEntryFee] = useState(false);
  const [entryFee, setEntryFee] = useState("");
  const [payouts, setPayouts] = useState<PayoutTier[]>([]);
  const [optPhotoProof, setOptPhotoProof] = useState(false);
  const [photoProof, setPhotoProof] = useState<"bump" | "tape" | "none">("tape");
  const [requireHoldPhoto, setRequireHoldPhoto] = useState(false);
  const [optBoundaries, setOptBoundaries] = useState(false);
  const [boundary, setBoundary] = useState<"none" | "manitoba" | "custom">("manitoba");
  const [boundaryLakeQuery, setBoundaryLakeQuery] = useState("");
  const [boundaryLake, setBoundaryLake] = useState<{ id: string; name: string; lat: number; lng: number } | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [zoneBox, setZoneBox] = useState<ZoneBox>({ north: 60.1, south: 48.9, east: -88.9, west: -102.1 });
  const [zonePolygon, setZonePolygon] = useState<ZonePoint[] | null>(null);
  const [lakeCoords, setLakeCoords] = useState<Record<string, { lat: number; lng: number }>>({});
  const [autoApprove, setAutoApprove] = useState(false);
  const [hideLocations, setHideLocations] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load lake coordinates so the zone map can jump to a picked lake.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/fishmb/lake-coords.json");
        const data = (await res.json()) as Record<string, { lat: number; lng: number }>;
        setLakeCoords(data);
      } catch {
        // Zone map just won't auto-focus.
      }
    })();
  }, []);

  const boundaryLakeMatches = useMemo(() => {
    const q = boundaryLakeQuery.trim().toLowerCase();
    if (!q) return [];
    return lakes.filter((l) => l.name.toLowerCase().includes(q)).slice(0, 8);
  }, [boundaryLakeQuery, lakes]);

  const pickBoundaryLake = (l: LakeOpt) => {
    const c = lakeCoords[l.id];
    setBoundaryLakeQuery("");
    if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
      const poly = circleAround(c.lat, c.lng);
      setBoundaryLake({ id: l.id, name: l.name, lat: c.lat, lng: c.lng });
      setZonePolygon(poly);
      const lats = poly.map((p) => p.lat);
      const lngs = poly.map((p) => p.lng);
      setZoneBox({
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lngs),
        west: Math.min(...lngs),
      });
      setMapKey((k) => k + 1);
    }
  };

  const entryFeeCents = optEntryFee ? Math.max(0, Math.round((parseFloat(entryFee) || 0) * 100)) : 0;
  // Real-money tournaments always enforce app-camera-only entries.
  const effectivePhotoMode =
    entryFeeCents > 0 ? "strict" : photoProof === "bump" ? "measure_only" : photoProof === "none" ? "no_measure" : "standard";
  const apiScoring = scoring === "biggest" ? (biggestBy === "weight" ? "heaviest" : "longest") : scoring;
  const scoringCount = scoring === "total" && totalMode === "top" ? Math.max(1, parseInt(totalN) || 5) : null;
  const useCustomZone = optBoundaries && boundary === "custom";
  const useWorldBounds = optBoundaries && boundary === "none";

  const validStep0 = name.trim().length > 0;
  const validStep1 = !!startsAt && !!endsAt && new Date(endsAt) > new Date(startsAt);

  const scoringLabel =
    scoring === "biggest"
      ? `Biggest fish (${biggestBy === "weight" ? "heaviest" : "longest"})`
      : scoring === "total"
        ? `Total length (${totalMode === "top" ? `top ${scoringCount}` : "all fish"})`
        : "Most fish";
  const boundaryLabel = !optBoundaries || boundary === "manitoba" ? "All of Manitoba" : boundary === "none" ? "No boundaries" : boundaryLake ? `Custom — ${boundaryLake.name}` : "Custom zone";

  const uploadCover = async (file: File) => {
    setUploadingCover(true);
    setError(null);
    try {
      const token = localStorage.getItem(FISHMB_TOKEN_KEY);
      const form = new FormData();
      form.append("file", await compressImage(file));
      const upRes = await fetch("/api/fish/photos/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const up = await upRes.json();
      if (!upRes.ok) throw new Error(up.error || "Photo upload failed.");
      setCoverPhotoUrl(up.url as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload the cover photo.");
    } finally {
      setUploadingCover(false);
    }
  };

  const create = async () => {
    setError(null);
    if (!user) {
      openLogin();
      return;
    }
    setSaving(true);
    try {
      const data = await fishFetch("/api/fishmb/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          lake_ids: [],
          species,
          starts_at: new Date(startsAt).toISOString(),
          ends_at: new Date(endsAt).toISOString(),
          rules: rules.trim(),
          scoring: apiScoring,
          scoring_count: scoringCount,
          max_participants: null,
          entry_fee_cents: entryFeeCents,
          payouts,
          auto_approve_entries: autoApprove,
          photo_mode: effectivePhotoMode,
          require_hold_photo: requireHoldPhoto,
          hide_locations: hideLocations,
          cover_photo_url: coverPhotoUrl,
          venue_name: showVenueName && venueName.trim() ? venueName.trim() : null,
          venue_address: showVenueAddress && venueAddress.trim() ? venueAddress.trim() : null,
          ...(useCustomZone
            ? {
                gps_north: zoneBox.north,
                gps_south: zoneBox.south,
                gps_east: zoneBox.east,
                gps_west: zoneBox.west,
                ...(zonePolygon && zonePolygon.length >= 3 ? { zone_polygon: zonePolygon } : {}),
              }
            : {}),
          ...(useWorldBounds ? { gps_north: 90, gps_south: -90, gps_east: 180, gps_west: -180 } : {}),
        }),
      });
      router.push(`/fishmb/tournaments/${data.tournament.id}/manage`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the tournament.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-paper-deep border border-pine/10 rounded-3xl p-6 md:p-8">
      {/* Stepper */}
      <div className="flex gap-2 mb-8">
        {["Basics", "Payment and rules", "Review"].map((s, i) => (
          <button
            key={s}
            onClick={() => i < step && setStep(i)}
            className={`flex-1 text-center text-xs font-bold uppercase tracking-wider py-2.5 rounded-full transition-colors ${
              i === step ? "bg-pine text-white" : i < step ? "bg-signal/15 text-signal-dark" : "bg-pine/5 text-pine/40"
            }`}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-5">
          <div>
            <label className={labelCls}>Tournament name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lake Winnipeg Walleye Classic" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What is it, who is it for, what are the prizes?" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Cover photo (optional)</label>
            {coverPhotoUrl ? (
              <div className="relative rounded-2xl overflow-hidden border border-pine/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverPhotoUrl} alt="Tournament cover" className="w-full h-40 object-cover" />
                <button
                  onClick={() => setCoverPhotoUrl(null)}
                  className="absolute top-2 right-2 bg-pine-deep/80 text-white text-xs font-bold px-3 py-1.5 rounded-full"
                >
                  Remove
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingCover}
                  className="inline-flex items-center gap-2 bg-white border border-pine/20 text-pine text-sm font-bold px-5 py-2.5 rounded-full hover:border-signal transition-colors disabled:opacity-50"
                >
                  {uploadingCover ? "Uploading…" : "📷 Add photo"}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingCover}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadCover(f);
                    e.target.value = "";
                  }}
                />
              </>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-pine/70">
                Venue name <span className="text-pine/40">(optional)</span>
              </span>
              <button
                type="button"
                role="checkbox"
                aria-checked={showVenueName}
                onClick={() => setShowVenueName((v) => !v)}
                className={`w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                  showVenueName ? "bg-signal border-signal" : "border-pine/30"
                }`}
              >
                {showVenueName && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12.5l5 5L20 6.5" />
                  </svg>
                )}
              </button>
            </div>
            {showVenueName && (
              <input value={venueName} onChange={(e) => setVenueName(e.target.value)} maxLength={120} placeholder="e.g. Selkirk Park" className={inputCls} />
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-pine/70">
                Venue address <span className="text-pine/40">(optional)</span>
              </span>
              <button
                type="button"
                role="checkbox"
                aria-checked={showVenueAddress}
                onClick={() => setShowVenueAddress((v) => !v)}
                className={`w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                  showVenueAddress ? "bg-signal border-signal" : "border-pine/30"
                }`}
              >
                {showVenueAddress && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12.5l5 5L20 6.5" />
                  </svg>
                )}
              </button>
            </div>
            {showVenueAddress && (
              <input value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} maxLength={200} placeholder="e.g. 112 Main St, Selkirk MB" className={inputCls} />
            )}
          </div>
          <div>
            <label className={labelCls}>Eligible species</label>
            <div className="flex gap-2">
              <input
                value={speciesInput}
                onChange={(e) => setSpeciesInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && speciesInput.trim()) {
                    e.preventDefault();
                    if (!species.includes(speciesInput.trim())) setSpecies([...species, speciesInput.trim()]);
                    setSpeciesInput("");
                  }
                }}
                placeholder="Add a species, press Enter"
                className={inputCls}
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {species.map((s) => (
                <span key={s} className="inline-flex items-center gap-2 bg-gold/20 text-pine text-sm font-bold pl-4 pr-2 py-1.5 rounded-full">
                  {s}
                  <button onClick={() => setSpecies(species.filter((x) => x !== s))} className="w-6 h-6 rounded-full bg-pine/10 hover:bg-pine/25 text-xs" aria-label={`Remove ${s}`}>✕</button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          {/* Dates */}
          <div>
            <label className={labelCls}>Dates *</label>
            <button
              type="button"
              onClick={() => setDatesOpen((o) => !o)}
              className="w-full flex items-center justify-between bg-white border border-pine/20 rounded-2xl px-4 py-3 text-left"
            >
              <span className={`text-sm font-bold ${startsAt && endsAt ? "text-pine" : "text-pine/50"}`}>
                {startsAt && endsAt ? `${fmtDT(startsAt)} → ${fmtDT(endsAt)}` : "📅 Set dates and times"}
              </span>
              <span className="text-pine/40 text-xs">{datesOpen ? "▾" : "▸"}</span>
            </button>
            {datesOpen && (
              <div className="mt-2 bg-white border border-pine/15 rounded-2xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPicking(picking === "start" ? null : "start")}
                    className={`rounded-2xl px-3 py-2.5 text-left transition-colors ${
                      picking === "start" ? "bg-signal text-white" : "bg-pine/5 border border-pine/15"
                    }`}
                  >
                    <span className={`block text-[10px] font-bold uppercase tracking-wider ${picking === "start" ? "text-white/80" : "text-pine/50"}`}>Start</span>
                    <span className={`block text-sm font-bold ${picking === "start" ? "text-white" : "text-pine"}`}>{fmtDT(startsAt)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPicking(picking === "end" ? null : "end")}
                    className={`rounded-2xl px-3 py-2.5 text-left transition-colors ${
                      picking === "end" ? "bg-signal text-white" : "bg-pine/5 border border-pine/15"
                    }`}
                  >
                    <span className={`block text-[10px] font-bold uppercase tracking-wider ${picking === "end" ? "text-white/80" : "text-pine/50"}`}>End</span>
                    <span className={`block text-sm font-bold ${picking === "end" ? "text-white" : "text-pine"}`}>{fmtDT(endsAt)}</span>
                  </button>
                </div>
                {picking && (
                  <DateTimeField
                    label=""
                    value={picking === "start" ? startsAt : endsAt}
                    onChange={picking === "start" ? setStartsAt : setEndsAt}
                  />
                )}
              </div>
            )}
          </div>

          {/* Scoring */}
          <div>
            <label className={labelCls}>Scoring</label>
            <div className="grid grid-cols-3 gap-2">
              <Pill selected={scoring === "biggest"} onClick={() => setScoring("biggest")}>Biggest fish</Pill>
              <Pill selected={scoring === "total"} onClick={() => setScoring("total")}>Total length</Pill>
              <Pill selected={scoring === "count"} onClick={() => setScoring("count")}>Most fish</Pill>
            </div>
            {scoring === "biggest" && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Pill selected={biggestBy === "length"} onClick={() => setBiggestBy("length")}>Longest</Pill>
                <Pill selected={biggestBy === "weight"} onClick={() => setBiggestBy("weight")}>Heaviest</Pill>
              </div>
            )}
            {scoring === "total" && (
              <div className="mt-2 flex items-center gap-2">
                <Pill selected={totalMode === "all"} onClick={() => setTotalMode("all")} className="flex-1">All fish count</Pill>
                <Pill selected={totalMode === "top"} onClick={() => setTotalMode("top")} className="flex-1">Top</Pill>
                {totalMode === "top" && (
                  <>
                    <input
                      value={totalN}
                      onChange={(e) => setTotalN(e.target.value.replace(/[^0-9]/g, ""))}
                      inputMode="numeric"
                      className="w-16 bg-white border border-pine/20 rounded-2xl px-3 py-3 text-pine text-center font-bold focus:outline-none focus:border-signal"
                      aria-label="How many fish count"
                    />
                    <span className="text-xs text-pine/50 font-bold">fish count</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Rules */}
          <div>
            <label className={labelCls}>Rules</label>
            <button
              type="button"
              onClick={() => setTemplatesOpen((o) => !o)}
              className="w-full inline-flex items-center justify-center gap-2 bg-pine text-white text-sm font-bold px-5 py-3 rounded-full hover:bg-pine-deep transition-colors"
            >
              📋 Use pre-scripted rules
            </button>
            {templatesOpen && (
              <div className="grid gap-2 mt-2">
                {RULE_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setRules(t.rules);
                      setTemplatesOpen(false);
                    }}
                    className="text-left bg-white border border-pine/15 rounded-2xl px-4 py-3 hover:border-signal transition-colors"
                  >
                    <span className="block text-sm font-bold text-pine">{t.name}</span>
                    <span className="block text-xs text-pine/50 mt-0.5">{t.description}</span>
                  </button>
                ))}
              </div>
            )}
            <textarea
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              rows={6}
              placeholder="Write your rules here, or pick a template above and edit it."
              className={`${inputCls} mt-2`}
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <CheckRow
              checked={optEntryFee}
              onChange={setOptEntryFee}
              title="Entry fee"
              hint="Leave off for a free friendly tournament — no money changes hands."
            />
            {optEntryFee && (
              <div className="bg-white border border-pine/15 rounded-2xl p-4 space-y-4">
                <div>
                  <label className={labelCls}>Entry fee per angler ($)</label>
                  <input
                    value={entryFee}
                    onChange={(e) => setEntryFee(e.target.value.replace(/[^0-9.]/g, ""))}
                    inputMode="decimal"
                    placeholder="0 = free"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Payouts</label>
                  <PayoutEditor value={payouts} onChange={setPayouts} />
                  <p className="text-xs text-pine/50 mt-2">
                    Each place pays a % of the pot or a fixed $ amount. Leave empty for bragging rights.
                  </p>
                </div>
                <p className="text-xs text-pine/60 bg-gold/15 border border-gold/40 rounded-xl p-3">
                  Real-money tournaments enforce app-camera-only entries for fair play.
                </p>
              </div>
            )}

            <CheckRow
              checked={optPhotoProof}
              onChange={setOptPhotoProof}
              title="Photo proof requirements"
              hint="How catches must be photographed."
            />
            {optPhotoProof && (
              <div className="space-y-2">
                <div className="grid grid-cols-1 gap-2">
                  <Pill selected={photoProof === "bump"} onClick={() => setPhotoProof("bump")} className="text-left">
                    Official bump board photo
                    <span className={`block text-xs font-normal mt-1 ${photoProof === "bump" ? "text-white/85" : "text-pine/50"}`}>
                      Fish measured on a bump board — strictest proof
                    </span>
                  </Pill>
                  <Pill selected={photoProof === "tape"} onClick={() => setPhotoProof("tape")} className="text-left">
                    Any measuring tape
                    <span className={`block text-xs font-normal mt-1 ${photoProof === "tape" ? "text-white/85" : "text-pine/50"}`}>
                      Tape or board — more casual
                    </span>
                  </Pill>
                  <Pill selected={photoProof === "none"} onClick={() => setPhotoProof("none")} className="text-left">
                    No measure photo required
                    <span className={`block text-xs font-normal mt-1 ${photoProof === "none" ? "text-white/85" : "text-pine/50"}`}>
                      Just a fish photo — best for most-fish scoring
                    </span>
                  </Pill>
                </div>
                <button
                  type="button"
                  onClick={() => setRequireHoldPhoto((v) => !v)}
                  className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 transition-colors ${
                    requireHoldPhoto ? "bg-signal text-white" : "bg-white border border-pine/20 text-pine"
                  }`}
                >
                  <span className="text-sm font-bold text-left">
                    Require holding photo
                    <span className={`block text-xs font-normal mt-0.5 ${requireHoldPhoto ? "text-white/85" : "text-pine/50"}`}>
                      Anglers must also submit a photo holding the fish.
                    </span>
                  </span>
                  <span
                    className={`shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                      requireHoldPhoto ? "bg-white border-white" : "border-pine/30"
                    }`}
                  >
                    {requireHoldPhoto && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C2410C" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12.5l5 5L20 6.5" />
                      </svg>
                    )}
                  </span>
                </button>
              </div>
            )}

            <CheckRow
              checked={optBoundaries}
              onChange={setOptBoundaries}
              title="Tournament boundaries"
              hint="Leave off for all of Manitoba."
            />
            {optBoundaries && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <Pill selected={boundary === "none"} onClick={() => setBoundary("none")}>No boundaries</Pill>
                  <Pill selected={boundary === "manitoba"} onClick={() => setBoundary("manitoba")}>All of Manitoba</Pill>
                  <Pill selected={boundary === "custom"} onClick={() => setBoundary("custom")}>Set your own</Pill>
                </div>
                {boundary === "custom" && (
                  <div>
                    <p className="text-xs text-pine/60 mb-2">
                      Fish caught outside boundaries will be flagged for review by the organizer.
                    </p>
                    <input
                      value={boundaryLakeQuery}
                      onChange={(e) => setBoundaryLakeQuery(e.target.value)}
                      placeholder="Search for a lake…"
                      className={inputCls}
                    />
                    {boundaryLakeMatches.length > 0 && (
                      <div className="mt-2 bg-white border border-pine/15 rounded-2xl overflow-hidden">
                        {boundaryLakeMatches.map((l) => (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => pickBoundaryLake(l)}
                            className="w-full text-left px-4 py-2.5 hover:bg-pine/5 text-sm text-pine flex justify-between"
                          >
                            <span>{l.name}</span>
                            <span className="text-pine/45 text-xs">{l.region}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {boundaryLake && (
                      <p className="text-xs text-pine/60 mt-2">
                        Boundary drawn around <span className="font-bold text-pine">{boundaryLake.name}</span> — drag the points to adjust it.
                      </p>
                    )}
                    <div className="mt-2">
                      <ZoneMapPicker
                        key={mapKey}
                        initialBox={zoneBox}
                        initialPolygon={zonePolygon}
                        focusLake={boundaryLake ? { lat: boundaryLake.lat, lng: boundaryLake.lng, key: boundaryLake.id } : null}
                        onChange={(b, p) => {
                          setZoneBox(b);
                          setZonePolygon(p);
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-start gap-3 bg-white border border-pine/15 rounded-2xl p-4">
            <input
              type="checkbox"
              id="autoApprove"
              checked={autoApprove}
              onChange={(e) => setAutoApprove(e.target.checked)}
              className="mt-1 w-4 h-4 accent-[#C2410C]"
            />
            <label htmlFor="autoApprove" className="text-sm text-pine">
              <span className="font-bold">Auto-approve catches</span>
              <span className="block text-pine/55 text-xs mt-1">
                For friendly and demo tournaments — catches hit the leaderboard instantly. Leave off
                for competitive tournaments so you review every catch first.
              </span>
            </label>
          </div>
          <div className="flex items-start gap-3 bg-white border border-pine/15 rounded-2xl p-4">
            <input
              type="checkbox"
              id="hideLocations"
              checked={hideLocations}
              onChange={(e) => setHideLocations(e.target.checked)}
              className="mt-1 w-4 h-4 accent-[#C2410C]"
            />
            <label htmlFor="hideLocations" className="text-sm text-pine">
              <span className="font-bold">Keep catch spots private</span>
              <span className="block text-pine/55 text-xs mt-1">
                For friendly tournaments with strangers — the app still confirms each catch is
                inside the tournament waters, but other anglers never see anyone&apos;s exact spot.
                You (the organizer) still see locations for verification.
              </span>
            </label>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h3 className="font-display font-bold uppercase text-pine text-xl tracking-wide">Review</h3>
          <dl className="bg-white rounded-2xl border border-pine/10 p-5 space-y-2.5 text-sm">
            <div className="flex justify-between"><dt className="text-pine/55 font-bold uppercase text-xs tracking-wider">Name</dt><dd className="text-pine font-bold text-right">{name}</dd></div>
            {(showVenueName && venueName.trim()) || (showVenueAddress && venueAddress.trim()) ? (
              <div className="flex justify-between"><dt className="text-pine/55 font-bold uppercase text-xs tracking-wider">Where</dt><dd className="text-pine text-right">{[showVenueName ? venueName.trim() : "", showVenueAddress ? venueAddress.trim() : ""].filter(Boolean).join(" — ")}</dd></div>
            ) : null}
            <div className="flex justify-between"><dt className="text-pine/55 font-bold uppercase text-xs tracking-wider">Dates</dt><dd className="text-pine text-right">{fmtDT(startsAt)} → {fmtDT(endsAt)}</dd></div>
            <div className="flex justify-between"><dt className="text-pine/55 font-bold uppercase text-xs tracking-wider">Scoring</dt><dd className="text-pine text-right">{scoringLabel}</dd></div>
            <div className="flex justify-between"><dt className="text-pine/55 font-bold uppercase text-xs tracking-wider">Waters</dt><dd className="text-pine text-right">{boundaryLabel}</dd></div>
            <div className="flex justify-between"><dt className="text-pine/55 font-bold uppercase text-xs tracking-wider">Species</dt><dd className="text-pine text-right">{species.join(", ") || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-pine/55 font-bold uppercase text-xs tracking-wider">Entry fee</dt><dd className="text-pine text-right">{entryFeeCents > 0 ? `$${(entryFeeCents / 100).toFixed(2)} / angler` : "Free"}</dd></div>
            {payouts.length > 0 && (
              <div className="flex justify-between"><dt className="text-pine/55 font-bold uppercase text-xs tracking-wider">Payouts</dt><dd className="text-pine text-right">{payouts.map((p) => `${p.place}${p.type === "percent" ? ` (${p.value}%)` : ` ($${p.value})`}`).join(", ")}</dd></div>
            )}
            <div className="flex justify-between"><dt className="text-pine/55 font-bold uppercase text-xs tracking-wider">Photo proof</dt><dd className="text-pine text-right">{entryFeeCents > 0 ? "Strict — app camera only" : photoProof === "bump" ? "Bump board" : photoProof === "none" ? "No measure needed" : "Any tape"}{requireHoldPhoto ? " + holding photo" : ""}</dd></div>
          </dl>
          {!user && (
            <p className="text-sm text-pine/60 bg-gold/15 border border-gold/40 rounded-2xl p-4">
              You&apos;ll log in with Google to save it — the same account as the FishMB app. Your tournament draft stays right here.
            </p>
          )}
          {error && <p className="text-sm text-signal-dark">{error}</p>}
        </div>
      )}

      <div className="flex justify-between mt-8">
        <button
          onClick={() => { setError(null); setStep(Math.max(0, step - 1)); }}
          disabled={step === 0}
          className="text-sm font-bold uppercase tracking-wider text-pine/50 disabled:opacity-30 px-4 py-3"
        >
          ← Back
        </button>
        {step === 0 ? (
          <button
            onClick={() => validStep0 ? (setError(null), setStep(1)) : setError("Give your tournament a name.")}
            className="bg-pine hover:bg-pine-deep text-white font-bold uppercase tracking-wider text-sm px-7 py-3 rounded-full transition-colors"
          >
            Continue →
          </button>
        ) : step === 1 ? (
          <button
            onClick={() => validStep1 ? (setError(null), setStep(2)) : setError("Set valid start and end dates.")}
            className="bg-pine hover:bg-pine-deep text-white font-bold uppercase tracking-wider text-sm px-7 py-3 rounded-full transition-colors"
          >
            Continue →
          </button>
        ) : (
          <button
            onClick={create}
            disabled={saving}
            className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-7 py-3 rounded-full transition-colors disabled:opacity-50"
          >
            {saving ? "Creating…" : user ? "Create tournament" : "Log in & create"}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-signal-dark mt-3">{error}</p>}
    </div>
  );
}
