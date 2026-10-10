"use client";

import { useEffect, useRef, useState } from "react";
import ContoursToggle from "../../_components/ContoursToggle";
import { fishFetch } from "../../_components/fishFetch";
import { SPOT_ICON_CHOICES, spotIconHtml, spotIconSize } from "./spotIcons";
import { haversineM, formatDist } from "./geo";

export interface SpotPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  notes: string | null;
  icon: string;
  created_at: string;
}

export interface TrailPoint {
  lat: number;
  lng: number;
  t?: number;
}

export interface CatchPin {
  id: string;
  lat: number;
  lng: number;
  species: string;
  length_in: number | null;
  mine: boolean;
  avatar_url: string | null;
  user_name: string;
}

export type BasemapId = "streets" | "satellite";

interface SpotMapProps {
  spots: SpotPin[];
  /** When true, clicking the map drops a pin and calls onPick. */
  picking?: boolean;
  onPick?: (lat: number, lng: number) => void;
  /** Long-press (hold) on the map also drops a pin via onLongPress. */
  onLongPress?: (lat: number, lng: number) => void;
  /** The in-progress manual pin (rendered distinctly). */
  pendingPin?: { lat: number; lng: number } | null;
  /** Recenter request: when the key changes, fly the map to lat/lng. */
  focus?: { lat: number; lng: number; key: string; zoom?: number } | null;
  /** Live GPS position — rendered as a person marker that follows you. */
  myLoc?: { lat: number; lng: number; speed: number | null } | null;
  /** A saved trail to overlay on the map (retrace your route). */
  overlayTrail?: TrailPoint[] | null;
  /** Navigate-to target: dashed line from your location to this point. */
  goTo?: { lat: number; lng: number } | null;
  /** Fired after a recorded trail is saved, so the parent can refresh. */
  onTrailSaved?: () => void;
  /** Fired when a spot marker is tapped — parent shows a custom popup. */
  onSpotClick?: (spot: SpotPin) => void;
  /** Smooth pan (no zoom change) — used by follow-me mode. */
  panTo?: { lat: number; lng: number; key: string } | null;
  /** Icon id for the "my location" marker. */
  followDot?: string;
  /** GPS catch pins rendered on the map. */
  catchPins?: CatchPin[];
  /** Fired when a catch pin is tapped — parent shows a detail sheet. */
  onCatchClick?: (pin: CatchPin) => void;
  /** Base map style. */
  basemap?: BasemapId;
  /** Fired (debounced by Leaflet) whenever the map stops moving. */
  onMoveEnd?: (center: { lat: number; lng: number }, zoom: number) => void;
  /** Fill the parent container (used by the fullscreen maps page) —
      disables the tap-to-expand behaviour. */
  fill?: boolean;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function fmtElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function defaultTrailName(): string {
  const d = new Date();
  return `Trail ${d.toLocaleDateString("en-CA", { month: "short", day: "numeric" })} ${d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Personal fishing-spots map (Leaflet, dynamically imported so it never runs
 * during SSR). Pins with custom icons, live GPS person marker, trail
 * recording, distance measuring and go-to navigation.
 */
export default function SpotMap({
  spots,
  picking,
  onPick,
  onLongPress,
  pendingPin,
  focus,
  myLoc,
  overlayTrail,
  goTo,
  onTrailSaved,
  onSpotClick,
  panTo,
  followDot = "dot-blue",
  catchPins,
  onCatchClick,
  basemap = "streets",
  onMoveEnd,
  fill = false,
}: SpotMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSpotClickRef = useRef(onSpotClick);
  onSpotClickRef.current = onSpotClick;
  const [map, setMap] = useState<any>(null);
  const [expanded, setExpanded] = useState(false);
  // Circular fill indicator shown at the press point during a long-press.
  const [pressRing, setPressRing] = useState<{ x: number; y: number; p: number } | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const onLongPressRef = useRef(onLongPress);
  onLongPressRef.current = onLongPress;
  const pickingRef = useRef(picking);
  pickingRef.current = picking;
  const onMoveEndRef = useRef(onMoveEnd);
  onMoveEndRef.current = onMoveEnd;
  const basemapRef = useRef<BasemapId>(basemap);
  basemapRef.current = basemap;
  // Tile layers for the two basemaps (created once the map exists).
  const baseLayersRef = useRef<{ streets: any; satellite: any } | null>(null);
  const fillRef = useRef(fill);
  fillRef.current = fill;

  // Trail recording state.
  const [recording, setRecording] = useState(false);
  // Follow mode: while recording, the map pans to keep your marker in view.
  // Dragging the map manually pauses following (◎ button resumes it).
  const [following, setFollowing] = useState(false);
  const [trailPts, setTrailPts] = useState<TrailPoint[]>([]);
  const [trailStart, setTrailStart] = useState<number | null>(null);
  const [trailElapsed, setTrailElapsed] = useState(0);
  const [showSave, setShowSave] = useState(false);
  const [trailName, setTrailName] = useState("");
  const [savingTrail, setSavingTrail] = useState(false);
  const [trailNote, setTrailNote] = useState<string | null>(null);

  // Measure mode state.
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePts, setMeasurePts] = useState<{ lat: number; lng: number }[]>([]);
  const measureModeRef = useRef(false);
  measureModeRef.current = measureMode;

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current) return;
      const m = L.map(containerRef.current, { scrollWheelZoom: false, zoomControl: false }).setView(
        [48, -100],
        3
      );
      const streets = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      });
      const satellite = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution:
            "Imagery &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
          maxZoom: 19,
        }
      );
      (basemapRef.current === "satellite" ? satellite : streets).addTo(m);
      baseLayersRef.current = { streets, satellite };
      m.on("moveend", () => {
        const c = m.getCenter();
        onMoveEndRef.current?.({ lat: c.lat, lng: c.lng }, m.getZoom());
      });
      m.on("focus", () => m.scrollWheelZoom.enable());
      m.on("blur", () => m.scrollWheelZoom.disable());
      m.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        if (pickingRef.current) {
          onPickRef.current?.(e.latlng.lat, e.latlng.lng);
          return;
        }
        if (measureModeRef.current) {
          const { lat, lng } = e.latlng;
          setMeasurePts((prev) => (prev.length >= 2 ? [{ lat, lng }] : [...prev, { lat, lng }]));
        }
      });
      if (!cancelled) setMap(m);
      // Debug handle for live diagnostics (tile painting issues).
      (window as unknown as { __spotMap?: unknown }).__spotMap = m;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Long-press (hold) on the map drops a pin via onLongPress.
  // Works for touch (mobile) and mouse (desktop). Moving more than a few
  // pixels cancels, so panning the map never triggers it. Disabled in
  // measure mode so measuring taps stay clean.
  useEffect(() => {
    if (!map || !containerRef.current) return;
    let L: any = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let rafId: number | null = null;
    let startX = 0;
    let startY = 0;
    const el = containerRef.current;

    import("leaflet").then((mod) => {
      L = mod.default;
    });

    const pointToLatLng = (clientX: number, clientY: number) => {
      if (!L) return null;
      const rect = el.getBoundingClientRect();
      const pt = L.point(clientX - rect.left, clientY - rect.top);
      return map.containerPointToLatLng(pt) as { lat: number; lng: number };
    };

    const fire = (clientX: number, clientY: number) => {
      if (measureModeRef.current) return;
      const ll = pointToLatLng(clientX, clientY);
      if (ll) onLongPressRef.current?.(ll.lat, ll.lng);
    };

    const cancel = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      setPressRing(null);
    };

    const onDown = (clientX: number, clientY: number) => {
      cancel();
      startX = clientX;
      startY = clientY;
      // Show the circular fill indicator at the press point.
      const rect = el.getBoundingClientRect();
      const rx = clientX - rect.left;
      const ry = clientY - rect.top;
      const t0 = performance.now();
      const tick = () => {
        const p = Math.min((performance.now() - t0) / 600, 1);
        setPressRing({ x: rx, y: ry, p });
        rafId = p < 1 ? requestAnimationFrame(tick) : null;
      };
      rafId = requestAnimationFrame(tick);
      timer = setTimeout(() => {
        timer = null;
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        setPressRing(null);
        fire(clientX, clientY);
      }, 600);
    };

    const onMove = (clientX: number, clientY: number) => {
      if (timer && Math.hypot(clientX - startX, clientY - startY) > 12) cancel();
    };

    const ts = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        cancel();
        return;
      }
      onDown(e.touches[0].clientX, e.touches[0].clientY);
    };
    const tm = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        cancel();
        return;
      }
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const md = (e: MouseEvent) => onDown(e.clientX, e.clientY);
    const mm = (e: MouseEvent) => onMove(e.clientX, e.clientY);

    el.addEventListener("touchstart", ts, { passive: true });
    el.addEventListener("touchmove", tm, { passive: true });
    el.addEventListener("touchend", cancel);
    el.addEventListener("touchcancel", cancel);
    el.addEventListener("mousedown", md);
    el.addEventListener("mousemove", mm);
    el.addEventListener("mouseup", cancel);
    el.addEventListener("mouseleave", cancel);
    return () => {
      cancel();
      el.removeEventListener("touchstart", ts);
      el.removeEventListener("touchend", cancel);
      el.removeEventListener("touchcancel", cancel);
      el.removeEventListener("mousedown", md);
      el.removeEventListener("mousemove", mm);
      el.removeEventListener("mouseup", cancel);
      el.removeEventListener("mouseleave", cancel);
    };
  }, [map]);

  // Render spot pins when the map exists or spots change.
  const layerRef = useRef<any>(null);
  useEffect(() => {
    if (!map) return;
    (async () => {
      const L = (await import("leaflet")).default;
      layerRef.current?.remove();
      const layer = L.layerGroup();
      const bounds: [number, number][] = [];
      for (const s of spots) {
        const { size, anchor } = spotIconSize(s.icon ?? "pin");
        const icon = L.divIcon({
          className: "",
          html: spotIconHtml(s.icon ?? "pin"),
          iconSize: size,
          iconAnchor: anchor,
        });
        const marker = L.marker([s.lat, s.lng], { icon });
        marker.on("click", () => onSpotClickRef.current?.(s));
        marker.addTo(layer);
        bounds.push([s.lat, s.lng]);
      }
      if (pendingPin) {
        const draft = L.divIcon({
          className: "",
          html: `<div style="width:18px;height:18px;border-radius:50%;background:#1D4ED8;border:3px solid white;box-shadow:0 1px 6px rgba(0,0,0,0.5)"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        L.marker([pendingPin.lat, pendingPin.lng], { icon: draft }).addTo(layer);
        bounds.push([pendingPin.lat, pendingPin.lng]);
      }
      layer.addTo(map);
      layerRef.current = layer;
      // No auto-fit: the map's initial position is controlled by MapsHub
      // (GPS current location, or the last remembered map position).
      // Auto-fitting to spots here caused the map to jump to a seemingly
      // random spot before GPS had a chance to centre it.
    })();
  }, [spots, pendingPin, map]);

  // Basemap switching (streets ⇄ satellite).
  useEffect(() => {
    if (!map || !baseLayersRef.current) return;
    const { streets, satellite } = baseLayersRef.current;
    if (basemap === "satellite") {
      if (!map.hasLayer(satellite)) {
        map.removeLayer(streets);
        satellite.addTo(map);
      }
    } else {
      if (!map.hasLayer(streets)) {
        map.removeLayer(satellite);
        streets.addTo(map);
      }
    }
  }, [basemap, map]);

  // GPS catch pins — your catches in signal orange, others' in pine.
  const catchLayerRef = useRef<any>(null);
  useEffect(() => {
    if (!map) return;
    (async () => {
      const L = (await import("leaflet")).default;
      catchLayerRef.current?.remove();
      const pins = catchPins ?? [];
      if (pins.length === 0) return;
      const layer = L.layerGroup();
      for (const c of pins) {
        const color = c.mine ? "#e4572e" : "#12322b";
        const initial = (c.user_name ?? "?").trim().charAt(0).toUpperCase() || "?";
        const icon = L.divIcon({
          className: "",
          html: c.avatar_url
            ? `<div style="width:32px;height:32px;border-radius:50%;overflow:hidden;border:2.5px solid ${color};box-shadow:0 2px 8px rgba(0,0,0,0.4);background:#12322b;"><img src="${c.avatar_url}" alt="" style="width:100%;height:100%;object-fit:cover;" /></div>`
            : `<div style="width:30px;height:30px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:15px;">${initial}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        const marker = L.marker([c.lat, c.lng], { icon });
        if (onCatchClick) {
          marker.on("click", () => onCatchClick(c));
        } else {
          marker.bindPopup(
            `<strong>${escapeHtml(c.species)}</strong>${
              c.length_in ? `<br/>${c.length_in}&Prime;` : ""
            }`
          );
        }
        marker.addTo(layer);
      }
      layer.addTo(map);
      catchLayerRef.current = layer;
    })();
  }, [catchPins, map, onCatchClick]);

  // Live GPS person marker — follows you whenever we have a fix.
  // Single persistent marker (no duplicates): we reuse one Leaflet marker and
  // just move it / swap its icon, so there's never two location dots.
  const personMarkerRef = useRef<any>(null);
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      const { spotIconHtml, spotIconSize } = await import("./spotIcons");
      if (cancelled) return;
      if (!myLoc) {
        personMarkerRef.current?.remove();
        personMarkerRef.current = null;
        return;
      }
      const { size, anchor } = spotIconSize(followDot);
      const person = L.divIcon({
        className: "",
        html: spotIconHtml(followDot),
        iconSize: size,
        iconAnchor: anchor,
      });
      if (personMarkerRef.current) {
        personMarkerRef.current.setLatLng([myLoc.lat, myLoc.lng]);
        personMarkerRef.current.setIcon(person);
      } else {
        personMarkerRef.current = L.marker([myLoc.lat, myLoc.lng], {
          icon: person,
          interactive: false,
          zIndexOffset: 500,
        }).addTo(map);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [map, myLoc, followDot]);

  // Trail polylines: live recording (orange) + saved overlay (blue).
  const trailLayerRef = useRef<any>(null);
  useEffect(() => {
    if (!map) return;
    (async () => {
      const L = (await import("leaflet")).default;
      trailLayerRef.current?.remove();
      const layer = L.layerGroup();
      if (trailPts.length >= 2) {
        L.polyline(
          trailPts.map((p) => [p.lat, p.lng]),
          { color: "#EA580C", weight: 4, opacity: 0.9 }
        ).addTo(layer);
      }
      if (overlayTrail && overlayTrail.length >= 2) {
        L.polyline(
          overlayTrail.map((p) => [p.lat, p.lng]),
          { color: "#1D4ED8", weight: 4, opacity: 0.85, dashArray: "8 6" }
        ).addTo(layer);
      }
      layer.addTo(map);
      trailLayerRef.current = layer;
    })();
  }, [map, trailPts, overlayTrail]);

  // Go-to line: dashed from your location to the target.
  const goToLayerRef = useRef<any>(null);
  useEffect(() => {
    if (!map) return;
    (async () => {
      const L = (await import("leaflet")).default;
      goToLayerRef.current?.remove();
      if (!goTo || !myLoc) return;
      const layer = L.layerGroup();
      L.polyline(
        [
          [myLoc.lat, myLoc.lng],
          [goTo.lat, goTo.lng],
        ],
        { color: "#15803D", weight: 3, opacity: 0.8, dashArray: "6 8" }
      ).addTo(layer);
      layer.addTo(map);
      goToLayerRef.current = layer;
    })();
  }, [map, goTo, myLoc]);

  // Measure line between the two tapped points.
  const measureLayerRef = useRef<any>(null);
  useEffect(() => {
    if (!map) return;
    (async () => {
      const L = (await import("leaflet")).default;
      measureLayerRef.current?.remove();
      if (measurePts.length < 2) return;
      const layer = L.layerGroup();
      L.polyline(
        measurePts.map((p) => [p.lat, p.lng]),
        { color: "#7C3AED", weight: 3, opacity: 0.9, dashArray: "4 6" }
      ).addTo(layer);
      layer.addTo(map);
      measureLayerRef.current = layer;
    })();
  }, [map, measurePts]);

  const measureDist =
    measurePts.length === 2
      ? haversineM(measurePts[0].lat, measurePts[0].lng, measurePts[1].lat, measurePts[1].lng)
      : null;

  // Recording: append GPS fixes while recording (10 m movement filter).
  useEffect(() => {
    if (!recording || !myLoc) return;
    setTrailPts((prev) => {
      const last = prev[prev.length - 1];
      if (last && haversineM(last.lat, last.lng, myLoc.lat, myLoc.lng) < 10) return prev;
      return [...prev, { lat: myLoc.lat, lng: myLoc.lng, t: Date.now() }];
    });
  }, [recording, myLoc]);

  // Recording elapsed clock.
  useEffect(() => {
    if (!recording || trailStart === null) return;
    setTrailElapsed(Date.now() - trailStart);
    const t = setInterval(() => setTrailElapsed(Date.now() - (trailStart as number)), 1000);
    return () => clearInterval(t);
  }, [recording, trailStart]);

  const startRecording = () => {
    setTrailPts([]);
    setTrailElapsed(0);
    setTrailStart(Date.now());
    setTrailNote(null);
    setRecording(true);
    setFollowing(true);
    // Jump the map to you so you can watch the trail draw as you move.
    if (myLoc && map) {
      map.flyTo([myLoc.lat, myLoc.lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
    } else {
      setTrailNote("Waiting for GPS signal…");
    }
  };

  const stopRecording = () => {
    setRecording(false);
    setFollowing(false);
    setTrailPts((prev) => {
      if (prev.length >= 2) {
        setTrailName(defaultTrailName());
        setShowSave(true);
      }
      return prev;
    });
  };

  const cancelRecording = () => {
    setRecording(false);
    setFollowing(false);
    setTrailPts([]);
    setShowSave(false);
    setTrailNote(null);
  };

  // Follow mode: keep your marker centered while recording.
  useEffect(() => {
    if (!map || !recording || !following || !myLoc) return;
    map.panTo([myLoc.lat, myLoc.lng], { animate: true });
  }, [map, recording, following, myLoc]);

  // A manual drag pauses follow mode; the ◎ button resumes it.
  useEffect(() => {
    if (!map) return;
    const onDrag = () => setFollowing(false);
    map.on("dragstart", onDrag);
    return () => {
      map.off("dragstart", onDrag);
    };
  }, [map]);

  // Clear the "waiting for GPS" note once the first fix arrives.
  useEffect(() => {
    if (recording && myLoc) {
      setTrailNote((n) => (n === "Waiting for GPS signal…" ? null : n));
    }
  }, [recording, myLoc]);

  const saveTrail = async () => {
    if (trailPts.length < 2 || savingTrail) return;
    setSavingTrail(true);
    setTrailNote(null);
    try {
      let d = 0;
      for (let i = 1; i < trailPts.length; i++) {
        d += haversineM(trailPts[i - 1].lat, trailPts[i - 1].lng, trailPts[i].lat, trailPts[i].lng);
      }
      await fishFetch("/api/fishmb/trails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trailName.trim() || defaultTrailName(), points: trailPts, distance_m: d }),
      });
      setTrailPts([]);
      setShowSave(false);
      setTrailName("");
      onTrailSaved?.();
    } catch (e) {
      setTrailNote(e instanceof Error ? e.message : "Could not save trail.");
    } finally {
      setSavingTrail(false);
    }
  };

  // Cursor feedback while picking a spot.
  useEffect(() => {
    if (map && containerRef.current) {
      containerRef.current.style.cursor = picking ? "crosshair" : measureMode ? "copy" : "";
    }
  }, [picking, measureMode, map]);

  // External recenter requests (favorite lake or spot clicked).
  const lastFocusKey = useRef<string | null>(null);
  // A focus request flies the map to a specific place.
  useEffect(() => {
    if (!map || !focus || focus.key === lastFocusKey.current) return;
    lastFocusKey.current = focus.key;
    const zoom = focus.zoom ?? 11;
    const offsetY = (focus as { offsetY?: number }).offsetY;
    if (offsetY) {
      // Place the target up on screen (fraction of viewport height) so it
      // sits centred in the visible map area above a half-open sheet.
      // Done in one flyTo: project the lake, shift down by the offset, and
      // unproject — that point becomes the map centre, putting the lake
      // offsetY * height above screen centre.
      const lakePoint = map.project([focus.lat, focus.lng], zoom);
      const centrePoint = lakePoint.add([0, window.innerHeight * offsetY]);
      const centre = map.unproject(centrePoint, zoom);
      map.flyTo(centre, zoom, { animate: true, duration: 1.2 });
    } else {
      map.flyTo([focus.lat, focus.lng], zoom, { animate: true, duration: 1.2 });
    }
  }, [map, focus]);

  // Smooth pan for follow-me — no zoom change, no fly animation fighting GPS.
  const lastPanKey = useRef<string | null>(null);
  useEffect(() => {
    if (!map || !panTo || panTo.key === lastPanKey.current) return;
    lastPanKey.current = panTo.key;
    map.panTo([panTo.lat, panTo.lng], { animate: true, duration: 0.8 });
  }, [map, panTo]);

  // A quick tap on the map (not a drag, not a long-press) opens it fullscreen.
  // Skipped while dropping a pin or measuring, and taps on markers/popups/
  // controls are left alone.
  useEffect(() => {
    if (expanded) return;
    const el = containerRef.current;
    if (!el) return;
    let sx = 0;
    let sy = 0;
    let st = 0;
    let tracking = false;
    const interactive = (t: EventTarget | null) =>
      t instanceof HTMLElement &&
      !!t.closest(".leaflet-marker-icon, .leaflet-popup, .leaflet-control, button, a");
    const down = (x: number, y: number, t: EventTarget | null) => {
      if (interactive(t)) {
        tracking = false;
        return;
      }
      tracking = true;
      sx = x;
      sy = y;
      st = Date.now();
    };
    const up = (x: number, y: number) => {
      if (!tracking) return;
      tracking = false;
      if (
        !fillRef.current &&
        !pickingRef.current &&
        !measureModeRef.current &&
        Date.now() - st < 350 &&
        Math.hypot(x - sx, y - sy) < 12
      ) {
        setExpanded(true);
      }
    };
    const tDown = (e: TouchEvent) => {
      if (e.touches.length === 1) down(e.touches[0].clientX, e.touches[0].clientY, e.target);
    };
    const tUp = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      up(t.clientX, t.clientY);
    };
    const mDown = (e: MouseEvent) => down(e.clientX, e.clientY, e.target);
    const mUp = (e: MouseEvent) => up(e.clientX, e.clientY);
    el.addEventListener("touchstart", tDown, { passive: true });
    el.addEventListener("touchend", tUp);
    el.addEventListener("mousedown", mDown);
    el.addEventListener("mouseup", mUp);
    return () => {
      el.removeEventListener("touchstart", tDown);
      el.removeEventListener("touchend", tUp);
      el.removeEventListener("mousedown", mDown);
      el.removeEventListener("mouseup", mUp);
    };
  }, [expanded]);

  // Keep Leaflet's internal size in sync with the container (expand/collapse,
  // rotation, etc.) so tiles always paint.
  useEffect(() => {
    if (!map || !containerRef.current) return;
    const el = containerRef.current;
    const fix = () => {
      try {
        map.invalidateSize();
      } catch {
        // non-fatal
      }
    };
    const t1 = setTimeout(fix, 60);
    const t2 = setTimeout(fix, 400);
    const t3 = setTimeout(fix, 1200);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => fix());
      ro.observe(el);
    }
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      ro?.disconnect();
    };
  }, [map]);

  // Fullscreen mode: lock the page behind the map, Escape exits.
  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  const speedKmh = myLoc?.speed != null && myLoc.speed > 0.5 ? myLoc.speed * 3.6 : null;

  // Record + measure buttons, shared by the fullscreen overlay and the
  // under-map row (full-width so both are always visible and tappable).
  const recordButton = (
    <button
      type="button"
      onClick={() => (recording ? stopRecording() : startRecording())}
      aria-label={recording ? "Stop recording trail" : "Record boat trail"}
      title={recording ? "Stop recording" : "Record your boat trail"}
      className={`flex-1 flex items-center justify-center gap-1.5 rounded-full px-4 py-3 text-xs font-black uppercase tracking-wider shadow-lg border transition-colors ${
        recording
          ? "bg-red-600 text-white border-red-700 animate-pulse"
          : "bg-white/95 text-pine border-pine/15 hover:bg-white"
      }`}
    >
      {recording ? `⏹ ${fmtElapsed(trailElapsed)}` : "⏺ Record"}
    </button>
  );
  const measureButton = (
    <button
      type="button"
      onClick={() => {
        setMeasureMode((m) => !m);
        setMeasurePts([]);
      }}
      aria-label="Measure distance"
      title="Measure distance between two taps"
      className={`flex-1 rounded-full px-4 py-3 text-xs font-black uppercase tracking-wider shadow-lg border transition-colors ${
        measureMode
          ? "bg-pine text-white border-pine"
          : "bg-white/95 text-pine border-pine/15 hover:bg-white"
      }`}
    >
 Measure
    </button>
  );

  return (
    <div
      className={
        fill
          ? "relative h-full w-full overflow-hidden isolate"
          : expanded
            ? "fixed inset-0 z-[900] bg-white"
            : "-mx-8 md:mx-0 md:rounded-3xl md:overflow-hidden md:border md:border-pine/10 md:shadow-sm relative"
      }
    >
      {expanded && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="absolute top-3 left-3 z-[1001] bg-white/95 backdrop-blur border border-pine/15 rounded-full px-5 py-2.5 text-sm font-bold text-pine shadow-lg"
        >
          ← Back
        </button>
      )}
      {!fill && <ContoursToggle />}
      {/* Long-press circular fill indicator */}
      {pressRing && (
        <div
          className="absolute z-[1002] pointer-events-none"
          style={{
            left: pressRing.x - 48,
            top: pressRing.y - 48,
            width: 96,
            height: 96,
          }}
        >
          <svg width="96" height="96" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r="42" fill="rgba(255,255,255,0.85)" />
            <circle
              cx="48"
              cy="48"
              r="42"
              fill="none"
              stroke="#1d4d2b"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 42}
              strokeDashoffset={2 * Math.PI * 42 * (1 - pressRing.p)}
              transform="rotate(-90 48 48)"
            />
          </svg>
        </div>
      )}
      {/*
        Sizing wrapper is React-owned; the inner div belongs to Leaflet.
        Its className must NEVER change between renders — when it does,
        React rewrites the whole class attribute and wipes the
        `leaflet-container` class L.map() adds, which blanks every tile
        (all Leaflet tile CSS is scoped under .leaflet-container).
      */}
      <div
        className={expanded || fill ? "h-full w-full select-none" : "h-[300px] md:h-[380px] w-full z-0 select-none"}
        style={{ WebkitTouchCallout: "none", WebkitTapHighlightColor: "transparent" }}
      >
        <div ref={containerRef} className="h-full w-full" />
      </div>

      {/* Measure result pill */}
      {measureDist !== null && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[600] bg-pine-deep/90 text-white text-xs font-bold rounded-full px-4 py-2 shadow-lg whitespace-nowrap">
 {formatDist(measureDist)}
          <button
            type="button"
            aria-label="Clear measurement"
            onClick={() => setMeasurePts([])}
            className="ml-2 text-white/70 hover:text-white font-black"
          >
 
          </button>
        </div>
      )}

      {/* Live speed readout — sits above the map attribution */}
      {speedKmh !== null && (
        <div className="absolute bottom-9 right-3 z-[600] bg-pine-deep/90 text-white text-xs font-bold rounded-full px-3.5 py-2 shadow-lg tabular-nums">
 {speedKmh.toFixed(0)} km/h
        </div>
      )}

      {/* Recenter: resumes follow mode after a manual drag while recording */}
      {recording && !following && (
        <button
          type="button"
          onClick={() => {
            setFollowing(true);
            if (myLoc && map) {
              map.flyTo([myLoc.lat, myLoc.lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
            }
          }}
          aria-label="Follow my location"
          title="Follow my location"
          className="absolute bottom-24 right-3 z-[600] w-11 h-11 rounded-full bg-white/95 border border-pine/15 shadow-lg text-pine text-xl flex items-center justify-center"
        >
          ◎
        </button>
      )}

      {/* Map toolbar: record trail + measure. Overlaid in fullscreen/fill
          modes; otherwise it sits in normal flow right under the map so
          nothing on the map can cover the buttons. */}
      {(expanded || fill) && (
        <div className="absolute bottom-9 left-3 right-3 z-[600] flex gap-2">
          {recordButton}
          {measureButton}
        </div>
      )}
      {measureMode && (
        <p className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[600] bg-pine-deep/90 text-white text-[11px] font-bold rounded-full px-3.5 py-1.5 shadow-lg whitespace-nowrap">
          Tap two points on the map
        </p>
      )}

      {/* Save-trail dialog */}
      {showSave && (
        <div className="absolute inset-0 z-[700] flex items-center justify-center p-4 bg-pine-deep/50">
          <div className="bg-paper rounded-3xl p-6 w-full max-w-xs shadow-2xl">
            <h3 className="font-bold text-pine text-lg mb-1">Save trail</h3>
            <p className="text-pine/55 text-xs mb-4 tabular-nums">
              {trailPts.length} points · {formatDist(trailPts.reduce((d, p, i) => (i === 0 ? d : d + haversineM(trailPts[i - 1].lat, trailPts[i - 1].lng, p.lat, p.lng)), 0))} · {fmtElapsed(Date.now() - (trailStart ?? Date.now()))}
            </p>
            {trailNote && (
              <p className="text-sm text-signal-dark bg-signal/10 border border-signal/30 rounded-2xl px-4 py-2.5 mb-3">
                {trailNote}
              </p>
            )}
            <input
              value={trailName}
              onChange={(e) => setTrailName(e.target.value)}
              maxLength={80}
              placeholder="Trail name"
              className="w-full bg-white border border-pine/15 rounded-2xl px-4 py-3 text-sm text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal mb-3"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelRecording}
                className="flex-1 bg-pine/10 hover:bg-pine/20 text-pine font-bold uppercase tracking-wider text-xs px-4 py-3 rounded-full transition-colors"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={saveTrail}
                disabled={savingTrail}
                className="flex-1 bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-xs px-4 py-3 rounded-full disabled:opacity-50 transition-colors"
              >
                {savingTrail ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {!expanded && !fill && (
        <div className="flex gap-2 px-4 py-3 bg-white border-t border-pine/10">
          {recordButton}
          {measureButton}
        </div>
      )}

      {!expanded && (
        <p className="text-xs text-pine/50 px-4 py-2.5 bg-white">
          {picking
            ? "Tap the map to drop your pin — or hold your finger down on any spot to mark it."
            : spots.length === 0
              ? "No spots yet — tap the map to go fullscreen, or hold your finger down to mark one."
              : `${spots.length} spot${spots.length === 1 ? "" : "s"} — only you can see them. Tap the map to go fullscreen.`}
        </p>
      )}
    </div>
  );
}

// Re-exported so parents can build matching icon pickers.
export { SPOT_ICON_CHOICES };
