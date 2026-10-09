"use client";

import { useRef, useState, type ReactNode, type TouchEvent } from "react";

export type SheetTab = "catches" | "spots" | "settings";

export const SHEET_TABS: { id: SheetTab; label: string; icon: string }[] = [
  { id: "catches", label: "Catches", icon: "🎣" },
  { id: "spots", label: "Saved spots", icon: "📍" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

interface MapSheetProps {
  tab: SheetTab;
  onTabChange: (t: SheetTab) => void;
  expanded: boolean;
  onExpandedChange: (e: boolean) => void;
  children: ReactNode;
}

/**
 * Bottom sheet for the maps page. Peeks above the floating bottom bar showing
 * just the three tab headers; swipe up (or tap a tab) to expand fullscreen,
 * swipe down (or tap ✕) to collapse back to the peek.
 */
export default function MapSheet({
  tab,
  onTabChange,
  expanded,
  onExpandedChange,
  children,
}: MapSheetProps) {
  const [dragDy, setDragDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef<number | null>(null);

  const onTouchStart = (e: TouchEvent) => {
    startY.current = e.touches[0]?.clientY ?? null;
    setDragging(true);
  };
  const onTouchMove = (e: TouchEvent) => {
    if (startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    // Peek: allow dragging up (reveal) a bit and down a little.
    // Full: only dragging down matters.
    setDragDy(expanded ? Math.max(0, Math.min(dy, 320)) : Math.max(-260, Math.min(dy, 120)));
  };
  const onTouchEnd = () => {
    if (startY.current === null) return;
    if (!expanded && dragDy < -60) onExpandedChange(true);
    else if (expanded && dragDy > 60) onExpandedChange(false);
    setDragDy(0);
    setDragging(false);
    startY.current = null;
  };

  const tapTab = (id: SheetTab) => {
    if (!expanded) {
      onTabChange(id);
      onExpandedChange(true);
    } else if (id === tab) {
      onExpandedChange(false);
    } else {
      onTabChange(id);
    }
  };

  return (
    <div
      className="fixed inset-x-3 z-50 bg-paper rounded-3xl shadow-2xl border border-pine/10 flex flex-col overflow-hidden"
      style={{
        top: expanded ? 68 : "calc(100dvh - 196px)",
        bottom: expanded ? 8 : 118,
        transform: dragDy !== 0 ? `translateY(${dragDy}px)` : undefined,
        transition: dragging ? "none" : "top 0.3s ease, bottom 0.3s ease",
      }}
    >
      {/* Header — the drag handle + tab switcher (always visible) */}
      <div
        className="shrink-0 pt-2 pb-1 px-2 touch-none select-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="w-10 h-1 rounded-full bg-pine/20 mx-auto mb-1.5" />
        <div className="flex items-center gap-1">
          {SHEET_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => tapTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[13px] font-bold transition-colors ${
                tab === t.id
                  ? "bg-pine text-white shadow"
                  : "text-pine/50 hover:text-pine hover:bg-pine/5"
              }`}
            >
              <span className="text-base">{t.icon}</span>
              {t.label}
            </button>
          ))}
          {expanded && (
            <button
              type="button"
              onClick={() => onExpandedChange(false)}
              aria-label="Collapse panel"
              className="shrink-0 w-9 h-9 ml-1 rounded-full bg-pine/5 text-pine/60 font-black flex items-center justify-center"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      {/* Content — only rendered when expanded */}
      {expanded && (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-8">
          {children}
        </div>
      )}
    </div>
  );
}
