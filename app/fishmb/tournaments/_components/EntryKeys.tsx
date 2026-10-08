"use client";

import { useCallback, useEffect, useState } from "react";
import { fishFetch } from "../../_components/fishFetch";

interface TKey {
  id: string;
  key_code: string;
  status: "unused" | "used";
  used_by_name: string | null;
  used_at: string | null;
}

/**
 * Organizer's single-use entry key manager. Generate batches of one-time
 * keys, hand one to each angler after they pay (payment stays off-platform),
 * and watch keys get consumed as anglers redeem them.
 */
export function EntryKeys({ tournamentId }: { tournamentId: string }) {
  const [keys, setKeys] = useState<TKey[]>([]);
  const [count, setCount] = useState("10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await fishFetch(`/api/fishmb/tournaments/${tournamentId}/keys`);
      setKeys(d.keys ?? []);
    } catch {
      // keys section simply stays empty on failure
    }
  }, [tournamentId]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    const n = Math.floor(Number(count));
    if (!n || n < 1 || n > 200) {
      setError("Enter a number between 1 and 200.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await fishFetch(`/api/fishmb/tournaments/${tournamentId}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: n }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate keys.");
    } finally {
      setBusy(false);
    }
  };

  const copy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  };

  const unused = keys.filter((k) => k.status === "unused").length;

  return (
    <section className="bg-white border border-pine/10 rounded-3xl p-6 md:p-8 mb-8">
      <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-2">
        Entry keys
      </h2>
      <p className="text-pine/55 text-sm mb-5">
        Generate one-time keys. Give each angler their key after they pay —
        each key joins one angler, once.{" "}
        {keys.length > 0 && (
          <span className="font-bold text-pine">
            {unused} of {keys.length} unused.
          </span>
        )}
      </p>
      {error && (
        <p className="text-sm text-signal-dark bg-signal/10 border border-signal/30 rounded-2xl px-4 py-3 mb-5">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3 items-center mb-6">
        <input
          value={count}
          onChange={(e) => setCount(e.target.value.replace(/[^0-9]/g, ""))}
          inputMode="numeric"
          placeholder="10"
          className="w-24 bg-paper-deep border border-pine/15 rounded-full px-4 py-2.5 text-pine text-center font-bold focus:outline-none focus:border-signal"
          aria-label="Number of keys to generate"
        />
        <button
          onClick={generate}
          disabled={busy}
          className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-2.5 rounded-full disabled:opacity-50 transition-colors"
        >
          {busy ? "Generating…" : "Generate keys"}
        </button>
      </div>
      {keys.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {keys.map((k) => (
            <div
              key={k.id}
              className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 ${
                k.status === "used"
                  ? "border-pine/10 bg-paper-deep opacity-70"
                  : "border-gold/50 bg-gold/10"
              }`}
            >
              <code className="font-bold tracking-[0.18em] text-pine flex-1">
                {k.key_code}
              </code>
              {k.status === "used" ? (
                <span
                  className="text-[10px] font-bold uppercase tracking-wider bg-pine/10 text-pine px-2.5 py-1 rounded-full"
                  title={k.used_by_name ? `Used by ${k.used_by_name}` : "Used"}
                >
                  Used{k.used_by_name ? ` · ${k.used_by_name}` : ""}
                </span>
              ) : (
                <>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-pine text-white px-2.5 py-1 rounded-full">
                    Unused
                  </span>
                  <button
                    onClick={() => copy(k.key_code)}
                    className="text-xs font-bold uppercase tracking-wider text-signal-dark hover:underline"
                  >
                    {copied === k.key_code ? "Copied!" : "Copy"}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
