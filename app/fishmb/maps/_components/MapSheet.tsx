"use client";

import { useRef, useState, type TouchEvent } from "react";
import type { SheetTab } from "./types";

export type { SheetTab };

const TABS: { id: SheetTab; label: string }[] = [
  { id: "catches", label: "Catches" },
  { id: "spots", label: "Saved spots" },
  { id: "lakes", label: "Lakes" },
  { id: "settings", label: "Settings" },
];

interface Props {
  tab: SheetTab;
  onTabChange: (t: SheetTab) => void;
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
  children: React.ReactNode;
}

/**
 * Bottom sheet styled like a full page sliding up from behind the bottom bar.
 * Collapsed it peeks just above the bar (grabber + tab row visible); swipe up
 * or tap a tab to open it fullscreen, swipe down anywhere to close it.
 */
export default function MapSheet({
  tab,
  onTabChange,
  expanded,
  onExpandedChange,
  children,
}: Props) {
  const [dragDy, setDragDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragMode = useRef<"expand" | "close" | null>(null);

  const onTouchStart = (e: TouchEvent) => {
    startY.current = e.touches[0].clientY;
    dragMode.current = null;
    setDragging(true);
  };

  const onTouchMove = (e: TouchEvent) => {
    if (startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (!expanded) {
      // Collapsed: drag up to open the page.
      if (dy < -8) {
        dragMode.current = "expand";
        setDragDy(dy);
      } else {
        setDragDy(0);
      }
    } else {
      // Open: drag down anywhere to close — but only when the content
      // is scrolled to the top, otherwise let the list scroll normally.
      const scroller = scrollRef.current;
      const atTop = !scroller || scroller.scrollTop <= 0;
      if (dy > 8 && atTop) {
        dragMode.current = "close";
        setDragDy(dy);
      } else if (dragMode.current !== "close") {
        setDragDy(0);
      }
    }
  };

  const onTouchEnd = () => {
    if (dragMode.current === "expand" && dragDy < -60) {
      onExpandedChange(true);
    } else if (dragMode.current === "close" && dragDy > 60) {
      onExpandedChange(false);
    }
    setDragDy(0);
    setDragging(false);
    startY.current = null;
    dragMode.current = null;
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
      className={`fixed inset-x-0 bg-paper rounded-t-3xl shadow-2xl border-t border-x border-pine/10 flex flex-col overflow-hidden ${
        expanded ? "z-50 top-3 md:top-[68px]" : "z-30 top-[calc(100dvh-225px)]"
      } bottom-0`}
      style={{
        transform: dragDy !== 0 ? `translateY(${dragDy}px)` : undefined,
        transition: dragging ? "none" : "top 0.32s ease, transform 0.32s ease",
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Grabber */}
      <div className="shrink-0 pt-2.5 pb-1 flex justify-center">
        <div className="w-10 h-1.5 rounded-full bg-pine/20" />
      </div>

      {/* Tab headers — text only */}
      <div className="shrink-0 px-7 pb-1 flex items-center justify-between">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => tapTab(t.id)}
            className={`text-[17px] py-2 transition-colors ${
              tab === t.id
                ? "font-extrabold text-[#c2410c]"
                : "font-semibold text-pine/55"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Scrollable page content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain px-4 pb-10"
      >
        {children}
      </div>
    </div>
  );
}
