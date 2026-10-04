"use client";

import { variantDisplayLabel } from "../lib/variant-names";

export interface VariantChoice {
  value: string; // underlying Shopify option value (kept for DSers)
  label: string; // customer-facing display label
}

/**
 * Text-only variant buttons — no thumbnails. The selected option is highlighted,
 * and the label shown is the descriptive display name.
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
  const choices: VariantChoice[] = values.map((v) => ({
    value: v,
    label: variantDisplayLabel(productHandle, productTitle, v),
  }));

  return (
    <div className="variant-selector">
      <p className="variant-option-name">
        {optionName}:{" "}
        <strong>
          {variantDisplayLabel(productHandle, productTitle, selected)}
        </strong>
      </p>
      <div className="variant-options">
        {choices.map((c) => (
          <button
            key={c.value}
            type="button"
            className={`variant-option${c.value === selected ? " selected" : ""}`}
            onClick={() => onSelect(c.value)}
            aria-pressed={c.value === selected}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
