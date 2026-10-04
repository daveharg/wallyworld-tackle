"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

interface Props {
  open: boolean;
  onClose: () => void;
  initialTab?: "signin" | "signup";
}

export default function AuthModal({ open, onClose, initialTab = "signin" }: Props) {
  const [tab, setTab] = useState<"signin" | "signup">(initialTab);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setError(null);
      setBusy(false);
      fetch("/api/auth/config")
        .then((r) => r.json())
        .then((j) => setGoogleEnabled(Boolean(j.googleEnabled)))
        .catch(() => setGoogleEnabled(false));
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleGoogle = () => {
    setBusy(true);
    signIn("google", { callbackUrl: "/account" });
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (tab === "signup") {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Sign-up failed.");
          setBusy(false);
          return;
        }
      }
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("Invalid email or password.");
        setBusy(false);
        return;
      }
      onClose();
      window.location.href = "/account";
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-pine/20 bg-white px-4 py-3 text-pine placeholder:text-pine/35 outline-none focus:border-signal focus:ring-2 focus:ring-signal/20 transition";

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Sign in or create account">
      <div className="absolute inset-0 bg-pine-deep/60 animate-fade-in" onClick={onClose} />
      <div className="absolute inset-0 grid place-items-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md bg-paper rounded-2xl shadow-2xl border border-pine/10 overflow-hidden animate-drawer-in">
          {/* header */}
          <div className="bg-pine px-6 py-5 relative">
            <h2 className="font-display font-bold text-2xl uppercase tracking-wide text-white">
              {tab === "signin" ? "Welcome back" : "Join Wallyworld Rewards"}
            </h2>
            <p className="text-paper/70 text-sm mt-1">
              {tab === "signin"
                ? "Sign in to track orders, sync your cart and earn points."
                : "Create an account and start earning 1 point per $1 spent."}
            </p>
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          {/* tabs */}
          <div className="flex border-b border-pine/10">
            {(["signin", "signup"] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  setError(null);
                }}
                className={`flex-1 py-3.5 font-display font-bold uppercase tracking-wider text-sm border-b-[3px] transition ${
                  tab === t
                    ? "text-signal border-signal"
                    : "text-pine/50 border-transparent hover:text-pine"
                }`}
              >
                {t === "signin" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          <div className="p-6">
            {googleEnabled && (
              <>
                <button
                  onClick={handleGoogle}
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-3 rounded-xl border border-pine/20 bg-white hover:bg-paper-deep py-3 font-semibold text-pine transition disabled:opacity-50"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.2.1c2.2-2 3.8-5 3.8-8.9z" />
                    <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-.1.1-3.7 2.9v.1C3.5 21.3 7.5 24 12 24z" />
                    <path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.1-3.7-2.9-.1.1C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l3.9-3z" />
                    <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17 1.1 14.8 0 12 0 7.5 0 3.5 2.7 1.3 6.6l3.9 3.1c1-2.9 3.7-5 6.8-5z" />
                  </svg>
                  {tab === "signin" ? "Continue with Google" : "Sign up with Gmail"}
                </button>
                <div className="flex items-center gap-3 my-5">
                  <span className="flex-1 h-px bg-pine/15" />
                  <span className="text-xs text-pine/45 font-semibold uppercase tracking-widest">or with email</span>
                  <span className="flex-1 h-px bg-pine/15" />
                </div>
              </>
            )}

            <form onSubmit={handleEmail} className="space-y-4">
              {tab === "signup" && (
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name (optional)"
                  autoComplete="name"
                  className={inputCls}
                />
              )}
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                type="email"
                required
                autoComplete="email"
                className={inputCls}
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tab === "signup" ? "Password (min 8 characters)" : "Password"}
                type="password"
                required
                minLength={tab === "signup" ? 8 : 1}
                autoComplete={tab === "signup" ? "new-password" : "current-password"}
                className={inputCls}
              />
              {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-signal hover:bg-signal-dark disabled:opacity-50 text-white font-bold py-3.5 transition shadow-md"
              >
                {busy ? "Please wait…" : tab === "signin" ? "Sign In" : "Create Account"}
              </button>
            </form>

            {tab === "signup" && (
              <p className="text-xs text-pine/50 mt-4 text-center leading-relaxed">
                By creating an account you join <strong>Wallyworld Rewards</strong> — earn 1 point per
                $1 spent. 100 points = $5 off.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
