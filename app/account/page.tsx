"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";

interface PointsSummary {
  balance: number;
  lifetime: number;
  transactions: { id: string; points: number; type: string; note: string | null; createdAt: string }[];
  credits: { code: string; amount: number; currency: string; createdAt: string }[];
}

interface Address {
  id: string;
  label: string;
  name: string;
  address1: string;
  address2: string | null;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  phone: string | null;
  isDefault: boolean;
}

interface Order {
  id: string;
  orderNumber: string | null;
  total: number;
  currency: string;
  status: string;
  pointsCredited: boolean;
  createdAt: string;
}

const EMPTY_ADDR = { label: "Home", name: "", address1: "", address2: "", city: "", province: "", postalCode: "", country: "Canada", phone: "" };

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function money(amount: number, currency = "CAD"): string {
  try {
    return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export default function AccountPage() {
  const { data: session, status } = useSession();
  const [points, setPoints] = useState<PointsSummary | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [addrForm, setAddrForm] = useState(EMPTY_ADDR);
  const [addrError, setAddrError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [p, a, o] = await Promise.all([
      fetch("/api/points").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/addresses").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/orders").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    if (p) setPoints(p);
    if (a) setAddresses(a.addresses ?? []);
    if (o) setOrders(o.orders ?? []);
  }, []);

  useEffect(() => {
    if (status === "authenticated") loadAll();
  }, [status, loadAll]);

  if (status === "loading") {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-pine/60">Loading…</div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="font-display font-bold text-3xl uppercase text-pine mb-3">My Account</h1>
        <p className="text-pine/60 mb-6">Sign in to view your account, track orders and earn Wallyworld Rewards points.</p>
        <button
          onClick={() => signIn(undefined, { callbackUrl: "/account" })}
          className="rounded-xl bg-signal hover:bg-signal-dark text-white font-bold px-8 py-3.5 transition shadow-md"
        >
          Sign In / Create Account
        </button>
        <p className="text-xs text-pine/45 mt-4">Use the account icon in the header — you can sign up with Gmail or email.</p>
      </div>
    );
  }

  const pendingOrders = orders.filter((o) => o.status === "pending");

  const handleClaim = async () => {
    setClaiming(true);
    setClaimMsg(null);
    try {
      const res = await fetch("/api/orders/claim", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setClaimMsg(`+${data.pointsEarned} points added to your balance!`);
        loadAll();
      } else {
        setClaimMsg(data.error ?? "Nothing to claim right now.");
      }
    } catch {
      setClaimMsg("Something went wrong. Please try again.");
    } finally {
      setClaiming(false);
    }
  };

  const handleAddrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddrError(null);
    try {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addrForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddrError(data.error ?? "Could not save address.");
        return;
      }
      setShowAddrForm(false);
      setAddrForm(EMPTY_ADDR);
      loadAll();
    } catch {
      setAddrError("Something went wrong. Please try again.");
    }
  };

  const deleteAddress = async (id: string) => {
    if (!confirm("Delete this address?")) return;
    await fetch(`/api/addresses/${id}`, { method: "DELETE" });
    loadAll();
  };

  const makeDefault = async (id: string) => {
    const addr = addresses.find((a) => a.id === id);
    if (!addr) return;
    await fetch(`/api/addresses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...addr, isDefault: true }),
    });
    loadAll();
  };

  const inputCls =
    "w-full rounded-xl border border-pine/20 bg-white px-4 py-2.5 text-pine placeholder:text-pine/35 outline-none focus:border-signal text-sm";

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="font-display font-bold text-3xl md:text-4xl uppercase tracking-wide text-pine mb-1">
        My Account
      </h1>
      <p className="text-pine/55 mb-8">{session?.user?.email}</p>

      {/* points banner */}
      <section className="rounded-2xl bg-pine text-white p-6 md:p-8 mb-8 relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-xs uppercase tracking-widest text-gold font-bold mb-1">Wallyworld Rewards</p>
          <p className="font-display font-bold text-5xl">{points?.balance ?? 0}</p>
          <p className="text-paper/70 text-sm mt-1">
            points · {points?.lifetime ?? 0} earned all-time
          </p>
          <Link
            href="/account/points"
            className="inline-block mt-4 rounded-xl bg-signal hover:bg-signal-dark text-white font-bold px-6 py-2.5 text-sm transition"
          >
            View Rewards & Redeem
          </Link>
        </div>
        <div className="absolute -right-8 -bottom-10 font-display font-bold text-[160px] leading-none text-white/5 select-none">
          W
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-8">
        {/* orders */}
        <section id="orders" className="rounded-2xl bg-white border border-pine/10 p-6">
          <h2 className="font-display font-bold text-xl uppercase tracking-wide text-pine mb-4">
            Order History
          </h2>
          {pendingOrders.length > 0 && (
            <div className="rounded-xl bg-gold/10 border border-gold/30 p-4 mb-4">
              <p className="text-sm text-pine font-semibold mb-2">
                You have {pendingOrders.length} recent checkout{pendingOrders.length > 1 ? "s" : ""} waiting for points.
              </p>
              <button
                onClick={handleClaim}
                disabled={claiming}
                className="rounded-lg bg-gold hover:opacity-90 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 transition"
              >
                {claiming ? "Claiming…" : "Claim my points"}
              </button>
              {claimMsg && <p className="text-sm text-pine mt-2">{claimMsg}</p>}
            </div>
          )}
          {orders.length === 0 ? (
            <p className="text-sm text-pine/55">
              No orders yet. When you check out while signed in, your order is recorded here and you
              can claim 1 point per $1 spent.
            </p>
          ) : (
            <ul className="space-y-3">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between rounded-xl bg-paper-deep px-4 py-3">
                  <div>
                    <p className="text-sm font-bold text-pine">
                      {o.orderNumber ? `Order ${o.orderNumber}` : `Order ${o.id.slice(0, 8)}`}
                    </p>
                    <p className="text-xs text-pine/50">
                      {fmtDate(o.createdAt)} · {o.status === "completed" ? "Completed" : "Checkout started"}
                      {o.pointsCredited && " · points earned"}
                    </p>
                  </div>
                  <span className="font-display font-bold text-pine">{money(o.total, o.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* addresses */}
        <section className="rounded-2xl bg-white border border-pine/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-xl uppercase tracking-wide text-pine">
              Saved Addresses
            </h2>
            <button
              onClick={() => {
                setShowAddrForm((v) => !v);
                setAddrError(null);
              }}
              className="text-sm font-bold text-signal hover:text-signal-dark"
            >
              {showAddrForm ? "Cancel" : "+ Add address"}
            </button>
          </div>

          {showAddrForm && (
            <form onSubmit={handleAddrSubmit} className="rounded-xl bg-paper-deep p-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input className={inputCls} placeholder="Label (Home, Cabin…)" value={addrForm.label} onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })} />
                <input className={inputCls} placeholder="Full name *" required value={addrForm.name} onChange={(e) => setAddrForm({ ...addrForm, name: e.target.value })} />
              </div>
              <input className={inputCls} placeholder="Street address *" required value={addrForm.address1} onChange={(e) => setAddrForm({ ...addrForm, address1: e.target.value })} />
              <input className={inputCls} placeholder="Apt, suite, etc." value={addrForm.address2} onChange={(e) => setAddrForm({ ...addrForm, address2: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <input className={inputCls} placeholder="City *" required value={addrForm.city} onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })} />
                <input className={inputCls} placeholder="Province *" required value={addrForm.province} onChange={(e) => setAddrForm({ ...addrForm, province: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className={inputCls} placeholder="Postal code *" required value={addrForm.postalCode} onChange={(e) => setAddrForm({ ...addrForm, postalCode: e.target.value })} />
                <input className={inputCls} placeholder="Phone" value={addrForm.phone} onChange={(e) => setAddrForm({ ...addrForm, phone: e.target.value })} />
              </div>
              {addrError && <p className="text-sm text-red-600">{addrError}</p>}
              <button type="submit" className="rounded-xl bg-pine hover:bg-pine-deep text-white font-bold px-6 py-2.5 text-sm transition">
                Save Address
              </button>
            </form>
          )}

          {addresses.length === 0 && !showAddrForm ? (
            <p className="text-sm text-pine/55">
              No saved addresses yet. Add one and we&apos;ll remember it for faster checkout.
            </p>
          ) : (
            <ul className="space-y-3">
              {addresses.map((a) => (
                <li key={a.id} className="rounded-xl bg-paper-deep px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm text-pine">
                      <p className="font-bold">
                        {a.label}
                        {a.isDefault && (
                          <span className="ml-2 text-[10px] uppercase tracking-widest bg-pine text-white rounded-full px-2 py-0.5">
                            Default
                          </span>
                        )}
                      </p>
                      <p className="mt-1">{a.name}</p>
                      <p className="text-pine/60">
                        {a.address1}
                        {a.address2 ? `, ${a.address2}` : ""}
                        <br />
                        {a.city}, {a.province} {a.postalCode}
                        <br />
                        {a.country}
                        {a.phone ? ` · ${a.phone}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {!a.isDefault && (
                        <button onClick={() => makeDefault(a.id)} className="text-xs font-bold text-signal hover:text-signal-dark">
                          Set default
                        </button>
                      )}
                      <button onClick={() => deleteAddress(a.id)} className="text-xs text-pine/45 hover:text-red-600">
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* recent points activity */}
      <section className="rounded-2xl bg-white border border-pine/10 p-6 mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-xl uppercase tracking-wide text-pine">
            Recent Points Activity
          </h2>
          <Link href="/account/points" className="text-sm font-bold text-signal hover:text-signal-dark">
            View all →
          </Link>
        </div>
        {!points || points.transactions.length === 0 ? (
          <p className="text-sm text-pine/55">
            No points activity yet — earn 1 point for every $1 you spend.
          </p>
        ) : (
          <ul className="divide-y divide-pine/10">
            {points.transactions.slice(0, 5).map((t) => (
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
      </section>
    </div>
  );
}
