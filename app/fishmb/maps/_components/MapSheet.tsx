"use client";

import { useRef, useState, type TouchEvent } from "react";
import type { SheetTab } from "./types";

export type { SheetTab };

/** Sheet snap positions: peek, half-screen, fullscreen. */
export type SheetSnap = "collapsed" | "half" | "full";

const TABS: { id: SheetTab; label: string }[] = [
  { id: "catches", label: "Catches" },
  { id: "spots", label: "Saved spots" },
  { id: "lakes", label: "Lakes" },
  { id: "settings", label: "Settings" },
];

interface Props {
  tab: SheetTab;
  onTabChange: (t: SheetTab) => void;
  snap: SheetSnap;
  onSnapChange: (s: SheetSnap) => void;
  /** When true the sheet shows detail content (e.g. a lake) instead of tabs. */
  detailMode?: boolean;
  children: React.ReactNode;
}

const TOP: Record<SheetSnap, string> = {
  collapsed: "top-[calc(100dvh-225px)]",
  half: "top-[50dvh]",
  full: "top-3 md:top-[68px]",
};

/**
 * Bottom sheet styled like a full page sliding up from behind the bottom bar.
 * Three snap positions:
 * - collapsed: peeks just above the bar (grabber + tab row visible);
 *   swipe up or tap a tab to open.
 * - half: covers the bottom half — used for lake details with the lake
 *   centred on the map above; drag up for the full page, down for full map.
 * - full: fullscreen page; swipe down anywhere to close.
 */
export default function MapSheet({
  tab,
  onTabChange,
  snap,
  onSnapChange,
  detailMode,
  children,
}: Props) {
  const [dragDy, setDragDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const dragTarget = useRef<SheetSnap | null>(null);
  const fromHeader = useRef(false);

  const onTouchStart = (e: TouchEvent) => {
    startY.current = e.touches[0].clientY;
    dragTarget.current = null;
    // Touches starting on the grabber/header always drag the sheet,
    // regardless of the content's scroll position.
    fromHeader.current = !!(
      headerRef.current && headerRef.current.contains(e.target as Node)
    );
    setDragging(true);
  };

  const onTouchMove = (e: TouchEvent) => {
    if (startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    const scroller = scrollRef.current;
    const atTop = fromHeader.current || !scroller || scroller.scrollTop <= 0;

    if (snap === "collapsed") {
      // Peek: drag up to open — back to the lake detail if one is open.
      if (dy < -8) {
        dragTarget.current = detailMode ? "half" : "full";
        setDragDy(dy);
      } else {
        setDragDy(0);
      }
    } else if (snap === "half") {
      if (dy < -8 && atTop) {
        // Drag up → full page.
        dragTarget.current = "full";
        setDragDy(dy);
      } else if (dy > 8 && atTop) {
        // Drag down → full map view.
        dragTarget.current = "collapsed";
        setDragDy(dy);
      } else {
        setDragDy(0);
      }
    } else {
      // Full: drag down anywhere to step back down — but only when the
      // content is scrolled to the top, otherwise let the list scroll.
      if (dy > 8 && atTop) {
        dragTarget.current = detailMode ? "half" : "collapsed";
        setDragDy(dy);
      } else if (dragTarget.current === null) {
        setDragDy(0);
      }
    }
  };

  const onTouchEnd = () => {
    const target = dragTarget.current;
    if (target && Math.abs(dragDy) > 60) {
      onSnapChange(target);
    }
    setDragDy(0);
    setDragging(false);
    startY.current = null;
    dragTarget.current = null;
    fromHeader.current = false;
  };

  // Tapping a tab only switches the tab — the sheet itself only moves
  // when the user slides/drags it.
  const tapTab = (id: SheetTab) => {
    onTabChange(id);
  };

  return (
    <div
      className={`fixed inset-x-0 bg-paper rounded-t-3xl shadow-2xl border-t border-x border-pine/10 flex flex-col overflow-hidden ${
        snap === "full" ? "z-50" : "z-30"
      } ${TOP[snap]} bottom-0`}
      style={{
        transform: dragDy !== 0 ? `translateY(${dragDy}px)` : undefined,
        transition: dragging ? "none" : "top 0.32s ease, transform 0.32s ease",
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Grabber + header zone — always drags the sheet */}
      <div ref={headerRef}>
      <div className="shrink-0 pt-2.5 pb-1 flex justify-center">
        <div className="w-10 h-1.5 rounded-full bg-pine/20" />
      </div>

      {!detailMode && (
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
      )}
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
