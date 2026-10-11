"use client";

/** FishMB color themes — persisted in localStorage, applied via data-theme. */

export const THEMES = [
  {
    id: "forest",
    name: "Forest",
    desc: "Classic FishMB greens",
    swatch: ["#12322b", "#e4572e", "#b97e14"],
  },
  {
    id: "ocean",
    name: "Ocean",
    desc: "Deep lake blues",
    swatch: ["#0b3b52", "#0891b2", "#ca8804"],
  },
  {
    id: "sunset",
    name: "Sunset",
    desc: "Warm prairie dusk",
    swatch: ["#4a2416", "#d9481f", "#c47d14"],
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const KEY = "fishmb-theme";

export function getTheme(): ThemeId {
  if (typeof window === "undefined") return "forest";
  const t = window.localStorage.getItem(KEY);
  return t === "ocean" || t === "sunset" || t === "forest" ? t : "forest";
}

export function setTheme(id: ThemeId) {
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    // Storage is best-effort.
  }
  document.documentElement.setAttribute("data-theme", id);
}
