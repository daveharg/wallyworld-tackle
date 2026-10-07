// Typo-tolerant search for FishMB (e.g. "walley" finds walleye lakes).

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let cur0 = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const next = Math.min(prev[j] + 1, cur0 + 1, prev[j - 1] + cost);
      prev[j - 1] = cur0;
      cur0 = next;
    }
    prev[b.length] = cur0;
  }
  return prev[b.length];
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Score a lake against a query; higher is better, 0 = no match. */
export function matchScore(haystack: string, query: string): number {
  const h = normalize(haystack);
  const q = normalize(query);
  if (!q) return 0;
  if (h === q) return 100;
  if (h.startsWith(q)) return 80;
  if (h.includes(q)) return 60;
  // Typo tolerance: compare against each word.
  if (q.length >= 4) {
    const words = h.split(" ");
    let best = Infinity;
    for (const w of words) {
      if (Math.abs(w.length - q.length) > 2) continue;
      const d = levenshtein(w, q);
      if (d < best) best = d;
    }
    if (best <= 2) return 40 - best * 10;
    // Also try the whole name without spaces for close matches.
    const nospace = h.replace(/ /g, "");
    if (Math.abs(nospace.length - q.length) <= 2 && levenshtein(nospace, q) <= 2) {
      return 25;
    }
  }
  return 0;
}

export interface Searchable {
  id: string;
  name: string;
  aliases?: string[];
  species: string[];
  region: string;
  stocked?: boolean;
}

/** Fuzzy lake search: matches name, species, and region. Typo-tolerant.
 *  Multi-word queries score per word ("stocked trout" finds stocked trout
 *  lakes); the word "stocked" filters to stocked waters. */
export function searchLakes<T extends Searchable>(lakes: T[], query: string): T[] {
  const q = normalize(query);
  if (!q) return lakes;
  const words = q.split(" ").filter(Boolean);
  const stockedOnly = words.includes("stocked") || words.includes("stocking");
  const terms = words.filter((w) => w !== "stocked" && w !== "stocking");
  const scored: { lake: T; score: number }[] = [];
  for (const lake of lakes) {
    if (stockedOnly && !lake.stocked) continue;
    let score = 0;
    for (const t of terms.length ? terms : [q]) {
      const nameScore = matchScore(lake.name, t);
      const aliasScore = Math.max(0, ...(lake.aliases ?? []).map((a) => matchScore(a, t)));
      const speciesScore = Math.max(0, ...lake.species.map((s) => matchScore(s, t) * 0.7));
      const regionScore = matchScore(lake.region, t) * 0.4;
      score += Math.max(nameScore, aliasScore, speciesScore, regionScore);
    }
    if (score > 0) scored.push({ lake, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.lake);
}
