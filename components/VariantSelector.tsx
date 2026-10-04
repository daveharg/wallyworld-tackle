"use client";

import { variantDisplayLabel } from "../lib/variant-names";

/**
 * Text-only variant buttons. The underlying Shopify option value is
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
        <span className="text-pine/55 font-medium">{optionName}: </span>
        <strong className="text-pine">
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
                  ? "border-signal bg-signal/10 text-signal shadow-md"
                  : "border-pine/15 bg-white text-pine/75 hover:border-signal/50 hover:text-pine"
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
