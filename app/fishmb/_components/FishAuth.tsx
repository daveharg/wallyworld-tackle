"use client";

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
          onDone={(u) => {
            setUser(u);
            setLoginOpen(false);
          }}
        />
      )}
    </Ctx.Provider>
  );
}

function LoginModal({ onClose, onDone }: { onClose: () => void; onDone: (u: FishAuthUser) => void }) {
  const btnRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
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
              body: JSON.stringify({ id_token: resp.credential }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Sign-in failed.");
            localStorage.setItem(FISHMB_TOKEN_KEY, data.token);
            onDone(data.user);
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
  }, [onDone]);

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
        <p className="text-pine/70 text-sm mb-6">
          Log in with Google — the same account as the FishMB app. Your catches and profile follow you.
        </p>
        <div ref={btnRef} className="flex justify-center min-h-[44px]" />
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

/** Header login button: shows LOG IN, or the user's avatar/name when signed in. */
export function FishLoginButton() {
  const { user, loading, openLogin, logout } = useFishAuth();
  const [menu, setMenu] = useState(false);

  if (loading) {
    return <span className="hidden sm:inline-flex w-24 h-10 rounded-full bg-pine/10 animate-pulse" />;
  }

  if (!user) {
    return (
      <button
        onClick={openLogin}
        className="hidden sm:inline-flex bg-signal hover:bg-signal-dark text-white text-sm font-bold uppercase tracking-wider px-5 py-2.5 rounded-full transition-colors"
      >
        Log in
      </button>
    );
  }

  return (
    <div className="relative hidden sm:block">
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
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
          <div className="absolute right-0 mt-2 z-20 bg-paper border border-pine/10 rounded-2xl shadow-xl py-2 w-44">
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
        </>
      )}
    </div>
  );
}
