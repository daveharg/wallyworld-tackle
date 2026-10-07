import speciesJson from "./fishmb-species.json";

export interface SpeciesAdvice {
  species: string;
  overview: string;
  techniques: string[];
  baits: string[];
  best_seasons: string;
}

export function slugifySpecies(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function getSpeciesAdvice(): SpeciesAdvice[] {
  return speciesJson as SpeciesAdvice[];
}

export function getSpeciesBySlug(slug: string): SpeciesAdvice | null {
  return getSpeciesAdvice().find((s) => slugifySpecies(s.species) === slug) ?? null;
}
