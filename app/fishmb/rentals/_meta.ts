// Shared display metadata for FishMB rental categories.
// (Files starting with _ in app/ are not routes.)

export const RENTAL_CATS = [
  { key: "shack", emoji: "🛖", label: "Ice shacks", singular: "ice shack" },
  { key: "tent", emoji: "⛺", label: "Tents", singular: "tent" },
  { key: "equipment", emoji: "🎿", label: "Equipment", singular: "equipment" },
  { key: "guide", emoji: "🎣", label: "Guide services", singular: "guide service" },
] as const;

export type RentalCatKey = (typeof RENTAL_CATS)[number]["key"];

export function catMeta(key: string) {
  return RENTAL_CATS.find((c) => c.key === key) ?? RENTAL_CATS[0];
}
