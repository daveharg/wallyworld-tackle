// Spot icon choices for saved fishing spots.
export const SPOT_ICON_CHOICES = [
  { id: "pin", emoji: "📍", label: "Pin" },
  { id: "dot-red", emoji: "🔴", label: "Red dot" },
  { id: "dot-blue", emoji: "🔵", label: "Blue dot" },
  { id: "dot-green", emoji: "🟢", label: "Green dot" },
  { id: "dot-yellow", emoji: "🟡", label: "Yellow dot" },
  { id: "dot-purple", emoji: "🟣", label: "Purple dot" },
  { id: "fish", emoji: "🐟", label: "Fish" },
  { id: "rock", emoji: "🪨", label: "Rock" },
  { id: "weed", emoji: "🌿", label: "Weeds" },
  { id: "boat", emoji: "", label: "Boat", svg: "boat" },
] as const;

export type SpotIconId = (typeof SPOT_ICON_CHOICES)[number]["id"];

export function isSpotIconId(v: unknown): v is SpotIconId {
  return SPOT_ICON_CHOICES.some((c) => c.id === v);
}

const DOT_COLORS: Record<string, string> = {
  pin: "#C2410C",
  "dot-red": "#DC2626",
  "dot-blue": "#2563EB",
  "dot-green": "#16A34A",
  "dot-yellow": "#EAB308",
  "dot-purple": "#9333EA",
};

/** Bird's-eye view boat icon (top-down) as inline SVG. */
function boatSvgHtml(): string {
  return `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));transform:translate(-4px,-10px);">
    <path d="M14 1 C18 6, 21 12, 21 18 C21 23, 18 26, 14 26 C10 26, 7 23, 7 18 C7 12, 10 6, 14 1 Z" fill="#1d4d2b" stroke="white" stroke-width="1.5"/>
    <rect x="11" y="12" width="6" height="8" rx="1.5" fill="white" opacity="0.9"/>
    <path d="M14 1 C18 6, 21 12, 21 18" stroke="white" stroke-width="1" opacity="0.3"/>
  </svg>`;
}

/** Inner HTML for a Leaflet divIcon marker for the given spot icon id. */
export function spotIconHtml(icon: string): string {
  const color = DOT_COLORS[icon];
  if (color) {
    return `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.45)"></div>`;
  }
  if (icon === "boat") return boatSvgHtml();
  const found = SPOT_ICON_CHOICES.find((c) => c.id === icon);
  if (!found) {
    return `<div style="width:14px;height:14px;border-radius:50%;background:#C2410C;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.45)"></div>`;
  }
  return `<div style="font-size:24px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));transform:translate(-4px,-10px);">${found.emoji}</div>`;
}

/** divIcon size/anchor per icon id (emoji markers are bigger than the dot). */
export function spotIconSize(icon: string): { size: [number, number]; anchor: [number, number] } {
  if (DOT_COLORS[icon] || !isSpotIconId(icon)) return { size: [14, 14], anchor: [7, 7] };
  return { size: [28, 28], anchor: [14, 20] };
}
