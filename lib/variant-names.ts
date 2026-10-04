// Display-name mappings for supplier-coded variant option values.
// The underlying Shopify variant values stay unchanged (DSers mapping depends on
// them); only the customer-facing label changes.
//
// Add new product mappings here as products are onboarded.

type VariantLabelMap = Record<string, string>;

// Keyed by product handle (preferred) — falls back to matching by title substring.
export const VARIANT_DISPLAY_NAMES: Record<string, VariantLabelMap> = {
  // DEEP WALLEYE Trolling Crankbait — supplier color codes → descriptive names.
  "deep-walleye-trolling-crankbait-125mm-diving-lure": {
    "Color I": "Chartreuse Green",
    "Color K": "Black White",
    "Color J": "Silver Blue",
    "Color L": "Deep Orange",
    "Color X": "Charcoal Gray",
    "Color O": "Metallic Blue",
    "Color P": "Pink Purple",
    "Color N": "Silver Gray",
    "Color C": "Green Chartreuse",
    "Color B": "Orange Gold",
    "Color E": "Fire Tiger Green",
  },
  // Curly Tail Grubs 20-Pack — supplier size codes → size + color names.
  "curly-tail-grubs": {
    "5pcs 5cm": "5pcs 5cm Green",
    "5pcs 5cm 1": "5pcs 5cm Red",
    "5pcs 5cm 2": "5pcs 5cm White",
    "5pcs 6.5cm": "5pcs 6.5cm Orange",
    "5pcs 6.5cm 1": "5pcs 6.5cm White",
    "5pcs 6.5cm 2": "5pcs 6.5cm Green",
    "5pcs 6.5cm 3": "5pcs 6.5cm Gray",
  },
};

// Title-substring fallbacks for products whose handle isn't in the map above.
const TITLE_FALLBACKS: { match: RegExp; map: VariantLabelMap }[] = [
  {
    match: /deep walleye/i,
    map: {
      "Color I": "Chartreuse Green",
      "Color K": "Black White",
      "Color J": "Silver Blue",
      "Color L": "Deep Orange",
      "Color X": "Charcoal Gray",
      "Color O": "Metallic Blue",
      "Color P": "Pink Purple",
      "Color N": "Silver Gray",
      "Color C": "Green Chartreuse",
      "Color B": "Orange Gold",
      "Color E": "Fire Tiger Green",
    },
  },
  {
    match: /curly tail grub/i,
    map: {
      "5pcs 5cm": "5pcs 5cm Green",
      "5pcs 5cm 1": "5pcs 5cm Red",
      "5pcs 5cm 2": "5pcs 5cm White",
      "5pcs 6.5cm": "5pcs 6.5cm Orange",
      "5pcs 6.5cm 1": "5pcs 6.5cm White",
      "5pcs 6.5cm 2": "5pcs 6.5cm Green",
      "5pcs 6.5cm 3": "5pcs 6.5cm Gray",
    },
  },
];

/**
 * Customer-facing label for a variant option value.
 * Never returns "Default Title" — falls back to a cleaned-up value instead.
 */
export function variantDisplayLabel(
  productHandle: string,
  productTitle: string,
  rawValue: string
): string {
  const byHandle = VARIANT_DISPLAY_NAMES[productHandle];
  if (byHandle && byHandle[rawValue]) return byHandle[rawValue];

  for (const fb of TITLE_FALLBACKS) {
    if (fb.match.test(productTitle) && fb.map[rawValue]) return fb.map[rawValue];
  }

  if (rawValue === "Default Title") return productTitle;
  return rawValue;
}
