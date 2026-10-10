"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { fishFetch } from "./fishFetch";
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
          initialize: (opts: {
            client_id: string;
            callback: (r: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
          prompt: () => void;
          disableAutoSelect: () => void;
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 13+ self-declaration + terms acceptance — both required before Google activates.
  const [ageOk, setAgeOk] = useState(false);
  const [termsOk, setTermsOk] = useState(false);
  const canContinue = ageOk && termsOk;

  // PKCE helpers for Google OAuth (no iframe, no GSI button — avoids the "locked" state).
  const base64UrlEncode = (buf: ArrayBuffer) => {
    const bytes = new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  const generateVerifier = () => {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return base64UrlEncode(arr.buffer);
  };
  const challengeFromVerifier = async (v: string) => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
    return base64UrlEncode(digest);
  };

  const signInWithGoogle = async () => {
    if (!canContinue || busy) return;
    setBusy(true);
    setError(null);
    try {
      const verifier = generateVerifier();
      const challenge = await challengeFromVerifier(verifier);
      const state = generateVerifier();
      try {
        sessionStorage.setItem("fishmb-oauth-verifier", verifier);
        sessionStorage.setItem("fishmb-oauth-state", state);
      } catch { /* noop */ }

      const redirectUri = `${window.location.origin}/fishmb/auth/callback`;
      const params = new URLSearchParams({
        client_id: FISHMB_GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        code_challenge: challenge,
        code_challenge_method: "S256",
        state,
        prompt: "select_account",
      });
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      const popup = window.open(authUrl, "fishmb-google-signin", "width=500,height=600");
      if (!popup) throw new Error("Popup blocked. Allow popups for FishMB to sign in.");

      // Wait for the popup to send us the authorization code.
      const code: string = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          window.removeEventListener("message", onMessage);
          reject(new Error("Sign-in timed out. Try again."));
        }, 120000);
        const onMessage = (e: MessageEvent) => {
          if (e.origin !== window.location.origin) return;
          const d = e.data as { type?: string; code?: string; error?: string; state?: string };
          if (d?.type !== "fishmb-oauth") return;
          clearTimeout(timeout);
          window.removeEventListener("message", onMessage);
          if (d.error) reject(new Error(d.error));
          else if (d.code) resolve(d.code);
          else reject(new Error("Sign-in failed. Try again."));
        };
        window.addEventListener("message", onMessage);
        const poll = setInterval(() => {
          if (popup.closed) {
            clearInterval(poll);
            clearTimeout(timeout);
            window.removeEventListener("message", onMessage);
            reject(new Error("Sign-in was cancelled."));
          }
        }, 500);
      });

      // Exchange the code for tokens (PKCE — no client secret needed).
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: FISHMB_GOOGLE_CLIENT_ID,
          code,
          code_verifier: verifier,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }).toString(),
      });
      const tokens = await tokenRes.json();
      if (!tokenRes.ok || !tokens.id_token) {
        throw new Error(tokens.error_description || "Could not complete Google sign-in.");
      }

      // Send the ID token to our backend (same as before).
      const res = await fetch("/api/fish/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: tokens.id_token, age_confirmed: true, terms_accepted: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sign-in failed.");
      try {
        localStorage.setItem(FISHMB_TOKEN_KEY, data.token);
        localStorage.setItem("fishmb-terms-ok", "1");
      } catch { /* noop */ }
      onDone(data.user, data.is_new_user === true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

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

  // Remember a previous acceptance so returning users don't check twice.
  // (GSI button removed — using PKCE popup flow via signInWithGoogle instead,
  // which doesn't suffer from the "locked button" iframe state.)

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
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={busy}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-pine/15 hover:border-signal rounded-3xl px-5 py-4 font-bold text-pine transition-colors disabled:opacity-50"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {busy ? "Signing you in…" : "Sign in with Google"}
          </button>
        ) : (
          <p className="text-xs text-pine/50 mb-2">
            Check both boxes above to continue with Google.
          </p>
        )}
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
            <p className="font-bold text-pine">Personal</p>
            <p className="text-xs text-pine/60 mt-1">Fish, post, join tournaments.</p>
          </button>
          <button
            onClick={() => pick("business")}
            disabled={saving}
            className="bg-white border-2 border-pine/15 hover:border-signal rounded-3xl p-5 text-left transition-colors disabled:opacity-50"
          >
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
  const [pendingCount, setPendingCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Pending friend requests — drives the alert badge on the user button.
  useEffect(() => {
    if (!user) {
      setPendingCount(0);
      return;
    }
    let cancelled = false;
    fetch("/api/fish/friends", {
      headers: { Authorization: `Bearer ${localStorage.getItem(FISHMB_TOKEN_KEY) ?? ""}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setPendingCount((d.pending_incoming ?? []).length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  // New tournament joins (organizer alerts) — same badge system.
  const [joinCount, setJoinCount] = useState(0);
  const [joinTourneyId, setJoinTourneyId] = useState<string | null>(null);
  const [joinDetails, setJoinDetails] = useState<
    { tournament_id: string; tournament_name: string; user_name: string; joined_at: string; key_code: string | null; key_label: string | null }[]
  >([]);
  const [showAlerts, setShowAlerts] = useState(false);
  useEffect(() => {
    if (!user) {
      setJoinCount(0);
      setJoinTourneyId(null);
      setJoinDetails([]);
      return;
    }
    let cancelled = false;
    const load = () => {
      fishFetch("/api/fishmb/tournaments/notifications")
        .then((d) => {
          if (cancelled) return;
          const data = d as {
            new_joins?: number;
            tournaments?: { id: string }[];
            details?: typeof joinDetails;
          };
          setJoinCount(Number(data.new_joins ?? 0));
          setJoinTourneyId(data.tournaments?.[0]?.id ?? null);
          setJoinDetails(data.details ?? []);
        })
        .catch(() => {});
    };
    load();
    // Refresh every 60s so the badge clears promptly after viewing.
    const t = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [user]);

  const totalAlerts = pendingCount + joinCount;

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
    // Swipe up on the menu dismisses it.
    let startY: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0]?.clientY ?? null;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (startY === null) return;
      const endY = e.changedTouches[0]?.clientY ?? startY;
      if (startY - endY > 40) setMenu(false);
      startY = null;
    };
    const menuEl = ref.current?.querySelector("[data-menu-panel]") as HTMLElement | null;
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    menuEl?.addEventListener("touchstart", onTouchStart, { passive: true });
    menuEl?.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
      menuEl?.removeEventListener("touchstart", onTouchStart);
      menuEl?.removeEventListener("touchend", onTouchEnd);
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
        className="relative inline-flex items-center gap-2 bg-pine/5 hover:bg-pine/10 rounded-full pl-1 pr-4 h-10 transition-colors"
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
        {totalAlerts > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-signal text-white text-[11px] font-black flex items-center justify-center shadow">
            {totalAlerts > 9 ? "9+" : totalAlerts}
          </span>
        )}
      </button>
      {menu && (
        <div
          data-menu-panel
          className="absolute right-0 mt-2 z-20 bg-paper border border-pine/10 rounded-2xl shadow-xl py-2 w-64"
          onClick={() => setMenu(false)}
        >
          {joinDetails.length > 0 && (
            <div className="px-4 py-2 border-b border-pine/10 mb-1">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-pine/45 mb-2">
                Tournament alerts
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {joinDetails.map((d, i) => (
                  <Link
                    key={i}
                    href={`/fishmb/tournaments/${d.tournament_id}/manage`}
                    onClick={() => setMenu(false)}
                    className="block bg-pine/5 rounded-xl px-3 py-2 hover:bg-pine/10"
                  >
                    <p className="text-xs font-bold text-pine leading-tight">
                      {d.user_name} joined {d.tournament_name}
                    </p>
                    {d.key_code && (
                      <p className="text-[11px] text-pine/55 mt-0.5">
                        Used key {d.key_code}
                        {d.key_label ? ` (${d.key_label})` : ""}
                      </p>
                    )}
                    <p className="text-[10px] text-pine/40 mt-0.5">
                      {new Date(d.joined_at).toLocaleString()}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
            <Link
              href="/fishmb/profile/edit"
              onClick={() => setMenu(false)}
              className="block px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-pine/70 hover:text-signal hover:bg-pine/5"
            >
              Edit profile
            </Link>
            <Link
              href="/fishmb/friends?tab=add"
              onClick={() => setMenu(false)}
              className="block px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-pine/70 hover:text-signal hover:bg-pine/5"
            >
              Add friends
            </Link>
            <Link
              href="/fishmb/friends?tab=requests"
              onClick={() => setMenu(false)}
              className="flex items-center justify-between px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-pine/70 hover:text-signal hover:bg-pine/5"
            >
              <span>Friend requests</span>
              {pendingCount > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-signal text-white text-[11px] font-black flex items-center justify-center">
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              )}
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
            <button
              onClick={() => {
                logout();
                setMenu(false);
                openLogin();
              }}
              className="w-full text-left px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-pine/70 hover:text-signal hover:bg-pine/5"
            >
              Change user
            </button>
        </div>
      )}
    </div>
  );
}
