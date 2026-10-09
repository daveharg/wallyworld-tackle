"use client";

import type { PayoutTier } from "@/lib/fish/tournaments";

/** Editor for per-place payouts: each place pays a % of the pot or a fixed $ amount. */
export function PayoutEditor({
  value,
  onChange,
}: {
  value: PayoutTier[];
  onChange: (v: PayoutTier[]) => void;
}) {
  const update = (i: number, patch: Partial<PayoutTier>) =>
    onChange(value.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const add = () => {
    const nextPlace = value.length ? Math.max(...value.map((p) => p.place)) + 1 : 1;
    onChange([...value, { place: nextPlace, type: "percent", value: nextPlace === 1 ? 50 : 0 }]);
  };

  return (
    <div className="space-y-2">
      {value.map((p, i) => (
        <div key={i} className="flex items-center gap-2 bg-white border border-pine/15 rounded-2xl p-2">
          <input
            type="number"
            min={1}
            max={100}
            value={p.place}
            onChange={(e) => update(i, { place: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-14 bg-paper-deep border border-pine/15 rounded-xl px-2 py-2 text-sm font-bold text-pine text-center"
            aria-label="Place"
          />
          <div className="flex rounded-xl overflow-hidden border border-pine/15">
            {(["percent", "amount"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => update(i, { type: t })}
                className={`px-3 py-2 text-xs font-bold uppercase tracking-wider ${
                  p.type === t ? "bg-pine text-white" : "bg-white text-pine/60"
                }`}
              >
                {t === "percent" ? "%" : "$"}
              </button>
            ))}
          </div>
          <input
            type="number"
            min={0}
            step="any"
            value={p.value || ""}
            onChange={(e) => update(i, { value: Math.max(0, parseFloat(e.target.value) || 0) })}
            placeholder={p.type === "percent" ? "% of pot" : "$ amount"}
            className="flex-1 bg-paper-deep border border-pine/15 rounded-xl px-3 py-2 text-sm text-pine"
            aria-label={p.type === "percent" ? "Percent of pot" : "Fixed dollar amount"}
          />
          <button
            type="button"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="w-9 h-9 rounded-xl text-pine/50 hover:bg-signal/10 hover:text-signal-dark font-bold"
            aria-label="Remove payout"
          >
 
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-sm font-bold text-signal uppercase tracking-wider hover:text-signal-dark"
      >
        + Add payout
      </button>
    </div>
  );
}
