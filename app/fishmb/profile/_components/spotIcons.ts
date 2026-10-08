// Spot icon choices for saved fishing spots.
export const SPOT_ICON_CHOICES = [
  { id: "pin", emoji: "📍", label: "Pin" },
  { id: "fish", emoji: "🐟", label: "Fish" },
  { id: "rock", emoji: "🪨", label: "Rock" },
  { id: "weed", emoji: "🌿", label: "Weeds" },
] as const;

export type SpotIconId = (typeof SPOT_ICON_CHOICES)[number]["id"];

export function isSpotIconId(v: unknown): v is SpotIconId {
  return SPOT_ICON_CHOICES.some((c) => c.id === v);
}

/** Inner HTML for a Leaflet divIcon marker for the given spot icon id. */
export function spotIconHtml(icon: string): string {
  const found = SPOT_ICON_CHOICES.find((c) => c.id === icon);
  if (!found || found.id === "pin") {
    return `<div style="width:14px;height:14px;border-radius:50%;background:#C2410C;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.45)"></div>`;
  }
  return `<div style="font-size:24px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));transform:translate(-4px,-10px);">${found.emoji}</div>`;
}

/** divIcon size/anchor per icon id (emoji markers are bigger than the dot). */
export function spotIconSize(icon: string): { size: [number, number]; anchor: [number, number] } {
  if (icon === "pin" || !isSpotIconId(icon)) return { size: [14, 14], anchor: [7, 7] };
  return { size: [28, 28], anchor: [14, 20] };
}
