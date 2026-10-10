"use client";

/** FishMB loading indicator — the app logo with a gentle spin. */
export default function FishLoader({
  size = 48,
  label,
}: {
  size?: number;
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/fishmb/icon-192.png"
        alt="Loading"
        width={size}
        height={size}
        className="rounded-2xl animate-[spin_2.5s_linear_infinite]"
        draggable={false}
      />
      {label && <p className="text-sm font-bold text-pine/50">{label}</p>}
    </div>
  );
}
