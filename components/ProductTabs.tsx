"use client";

import { useState } from "react";

const TABS = ["Description", "Specs", "Shipping"] as const;

export default function ProductTabs({
  descriptionHtml,
  description,
  specs,
}: {
  descriptionHtml: string;
  description: string;
  specs: { label: string; value: string }[];
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Description");

  return (
    <div className="mt-10">
      <div className="flex gap-1 border-b border-pine/15" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`px-5 py-3 font-display font-semibold uppercase tracking-widest text-sm transition border-b-2 -mb-px ${
              tab === t
                ? "text-signal border-signal"
                : "text-pine/45 border-transparent hover:text-pine"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="py-6 text-[15px] leading-relaxed text-pine/75">
        {tab === "Description" &&
          (descriptionHtml ? (
            <div
              className="[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_p]:mb-3"
              dangerouslySetInnerHTML={{ __html: descriptionHtml }}
            />
          ) : (
            <p>{description || "No description available."}</p>
          ))}

        {tab === "Specs" &&
          (specs.length > 0 ? (
            <dl className="grid sm:grid-cols-2 gap-x-8">
              {specs.map((s) => (
                <div
                  key={s.label}
                  className="flex justify-between gap-4 py-2.5 border-b border-pine/10"
                >
                  <dt className="text-pine/50">{s.label}</dt>
                  <dd className="text-pine font-medium text-right">{s.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-pine/45">Specs coming soon.</p>
          ))}

        {tab === "Shipping" && (
          <div className="space-y-3">
            <p>
              <strong className="text-pine">Free shipping</strong> on all orders.
            </p>
            <p>
              Most items ship <strong className="text-pine">direct from our suppliers</strong>,
              which keeps prices low. Please allow 7–14 business days for delivery.
            </p>
            <p>
              Not happy? You&apos;re covered by our{" "}
              <strong className="text-pine">30-day hassle-free return</strong> policy.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
