// Shared reaction vocabulary for the press-and-hold menu (feed posts,
// feed comments, Messenger messages). Pure logic only — no DB, no React —
// so it can be unit-tested standalone.
//
// Feed posts/comments store reactions as smallint codes in
// fm_post_reactions / fm_comment_reactions (value column). Codes 1, -1, 2
// predate this module (👍 like, 👎 dislike, 😆 laugh) and MUST keep
// rendering; the Facebook picker set adds 3..7. 👎 stays displayable as a
// chip (legacy rows) but is not offered in the picker — Facebook's set has
// no dislike.

/** Code → emoji for every storable feed reaction value. */
export const FEED_REACTION_EMOJI: Record<number, string> = {
  1: "👍",
  "-1": "👎",
  2: "😆",
  3: "❤️",
  4: "🥰",
  5: "😮",
  6: "😢",
  7: "😡",
};

/** The Facebook seven, in Facebook's picker order, as feed codes. */
export const FEED_REACTION_PICKER: number[] = [1, 3, 4, 2, 5, 6, 7];

/** Every value the feed react endpoints accept (picker set + legacy 👎). */
export const FEED_REACTION_VALUES: readonly number[] = [1, -1, 2, 3, 4, 5, 6, 7];

export function isFeedReactionValue(v: unknown): v is number {
  return typeof v === "number" && FEED_REACTION_VALUES.includes(v);
}

export function feedEmojiFor(code: number | null | undefined): string | null {
  if (code === null || code === undefined) return null;
  return FEED_REACTION_EMOJI[code] ?? null;
}

export interface ReactionChip {
  emoji: string;
  n: number;
  mine: boolean;
}

/**
 * Aggregate stored feed reaction values into display chips: one chip per
 * emoji with a positive count, picker order first, legacy 👎 last.
 * `counts` maps value-code (as string, as jsonb keys arrive) → count.
 */
export function feedChips(
  counts: Record<string, number> | null | undefined,
  viewerReaction: number | null | undefined
): ReactionChip[] {
  if (!counts) return [];
  const byCode = new Map<number, number>();
  for (const [k, n] of Object.entries(counts)) {
    const code = Number(k);
    if (Number.isFinite(code) && n > 0 && FEED_REACTION_EMOJI[code]) {
      byCode.set(code, n);
    }
  }
  const ordered = [...FEED_REACTION_PICKER, -1].filter((c) => byCode.has(c));
  return ordered.map((code) => ({
    emoji: FEED_REACTION_EMOJI[code],
    n: byCode.get(code)!,
    mine: viewerReaction === code,
  }));
}

/** Emoji → count totals from a {code: count} map (valid codes only). */
export function totalFeedReactions(
  counts: Record<string, number> | null | undefined
): number {
  if (!counts) return 0;
  let total = 0;
  for (const [k, n] of Object.entries(counts)) {
    if (FEED_REACTION_EMOJI[Number(k)] && n > 0) total += n;
  }
  return total;
}

// ---- Messenger -------------------------------------------------------

/** Facebook's seven plus Dave's 🖕 — Messenger only, finger goes last. */
export const MSG_REACTION_PICKER: string[] = [
  "👍",
  "❤️",
  "🥰",
  "😆",
  "😮",
  "😢",
  "😡",
  "🖕",
];

export function isMsgReactionEmoji(v: unknown): v is string {
  return typeof v === "string" && MSG_REACTION_PICKER.includes(v);
}

/**
 * The shared identity of one logical message: every stored copy of a send
 * (one row per recipient key/device) carries the same sender_id and the
 * same server-stamped created_at within its conversation. Reactions key
 * off this, never off a per-copy row id.
 */
export function logicalMessageKey(senderId: string, createdAt: string): string {
  return `${senderId}|${createdAt}`;
}

export interface EmojiCountRow {
  emoji: string;
  n: number;
  mine: boolean;
}

/**
 * Aggregate per-emoji reaction rows (as stored) into sorted chips:
 * count desc, then picker order; emojis outside the picker (historical
 * rows migrated from the pre-Signal table) keep displaying, sorted last.
 */
export function aggregateEmojiReactions(rows: EmojiCountRow[]): ReactionChip[] {
  const byEmoji = new Map<string, ReactionChip>();
  for (const r of rows) {
    if (!r.emoji || !(r.n > 0)) continue;
    const cur = byEmoji.get(r.emoji);
    if (cur) {
      cur.n += r.n;
      cur.mine = cur.mine || r.mine;
    } else {
      byEmoji.set(r.emoji, { emoji: r.emoji, n: r.n, mine: r.mine });
    }
  }
  const order = (e: string) => {
    const i = MSG_REACTION_PICKER.indexOf(e);
    return i === -1 ? MSG_REACTION_PICKER.length : i;
  };
  return Array.from(byEmoji.values()).sort(
    (a, b) => b.n - a.n || order(a.emoji) - order(b.emoji)
  );
}

/**
 * Toggle semantics (Facebook): picking the emoji you already have removes
 * it; picking a different one switches; null always clears.
 */
export function nextReaction(
  current: string | null,
  picked: string | null
): string | null {
  if (picked === null) return null;
  return current === picked ? null : picked;
}
