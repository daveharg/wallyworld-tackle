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
  {
    id: "prairie",
    name: "Prairie",
    desc: "Golden wheat fields",
    swatch: ["#3a3a20", "#c86e23", "#b49628"],
  },
  {
    id: "ice",
    name: "Ice",
    desc: "Hardwater steel blue",
    swatch: ["#264458", "#2e9bc6", "#c9962e"],
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const KEY = "fishmb-theme";

export const DEFAULT_THEME: ThemeId = "forest";

const VALID: readonly string[] = THEMES.map((t) => t.id);

export function getTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const t = window.localStorage.getItem(KEY);
  return (VALID as string[]).includes(t ?? "") ? (t as ThemeId) : DEFAULT_THEME;
}

export function setTheme(id: ThemeId) {
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    // Storage is best-effort.
  }
  document.documentElement.setAttribute("data-theme", id);
}
