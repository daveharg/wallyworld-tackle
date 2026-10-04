"use client";

import { variantDisplayLabel } from "../lib/variant-names";

/**
 * Professional text-only variant buttons. The underlying Shopify option value is
 * preserved for DSers mapping; only the customer-facing label changes.
 */
export default function VariantSelector({
  optionName,
  productHandle,
  productTitle,
  values,
  selected,
  onSelect,
}: {
  optionName: string;
  productHandle: string;
  productTitle: string;
  values: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="mb-5">
      <p className="text-sm mb-2.5">
        <span className="text-slate-400 font-medium">{optionName}: </span>
        <strong className="text-white">
          {variantDisplayLabel(productHandle, productTitle, selected)}
        </strong>
      </p>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => {
          const label = variantDisplayLabel(productHandle, productTitle, v);
          const isSel = v === selected;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onSelect(v)}
              aria-pressed={isSel}
              className={`rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition ${
                isSel
                  ? "border-ember-500 bg-ember-500/10 text-ember-400 shadow-lg shadow-ember-600/10"
                  : "border-night-600 bg-night-800 text-slate-300 hover:border-night-600 hover:border-ember-500/50 hover:text-white"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
