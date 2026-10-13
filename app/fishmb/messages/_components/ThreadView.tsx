"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fishFetch } from "../../_components/fishFetch";
import { useSheetDrag, SheetGrabber } from "../../_components/sheetDrag";
import {
  decryptText,
  decryptV2Copy,
  encryptForPublicKey,
  publicKeyB64,
  sharedSecret,
  V2_NONCE,
  type MsgKeypair,
} from "./msgCrypto";

interface StoredMessage {
  id: string;
  sender_id: string;
  recipient_id?: string;
  recipient_key?: string | null;
  nonce: string;
  ciphertext: string;
  created_at: string;
}

/** A conversation member plus every public key they have registered. */
interface MemberKeys {
  user_id: string;
  name: string;
  public_key: string | null;
  public_keys: string[];
}

/** All keys for a member payload — falls back to the single newest key
 *  if an older server response has no public_keys array yet. */
function keysOf(m: {
  public_key?: string | null;
  public_keys?: string[];
}): string[] {
  if (m.public_keys && m.public_keys.length > 0) return m.public_keys;
  return m.public_key ? [m.public_key] : [];
}

function normalizeMembers(raw: unknown): MemberKeys[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => {
    const r = m as {
      user_id: string;
      name?: string;
      public_key?: string | null;
      public_keys?: string[];
    };
    return {
      user_id: r.user_id,
      name: r.name ?? "",
      public_key: r.public_key ?? null,
      public_keys: keysOf(r),
    };
  });
}

interface Decrypted {
  id: string;
  mine: boolean;
  sender_id: string;
  text: string | null;
  noKey: boolean;
  created_at: string;
}

export interface ThreadPeer {
  id: string;
  name: string | null;
  avatar_url: string | null;
  is_group: boolean;
  members: { user_id: string; name: string; avatar_url: string | null }[];
}


/** Photo payloads are JSON { t: "photo", url } inside the encrypted text. */
function photoUrl(text: string | null): string | null {
  if (!text || !text.startsWith("{")) return null;
  try {
    const o = JSON.parse(text);
    return o && o.t === "photo" && typeof o.url === "string" ? o.url : null;
  } catch {
    return null;
  }
}

export interface SpotPayload {
  spot: {
    name: string;
    lat: number;
    lng: number;
    notes: string | null;
    icon: string;
    lake_id: string | null;
  };
  origin: { id: string; name: string };
}

/** Spot-share payloads are JSON { t: "spot", spot, origin } (see sendSpot.ts). */
function spotPayload(text: string | null): SpotPayload | null {
  if (!text || !text.startsWith("{")) return null;
  try {
    const o = JSON.parse(text);
    if (
      o &&
      o.t === "spot" &&
      o.spot &&
      typeof o.spot.lat === "number" &&
      typeof o.spot.lng === "number" &&
      o.origin &&
      typeof o.origin.name === "string"
    ) {
      return o as SpotPayload;
    }
    return null;
  } catch {
    return null;
  }
}

export default function ThreadView({
  peer,
  myId,
  keypair,
  onBack,
  onSent,
  onRead,
}: {
  peer: ThreadPeer;
  myId: string;
  keypair: MsgKeypair;
  onBack: () => void;
  onSent: () => void;
  onRead: () => void;
}) {
  const [memberKeys, setMemberKeys] = useState<MemberKeys[] | null>(null);
  const [missingNames, setMissingNames] = useState<string[]>([]);
  const [msgs, setMsgs] = useState<Decrypted[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [editingGroup, setEditingGroup] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  // Bottom sheets: drag down / tap the grabber to close (shared behaviour).
  const groupSheetDrag = useSheetDrag(() => setEditingGroup(false));
  const themeSheetDrag = useSheetDrag(() => setThemeOpen(false));
  const [themeName, setThemeName] = useState<string>("Default");
  const [resyncing, setResyncing] = useState(false);
  const autoResyncDone = useRef(false);
  // Spot shares: message ids I've already saved a spot from, and ones I
  // declined (declines are local-only — the sender isn't notified).
  const [acceptedSpotMsgs, setAcceptedSpotMsgs] = useState<Set<string>>(new Set());
  const [declinedSpotMsgs, setDeclinedSpotMsgs] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("fishmb-declined-spot-msgs");
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });
  const [acceptingSpotId, setAcceptingSpotId] = useState<string | null>(null);

  useEffect(() => {
    fishFetch("/api/fishmb/spots")
      .then((d) => {
        const rows = (d as { spots?: { share_msg_id: string | null }[] }).spots ?? [];
        setAcceptedSpotMsgs(
          new Set(rows.map((s) => s.share_msg_id).filter((x): x is string => !!x))
        );
      })
      .catch(() => {});
  }, []);

  const acceptSpot = async (msgId: string, p: SpotPayload) => {
    if (acceptingSpotId) return;
    setAcceptingSpotId(msgId);
    setNote(null);
    try {
      await fishFetch("/api/fishmb/spots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: p.spot.name,
          lat: p.spot.lat,
          lng: p.spot.lng,
          notes: p.spot.notes,
          icon: p.spot.icon,
          lake_id: p.spot.lake_id,
          origin_user_id: p.origin.id,
          origin_name: p.origin.name,
          share_msg_id: msgId,
        }),
      });
      setAcceptedSpotMsgs((prev) => new Set(prev).add(msgId));
      setNote("Spot saved — it's in your Saved spots on the map 🎣");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not save the spot.");
    } finally {
      setAcceptingSpotId(null);
    }
  };

  const declineSpot = (msgId: string) => {
    setDeclinedSpotMsgs((prev) => {
      const next = new Set(prev).add(msgId);
      try {
        localStorage.setItem("fishmb-declined-spot-msgs", JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  /** Re-upload our public key and refetch all member keys. Registration is
   *  add-only on the server, so this can never replace a key another
   *  device is relying on. */
  const resyncKeys = async (silent: boolean = false) => {
    if (!silent) setResyncing(true);
    try {
      const localPub = publicKeyB64(keypair);
      await fishFetch("/api/fishmb/msg/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_key: localPub }),
      });
      const d = await fishFetch(`/api/fishmb/msg/conversations/${peer.id}/members`);
      const members = normalizeMembers(d.members ?? []);
      memberKeysRef.current = members;
      setMemberKeys(members);
      if (!silent) {
        setNote("Keys re-synced. New messages should decrypt. Old messages encrypted with a lost key can't be recovered.");
      }
      return true;
    } catch {
      if (!silent) setNote("Couldn't re-sync keys. Try again.");
      return false;
    } finally {
      if (!silent) setResyncing(false);
    }
  };

  // Auto re-sync once when messages fail to decrypt (keys likely stale).
  useEffect(() => {
    if (autoResyncDone.current || !memberKeys || msgs.length === 0) return;
    const failed = msgs.some((m) => !m.text && !m.noKey && !m.mine);
    if (failed) {
      autoResyncDone.current = true;
      resyncKeys(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs, memberKeys]);

  // Curated themes — every combination is designed to be readable.
  const THEMES: {
    name: string;
    chatBg: string;
    sentBg: string;
    sentText: string;
    receivedBg: string;
    receivedText: string;
  }[] = [
    { name: "Default", chatBg: "#ffffff", sentBg: "#0b231f", sentText: "#ffffff", receivedBg: "#e9e9eb", receivedText: "#0b231f" },
    { name: "Dark", chatBg: "#0b231f", sentBg: "#e4572e", sentText: "#ffffff", receivedBg: "#1e3a34", receivedText: "#ffffff" },
    { name: "Ocean", chatBg: "#e8f1f8", sentBg: "#0a4d8c", sentText: "#ffffff", receivedBg: "#ffffff", receivedText: "#0a2a4a" },
    { name: "Forest", chatBg: "#f2f0e4", sentBg: "#2d5a27", sentText: "#ffffff", receivedBg: "#dce5d0", receivedText: "#1a2f1a" },
    { name: "Sunset", chatBg: "#fff5ec", sentBg: "#c94826", sentText: "#ffffff", receivedBg: "#ffe8d6", receivedText: "#5a2310" },
    { name: "Midnight", chatBg: "#121212", sentBg: "#7c4dff", sentText: "#ffffff", receivedBg: "#2a2a2a", receivedText: "#f0f0f0" },
    { name: "Lavender", chatBg: "#f3eefb", sentBg: "#5e35b1", sentText: "#ffffff", receivedBg: "#ffffff", receivedText: "#3a245e" },
    { name: "Arctic", chatBg: "#eef6fb", sentBg: "#0f2a44", sentText: "#ffffff", receivedBg: "#ffffff", receivedText: "#0f2a44" },
  ];

  const theme = THEMES.find((t) => t.name === themeName) ?? THEMES[0];

  // Load per-chat theme from localStorage.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`fishmb-chat-theme-${peer.id}`);
      if (saved) {
        const t = JSON.parse(saved) as { name?: string };
        if (t.name && THEMES.some((x) => x.name === t.name)) setThemeName(t.name);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peer.id]);

  const saveTheme = (name: string) => {
    setThemeName(name);
    try {
      localStorage.setItem(`fishmb-chat-theme-${peer.id}`, JSON.stringify({ name }));
    } catch {}
  };
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [savingGroup, setSavingGroup] = useState(false);
  // Member removal safety: removing someone — or leaving yourself — is
  // a two-tap inline confirm, never a silent one-tap action.
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addScope, setAddScope] = useState<"friends" | "all">("friends");
  const [friendOptions, setFriendOptions] = useState<{ id: string; name: string; avatar_url: string | null }[]>([]);
  const [allUserResults, setAllUserResults] = useState<{ id: string; name: string; avatar_url: string | null }[]>([]);
  const [allUserSearching, setAllUserSearching] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastAtRef = useRef<string | null>(null);
  const memberKeysRef = useRef<MemberKeys[] | null>(null);
  // Synchronous send guard — `sending` state updates async, so rapid taps
  // (double-tap, tap + Enter) would all slip past it and send duplicates.
  const sendingRef = useRef(false);
  const uploadingRef = useRef(false);

  // Load every member's registered public keys. Sends encrypt one
  // self-contained copy per (member, key) — including yourself, so each
  // of your devices can read the history. Members without any keys yet
  // can't read anything until they enable encrypted messaging — the
  // thread still works for everyone else.
  useEffect(() => {
    let live = true;
    fishFetch(`/api/fishmb/msg/conversations/${peer.id}/members`)
      .then((d) => {
        if (!live) return;
        const members = normalizeMembers(d.members ?? []);
        setMissingNames(
          members.filter((m) => m.public_keys.length === 0 && m.user_id !== myId).map((m) => m.name || "Someone")
        );
        // Ensure our own key is registered — if not, upload it now so
        // others encrypt copies for it. Registration is add-only, so
        // this never replaces a key another device is using.
        const me = members.find((m) => m.user_id === myId);
        const localPub = publicKeyB64(keypair);
        if (me && !me.public_keys.includes(localPub)) {
          fishFetch("/api/fishmb/msg/keys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ public_key: localPub }),
          }).catch(() => {});
          // Use it immediately for this session's sends.
          me.public_keys = [localPub, ...me.public_keys];
          if (!me.public_key) me.public_key = localPub;
        }
        memberKeysRef.current = members;
        setMemberKeys(members);
      })
      .catch(() => {
        if (live) setNote("Could not load encryption keys.");
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peer.id, keypair]);

  // Decrypt ONE of my copies.
  // - v2 copies are self-contained: they open with only my secret key,
  //   whichever of my keys they were wrapped to (copies wrapped to a key
  //   whose secret is lost simply fail and a sibling copy is tried).
  // - Legacy copies were encrypted by their sender for us, so they open
  //   with the pairwise shared secret for THAT sender. Any of the
  //   sender's registered keys may have been current when the message
  //   was sent (e.g. before they got a new phone), so try each,
  //   newest first.
  const decryptRow = (m: StoredMessage): { text: string | null; noKey: boolean } => {
    if (m.nonce === V2_NONCE) {
      return {
        text: decryptV2Copy(m.nonce, m.ciphertext, keypair.secretKey),
        noKey: false,
      };
    }
    const senderKeys =
      memberKeysRef.current?.find((x) => x.user_id === m.sender_id)?.public_keys ?? [];
    if (senderKeys.length === 0) return { text: null, noKey: true };
    for (const pk of senderKeys) {
      const text = decryptText(m.nonce, m.ciphertext, sharedSecret(pk, keypair.secretKey));
      if (text !== null) return { text, noKey: false };
    }
    return { text: null, noKey: false };
  };

  // Rows arrive as one copy per (recipient, key). Copies of one logical
  // message share sender_id + created_at (the server stamps all copies
  // of a send with a single timestamp), so fold them into one bubble:
  // the first copy that decrypts becomes the bubble; sibling copies are
  // dropped, and a failed placeholder upgrades if a later copy opens.
  const decryptAll = (rows: StoredMessage[]): Decrypted[] => {
    const out: Decrypted[] = [];
    const byBase = new Map<string, number>();
    const seenGood = new Set<string>();
    for (const m of rows) {
      const { text, noKey } = decryptRow(m);
      const base = `${m.sender_id}|${m.created_at}`;
      if (text !== null) {
        const goodKey = `${base}|${text}`;
        if (seenGood.has(goodKey)) continue;
        seenGood.add(goodKey);
        const idx = byBase.get(base);
        if (idx !== undefined && out[idx].text === null) {
          out[idx] = { ...out[idx], id: m.id, text, noKey: false };
          continue;
        }
        byBase.set(base, out.length);
        out.push({
          id: m.id,
          mine: m.sender_id === myId,
          sender_id: m.sender_id,
          text,
          noKey: false,
          created_at: m.created_at,
        });
      } else {
        if (byBase.has(base)) continue;
        byBase.set(base, out.length);
        out.push({
          id: m.id,
          mine: m.sender_id === myId,
          sender_id: m.sender_id,
          text: null,
          noKey,
          created_at: m.created_at,
        });
      }
    }
    return out;
  };

  // Initial load + polling. My rows only — each member reads their own copies.
  useEffect(() => {
    if (!memberKeys) return;
    let live = true;
    let timer: ReturnType<typeof setInterval>;
    const load = async (after?: string) => {
      try {
        const url =
          `/api/fishmb/msg/conversations/${peer.id}/messages` +
          (after ? `?after=${encodeURIComponent(after)}` : "");
        const d = await fishFetch(url);
        const rows = (d.messages ?? []) as StoredMessage[];
        if (!live) return;
        if (after) {
          if (rows.length > 0) {
            setMsgs((prev) => {
              const fresh = decryptAll(rows);
              if (fresh.length === 0) return prev;
              // Merge by logical message (sender + timestamp), not row
              // id: the poll may return a different copy of a message
              // already on screen.
              let changed = false;
              const next = [...prev];
              for (const f of fresh) {
                const idx = next.findIndex(
                  (p) => p.sender_id === f.sender_id && p.created_at === f.created_at
                );
                if (idx === -1) {
                  next.push(f);
                  changed = true;
                } else if (next[idx].text === null && f.text !== null) {
                  next[idx] = f;
                  changed = true;
                }
              }
              return changed ? next : prev;
            });
            lastAtRef.current = rows[rows.length - 1].created_at;
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
          }
        } else {
          setMsgs(decryptAll(rows));
          lastAtRef.current =
            rows.length > 0 ? rows[rows.length - 1].created_at : null;
          setTimeout(
            () => bottomRef.current?.scrollIntoView({ behavior: "auto" }),
            50
          );
        }
        if (rows.length > 0) {
          fishFetch(`/api/fishmb/msg/conversations/${peer.id}/read`, {
            method: "POST",
          })
            .then(() => {
              onRead();
              // Tell the bottom bar to refresh its unread badge immediately.
              try {
                window.dispatchEvent(new Event("fishmb-unread-changed"));
              } catch {}
            })
            .catch(() => {});
        }
      } catch {
        // keep polling quietly
      }
    };
    load();
    timer = setInterval(() => {
      load(lastAtRef.current ?? undefined);
    }, 4000);
    return () => {
      live = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberKeys, peer.id]);

  const sendPayload = async (payload: string, optimisticText: string | null = null) => {
    const members = memberKeysRef.current;
    if (!payload || !members || members.length === 0 || sendingRef.current) return;
    if (payload.length > 8000) {
      setNote("That message is too long.");
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setNote(null);
    try {
      // One self-contained v2 copy per (member, registered key) —
      // including copies for each of my own keys, so every device I
      // use can read my sent history. Members without keys are skipped.
      const parts: {
        recipient_id: string;
        recipient_key: string;
        nonce: string;
        ciphertext: string;
      }[] = [];
      for (const m of members) {
        for (const pk of m.public_keys) {
          const { nonce, ciphertext } = encryptForPublicKey(payload, pk);
          parts.push({ recipient_id: m.user_id, recipient_key: pk, nonce, ciphertext });
        }
      }
      if (parts.length === 0) {
        throw new Error("No one in this chat has messaging keys set up yet.");
      }
      const d = await fishFetch(`/api/fishmb/msg/conversations/${peer.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parts }),
      });
      // The POST stores one row per (recipient, key) — the optimistic
      // row must be MY copy for THIS device's key (or any of my copies),
      // or the poll will re-add it as a duplicate seconds later.
      const rows = d.messages as StoredMessage[];
      const myPub = publicKeyB64(keypair);
      const mine =
        rows.find((m) => m.recipient_id === myId && m.recipient_key === myPub) ??
        rows.find((m) => m.recipient_id === myId) ??
        rows.find((m) => m.sender_id === myId);
      if (mine) {
        setMsgs((prev) => {
          if (prev.some((m) => m.id === mine.id)) return prev;
          return [
            ...prev,
            { id: mine.id, mine: true, sender_id: myId, text: optimisticText ?? payload, noKey: false, created_at: mine.created_at },
          ];
        });
        lastAtRef.current = mine.created_at;
      }
      setTimeout(
        () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        50
      );
      setDraft("");
      onSent();
      try {
        window.dispatchEvent(new Event("fishmb-unread-changed"));
      } catch {}
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not send.");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    if (text.length > 2000) {
      setNote("Messages are limited to 2000 characters.");
      return;
    }
    await sendPayload(text);
  };

  const photoInputRef = useRef<HTMLInputElement>(null);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const sendPhoto = async (file: File) => {
    const members = memberKeysRef.current;
    if (!members || members.length === 0 || sendingRef.current || uploadingRef.current) return;
    uploadingRef.current = true;
    setUploading(true);
    setNote(null);
    try {
      const { compressImage } = await import("../../_components/compressImage");
      const { FISHMB_TOKEN_KEY } = await import("@/lib/fishmb-constants");
      const token = localStorage.getItem(FISHMB_TOKEN_KEY);
      const form = new FormData();
      form.append("file", await compressImage(file));
      const upRes = await fetch("/api/fish/photos/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const up = await upRes.json();
      if (!upRes.ok) throw new Error(up.error || "Photo upload failed.");
      const payload = JSON.stringify({ t: "photo", url: up.url as string });
      await sendPayload(payload, payload);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not send photo.");
    } finally {
      uploadingRef.current = false;
      setUploading(false);
    }
  };

  const openGroupEditor = () => {
    setEditName(peer.name ?? "");
    setEditAvatar(peer.avatar_url ?? null);
    setAddSearch("");
    setAddScope("friends");
    setAllUserResults([]);
    setConfirmRemoveId(null);
    setConfirmLeave(false);
    setEditingGroup(true);
    // Load friends for the add-member picker.
    fishFetch("/api/fish/friends")
      .then((d) => {
        const list = ((d as { friends?: { id: string; name: string; avatar_url: string | null }[] }).friends ?? [])
          .filter((f) => !peer.members.some((m) => m.user_id === f.id));
        setFriendOptions(list);
      })
      .catch(() => {});
  };

  // Search all users when in "all" scope.
  useEffect(() => {
    if (!editingGroup || addScope !== "all") return;
    const q = addSearch.trim();
    if (q.length < 2) {
      setAllUserResults([]);
      setAllUserSearching(false);
      return;
    }
    setAllUserSearching(true);
    const t = window.setTimeout(async () => {
      try {
        const d = await fishFetch(`/api/fishmb/users/search?q=${encodeURIComponent(q)}`);
        const users = ((d as { users?: { id: string; name: string; avatar_url: string | null }[] }).users ?? [])
          .filter((u) => !peer.members.some((m) => m.user_id === u.id));
        setAllUserResults(users);
      } catch {
        setAllUserResults([]);
      } finally {
        setAllUserSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [editingGroup, addScope, addSearch, peer.members]);

  const uploadGroupAvatar = async (file: File) => {
    setSavingGroup(true);
    try {
      const { compressImage } = await import("../../_components/compressImage");
      const { FISHMB_TOKEN_KEY } = await import("@/lib/fishmb-constants");
      const token = localStorage.getItem(FISHMB_TOKEN_KEY);
      const form = new FormData();
      form.append("file", await compressImage(file));
      const upRes = await fetch("/api/fish/photos/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const up = await upRes.json();
      if (!upRes.ok) throw new Error(up.error || "Photo upload failed.");
      setEditAvatar(up.url as string);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not upload photo.");
    } finally {
      setSavingGroup(false);
    }
  };

  const saveGroup = async () => {
    const name = editName.trim();
    if (!name) {
      setNote("Give the group a name.");
      return;
    }
    setSavingGroup(true);
    try {
      await fishFetch(`/api/fishmb/msg/conversations/${peer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatar_url: editAvatar ?? "" }),
      });
      peer.name = name;
      peer.avatar_url = editAvatar;
      setEditingGroup(false);
      setNote(null);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not save group.");
    } finally {
      setSavingGroup(false);
    }
  };

  const addMember = async (userId: string) => {
    const wasGroup = peer.is_group;
    setSavingGroup(true);
    try {
      await fishFetch(`/api/fishmb/msg/conversations/${peer.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const f = friendOptions.find((x) => x.id === userId) ?? allUserResults.find((x) => x.id === userId);
      if (f && !peer.members.some((m) => m.user_id === userId)) {
        peer.members.push({ user_id: userId, name: f.name, avatar_url: f.avatar_url ?? null });
      }
      // If this was a 1-on-1, it's now a group.
      if (peer.members.length > 2) {
        peer.is_group = true;
      }
      // Remove from pickers so they don't show again.
      setFriendOptions((prev) => prev.filter((x) => x.id !== userId));
      setAllUserResults((prev) => prev.filter((x) => x.id !== userId));
      setAddSearch("");
      setNote(null);
      // Close the picker after converting a 1-on-1 (it's now a group).
      if (!wasGroup && peer.is_group) {
        setEditingGroup(false);
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not add member.");
    } finally {
      setSavingGroup(false);
    }
  };

  const removeMember = async (userId: string) => {
    setSavingGroup(true);
    try {
      await fishFetch(`/api/fishmb/msg/conversations/${peer.id}/members?user_id=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      const idx = peer.members.findIndex((m) => m.user_id === userId);
      if (idx >= 0) peer.members.splice(idx, 1);
      setNote(null);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not remove member.");
    } finally {
      setSavingGroup(false);
      setConfirmRemoveId(null);
    }
  };

  /** Leave the chat yourself: the members DELETE with no user_id
   *  removes the caller. Only runs after the inline confirm. */
  const leaveChat = async () => {
    setSavingGroup(true);
    try {
      await fishFetch(`/api/fishmb/msg/conversations/${peer.id}/members`, {
        method: "DELETE",
      });
      setEditingGroup(false);
      onBack();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not leave the chat.");
    } finally {
      setSavingGroup(false);
      setConfirmLeave(false);
    }
  };
  const title = peer.is_group
    ? (peer.name ?? "Group chat")
    : (peer.members.find((m) => m.user_id !== myId)?.name ?? "Chat");
  const others = peer.members.filter((m) => m.user_id !== myId);

  // iOS-style avatar colors, derived from the name so they're stable.
  const avatarBg = (name: string) => {
    const colors = ["bg-pine", "bg-signal", "bg-[#2f6b4f]", "bg-[#b4552d]"];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return colors[h % colors.length];
  };

  const peerAvatar = (size: string, textSize: string) =>
    peer.is_group ? (
      peer.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={peer.avatar_url} alt="" className={`${size} rounded-full object-cover shrink-0`} />
      ) : (
        <span className={`${size} rounded-full bg-pine/15 text-pine flex items-center justify-center font-bold shrink-0`}>
 
        </span>
      )
    ) : others[0]?.avatar_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={others[0].avatar_url} alt="" className={`${size} rounded-full object-cover shrink-0`} />
    ) : (
      <span className={`${size} rounded-full ${avatarBg(title)} text-white flex items-center justify-center font-bold shrink-0 ${textSize}`}>
        {title.charAt(0).toUpperCase()}
      </span>
    );

  const senderAvatar = (m: Decrypted, size: string) => {
    const member = peer.members.find((x) => x.user_id === m.sender_id);
    const name = member?.name ?? "?";
    return member?.avatar_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={member.avatar_url} alt="" className={`${size} rounded-full object-cover shrink-0`} />
    ) : (
      <span className={`${size} rounded-full ${avatarBg(name)} text-white flex items-center justify-center font-bold shrink-0 text-[10px]`}>
        {name.charAt(0).toUpperCase()}
      </span>
    );
  };

  // "Today 5:01 PM" style divider labels between messages.
  const dividerLabel = (iso: string): string => {
    const d = new Date(iso);
    const now = new Date();
    const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diffDays = Math.round((day(now) - day(d)) / 86400000);
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const dayName =
      diffDays <= 0 ? "Today" :
      diffDays === 1 ? "Yesterday" :
      diffDays < 7 ? d.toLocaleDateString("en-US", { weekday: "long" }) :
      d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
    return `${dayName} ${time}`;
  };
  const showDivider = (prev: Decrypted | undefined, m: Decrypted): boolean => {
    if (!prev) return true;
    const gap = new Date(m.created_at).getTime() - new Date(prev.created_at).getTime();
    if (gap > 60 * 60 * 1000) return true;
    const a = new Date(prev.created_at), b = new Date(m.created_at);
    return a.getFullYear() !== b.getFullYear() || a.getMonth() !== b.getMonth() || a.getDate() !== b.getDate();
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* iOS-style header: back chevron, centered avatar + name */}
      <div className="flex items-center gap-1 pb-2 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="md:hidden w-8 h-8 -ml-1 flex items-center justify-center text-pine text-3xl leading-none"
          aria-label="Back to conversations"
        >
          ‹
        </button>
        <div className="flex-1 min-w-0 flex flex-col items-center">
          <div className="flex items-center gap-2">
            {!peer.is_group && peer.members.length > 0 ? (
              <Link
                href={`/fishmb/anglers/${peer.members.find((m) => m.user_id !== myId)?.user_id ?? peer.members[0].user_id}`}
                className="flex flex-col items-center gap-1 min-w-0"
                aria-label={`View ${title}'s profile`}
              >
                {peerAvatar("w-11 h-11", "text-lg")}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => peer.is_group ? openGroupEditor() : undefined}
                className="flex flex-col items-center gap-1 min-w-0"
                aria-label={peer.is_group ? "Edit group" : title}
              >
                {peerAvatar("w-11 h-11", "text-lg")}
              </button>
            )}
            {!peer.is_group && (
              <button
                type="button"
                onClick={() => openGroupEditor()}
                className="w-8 h-8 rounded-full bg-signal hover:bg-signal-dark text-white text-xl font-bold flex items-center justify-center shrink-0 transition-colors"
                aria-label="Add person to chat"
              >
                +
              </button>
            )}
          </div>
          {!peer.is_group && peer.members.length > 0 ? (
            <Link
              href={`/fishmb/anglers/${peer.members.find((m) => m.user_id !== myId)?.user_id ?? peer.members[0].user_id}`}
              className="flex flex-col items-center gap-1 min-w-0 mt-1"
              aria-label={`View ${title}'s profile`}
            >
              <span className="font-bold text-pine text-[17px] leading-tight truncate max-w-full">
                {title}
              </span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => peer.is_group ? openGroupEditor() : undefined}
              className="flex flex-col items-center gap-1 min-w-0 mt-1"
              aria-label={peer.is_group ? "Edit group" : title}
            >
              <span className="font-bold text-pine text-[17px] leading-tight truncate max-w-full">
                {title}
                {peer.is_group && <span className="text-pine/30 text-sm"> ›</span>}
              </span>
            </button>
          )}
          <p className="text-[11px] text-pine/45 mt-0.5">
            {peer.is_group ? `${peer.members.length} members` : "Direct message"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setThemeOpen(true)}
          className="w-8 h-8 md:hidden flex items-center justify-center text-pine/60 shrink-0"
          aria-label="Chat appearance"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {editingGroup && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={() => setEditingGroup(false)}>
          <div className="bg-paper rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()} style={groupSheetDrag.dragStyle}>
            <div className="touch-none cursor-grab active:cursor-grabbing -mt-3 mb-1" {...groupSheetDrag.dragHandlers}>
              <SheetGrabber onClose={() => setEditingGroup(false)} />
            </div>
            <h3 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-4">
              {peer.is_group ? "Edit group" : "Add to chat"}
            </h3>
            {peer.is_group && (
              <>
            <div className="flex flex-col items-center mb-4">
              <button
                type="button"
                onClick={() => groupAvatarInputRef.current?.click()}
                className="relative w-20 h-20 rounded-full overflow-hidden bg-pine/10 flex items-center justify-center"
                aria-label="Change group photo"
              >
                {editAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl"></span>
                )}
                <span className="absolute inset-0 bg-black/30 flex items-center justify-center text-white text-xs font-bold opacity-0 hover:opacity-100 transition-opacity">
                  Change
                </span>
              </button>
              <input
                ref={groupAvatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadGroupAvatar(f);
                  e.target.value = "";
                }}
              />
              <p className="text-xs text-pine/50 mt-2">Tap photo to change</p>
            </div>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Group name"
              maxLength={60}
              className="w-full bg-white border border-pine/15 rounded-2xl px-4 py-3 text-pine font-bold mb-4 focus:outline-none focus:border-signal"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditingGroup(false)}
                className="flex-1 py-3 rounded-full border border-pine/20 text-pine font-bold text-sm uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveGroup}
                disabled={savingGroup}
                className="flex-1 py-3 rounded-full bg-signal text-white font-bold text-sm uppercase tracking-wider disabled:opacity-50"
              >
                {savingGroup ? "Saving…" : "Save"}
              </button>
            </div>
              </>
            )}
            <div className="mt-5 pt-4 border-t border-pine/10">
              <p className="text-[11px] font-bold uppercase tracking-wider text-pine/45 mb-2">
                {peer.members.length} members
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {peer.members.map((m) => (
                  <div key={m.user_id} className="flex items-center gap-2 text-sm text-pine">
                    <span className="w-6 h-6 rounded-full bg-pine/10 flex items-center justify-center text-xs font-bold">
                      {m.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="flex-1 truncate">{m.name}</span>
                    {m.user_id === myId ? (
                      confirmLeave ? (
                        <span className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs font-bold text-red-500">Leave chat?</span>
                          <button
                            type="button"
                            onClick={() => void leaveChat()}
                            disabled={savingGroup}
                            className="text-xs font-bold bg-red-500 text-white rounded-full px-2.5 py-1 disabled:opacity-50"
                          >
                            Leave
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmLeave(false)}
                            className="text-xs font-bold text-pine/50 px-1.5 py-1"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-pine/45">(you)</span>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmLeave(true);
                              setConfirmRemoveId(null);
                            }}
                            className="text-xs font-bold text-red-500 underline underline-offset-2"
                          >
                            Leave chat
                          </button>
                        </span>
                      )
                    ) : confirmRemoveId === m.user_id ? (
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-bold text-red-500">Remove?</span>
                        <button
                          type="button"
                          onClick={() => void removeMember(m.user_id)}
                          disabled={savingGroup}
                          className="text-xs font-bold bg-red-500 text-white rounded-full px-2.5 py-1 disabled:opacity-50"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(null)}
                          className="text-xs font-bold text-pine/50 px-1.5 py-1"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmRemoveId(m.user_id);
                          setConfirmLeave(false);
                        }}
                        aria-label={`Remove ${m.name}`}
                        className="w-7 h-7 rounded-full bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center text-sm font-bold"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {/* Add member */}
              <div className="mt-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-pine/45 mb-2">
                  Add member
                </p>
                <input
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  placeholder="Search friends and anglers…"
                  className="w-full bg-white border border-pine/15 rounded-2xl px-4 py-2.5 text-sm text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal mb-2"
                />
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setAddScope("friends")}
                    className={`flex-1 font-bold uppercase tracking-wider text-[10px] px-3 py-1.5 rounded-full transition-colors ${
                      addScope === "friends" ? "bg-pine text-white" : "bg-pine/10 text-pine/60"
                    }`}
                  >
                    Friends
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddScope("all")}
                    className={`flex-1 font-bold uppercase tracking-wider text-[10px] px-3 py-1.5 rounded-full transition-colors ${
                      addScope === "all" ? "bg-pine text-white" : "bg-pine/10 text-pine/60"
                    }`}
                  >
                    All users
                  </button>
                </div>
                {addScope === "friends" ? (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {friendOptions
                      .filter((f) =>
                        !addSearch.trim() ||
                        f.name.toLowerCase().includes(addSearch.trim().toLowerCase())
                      )
                      .slice(0, 8)
                      .map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => addMember(f.id)}
                          className="w-full flex items-center gap-2 text-sm text-pine hover:bg-pine/5 rounded-xl px-2 py-1.5"
                        >
                          {f.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={f.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                          ) : (
                            <span className="w-6 h-6 rounded-full bg-pine/10 flex items-center justify-center text-xs font-bold">
                              {f.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                          {f.name}
                          <span className="ml-auto text-signal-dark font-bold">+</span>
                        </button>
                      ))}
                    {friendOptions.length === 0 && (
                      <p className="text-xs text-pine/45 px-2 py-1">No friends to add.</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {allUserSearching ? (
                      <p className="text-xs text-pine/45 px-2 py-1">Searching…</p>
                    ) : allUserResults.length === 0 ? (
                      <p className="text-xs text-pine/45 px-2 py-1">
                        {addSearch.trim().length < 2
                          ? "Type at least 2 letters to search all anglers."
                          : "No anglers found."}
                      </p>
                    ) : (
                      allUserResults.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => addMember(u.id)}
                          className="w-full flex items-center gap-2 text-sm text-pine hover:bg-pine/5 rounded-xl px-2 py-1.5"
                        >
                          {u.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                          ) : (
                            <span className="w-6 h-6 rounded-full bg-pine/10 flex items-center justify-center text-xs font-bold">
                              {u.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                          {u.name}
                          <span className="ml-auto text-signal-dark font-bold">+</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showMembers && peer.is_group && (
        <div className="bg-white border border-pine/10 rounded-2xl p-3 mt-3 space-y-1">
          {peer.members.map((m) => (
            <Link
              key={m.user_id}
              href={`/fishmb/anglers/${m.user_id}`}
              className="flex items-center gap-2 text-sm text-pine hover:text-signal-dark"
            >
              <span className="w-6 h-6 rounded-full bg-pine/10 flex items-center justify-center text-xs font-bold">
                {m.name.charAt(0).toUpperCase()}
              </span>
              {m.name}
              {m.user_id === myId && (
                <span className="text-xs text-pine/45">(you)</span>
              )}
            </Link>
          ))}
        </div>
      )}

      {note && (
        <p className="text-sm text-signal-dark bg-signal/10 border border-signal/30 rounded-2xl px-4 py-2.5 mt-3">
          {note}
        </p>
      )}
      {missingNames.length > 0 && (
        <p className="text-sm text-pine bg-pine/5 border border-pine/15 rounded-2xl px-4 py-3 mt-3">
 {missingNames.join(", ")} {missingNames.length === 1 ? "hasn't" : "haven't"} enabled
          encrypted messaging yet — they'll only see messages sent after they turn it on.
        </p>
      )}

      <div
        className="flex-1 min-h-0 overflow-y-auto py-4 space-y-1 -mx-4 px-4"
        style={{ backgroundColor: theme.chatBg }}
      >
        {msgs.length === 0 && memberKeys && (
          <p className="text-center text-pine/45 text-sm mt-8">
 No messages yet — say hey. 
          </p>
        )}
        {msgs.map((m, i) => {
          const prev = i > 0 ? msgs[i - 1] : undefined;
          const next = i < msgs.length - 1 ? msgs[i + 1] : undefined;
          const senderName = m.mine
            ? null
            : (peer.members.find((x) => x.user_id === m.sender_id)?.name ?? null);
          const photo = photoUrl(m.text);
          const spot = spotPayload(m.text);
          // iOS touches: name above the first bubble of a sender run (groups),
          // avatar only on the last bubble of a sender run.
          const showName = !m.mine && peer.is_group && senderName && prev?.sender_id !== m.sender_id;
          const showAvatar = !m.mine && peer.is_group && next?.sender_id !== m.sender_id;
          return (
          <div key={m.id}>
            {showDivider(prev, m) && (
              <p className="text-center text-[11px] text-pine/40 py-2.5">
                {dividerLabel(m.created_at)}
              </p>
            )}
            <div className={`flex ${m.mine ? "justify-end" : "justify-start"} items-end gap-1.5`}>
              {!m.mine && peer.is_group && (
                <span className="w-7 shrink-0">{showAvatar ? senderAvatar(m, "w-7 h-7") : null}</span>
              )}
              <div
                className={`max-w-[75%] px-3.5 py-2 rounded-[1.25rem] ${
                  m.mine ? "rounded-br-md" : "rounded-bl-md"
                }`}
                style={{
                  backgroundColor: m.mine ? theme.sentBg : theme.receivedBg,
                }}
              >
                {showName && (
                  <p className="text-[11px] font-semibold text-pine/50 mb-0.5">{senderName}</p>
                )}
                {spot ? (
                  <div className="bg-white rounded-2xl p-3.5 w-60 text-pine shadow-sm">
                    <p className="font-bold text-[15px] leading-snug">
                      📍 {spot.spot.name || "Fishing spot"}
                    </p>
                    <p className="text-[11px] text-pine/45 tabular-nums mt-0.5">
                      {spot.spot.lat.toFixed(5)}, {spot.spot.lng.toFixed(5)}
                    </p>
                    {spot.spot.notes && (
                      <p className="text-[13px] text-pine/70 mt-1.5 leading-snug">{spot.spot.notes}</p>
                    )}
                    <p className="text-[11px] font-bold text-pine/50 mt-2">
                      🎣 Spot shared by {spot.origin.name}
                    </p>
                    {m.mine ? (
                      <p className="text-[11px] text-pine/40 mt-2">You shared this spot</p>
                    ) : acceptedSpotMsgs.has(m.id) ? (
                      <p className="text-[12px] font-bold text-pine mt-2.5">✓ Saved to your spots</p>
                    ) : declinedSpotMsgs.has(m.id) ? (
                      <p className="text-[11px] text-pine/40 mt-2">Declined</p>
                    ) : (
                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          disabled={acceptingSpotId === m.id}
                          onClick={() => acceptSpot(m.id, spot)}
                          className="flex-1 bg-signal hover:bg-signal-dark text-white text-xs font-bold uppercase tracking-wider px-3 py-2.5 rounded-full disabled:opacity-50 transition-colors"
                        >
                          {acceptingSpotId === m.id ? "Saving…" : "✓ Accept spot"}
                        </button>
                        <button
                          type="button"
                          onClick={() => declineSpot(m.id)}
                          className="px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-pine/50"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                ) : photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="Shared photo" className="rounded-2xl max-h-64 object-cover" loading="lazy" />
                ) : (
                  <p
                    className="text-[17px] leading-snug whitespace-pre-wrap break-words"
                    style={{ color: m.mine ? theme.sentText : theme.receivedText }}
                  >
                    {m.text ?? (m.noKey ? "Waiting for encryption key…" : "Couldn't decrypt this message.")}
                  </p>
                )}
              </div>
            </div>
          </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 pt-2 shrink-0">
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) sendPhoto(f);
          }}
        />
        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          disabled={!memberKeys || uploading || sending}
          aria-label="Send a photo"
          className="shrink-0 w-9 h-9 rounded-full bg-pine/10 hover:bg-pine/20 text-pine font-bold text-xl disabled:opacity-40 transition-colors"
        >
          {uploading ? "…" : "+"}
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          maxLength={2000}
          placeholder="Message…"
          disabled={!memberKeys}
          enterKeyHint="send"
          className="flex-1 min-w-0 bg-white border border-pine/15 rounded-full px-4 py-2.5 text-[17px] md:text-sm text-pine placeholder:text-pine/40 focus:outline-none focus:border-pine disabled:opacity-50"
        />
        <button
          type="button"
          onClick={send}
          disabled={!draft.trim() || sending || uploading || !memberKeys}
          aria-label="Send message"
          className="shrink-0 w-9 h-9 rounded-full bg-pine text-white text-lg font-bold disabled:opacity-30 transition-colors flex items-center justify-center"
        >
          {sending ? "…" : "↑"}
        </button>
      </div>

      {/* Chat appearance settings — curated themes */}
      {themeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
          onClick={() => setThemeOpen(false)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-sm p-6 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            style={themeSheetDrag.dragStyle}
          >
            <div className="touch-none cursor-grab active:cursor-grabbing -mt-3 mb-1" {...themeSheetDrag.dragHandlers}>
              <SheetGrabber onClose={() => setThemeOpen(false)} />
            </div>
            <h3 className="font-bold text-pine text-lg mb-1">Chat theme</h3>
            <p className="text-xs text-pine/50 mb-4">Applies to this chat only.</p>

            <div className="space-y-2.5 mb-4">
              {THEMES.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => saveTheme(t.name)}
                  className={`w-full rounded-2xl p-3 text-left border-2 transition-transform ${
                    themeName === t.name ? "border-signal" : "border-pine/10"
                  }`}
                  style={{ backgroundColor: t.chatBg }}
                >
                  <span className="flex items-center justify-between mb-2">
                    <span
                      className="text-sm font-bold"
                      style={{ color: t.chatBg === "#ffffff" || t.chatBg === "#e8f1f8" || t.chatBg === "#f2f0e4" || t.chatBg === "#fff5ec" || t.chatBg === "#f3eefb" || t.chatBg === "#eef6fb" ? "#0b231f" : "#ffffff" }}
                    >
                      {t.name}
                    </span>
                    {themeName === t.name && (
                      <span className="text-signal text-lg leading-none">✓</span>
                    )}
                  </span>
                  <span className="flex flex-col gap-1.5">
                    <span
                      className="self-end max-w-[75%] px-3 py-1.5 rounded-2xl rounded-br-md text-xs"
                      style={{ backgroundColor: t.sentBg, color: t.sentText }}
                    >
                      Hey, how's the fishing?
                    </span>
                    <span
                      className="self-start max-w-[75%] px-3 py-1.5 rounded-2xl rounded-bl-md text-xs"
                      style={{ backgroundColor: t.receivedBg, color: t.receivedText }}
                    >
                      Pretty good, you?
                    </span>
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setThemeOpen(false)}
              className="w-full py-3 rounded-full bg-pine text-white font-bold text-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
