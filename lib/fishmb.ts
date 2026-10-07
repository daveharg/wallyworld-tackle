import fs from "fs";
import path from "path";

export { LAKE_REGIONS } from "./fishmb-constants";

/**
 * FishMB website data access. Single source of truth is the same
 * public/fish-manitoba/data.json bundle the FishMB app consumes —
 * 271 lakes, 127 lodges/guides, 2026 Anglers' Guide regulations,
 * stocking history, hot-lake reports, towns index.
 */

export interface LakeRegulations {
  division: string;
  division_approximate: boolean;
  special: string;
  note: string;
  source: string;
}

export interface Lake {
  id: string;
  name: string;
  region: string;
  photo: string | null;
  species: string[];
  size_text: string;
  max_depth_text: string;
  description: string;
  depth_map_url: string | null;
  stocked: boolean;
  stocked_species: string[];
  towns: { name: string; distance_km?: number }[] | string[];
  regulations: LakeRegulations;
  lodging: { name: string; detail?: string }[];
  restaurants: { name: string; detail?: string }[];
  boat_rentals: { name: string; detail?: string }[];
  limits_zone: string;
  limits_approximate: boolean;
}

export interface Lodge {
  id: string;
  name: string;
  location: string;
  kind: string;
  species: string[];
  description: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  amenities: string[];
  packages: { name: string; detail?: string }[];
  rates_note: string;
  fishing_waters: string[];
  ice_fishing: boolean;
  ice_fishing_details: string;
  established: string | null;
}

export interface ZoneLimit {
  species: string;
  limit: string;
  size: string;
  season: string;
}

export interface RegZone {
  id: string;
  name: string;
  description: string;
  limits: ZoneLimit[];
}

export interface HotLake {
  lake: string;
  date: string;
  species: string;
  report: string;
}

export interface YoutubeShow {
  name: string;
  description: string;
  url: string;
}

export interface Tournament {
  name: string;
  dates: string;
  location: string;
  entry: string;
  description: string;
  url: string;
}

interface FishData {
  updated: string;
  regulations: {
    zones: RegZone[];
    licensing: unknown;
    general_rules: unknown;
    guide_url: string;
  };
  lakes: Lake[];
  lodges: Lodge[];
  ice_fishing: unknown;
  species_advice: unknown[];
  master_angler: unknown;
  youtube_shows: unknown[];
  hot_lakes: HotLake[];
  towns_index: { town: string; lakes: string[] }[] | unknown[];
}

let cache: FishData | null = null;

export function getFishData(): FishData {
  if (cache) return cache;
  const p = path.join(process.cwd(), "public", "fish-manitoba", "data.json");
  cache = JSON.parse(fs.readFileSync(p, "utf8")) as FishData;
  return cache;
}

export function getLakes(): Lake[] {
  return getFishData().lakes;
}

export function getLake(id: string): Lake | undefined {
  return getFishData().lakes.find((l) => l.id === id);
}

export function getLodges(): Lodge[] {
  return getFishData().lodges;
}

export function getLodge(id: string): Lodge | undefined {
  return getFishData().lodges.find((l) => l.id === id);
}

export function getZones(): RegZone[] {
  return getFishData().regulations.zones;
}

export function getZone(id: string): RegZone | undefined {
  return getFishData().regulations.zones.find((z) => z.id === id);
}

export function getHotLakes(): HotLake[] {
  return getFishData().hot_lakes;
}

export function getGuideUrl(): string {
  const g = getFishData().regulations.guide_url;
  return typeof g === "string" && g.length > 0
    ? g
    : "https://www.gov.mb.ca/nrnd/fish-wildlife/pubs/fish_wildlife/fish/angling-guide.pdf";
}

/** Lakes known to hold walleye, for the "Top walleye lakes" row. */
export function getWalleyeLakes(limit = 12): Lake[] {
  return getLakes()
    .filter((l) => l.species.some((s) => s.toLowerCase().includes("walleye")))
    .slice(0, limit);
}

export function getYoutubeShows(): YoutubeShow[] {
  return getFishData().youtube_shows as YoutubeShow[];
}

/** Upcoming Manitoba fishing tournaments (researched periodically). Empty when the file is missing. */
export function getTournaments(): { updated: string; tournaments: Tournament[] } {
  try {
    const p = path.join(process.cwd(), "public", "fishmb", "tournaments.json");
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return { updated: "", tournaments: [] };
  }
}

export function getStockedLakes(limit = 12): Lake[] {
  return getLakes().filter((l) => l.stocked).slice(0, limit);
}

/** Simple client+server search across lakes and lodges. */
export function searchAll(q: string, limit = 8): {
  lakes: Lake[];
  lodges: Lodge[];
} {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return { lakes: [], lodges: [] };
  const lakes = getLakes()
    .filter(
      (l) =>
        l.name.toLowerCase().includes(needle) ||
        l.region.toLowerCase().includes(needle) ||
        l.species.some((s) => s.toLowerCase().includes(needle))
    )
    .slice(0, limit);
  const lodges = getLodges()
    .filter(
      (l) =>
        l.name.toLowerCase().includes(needle) ||
        (l.location ?? "").toLowerCase().includes(needle) ||
        l.species.some((s) => s.toLowerCase().includes(needle)) ||
        (l.fishing_waters ?? []).some((w) => w.toLowerCase().includes(needle))
    )
    .slice(0, limit);
  return { lakes, lodges };
}
