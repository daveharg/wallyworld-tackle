"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFishAuth } from "../../_components/FishAuth";
import { fishFetch } from "../../_components/fishFetch";
import { PayoutEditor } from "./PayoutEditor";
import type { PayoutTier } from "@/lib/fish/tournaments";

interface LakeOpt {
  id: string;
  name: string;
  region: string;
}

const inputCls =
  "w-full bg-white border border-pine/20 rounded-2xl px-4 py-3 text-pine focus:outline-none focus:border-signal";
const labelCls = "block text-xs font-bold uppercase tracking-[0.18em] text-pine/60 mb-1.5";

export function TournamentBuilder({ lakes }: { lakes: LakeOpt[] }) {
  const router = useRouter();
  const { user, openLogin } = useFishAuth();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [scoring, setScoring] = useState("longest");
  const [rules, setRules] = useState("");
  const [lakeQuery, setLakeQuery] = useState("");
  const [lakeIds, setLakeIds] = useState<string[]>([]);
  const [speciesInput, setSpeciesInput] = useState("");
  const [species, setSpecies] = useState<string[]>(["Walleye"]);
  const [entryFee, setEntryFee] = useState("");
  const [payouts, setPayouts] = useState<PayoutTier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const lakeMatches = useMemo(() => {
    const q = lakeQuery.trim().toLowerCase();
    if (!q) return [];
    return lakes.filter((l) => l.name.toLowerCase().includes(q)).slice(0, 8);
  }, [lakeQuery, lakes]);

  const lakeName = (id: string) => lakes.find((l) => l.id === id)?.name || id;

  const validBasics = name.trim().length > 0 && startsAt && endsAt && new Date(endsAt) > new Date(startsAt);

  const create = async () => {
    setError(null);
    if (!user) {
      // Dave's flow: build first, log in when ready — the form is preserved.
      openLogin();
      return;
    }
    setSaving(true);
    try {
      const data = await fishFetch("/api/fishmb/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          lake_ids: lakeIds,
          species,
          starts_at: new Date(startsAt).toISOString(),
          ends_at: new Date(endsAt).toISOString(),
          rules: rules.trim(),
          scoring,
          max_participants: null,
          entry_fee_cents: Math.max(0, Math.round((parseFloat(entryFee) || 0) * 100)),
          payouts,
        }),
      });
      router.push(`/fishmb/tournaments/${data.tournament.id}/manage`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the tournament.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-paper-deep border border-pine/10 rounded-3xl p-6 md:p-8">
      {/* Stepper */}
      <div className="flex gap-2 mb-8">
        {["Basics", "Waters & species", "Review"].map((s, i) => (
          <button
            key={s}
            onClick={() => i < step && setStep(i)}
            className={`flex-1 text-center text-xs font-bold uppercase tracking-wider py-2.5 rounded-full transition-colors ${
              i === step ? "bg-pine text-white" : i < step ? "bg-signal/15 text-signal-dark" : "bg-pine/5 text-pine/40"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-5">
          <div>
            <label className={labelCls}>Tournament name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lake Winnipeg Walleye Classic" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What is it, who is it for, what are the prizes?" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Starts *</label>
              <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Ends *</label>
              <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Scoring</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["longest", "Longest fish"],
                ["total", "Total length"],
                ["count", "Most fish"],
              ].map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setScoring(v)}
                  className={`py-3 rounded-2xl text-sm font-bold transition-colors ${scoring === v ? "bg-signal text-white" : "bg-white border border-pine/20 text-pine/70"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Rules</label>
            <textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={4} placeholder="Catch-photo rules, measuring requirements, boundaries, prizes…" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Entry fee per angler ($)</label>
              <input
                value={entryFee}
                onChange={(e) => setEntryFee(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder="0 = free"
                className={inputCls}
              />
            </div>
            <div className="flex items-end pb-3">
              <p className="text-xs text-pine/50">
                The pot is entry fee × anglers. Payouts below are taken from it.
              </p>
            </div>
          </div>
          <div>
            <label className={labelCls}>Payouts</label>
            <PayoutEditor value={payouts} onChange={setPayouts} />
            <p className="text-xs text-pine/50 mt-2">
              Each place pays a % of the pot or a fixed $ amount. Leave empty for bragging rights.
            </p>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <div>
            <label className={labelCls}>Waters (search Manitoba lakes)</label>
            <input value={lakeQuery} onChange={(e) => setLakeQuery(e.target.value)} placeholder="Type a lake name…" className={inputCls} />
            {lakeMatches.length > 0 && (
              <div className="mt-2 bg-white border border-pine/15 rounded-2xl overflow-hidden">
                {lakeMatches.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => {
                      if (!lakeIds.includes(l.id)) setLakeIds([...lakeIds, l.id]);
                      setLakeQuery("");
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-pine/5 text-sm text-pine flex justify-between"
                  >
                    <span>{l.name}</span>
                    <span className="text-pine/45 text-xs">{l.region}</span>
                  </button>
                ))}
              </div>
            )}
            {lakeIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {lakeIds.map((id) => (
                  <span key={id} className="inline-flex items-center gap-2 bg-pine text-white text-sm font-bold pl-4 pr-2 py-1.5 rounded-full">
                    {lakeName(id)}
                    <button onClick={() => setLakeIds(lakeIds.filter((x) => x !== id))} className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/40 text-xs" aria-label={`Remove ${lakeName(id)}`}>✕</button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-pine/50 mt-2">Optional — leave empty for any Manitoba water.</p>
          </div>
          <div>
            <label className={labelCls}>Eligible species</label>
            <div className="flex gap-2">
              <input
                value={speciesInput}
                onChange={(e) => setSpeciesInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && speciesInput.trim()) {
                    e.preventDefault();
                    if (!species.includes(speciesInput.trim())) setSpecies([...species, speciesInput.trim()]);
                    setSpeciesInput("");
                  }
                }}
                placeholder="Add a species, press Enter"
                className={inputCls}
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {species.map((s) => (
                <span key={s} className="inline-flex items-center gap-2 bg-gold/20 text-pine text-sm font-bold pl-4 pr-2 py-1.5 rounded-full">
                  {s}
                  <button onClick={() => setSpecies(species.filter((x) => x !== s))} className="w-6 h-6 rounded-full bg-pine/10 hover:bg-pine/25 text-xs" aria-label={`Remove ${s}`}>✕</button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h3 className="font-display font-bold uppercase text-pine text-xl tracking-wide">Review</h3>
          <dl className="bg-white rounded-2xl border border-pine/10 p-5 space-y-2.5 text-sm">
            <div className="flex justify-between"><dt className="text-pine/55 font-bold uppercase text-xs tracking-wider">Name</dt><dd className="text-pine font-bold">{name}</dd></div>
            <div className="flex justify-between"><dt className="text-pine/55 font-bold uppercase text-xs tracking-wider">Dates</dt><dd className="text-pine">{startsAt.replace("T", " ")} → {endsAt.replace("T", " ")}</dd></div>
            <div className="flex justify-between"><dt className="text-pine/55 font-bold uppercase text-xs tracking-wider">Scoring</dt><dd className="text-pine capitalize">{scoring === "longest" ? "Longest fish" : scoring === "total" ? "Total length" : "Most fish"}</dd></div>
            <div className="flex justify-between"><dt className="text-pine/55 font-bold uppercase text-xs tracking-wider">Waters</dt><dd className="text-pine text-right">{lakeIds.length ? lakeIds.map(lakeName).join(", ") : "Any Manitoba water"}</dd></div>
            <div className="flex justify-between"><dt className="text-pine/55 font-bold uppercase text-xs tracking-wider">Species</dt><dd className="text-pine text-right">{species.join(", ") || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-pine/55 font-bold uppercase text-xs tracking-wider">Entry fee</dt><dd className="text-pine text-right">{parseFloat(entryFee) > 0 ? `$${parseFloat(entryFee).toFixed(2)} / angler` : "Free"}</dd></div>
            {payouts.length > 0 && (
              <div className="flex justify-between"><dt className="text-pine/55 font-bold uppercase text-xs tracking-wider">Payouts</dt><dd className="text-pine text-right">{payouts.map((p) => `${p.place}${p.type === "percent" ? ` (${p.value}%)` : ` ($${p.value})`}`).join(", ")}</dd></div>
            )}
          </dl>
          {!user && (
            <p className="text-sm text-pine/60 bg-gold/15 border border-gold/40 rounded-2xl p-4">
              You&apos;ll log in with Google to save it — the same account as the FishMB app. Your tournament draft stays right here.
            </p>
          )}
          {error && <p className="text-sm text-signal-dark">{error}</p>}
        </div>
      )}

      <div className="flex justify-between mt-8">
        <button
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="text-sm font-bold uppercase tracking-wider text-pine/50 disabled:opacity-30 px-4 py-3"
        >
          ← Back
        </button>
        {step < 2 ? (
          <button
            onClick={() => validBasics ? setStep(step + 1) : setError("Give your tournament a name and valid start/end dates.")}
            className="bg-pine hover:bg-pine-deep text-white font-bold uppercase tracking-wider text-sm px-7 py-3 rounded-full transition-colors"
          >
            Continue →
          </button>
        ) : (
          <button
            onClick={create}
            disabled={saving}
            className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-7 py-3 rounded-full transition-colors disabled:opacity-50"
          >
            {saving ? "Creating…" : user ? "Create tournament" : "Log in & create"}
          </button>
        )}
      </div>
      {step === 0 && error && <p className="text-sm text-signal-dark mt-3">{error}</p>}
    </div>
  );
}
