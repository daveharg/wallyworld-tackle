"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface PointsSummary {
  balance: number;
  lifetime: number;
  transactions: { id: string; points: number; type: string; note: string | null; createdAt: string }[];
  credits: { code: string; amount: number; currency: string; createdAt: string }[];
  earnRate: number;
  redeemPoints: number;
  redeemValue: number;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export default function PointsPage() {
  const { status } = useSession();
  const [data, setData] = useState<PointsSummary | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/points");
    if (res.ok) setData(await res.json());
  };

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status]);

  const handleRedeem = async () => {
    setRedeeming(true);
    setMsg(null);
    try {
      const res = await fetch("/api/points/redeem", { method: "POST" });
      const j = await res.json();
      if (res.ok) {
        setMsg(`Done! Your $5 store credit code is ${j.code}. Show it at checkout or mention it when you contact us.`);
        load();
      } else {
        setMsg(j.error ?? "Could not redeem.");
      }
    } catch {
      setMsg("Something went wrong. Please try again.");
    } finally {
      setRedeeming(false);
    }
  };

  if (status === "loading") {
    return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-pine/60">Loading…</div>;
  }

  if (status === "unauthenticated") {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="font-display font-bold text-3xl uppercase text-pine mb-3">Wallyworld Rewards</h1>
        <p className="text-pine/60 mb-6">Sign in to see your points balance and redeem rewards.</p>
        <Link href="/account" className="rounded-xl bg-signal hover:bg-signal-dark text-white font-bold px-8 py-3.5 transition shadow-md inline-block">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <p className="text-xs uppercase tracking-widest text-gold font-bold">Wallyworld Rewards</p>
      <h1 className="font-display font-bold text-3xl md:text-4xl uppercase tracking-wide text-pine mb-6">
        Loyalty Points
      </h1>

      {/* balance card */}
      <div className="rounded-2xl bg-pine text-white p-6 md:p-8 mb-8 flex flex-wrap items-center justify-between gap-6">
        <div>
          <p className="font-display font-bold text-5xl">{data?.balance ?? 0}</p>
          <p className="text-paper/70 text-sm mt-1">points available · {data?.lifetime ?? 0} earned all-time</p>
        </div>
        <button
          onClick={handleRedeem}
          disabled={redeeming || (data?.balance ?? 0) < (data?.redeemPoints ?? 100)}
          className="rounded-xl bg-signal hover:bg-signal-dark disabled:opacity-40 text-white font-bold px-6 py-3 transition shadow-md"
        >
          {redeeming ? "Redeeming…" : `Redeem ${data?.redeemPoints ?? 100} pts → $${data?.redeemValue ?? 5} off`}
        </button>
      </div>
      {msg && (
        <div className="rounded-xl bg-gold/10 border border-gold/40 p-4 mb-8 text-sm text-pine font-medium">
          {msg}
        </div>
      )}

      {/* how it works */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="rounded-2xl bg-white border border-pine/10 p-6">
          <h2 className="font-display font-bold text-xl uppercase tracking-wide text-pine mb-3">How to earn</h2>
          <ul className="space-y-2.5 text-sm text-pine/75">
            <li className="flex gap-2"><span className="text-signal font-bold">1.</span> Earn <strong>1 point for every $1</strong> you spend.</li>
            <li className="flex gap-2"><span className="text-signal font-bold">2.</span> Check out while <strong>signed in</strong> — your order is recorded automatically.</li>
            <li className="flex gap-2"><span className="text-signal font-bold">3.</span> After your order ships, hit <strong>&ldquo;Claim my points&rdquo;</strong> on your account page.</li>
            <li className="flex gap-2"><span className="text-signal font-bold">4.</span> Points never expire.</li>
          </ul>
        </div>
        <div className="rounded-2xl bg-white border border-pine/10 p-6">
          <h2 className="font-display font-bold text-xl uppercase tracking-wide text-pine mb-3">How to redeem</h2>
          <ul className="space-y-2.5 text-sm text-pine/75">
            <li className="flex gap-2"><span className="text-gold font-bold">★</span> Every <strong>100 points = $5 off</strong> your next order.</li>
            <li className="flex gap-2"><span className="text-gold font-bold">★</span> Hit redeem above to generate a <strong>store credit code</strong>.</li>
            <li className="flex gap-2"><span className="text-gold font-bold">★</span> Mention the code when you check out and we&apos;ll take $5 off.</li>
            <li className="flex gap-2"><span className="text-gold font-bold">★</span> Codes don&apos;t expire and can be combined with sales.</li>
          </ul>
        </div>
      </div>

      {/* unused credits */}
      {data && data.credits.length > 0 && (
        <div className="rounded-2xl bg-white border border-pine/10 p-6 mb-8">
          <h2 className="font-display font-bold text-xl uppercase tracking-wide text-pine mb-4">Your store credit codes</h2>
          <ul className="space-y-2">
            {data.credits.map((c) => (
              <li key={c.code} className="flex items-center justify-between rounded-xl bg-paper-deep px-4 py-3">
                <span className="font-mono font-bold text-pine tracking-widest">{c.code}</span>
                <span className="font-display font-bold text-signal">${c.amount.toFixed(2)} off</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* full history */}
      <div className="rounded-2xl bg-white border border-pine/10 p-6">
        <h2 className="font-display font-bold text-xl uppercase tracking-wide text-pine mb-4">Points history</h2>
        {!data || data.transactions.length === 0 ? (
          <p className="text-sm text-pine/55">No points activity yet.</p>
        ) : (
          <ul className="divide-y divide-pine/10">
            {data.transactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2.5">
                <div className="text-sm">
                  <p className="font-semibold text-pine">{t.note ?? (t.type === "earn" ? "Points earned" : "Points redeemed")}</p>
                  <p className="text-xs text-pine/50">{fmtDate(t.createdAt)}</p>
                </div>
                <span className={`font-display font-bold ${t.points >= 0 ? "text-emerald-700" : "text-signal"}`}>
                  {t.points >= 0 ? "+" : ""}{t.points}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link href="/account" className="inline-block mt-6 text-sm font-bold text-signal hover:text-signal-dark">
        ← Back to My Account
      </Link>
    </div>
  );
}
