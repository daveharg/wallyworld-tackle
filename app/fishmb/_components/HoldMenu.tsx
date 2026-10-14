// Facebook-style press-and-hold menu, shared by feed posts, feed
// comments, and Messenger messages: a reaction emoji bar floating over
// an action list, anchored to the pressed item (which the surface
// visually "pops" while the menu is open). Open with a touch/mouse
// long-press or a right-click; dismiss by tapping outside, scrolling,
// resizing, or pressing Escape.
//
// Reaction identity is surface-specific (feed = smallint codes,
// messages = emoji), so options arrive as { key, emoji, active } and the
// surface maps keys back to its own model.

"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface HoldReactionOption {
  key: string;
  emoji: string;
  active: boolean;
}

export interface HoldAction {
  icon: string;
  label: string;
  danger?: boolean;
  /** When set, the first tap swaps the label to this and only a second
   *  tap runs onSelect (destructive confirms without a second sheet). */
  confirmLabel?: string;
  onSelect: () => void;
}

/**
 * Long-press / right-click handlers for one holdable element. Spread the
 * returned handlers onto the element; onFire receives its bounding rect
 * (the menu anchor). A click that follows a fired long-press is
 * swallowed in the capture phase so buttons inside don't also trigger.
 */
export function useLongPress(
  onFire: (rect: DOMRect) => void,
  delay = 450
) {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const elRef = useRef<HTMLElement | null>(null);

  const clear = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const fire = () => {
    const el = elRef.current;
    if (!el) return;
    fired.current = true;
    try {
      navigator.vibrate?.(10);
    } catch {
      // Haptics are best-effort.
    }
    onFire(el.getBoundingClientRect());
  };

  return {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      // Right-button presses are handled by onContextMenu instead.
      if (e.pointerType === "mouse" && e.button !== 0) return;
      elRef.current = e.currentTarget;
      start.current = { x: e.clientX, y: e.clientY };
      fired.current = false;
      clear();
      timer.current = window.setTimeout(fire, delay);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (
        start.current &&
        Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10
      ) {
        clear();
      }
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onContextMenu: (e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault();
      clear();
      elRef.current = e.currentTarget;
      fire();
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (fired.current) {
        e.preventDefault();
        e.stopPropagation();
        fired.current = false;
      }
    },
  };
}

const MENU_Z = 3200;

/** iMessage-style frosted glass, shared by the reaction capsule and the
 *  action card so the two read as one unit. The app is light-only
 *  (globals.css: "Always light theme"), so one light variant serves
 *  every surface the menu appears on. */
const FROSTED: React.CSSProperties = {
  background: "rgba(255,255,255,0.85)",
  backdropFilter: "blur(20px) saturate(1.6)",
  WebkitBackdropFilter: "blur(20px) saturate(1.6)",
  border: "1px solid rgba(0,0,0,0.06)",
  boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
};

export function HoldMenu({
  anchor,
  reactions,
  onPickReaction,
  actions,
  onClose,
}: {
  anchor: DOMRect;
  reactions: HoldReactionOption[];
  onPickReaction: (key: string) => void;
  actions: HoldAction[];
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null);

  // Position: horizontally centred on the anchor (clamped to the
  // viewport), above the anchor when there's room, else below it.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const left = Math.min(
      Math.max(12, anchor.left + anchor.width / 2 - w / 2),
      Math.max(12, vw - w - 12)
    );
    const above = anchor.top - h - 10;
    const top =
      above >= 8 ? above : Math.min(anchor.bottom + 10, Math.max(8, vh - h - 8));
    // Bloom open from the edge nearest the held item (iMessage-style).
    card.style.transformOrigin = above >= 8 ? "50% 100%" : "50% 0%";
    setPos({ left, top });
  }, [anchor]);

  // Dismiss on scroll (any scroller, capture phase), resize, Escape.
  useEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 fm-noselect"
      style={{ zIndex: MENU_Z, background: "rgba(0,0,0,0.10)" }}
      onClick={onClose}
      onContextMenu={(e) => e.preventDefault()}
    >
      <style>{`
        @keyframes fishmb-hold-in {
          from { opacity: 0; transform: scale(.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes fishmb-emoji-in {
          from { opacity: 0; transform: translateY(10px) scale(.5); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div
        ref={cardRef}
        className="fixed w-[320px] max-w-[calc(100vw-24px)] fm-noselect"
        style={{
          left: pos?.left ?? -9999,
          top: pos?.top ?? -9999,
          opacity: pos ? 1 : 0,
          animation: "fishmb-hold-in .16s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {reactions.length > 0 && (
          <div
            className="flex items-center justify-between rounded-full px-3 py-2 mb-2"
            style={FROSTED}
          >
            {reactions.map((r, i) => (
              <button
                key={r.key}
                type="button"
                aria-label={`React ${r.emoji}`}
                onClick={() => {
                  onPickReaction(r.key);
                  onClose();
                }}
                className={`text-[26px] leading-none w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-125 active:scale-110 ${
                  r.active ? "bg-signal/15 ring-2 ring-signal/50" : ""
                }`}
                style={{
                  animation: `fishmb-emoji-in .18s ease-out ${i * 22}ms both`,
                }}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        )}
        {actions.length > 0 && (
          <div className="rounded-[20px] overflow-hidden" style={FROSTED}>
            {actions.map((a, i) => (
              <button
                key={`${a.label}-${i}`}
                type="button"
                onClick={() => {
                  if (a.confirmLabel && confirmIdx !== i) {
                    setConfirmIdx(i);
                    return;
                  }
                  a.onSelect();
                  onClose();
                }}
                style={{
                  borderTop: i > 0 ? "1px solid rgba(0,0,0,0.06)" : undefined,
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left text-[15px] font-semibold transition-colors hover:bg-pine/5 ${
                  a.danger || (a.confirmLabel && confirmIdx === i)
                    ? "text-red-600"
                    : "text-pine"
                }`}
              >
                <span className="text-lg w-6 text-center shrink-0">{a.icon}</span>
                <span className="flex-1">
                  {a.confirmLabel && confirmIdx === i ? a.confirmLabel : a.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export interface ReactionChipData {
  key: string;
  emoji: string;
  n: number;
  mine: boolean;
}

/** The little emoji+count pills shown under a post/comment/message. */
export function ReactionChips({
  chips,
  onTap,
  align = "left",
}: {
  chips: ReactionChipData[];
  onTap?: (key: string) => void;
  align?: "left" | "right";
}) {
  if (chips.length === 0) return null;
  return (
    <div
      className={`flex flex-wrap gap-1 mt-1 ${align === "right" ? "justify-end" : ""}`}
    >
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={onTap ? () => onTap(c.key) : undefined}
          className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-bold tabular-nums transition-colors ${
            c.mine
              ? "bg-signal/15 border-signal/40 text-pine"
              : "bg-white border-pine/15 text-pine/60"
          }`}
        >
          <span className="text-[12px] leading-none">{c.emoji}</span>
          {c.n}
        </button>
      ))}
    </div>
  );
}
