"use client";

import { useCallback, useEffect, useState } from "react";
import { fishFetch } from "../../_components/fishFetch";

interface TRedeemer {
  user_id: string;
  name: string | null;
  redeemed_at: string;
}

interface TKey {
  id: string;
  key_code: string;
  status: "unused" | "used";
  label: string | null;
  max_uses: number | null;
  uses: number;
  used_by_name: string | null;
  used_at: string | null;
  redeemers: TRedeemer[];
}

/**
 * Organizer's entry key manager. Two modes:
 * - Individual keys: one-time codes, optionally labeled with each angler's
 *   name so the organizer can track who got which key. Hand one to each
 *   angler after they pay (payment stays off-platform).
 * - One shared key: a single code with unlimited uses — every angler joins
 *   with the same key, but each angler still joins only once. The list shows
 *   who has used it.
 */
export function EntryKeys({ tournamentId }: { tournamentId: string }) {
  const [keys, setKeys] = useState<TKey[]>([]);
  const [mode, setMode] = useState<"individual" | "shared">("individual");
  const [count, setCount] = useState("10");
  const [names, setNames] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

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

  const post = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fishFetch(`/api/fishmb/tournaments/${tournamentId}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setNames("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate keys.");
    } finally {
      setBusy(false);
    }
  };

  const generateIndividual = () => {
    const lines = names
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length > 0) {
      void post({ labels: lines.slice(0, 200) });
      return;
    }
    const n = Math.floor(Number(count));
    if (!n || n < 1 || n > 200) {
      setError("Enter a number between 1 and 200.");
      return;
    }
    void post({ count: n });
  };

  const createShared = () => {
    void post({ shared: true });
  };

  const saveLabel = async (keyId: string) => {
    setBusy(true);
    setError(null);
    try {
      await fishFetch(`/api/fishmb/tournaments/${tournamentId}/keys`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key_id: keyId, label: editLabel.trim() || null }),
      });
      setEditingId(null);
      setEditLabel("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the name.");
    } finally {
      setBusy(false);
    }
  };

  const copy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  };

  const sharedKeys = keys.filter((k) => k.max_uses === null);
  const individualKeys = keys.filter((k) => k.max_uses !== null);
  const unusedIndividual = individualKeys.filter(
    (k) => k.status === "unused"
  ).length;
  const sharedInUse = sharedKeys.length > 0;

  const statusBadge = (k: TKey) => {
    if (k.max_uses === null) {
      const n = k.redeemers.length;
      return (
        <span className="text-[10px] font-bold uppercase tracking-wider bg-signal/15 text-signal-dark px-2.5 py-1 rounded-full">
          🔗 Shared · {n} {n === 1 ? "angler" : "anglers"}
        </span>
      );
    }
    if (k.status === "used") {
      const who = k.used_by_name ?? k.label;
      return (
        <span
          className="text-[10px] font-bold uppercase tracking-wider bg-pine/10 text-pine px-2.5 py-1 rounded-full"
          title={who ? `Used by ${who}` : "Used"}
        >
          Used{who ? ` · ${who}` : ""}
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold uppercase tracking-wider bg-pine text-white px-2.5 py-1 rounded-full">
        Unused
      </span>
    );
  };

  return (
    <section className="bg-white border border-pine/10 rounded-3xl p-6 md:p-8 mb-8">
      <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-2">
        Entry keys
      </h2>
      <p className="text-pine/55 text-sm mb-5">
        Give each angler their key after they pay — payment stays
        off-platform. Each key joins one angler, once.{" "}
        {individualKeys.length > 0 && (
          <span className="font-bold text-pine">
            {unusedIndividual} of {individualKeys.length} individual keys unused.
          </span>
        )}
      </p>
      {error && (
        <p className="text-sm text-signal-dark bg-signal/10 border border-signal/30 rounded-2xl px-4 py-3 mb-5">
          {error}
        </p>
      )}

      <div className="flex gap-2 mb-5">
        {(["individual", "shared"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-5 py-2.5 rounded-full text-sm font-bold uppercase tracking-wider transition-colors ${
              mode === m
                ? "bg-pine text-white"
                : "bg-paper-deep text-pine/60 hover:text-pine"
            }`}
          >
            {m === "individual" ? "Individual keys" : "One shared key"}
          </button>
        ))}
      </div>

      {mode === "individual" ? (
        <div className="mb-6">
          <div className="flex flex-wrap gap-3 items-center mb-3">
            <input
              value={count}
              onChange={(e) => setCount(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="10"
              className="w-24 bg-paper-deep border border-pine/15 rounded-full px-4 py-2.5 text-pine text-center font-bold focus:outline-none focus:border-signal"
              aria-label="Number of keys to generate"
            />
            <button
              onClick={generateIndividual}
              disabled={busy}
              className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-2.5 rounded-full disabled:opacity-50 transition-colors"
            >
              {busy ? "Generating…" : "Generate keys"}
            </button>
          </div>
          <textarea
            value={names}
            onChange={(e) => setNames(e.target.value)}
            rows={3}
            placeholder={
              "Angler names — one per line (optional).\nIf you paste names, you get one labeled key per name."
            }
            className="w-full max-w-md bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-sm placeholder:text-pine/35 focus:outline-none focus:border-signal resize-y"
            aria-label="Angler names, one per line"
          />
        </div>
      ) : (
        <div className="mb-6">
          <p className="text-pine/60 text-sm mb-3 max-w-md">
            One code for everyone — unlimited uses, but each angler can still
            only join once. You'll see exactly who joined with it below.
          </p>
          <button
            onClick={createShared}
            disabled={busy || sharedInUse}
            className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-2.5 rounded-full disabled:opacity-50 transition-colors"
          >
            {busy
              ? "Creating…"
              : sharedInUse
                ? "Shared key already created"
                : "Create shared key"}
          </button>
        </div>
      )}

      {keys.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {keys.map((k) => {
            const copyable = k.max_uses === null || k.status === "unused";
            const redeemerNames = k.redeemers
              .map((r) => r.name)
              .filter((n): n is string => !!n);
            return (
              <div
                key={k.id}
                className={`rounded-2xl border px-4 py-2.5 ${
                  k.max_uses === null
                    ? "border-signal/40 bg-signal/5"
                    : k.status === "used"
                      ? "border-pine/10 bg-paper-deep opacity-70"
                      : "border-gold/50 bg-gold/10"
                }`}
              >
                <div className="flex items-center gap-2">
                  <code className="font-bold tracking-[0.18em] text-pine flex-1">
                    {k.key_code}
                  </code>
                  {statusBadge(k)}
                  {copyable && (
                    <button
                      onClick={() => copy(k.key_code)}
                      className="text-xs font-bold uppercase tracking-wider text-signal-dark hover:underline"
                    >
                      {copied === k.key_code ? "Copied!" : "Copy"}
                    </button>
                  )}
                </div>
                {(k.label || redeemerNames.length > 0 || editingId === k.id) && (
                  <div className="mt-1">
                    {editingId === k.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          placeholder="Angler name…"
                          maxLength={80}
                          autoFocus
                          className="flex-1 min-w-0 bg-white border border-signal rounded-full px-3 py-1.5 text-xs text-pine placeholder:text-pine/40 focus:outline-none"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveLabel(k.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <button
                          onClick={() => saveLabel(k.id)}
                          disabled={busy}
                          className="text-xs font-bold uppercase tracking-wider text-signal-dark hover:underline disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs font-bold uppercase tracking-wider text-pine/50 hover:underline"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-pine/55 truncate flex items-center gap-2">
                        <span className="flex-1 min-w-0 truncate">
                          {k.label && (
                            <span className="font-bold text-pine/75">{k.label}</span>
                          )}
                          {k.label && redeemerNames.length > 0 && " · "}
                          {redeemerNames.length > 0 && (
                            <span title={redeemerNames.join(", ")}>
                              Joined: {redeemerNames.join(", ")}
                            </span>
                          )}
                          {!k.label && redeemerNames.length === 0 && (
                            <span className="italic">No name</span>
                          )}
                        </span>
                        <button
                          onClick={() => {
                            setEditingId(k.id);
                            setEditLabel(k.label ?? "");
                          }}
                          className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-signal-dark hover:underline"
                        >
                          {k.label ? "Rename" : "＋ Name"}
                        </button>
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
