"use client";

import { useEffect, useRef, useState } from "react";
import type { SheetTab } from "./types";

export type { SheetTab };

/** Sheet snap positions: mini peek, peek, half-screen, fullscreen. */
export type SheetSnap = "mini" | "collapsed" | "half" | "full";

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
  mini: "top-[calc(100dvh-120px)]",
  collapsed: "top-[calc(100dvh-225px)]",
  half: "top-[50dvh]",
  full: "top-3 md:top-[68px]",
};

/**
 * Bottom sheet styled like a full page sliding up from behind the bottom bar.
 * Four snap positions:
 * - mini: just the grabber peeks out — swipe up to reopen.
 * - collapsed: peeks just above the bar (grabber + tab row visible).
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
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  // Refs mirrored for the native touch handlers below.
  const snapRef = useRef(snap);
  snapRef.current = snap;
  const detailRef = useRef(detailMode);
  detailRef.current = detailMode;
  const dragDyRef = useRef(0);
  const targetRef = useRef<SheetSnap | null>(null);

  const commitSnap = (t: SheetSnap | null, dy: number) => {
    if (t && Math.abs(dy) > 60) onSnapChange(t);
    setDragDy(0);
    dragDyRef.current = 0;
    targetRef.current = null;
    setDragging(false);
  };

  /**
   * Gesture rule (Dave's spec): if the page has enough content to scroll,
   * it scrolls normally — only once you're at the very top and keep
   * pulling down does the sheet shrink. If the content isn't scrollable,
   * any pull moves the sheet directly. Touches starting on the grabber /
   * header always move the sheet.
   *
   * Native (non-passive) listeners so we can preventDefault the moment we
   * decide the gesture is a sheet drag — this stops iOS rubber-banding
   * from fighting the sheet movement.
   */
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;

    let startY: number | null = null;
    let sheetDrag = false; // locked for the rest of this gesture once true
    let fromHeader = false;

    const pickTarget = (dy: number): SheetSnap | null => {
      const s = snapRef.current;
      const detail = detailRef.current;
      if (s === "mini") {
        return dy < -8 ? "collapsed" : null;
      }
      if (s === "collapsed") {
        if (dy < -8) return detail ? "half" : "full";
        if (dy > 8) return "mini";
        return null;
      }
      if (s === "half") {
        if (dy < -8) return "full";
        if (dy > 8) return "collapsed";
        return null;
      }
      // full
      if (dy > 8) return detail ? "half" : "collapsed";
      return null;
    };

    const onStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      sheetDrag = false;
      targetRef.current = null;
      const t = e.target as HTMLElement;
      fromHeader =
        !!headerRef.current?.contains(t) || !!t.closest("[data-sheet-drag]");
      setDragging(true);
    };

    const onMove = (e: TouchEvent) => {
      if (startY === null) return;
      const dy = e.touches[0].clientY - startY;
      const sc = scrollRef.current;

      if (!sheetDrag) {
        if (fromHeader) {
          // Grabber/header: always a sheet drag.
          sheetDrag = Math.abs(dy) > 8;
        } else if (sc && sc.scrollHeight > sc.clientHeight + 4) {
          // Scrollable content: hijack only when pulling past an edge.
          const atTop = sc.scrollTop <= 0;
          const atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4;
          if (dy > 8 && atTop) sheetDrag = true; // pull down at top → shrink
          else if (dy < -8 && atBottom && snapRef.current !== "full")
            sheetDrag = true; // pull up at bottom → expand
        } else {
          // Not scrollable: any vertical drag moves the sheet.
          sheetDrag = Math.abs(dy) > 8;
        }
      }

      if (sheetDrag) {
        // Stop native scroll / rubber-band — the sheet owns this gesture now.
        e.preventDefault();
        targetRef.current = pickTarget(dy);
        dragDyRef.current = targetRef.current ? dy : 0;
        setDragDy(dragDyRef.current);
      } else {
        if (dragDyRef.current !== 0) {
          dragDyRef.current = 0;
          setDragDy(0);
        }
      }
    };

    const onEnd = () => {
      if (startY === null) return;
      commitSnap(targetRef.current, dragDyRef.current);
      startY = null;
      sheetDrag = false;
      fromHeader = false;
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
    // onSnapChange is stable (MapsHub useCallback); snap/detail read via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tapping a tab only switches the tab — the sheet itself only moves
  // when the user slides/drags it.
  const tapTab = (id: SheetTab) => {
    onTabChange(id);
  };

  return (
    <div
      ref={sheetRef}
      className={`fixed inset-x-0 bg-paper rounded-t-3xl shadow-2xl border-t border-x border-pine/10 flex flex-col overflow-hidden ${
        snap === "full" ? "z-50" : "z-30"
      } ${TOP[snap]} bottom-0`}
      style={{
        transform: dragDy !== 0 ? `translateY(${dragDy}px)` : undefined,
        transition: dragging ? "none" : "top 0.32s ease, transform 0.32s ease",
      }}
    >
      {/* Grabber + header zone — always drags the sheet */}
      <div ref={headerRef} style={{ touchAction: "pan-x" }}>
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
