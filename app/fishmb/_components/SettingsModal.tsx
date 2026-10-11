"use client";

import { useEffect, useState } from "react";
import { fishFetch } from "./fishFetch";
import { THEMES, getTheme, setTheme, DEFAULT_THEME, type ThemeId } from "./theme";

interface Prefs {
  friend_catch: boolean;
  friend_post: boolean;
  new_message: boolean;
}

const TOGGLES: { key: keyof Prefs; title: string; desc: string }[] = [
  {
    key: "friend_catch",
    title: "Friend caught a fish",
    desc: "Alert me when a friend logs a new catch",
  },
  {
    key: "friend_post",
    title: "Friend made a post",
    desc: "Alert me when a friend posts on the feed",
  },
  {
    key: "new_message",
    title: "New message",
    desc: "Alert me when I get a message",
  },
];

type PushState = "checking" | "unsupported" | "denied" | "prompt" | "enabled";

/** Settings popup: color themes + push notification alert settings. */
export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const [theme, setThemeState] = useState<ThemeId>("forest");
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState<keyof Prefs | null>(null);
  const [pushState, setPushState] = useState<PushState>("checking");
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    setThemeState(getTheme());
    (async () => {
      try {
        const p = await fishFetch("/api/fishmb/notification-prefs");
        setPrefs(p as Prefs);
      } catch {
        setPrefs({ friend_catch: true, friend_post: true, new_message: true });
      }
    })();
    (async () => {
      try {
        if (
          !("Notification" in window) ||
          !("serviceWorker" in navigator) ||
          !("PushManager" in window)
        ) {
          setPushState("unsupported");
          return;
        }
        if (Notification.permission === "denied") {
          setPushState("denied");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setPushState(sub ? "enabled" : "prompt");
      } catch {
        setPushState("unsupported");
      }
    })();
  }, []);

  const pickTheme = (id: ThemeId) => {
    setTheme(id);
    setThemeState(id);
  };

  const toggle = async (key: keyof Prefs) => {
    if (!prefs || saving) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaving(key);
    try {
      await fishFetch("/api/fishmb/notification-prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next[key] }),
      });
    } catch {
      // Revert on failure.
      setPrefs(prefs);
    } finally {
      setSaving(null);
    }
  };

  const enablePush = async () => {
    setEnabling(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setPushState("denied");
        return;
      }
      const keyRes = await fishFetch("/api/fishmb/push/vapid-key");
      const publicKey = (keyRes as { publicKey?: string }).publicKey;
      if (!publicKey) throw new Error("No key");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: Uint8Array.from(
          atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")),
          (c) => c.charCodeAt(0)
        ),
      });
      const json = sub.toJSON();
      await fishFetch("/api/fishmb/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      setPushState("enabled");
    } catch {
      setPushState("prompt");
    } finally {
      setEnabling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1300] flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-pine-deep/60"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full sm:max-w-md bg-paper rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[88vh] overflow-y-auto">
        <div className="sticky top-0 bg-paper/95 backdrop-blur px-5 pt-4 pb-3 border-b border-pine/10 flex items-center justify-between">
          <h2 className="font-display font-bold text-xl text-pine">Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="w-9 h-9 rounded-full bg-pine/5 flex items-center justify-center text-pine/60 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-5">
          {/* Color themes */}
          <h3 className="text-xs font-black uppercase tracking-[0.14em] text-pine/45 mb-3">
            Color theme
          </h3>
          <div className="grid grid-cols-3 gap-2.5 mb-7">
            {THEMES.map((t) => {
              const active = theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pickTheme(t.id)}
                  className={`rounded-2xl border-2 p-3 text-left transition-colors ${
                    active
                      ? "border-signal bg-white"
                      : "border-pine/10 bg-white"
                  }`}
                >
                  <div className="flex gap-1 mb-2">
                    {t.swatch.map((c) => (
                      <span
                        key={c}
                        className="w-6 h-6 rounded-full border border-black/10"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <p className="text-sm font-bold text-pine">{t.name}</p>
                  <p className="text-[11px] text-pine/50 leading-tight">
                    {t.desc}
                  </p>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => pickTheme(DEFAULT_THEME)}
            className="w-full mb-7 text-xs font-bold uppercase tracking-wider text-pine/55 hover:text-pine border border-pine/15 rounded-full px-5 py-2.5 transition-colors"
          >
            Reset to default theme
          </button>

          {/* Push notifications */}
          <h3 className="text-xs font-black uppercase tracking-[0.14em] text-pine/45 mb-3">
            Push notifications
          </h3>
          {pushState === "prompt" && (
            <button
              type="button"
              onClick={enablePush}
              disabled={enabling}
              className="w-full mb-4 bg-signal text-white font-bold text-sm uppercase tracking-wider rounded-full px-5 py-3 disabled:opacity-50"
            >
              {enabling ? "Enabling…" : "Turn on push notifications"}
            </button>
          )}
          {pushState === "denied" && (
            <p className="text-xs text-pine/55 mb-4 bg-pine/5 rounded-xl px-4 py-3">
              Notifications are blocked for this site. Allow them in your
              browser settings to get alerts.
            </p>
          )}
          {pushState === "unsupported" && (
            <p className="text-xs text-pine/55 mb-4 bg-pine/5 rounded-xl px-4 py-3">
              Push notifications aren&apos;t supported on this device.
            </p>
          )}
          <div className="bg-white border border-pine/10 rounded-2xl divide-y divide-pine/8 overflow-hidden">
            {TOGGLES.map((t) => {
              const on = prefs?.[t.key] ?? true;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => toggle(t.key)}
                  disabled={!prefs || saving !== null}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                >
                  <span
                    className={`shrink-0 w-11 h-6 rounded-full relative transition-colors ${
                      on ? "bg-signal" : "bg-pine/20"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                        on ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-pine">
                      {t.title}
                    </span>
                    <span className="block text-xs text-pine/55">{t.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-pine/40 mt-3 leading-relaxed">
            Alerts only arrive on devices where push notifications are turned
            on.
          </p>
        </div>
      </div>
    </div>
  );
}
