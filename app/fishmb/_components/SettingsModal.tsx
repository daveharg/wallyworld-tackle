"use client";

import { useEffect, useState } from "react";
import { fishFetch } from "./fishFetch";
import { FISHMB_TOKEN_KEY } from "@/lib/fishmb-constants";
import { THEMES, getTheme, setTheme, type ThemeId } from "./theme";
import { useSheetDrag, SheetGrabber } from "./sheetDrag";
import { useFishAuth } from "./FishAuth";
import { useSignalClient } from "../messages/_components/signal/singleton";

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
  const { dragHandlers, dragStyle } = useSheetDrag(onClose);
  const { user } = useFishAuth();
  // Signal-protocol client for the messaging-backup section.
  const signalInit = useSignalClient(user?.id);
  const signalClient = signalInit?.client ?? null;
  // Backup status for this device (or the wiped device, while a
  // restore is pending), including the last-backup date.
  const [backupInfo, setBackupInfo] = useState<{
    exists: boolean;
    updated_at: string | null;
  } | null>(null);
  const [backupPass, setBackupPass] = useState("");
  const [restorePass, setRestorePass] = useState("");
  const [backupBusy, setBackupBusy] = useState<"backup" | "restore" | null>(null);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  const refreshBackupInfo = async () => {
    if (!signalClient) return;
    try {
      let info = await signalClient.backupInfo();
      if (!info.exists && signalInit?.oldDeviceId != null) {
        info = await signalClient.backupInfo(signalInit.oldDeviceId);
      }
      setBackupInfo(info);
    } catch {
      setBackupInfo({ exists: false, updated_at: null });
    }
  };

  useEffect(() => {
    void refreshBackupInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalClient]);

  const doBackup = async () => {
    if (!signalClient || backupBusy) return;
    if (!backupPass) {
      setBackupError("Enter a passphrase for the backup.");
      setBackupMsg(null);
      return;
    }
    setBackupBusy("backup");
    setBackupError(null);
    setBackupMsg(null);
    try {
      await signalClient.createBackup(backupPass);
      setBackupPass("");
      setBackupMsg("Backup saved.");
      await refreshBackupInfo();
    } catch {
      setBackupError("Couldn't save the backup — try again.");
    } finally {
      setBackupBusy(null);
    }
  };

  const doRestore = async () => {
    if (!signalClient || backupBusy) return;
    if (!restorePass) {
      setBackupError("Enter your backup passphrase.");
      setBackupMsg(null);
      return;
    }
    setBackupBusy("restore");
    setBackupError(null);
    setBackupMsg(null);
    try {
      await signalClient.restoreFromBackup(restorePass, signalInit?.oldDeviceId);
      setRestorePass("");
      setBackupMsg("Backup restored — reopen Messages to see your chats.");
      await refreshBackupInfo();
    } catch {
      setBackupError("Couldn't restore the backup — check the passphrase and try again.");
    } finally {
      setBackupBusy(null);
    }
  };
  const [theme, setThemeState] = useState<ThemeId>("ocean");
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState<keyof Prefs | null>(null);
  const [pushState, setPushState] = useState<PushState>("checking");
  const [enabling, setEnabling] = useState(false);
  const [blocked, setBlocked] = useState<{ id: string; name: string; avatar_url: string | null }[] | null>(null);
  const [unblocking, setUnblocking] = useState<string | null>(null);
  const [armDelete, setArmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Lock background scroll while the sheet is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

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
        const b = (await fishFetch("/api/fishmb/blocks")) as {
          blocked: { id: string; name: string; avatar_url: string | null }[];
        };
        setBlocked(b.blocked ?? []);
      } catch {
        setBlocked([]);
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

  const unblock = async (userId: string) => {
    if (unblocking) return;
    setUnblocking(userId);
    try {
      await fishFetch(`/api/fishmb/blocks?user_id=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      setBlocked((prev) => (prev ?? []).filter((b) => b.id !== userId));
    } catch {
      // Leave the row in place on failure.
    } finally {
      setUnblocking(null);
    }
  };

  const deleteAccount = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await fishFetch("/api/fishmb/users/me", { method: "DELETE" });
      localStorage.removeItem(FISHMB_TOKEN_KEY);
      window.location.href = "/fishmb";
    } catch {
      setDeleting(false);
      setDeleteError("Couldn't delete your account — try again, or contact support@fishmb.ca.");
    }
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
      <div className="relative w-full sm:max-w-md bg-paper rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[88vh] overflow-y-auto" style={dragStyle}>
        <div className="sticky top-0 bg-paper/95 backdrop-blur px-5 pt-2 pb-3 border-b border-pine/10 z-10">
          <div className="touch-none cursor-grab active:cursor-grabbing" {...dragHandlers}>
            <SheetGrabber onClose={onClose} />
          </div>
          <div className="flex items-center justify-between mt-1">
          <h2 className="font-display font-bold text-xl text-pine">Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="w-9 h-9 rounded-full bg-pine/5 flex items-center justify-center text-pine/60 text-xl leading-none"
          >
            ×
          </button>
          </div>
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

          {/* Blocked anglers */}
          <h3 className="text-xs font-black uppercase tracking-[0.14em] text-pine/45 mt-7 mb-3">
            Blocked anglers
          </h3>
          {blocked === null ? (
            <p className="text-xs text-pine/50 mb-2">Loading…</p>
          ) : blocked.length === 0 ? (
            <p className="text-xs text-pine/50 mb-2 leading-relaxed">
              You haven&apos;t blocked anyone. Blocking hides an angler&apos;s posts
              and comments from you, and stops messages both ways.
            </p>
          ) : (
            <div className="bg-white border border-pine/10 rounded-2xl divide-y divide-pine/8 overflow-hidden mb-2">
              {blocked.map((b) => (
                <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-pine">
                    {b.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => unblock(b.id)}
                    disabled={unblocking !== null}
                    className="shrink-0 text-xs font-bold uppercase tracking-wider text-signal-dark disabled:opacity-50"
                  >
                    {unblocking === b.id ? "…" : "Unblock"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Messaging backup */}
          <h3 className="text-xs font-black uppercase tracking-[0.14em] text-pine/45 mt-7 mb-3">
            Messaging backup
          </h3>
          {!signalClient ? (
            <p className="text-xs text-pine/50 mb-2">Setting up encrypted messaging…</p>
          ) : (
            <div className="mb-2">
              {signalInit?.status === "wiped-backup-available" && (
                <div className="bg-signal/10 border border-signal/30 rounded-2xl px-4 py-4 mb-4">
                  <p className="text-sm font-bold text-pine mb-1">
                    This device lost its message keys.
                  </p>
                  <p className="text-xs text-pine/65 leading-relaxed mb-3">
                    Restore your encrypted backup to read your older chats.
                  </p>
                  <input
                    type="password"
                    value={restorePass}
                    onChange={(e) => setRestorePass(e.target.value)}
                    placeholder="Backup passphrase"
                    autoComplete="off"
                    className="w-full bg-white border border-pine/15 rounded-2xl px-4 py-2.5 text-sm text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal mb-2"
                  />
                  <button
                    type="button"
                    onClick={() => void doRestore()}
                    disabled={backupBusy !== null}
                    className="w-full bg-signal text-white font-bold text-sm uppercase tracking-wider rounded-full px-5 py-2.5 disabled:opacity-50"
                  >
                    {backupBusy === "restore" ? "Restoring…" : "Restore backup"}
                  </button>
                </div>
              )}
              <p className="text-xs text-pine/55 mb-3">
                {backupInfo === null
                  ? "Checking for a backup…"
                  : backupInfo.exists
                    ? backupInfo.updated_at
                      ? `Last backup: ${new Date(backupInfo.updated_at).toLocaleString()}`
                      : "A backup exists for this device."
                    : "No backup yet."}
              </p>
              <input
                type="password"
                value={backupPass}
                onChange={(e) => setBackupPass(e.target.value)}
                placeholder="Backup passphrase"
                autoComplete="new-password"
                className="w-full bg-white border border-pine/15 rounded-2xl px-4 py-2.5 text-sm text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal mb-2"
              />
              <button
                type="button"
                onClick={() => void doBackup()}
                disabled={backupBusy !== null}
                className="w-full bg-pine text-white font-bold text-sm uppercase tracking-wider rounded-full px-5 py-2.5 disabled:opacity-50 mb-3"
              >
                {backupBusy === "backup" ? "Backing up…" : "Back up now"}
              </button>
              {backupInfo?.exists && signalInit?.status !== "wiped-backup-available" && (
                <div className="bg-pine/5 rounded-2xl px-4 py-3 mb-3">
                  <input
                    type="password"
                    value={restorePass}
                    onChange={(e) => setRestorePass(e.target.value)}
                    placeholder="Backup passphrase"
                    autoComplete="off"
                    className="w-full bg-white border border-pine/15 rounded-2xl px-4 py-2.5 text-sm text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal mb-2"
                  />
                  <button
                    type="button"
                    onClick={() => void doRestore()}
                    disabled={backupBusy !== null}
                    className="w-full border border-pine/20 text-pine font-bold text-sm uppercase tracking-wider rounded-full px-5 py-2.5 disabled:opacity-50"
                  >
                    {backupBusy === "restore" ? "Restoring…" : "Restore from backup"}
                  </button>
                </div>
              )}
              {backupMsg && (
                <p className="text-xs font-bold text-pine mb-2">{backupMsg}</p>
              )}
              {backupError && (
                <p className="text-xs font-bold text-red-700 mb-2">{backupError}</p>
              )}
              <p className="text-[11px] text-pine/40 leading-relaxed">
                Your backup is encrypted with this passphrase — FishMB can&apos;t
                read it or reset it. If you forget it, the backup can&apos;t be
                recovered.
              </p>
            </div>
          )}

          {/* Delete account */}
          <h3 className="text-xs font-black uppercase tracking-[0.14em] text-pine/45 mt-7 mb-3">
            Danger zone
          </h3>
          {!armDelete ? (
            <button
              type="button"
              onClick={() => setArmDelete(true)}
              className="w-full border border-red-200 text-red-700 font-bold text-sm rounded-full px-5 py-3"
            >
              Delete my account
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-4">
              <p className="text-sm font-bold text-red-800 mb-1">
                Permanently delete your account?
              </p>
              <p className="text-xs text-red-700/80 leading-relaxed mb-3">
                This removes your profile and takes your posts, comments, catches
                and spots down for good. It can&apos;t be undone.
              </p>
              {deleteError && (
                <p className="text-xs font-bold text-red-700 mb-3">{deleteError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={deleteAccount}
                  disabled={deleting}
                  className="flex-1 bg-red-600 text-white font-bold text-sm rounded-full px-4 py-2.5 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Yes, delete it"}
                </button>
                <button
                  type="button"
                  onClick={() => setArmDelete(false)}
                  disabled={deleting}
                  className="flex-1 bg-white border border-pine/15 text-pine font-bold text-sm rounded-full px-4 py-2.5 disabled:opacity-50"
                >
                  Keep my account
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
