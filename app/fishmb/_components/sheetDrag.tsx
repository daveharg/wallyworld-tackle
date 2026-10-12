// Shared bottom-sheet dismissal: drag the sheet's header down to close,
// and the grabber pill itself is a tap-to-close button. Every FishMB
// bottom sheet uses this so they all behave the same way.
//
// Usage:
//   const { dragHandlers, dragStyle } = useSheetDrag(onClose);
//   <div panel style={dragStyle}>
//     <div {...dragHandlers} className="touch-none">
//       <SheetGrabber onClose={onClose} />
//       ...title...
//     </div>
//     ...scrollable content...

"use client";

import { useRef, useState } from "react";

export function useSheetDrag(onClose: () => void) {
  const [dragY, setDragY] = useState(0);
  const start = useRef<number | null>(null);

  const end = () => {
    if (start.current !== null && dragY > 70) {
      onClose();
      return;
    }
    start.current = null;
    setDragY(0);
  };

  const dragHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      start.current = e.clientY;
      (e.target as Element).setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current === null) return;
      setDragY(Math.max(0, e.clientY - start.current));
    },
    onPointerUp: end,
    onPointerCancel: end,
  };

  const dragStyle: React.CSSProperties = {
    transform: dragY ? `translateY(${dragY}px)` : undefined,
    transition: start.current === null ? "transform 0.18s ease" : undefined,
  };

  return { dragHandlers, dragStyle };
}

/** The little pill at the top of a sheet — tapping it closes the sheet. */
export function SheetGrabber({
  onClose,
  light = false,
}: {
  onClose: () => void;
  light?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className="block mx-auto w-16 h-6 shrink-0"
    >
      <span
        className={`block w-10 h-1.5 rounded-full mx-auto ${
          light ? "bg-white/40" : "bg-pine/20"
        }`}
      />
    </button>
  );
}
