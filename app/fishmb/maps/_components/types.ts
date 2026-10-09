export interface MapCatch {
  id: string;
  species: string;
  length_in: number | null;
  weight_lb: number | null;
  photo_url: string | null;
  lat: number;
  lng: number;
  caught_at: string;
  user_name: string;
  mine: boolean;
}

export interface SavedLake {
  id: string;
  name: string;
  region?: string;
  lat: number | null;
  lng: number | null;
}
