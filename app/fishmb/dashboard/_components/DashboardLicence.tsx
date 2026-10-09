"use client";

import { useEffect, useState } from "react";
import { fishFetch } from "../../_components/fishFetch";
import LicenseWallet from "../../profile/_components/LicenseWallet";

interface License {
  file_url: string;
  expiry_date: string | null;
}

function statusLabel(expiry: string | null): string {
  if (!expiry) return "On file";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiry + "T00:00:00");
  const days = Math.round((exp.getTime() - today.getTime()) / 86400000);
  if (days < 0) return "Expired";
  if (days <= 30) return `Expiring soon (${days}d)`;
  return "Valid";
}

/**
 * Dashboard bottom section: a small collapsed fishing-licence row.
 * Expands to the full licence wallet (upload, viewer, expiry).
 */
export default function DashboardLicence() {
  const [open, setOpen] = useState(false);
  const [lic, setLic] = useState<License | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fishFetch("/api/fishmb/license")
      .then((d) => setLic((d.license ?? null) as License | null))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div className="mt-10">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 bg-white border border-pine/10 rounded-3xl px-5 py-4 hover:border-signal/40 transition-colors"
      >
        <span className="flex items-center gap-3 min-w-0">
          <span className="text-left">
            <span className="block font-display font-bold uppercase text-pine tracking-wide">
              Fishing licence
            </span>
            <span className="block text-xs text-pine/55">
              {!loaded
                ? "Checking…"
                : lic
                  ? statusLabel(lic.expiry_date)
                  : "No licence saved yet"}
            </span>
          </span>
        </span>
        <span
          className={`text-pine/50 text-xl transition-transform ${open ? "rotate-180" : ""}`}
        >
          ⌄
        </span>
      </button>
      {open && (
        <div className="mt-2 bg-white border border-pine/10 rounded-3xl p-5">
          <LicenseWallet embedded />
        </div>
      )}
    </div>
  );
}
