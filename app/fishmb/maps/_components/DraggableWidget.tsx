// Draggable floating widget for the map — hold and drag to reposition.
// Position persists in localStorage per widget id.

"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";

interface Pos {
  x: number;
  y: number;
}

function loadPos(id: string, fallback: Pos): Pos {
  try {
    const raw = localStorage.getItem(`fishmb-widget-${id}`);
    if (raw) {
      const p = JSON.parse(raw) as Pos;
      if (typeof p.x === "number" && typeof p.y === "number") return p;
    }
  } catch {
    // Use fallback.
  }
  return fallback;
}

export default function DraggableWidget({
  id,
  defaultPos,
  children,
  className = "",
}: {
  id: string;
  defaultPos: Pos;
  children: ReactNode;
  className?: string;
}) {
  const [pos, setPos] = useState<Pos>(() => loadPos(id, defaultPos));
  const drag = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(`fishmb-widget-${id}`, JSON.stringify(pos));
    } catch {
      // Best effort.
    }
  }, [id, pos]);

  const onPointerDown = (e: React.PointerEvent) => {
    const el = (e.currentTarget as HTMLElement).parentElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    drag.current = {
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
      moved: false,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const parent = (e.currentTarget as HTMLElement).parentElement?.parentElement;
    if (!parent) return;
    const prect = parent.getBoundingClientRect();
    const x = e.clientX - prect.left - drag.current.dx;
    const y = e.clientY - prect.top - drag.current.dy;
    drag.current.moved = true;
    setPos({
      x: Math.max(0, Math.min(x, prect.width - 40)),
      y: Math.max(0, Math.min(y, prect.height - 40)),
    });
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div
      className={`absolute z-20 ${className}`}
      style={{ left: pos.x, top: pos.y, touchAction: "none" }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="cursor-grab active:cursor-grabbing select-none"
      >
        {children}
      </div>
    </div>
  );
}
