"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  FISHMB_GOOGLE_CLIENT_ID,
  FISHMB_TOKEN_KEY,
} from "@/lib/fishmb-constants";

export interface FishAuthUser {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  is_anonymous: boolean;
  account_type?: string;
}

interface FishAuthCtx {
  user: FishAuthUser | null;
  loading: boolean;
  openLogin: () => void;
  logout: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<FishAuthCtx>({
  user: null,
  loading: true,
  openLogin: () => {},
  logout: () => {},
  refresh: async () => {},
});

export const useFishAuth = () => useContext(Ctx);

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (opts: { client_id: string; callback: (r: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export function FishAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FishAuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);
  const [chooseType, setChooseType] = useState<FishAuthUser | null>(null);

  const refresh = useCallback(async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem(FISHMB_TOKEN_KEY) : null;
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/fish/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("bad session");
      const data = await res.json();
      setUser(data.user);
    } catch {
      localStorage.removeItem(FISHMB_TOKEN_KEY);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(() => {
    localStorage.removeItem(FISHMB_TOKEN_KEY);
    setUser(null);
  }, []);

  const openLogin = useCallback(() => setLoginOpen(true), []);

  return (
    <Ctx.Provider value={{ user, loading, openLogin, logout, refresh }}>
      {children}
      {loginOpen && (
        <LoginModal
          onClose={() => setLoginOpen(false)}
          onDone={(u, isNew) => {
            if (isNew) {
              // First signup — ask personal or business before entering.
              setChooseType(u);
            } else {
              setUser(u);
              setLoginOpen(false);
            }
          }}
        />
      )}
      {chooseType && (
        <AccountTypeChooser
          user={chooseType}
          onDone={(u) => {
            setUser(u);
            setChooseType(null);
            setLoginOpen(false);
          }}
        />
      )}
    </Ctx.Provider>
  );
}

function LoginModal({ onClose, onDone }: { onClose: () => void; onDone: (u: FishAuthUser, isNew: boolean) => void }) {
  const btnRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 13+ self-declaration + terms acceptance — both required before Google activates.
  const [ageOk, setAgeOk] = useState(false);
  const [termsOk, setTermsOk] = useState(false);
  const canContinue = ageOk && termsOk;

  // Remember a previous acceptance so returning users don't check twice.
  useEffect(() => {
    try {
      if (localStorage.getItem("fishmb-terms-ok") === "1") {
        setAgeOk(true);
        setTermsOk(true);
      }
    } catch {
      // storage unavailable — non-fatal
    }
  }, []);

  useEffect(() => {
    if (!canContinue) return;
    let cancelled = false;
    const init = () => {
      if (cancelled || !window.google || !btnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: FISHMB_GOOGLE_CLIENT_ID,
        callback: async (resp) => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch("/api/fish/auth/google", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id_token: resp.credential, age_confirmed: true, terms_accepted: true }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Sign-in failed.");
            try {
              localStorage.setItem(FISHMB_TOKEN_KEY, data.token);
              localStorage.setItem("fishmb-terms-ok", "1");
            } catch {
              // storage unavailable — non-fatal
            }
            onDone(data.user, data.is_new_user === true);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Sign-in failed.");
          } finally {
            setBusy(false);
          }
        },
      });
      window.google.accounts.id.renderButton(btnRef.current, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        width: 280,
      });
    };
    if (window.google) {
      init();
    } else {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = init;
      document.head.appendChild(s);
    }
    return () => {
      cancelled = true;
    };
  }, [onDone, canContinue]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-pine-deep/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Log in to FishMB"
    >
      <div
        className="bg-paper rounded-3xl max-w-sm w-full p-8 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-display font-bold uppercase text-2xl mb-1">
          <span className="text-pine">Fish</span>
          <span className="text-signal">MB</span>
        </div>
        <p className="text-pine/70 text-sm mb-5">
          Log in with Google — the same account as the FishMB app. Your catches and profile follow you.
        </p>
        <label className="flex items-start gap-2.5 text-left bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 mb-3 cursor-pointer">
          <input
            type="checkbox"
            checked={ageOk}
            onChange={(e) => setAgeOk(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[#2f6b3a]"
          />
          <span className="text-xs text-pine/80 leading-snug">
            I confirm I am <strong>13 years of age or older</strong>. FishMB is a
            community for anglers 13+.
          </span>
        </label>
        <label className="flex items-start gap-2.5 text-left bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={termsOk}
            onChange={(e) => setTermsOk(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[#2f6b3a]"
          />
          <span className="text-xs text-pine/80 leading-snug">
            I agree to the{" "}
            <a href="/fishmb/terms" target="_blank" rel="noopener" className="font-bold text-signal-dark hover:underline" onClick={(e) => e.stopPropagation()}>
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/fishmb/privacy" target="_blank" rel="noopener" className="font-bold text-signal-dark hover:underline" onClick={(e) => e.stopPropagation()}>
              Privacy Policy
            </a>
            .
          </span>
        </label>
        {canContinue ? (
          <div ref={btnRef} className="flex justify-center min-h-[44px]" />
        ) : (
          <p className="text-xs text-pine/50 mb-2">
            Check both boxes above to continue with Google.
          </p>
        )}
        {busy && <p className="text-sm text-pine/60 mt-4">Signing you in…</p>}
        {error && <p className="text-sm text-signal-dark mt-4">{error}</p>}
        <button
          onClick={onClose}
          className="mt-6 text-sm font-bold uppercase tracking-wider text-pine/50 hover:text-pine"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/** First-signup step: personal or business account? */
function AccountTypeChooser({ user, onDone }: { user: FishAuthUser; onDone: (u: FishAuthUser) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (account_type: "personal" | "business") => {
    setSaving(true);
    setError(null);
    try {
      const token = localStorage.getItem(FISHMB_TOKEN_KEY);
      const res = await fetch("/api/fish/auth/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ account_type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      onDone(data.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-pine-deep/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Choose account type"
    >
      <div className="bg-paper rounded-3xl max-w-md w-full p-8 text-center shadow-2xl">
        <h2 className="font-display font-bold uppercase text-pine text-2xl tracking-wide mb-2">
          Welcome, {user.name.split(" ")[0]}!
        </h2>
        <p className="text-pine/70 text-sm mb-6">
          Is this a personal account or a business account? Businesses get their
          own page, advertising options, and listing tools.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => pick("personal")}
            disabled={saving}
            className="bg-white border-2 border-pine/15 hover:border-signal rounded-3xl p-5 text-left transition-colors disabled:opacity-50"
          >
            <p className="text-3xl mb-2">🎣</p>
            <p className="font-bold text-pine">Personal</p>
            <p className="text-xs text-pine/60 mt-1">Fish, post, join tournaments.</p>
          </button>
          <button
            onClick={() => pick("business")}
            disabled={saving}
            className="bg-white border-2 border-pine/15 hover:border-signal rounded-3xl p-5 text-left transition-colors disabled:opacity-50"
          >
            <p className="text-3xl mb-2">🏢</p>
            <p className="font-bold text-pine">Business</p>
            <p className="text-xs text-pine/60 mt-1">Lodge, guide, shop — get a business page + ads.</p>
          </button>
        </div>
        {saving && <p className="text-sm text-pine/60 mt-4">Saving…</p>}
        {error && <p className="text-sm text-signal-dark mt-4">{error}</p>}
      </div>
    </div>
  );
}

/** Header login button: shows LOG IN, or the user's avatar/name when signed in. */
export function FishLoginButton() {
  const { user, loading, openLogin, logout } = useFishAuth();
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close the menu on any outside tap. (A fixed overlay div can't do this job:
  // the header's backdrop-blur makes it a containing block, clipping the overlay
  // to the header strip.)
  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu ]);

  if (loading) {
    return <span className="inline-flex w-24 h-10 rounded-full bg-pine/10 animate-pulse" />;
  }

  if (!user) {
    return (
      <button
        onClick={openLogin}
        className="inline-flex bg-signal hover:bg-signal-dark text-white text-sm font-bold uppercase tracking-wider px-4 sm:px-5 py-2.5 rounded-full transition-colors"
      >
        Log in
      </button>
    );
  }

  return (
    <div className="relative block" ref={ref}>
      <button
        onClick={() => setMenu((m) => !m)}
        className="inline-flex items-center gap-2 bg-pine/5 hover:bg-pine/10 rounded-full pl-1 pr-4 py-1 transition-colors"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <span className="w-8 h-8 rounded-full bg-signal text-white flex items-center justify-center font-bold text-sm">
            {user.name.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="text-sm font-bold text-pine max-w-[120px] truncate">{user.name}</span>
      </button>
      {menu && (
        <div
          className="absolute right-0 mt-2 z-20 bg-paper border border-pine/10 rounded-2xl shadow-xl py-2 w-44"
          onClick={() => setMenu(false)}
        >
            <Link
              href="/fishmb/dashboard"
              onClick={() => setMenu(false)}
              className="block px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-pine/70 hover:text-signal hover:bg-pine/5"
            >
              📊 Dashboard
            </Link>
            <Link
              href="/fishmb/profile"
              onClick={() => setMenu(false)}
              className="block px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-pine/70 hover:text-signal hover:bg-pine/5"
            >
              My profile
            </Link>
            <Link
              href="/fishmb/friends"
              onClick={() => setMenu(false)}
              className="block px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-pine/70 hover:text-signal hover:bg-pine/5"
            >
              Friends
            </Link>
            <button
              onClick={() => {
                logout();
                setMenu(false);
              }}
              className="w-full text-left px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-pine/70 hover:text-signal hover:bg-pine/5"
            >
              Log out
            </button>
        </div>
      )}
    </div>
  );
}
