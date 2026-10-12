export type SheetTab = "catches" | "spots" | "lakes" | "settings";

export interface MapCatch {
  id: string;
  user_id: string;
  species: string;
  length_in: number | null;
  weight_lb: number | null;
  depth_ft?: number | null;
  photo_url: string | null;
  lat: number;
  lng: number;
  caught_at: string;
  user_name: string;
  avatar_url: string | null;
  mine: boolean;
  /** The author is an accepted friend of the viewer (map-catches API). */
  friend?: boolean;
}

export interface SavedLake {
  id: string;
  name: string;
  region?: string;
  lat: number | null;
  lng: number | null;
}
