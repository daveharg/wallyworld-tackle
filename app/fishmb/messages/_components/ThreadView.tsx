"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fishFetch } from "../../_components/fishFetch";
import {
  decryptText,
  encryptText,
  sharedSecret,
  type MsgKeypair,
} from "./msgCrypto";

interface StoredMessage {
  id: string;
  sender_id: string;
  recipient_id?: string;
  nonce: string;
  ciphertext: string;
  created_at: string;
}

interface Decrypted {
  id: string;
  mine: boolean;
  sender_id: string;
  text: string | null;
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

export default function ThreadView({
  peer,
  myId,
  keypair,
  onBack,
  onSent,
}: {
  peer: ThreadPeer;
  myId: string;
  keypair: MsgKeypair;
  onBack: () => void;
  onSent: () => void;
}) {
  const [secrets, setSecrets] = useState<{ user_id: string; shared: Uint8Array }[] | null>(null);
  const [missingNames, setMissingNames] = useState<string[]>([]);
  const [msgs, setMsgs] = useState<Decrypted[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [editingGroup, setEditingGroup] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [savingGroup, setSavingGroup] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [friendOptions, setFriendOptions] = useState<{ id: string; name: string }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastAtRef = useRef<string | null>(null);
  const secretsRef = useRef<{ user_id: string; shared: Uint8Array }[] | null>(null);
  // Synchronous send guard — `sending` state updates async, so rapid taps
  // (double-tap, tap + Enter) would all slip past it and send duplicates.
  const sendingRef = useRef(false);
  const uploadingRef = useRef(false);

  // Every member's public key -> per-member shared secret. Each message is
  // encrypted separately for each member that HAS a key (including yourself).
  // Members without keys yet can't read anything until they enable encrypted
  // messaging — the thread still works for everyone else.
  useEffect(() => {
    let live = true;
    fishFetch(`/api/fishmb/msg/conversations/${peer.id}/members`)
      .then((d) => {
        if (!live) return;
        const members = (d.members ?? []) as {
          user_id: string;
          name: string;
          public_key: string | null;
        }[];
        setMissingNames(
          members.filter((m) => !m.public_key && m.user_id !== myId).map((m) => m.name || "Someone")
        );
        const keyed = members.filter((m) => m.public_key);
        const s = keyed.map((m) => ({
          user_id: m.user_id,
          shared: sharedSecret(m.public_key as string, keypair.secretKey),
        }));
        secretsRef.current = s;
        setSecrets(s);
      })
      .catch(() => {
        if (live) setNote("Could not load encryption keys.");
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peer.id, keypair]);

  // Each message copy was encrypted by its sender for us, so it must be
  // decrypted with the shared secret for THAT sender (their public key x
  // our secret key) — not our own.
  const decryptAll = (rows: StoredMessage[]): Decrypted[] =>
    rows.map((m) => {
      const sec =
        secretsRef.current?.find((x) => x.user_id === m.sender_id)?.shared ?? null;
      return {
        id: m.id,
        mine: m.sender_id === myId,
        sender_id: m.sender_id,
        text: sec ? decryptText(m.nonce, m.ciphertext, sec) : null,
        created_at: m.created_at,
      };
    });

  // Initial load + polling. My rows only — each member reads their own copy.
  useEffect(() => {
    if (!secrets) return;
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
              const ids = new Set(prev.map((m) => m.id));
              const fresh = decryptAll(rows).filter((m) => !ids.has(m.id));
              if (fresh.length === 0) return prev;
              return [...prev, ...fresh];
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
          }).catch(() => {});
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
  }, [secrets, peer.id]);

  const sendPayload = async (payload: string, optimisticText: string | null = null) => {
    const secs = secretsRef.current;
    if (!payload || !secs || secs.length === 0 || sendingRef.current) return;
    if (payload.length > 8000) {
      setNote("That message is too long.");
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setNote(null);
    try {
      const parts = secs.map(({ user_id, shared }) => {
        const { nonce, ciphertext } = encryptText(payload, shared);
        return { recipient_id: user_id, nonce, ciphertext };
      });
      const d = await fishFetch(`/api/fishmb/msg/conversations/${peer.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parts }),
      });
      // The POST stores one row per recipient (all with sender_id = me) —
      // the optimistic row must be MY copy, or the poll will re-add it as
      // a duplicate seconds later.
      const rows = d.messages as StoredMessage[];
      const mine =
        rows.find((m) => m.recipient_id === myId) ?? rows.find((m) => m.sender_id === myId);
      if (mine) {
        setMsgs((prev) => {
          if (prev.some((m) => m.id === mine.id)) return prev;
          return [
            ...prev,
            { id: mine.id, mine: true, sender_id: myId, text: optimisticText ?? payload, created_at: mine.created_at },
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
    const secs = secretsRef.current;
    if (!secs || secs.length === 0 || sendingRef.current || uploadingRef.current) return;
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
    setEditingGroup(true);
    // Load friends for the add-member picker.
    fishFetch("/api/fish/friends")
      .then((d) => {
        const list = ((d as { friends?: { id: string; name: string }[] }).friends ?? [])
          .filter((f) => !peer.members.some((m) => m.user_id === f.id));
        setFriendOptions(list);
      })
      .catch(() => {});
  };

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
    setSavingGroup(true);
    try {
      await fishFetch(`/api/fishmb/msg/conversations/${peer.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const f = friendOptions.find((x) => x.id === userId);
      if (f && !peer.members.some((m) => m.user_id === userId)) {
        peer.members.push({ user_id: userId, name: f.name, avatar_url: null });
      }
      setAddSearch("");
      setNote(null);
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
          <button
            type="button"
            onClick={() => peer.is_group ? openGroupEditor() : undefined}
            className="flex flex-col items-center gap-1 min-w-0"
            aria-label={peer.is_group ? "Edit group" : title}
          >
            {peerAvatar("w-11 h-11", "text-lg")}
            <span className="font-bold text-pine text-[17px] leading-tight truncate max-w-full">
              {title}
              {peer.is_group && <span className="text-pine/30 text-sm"> ›</span>}
            </span>
          </button>
          <p className="text-[11px] text-pine/45 mt-0.5">
            {peer.is_group ? `${peer.members.length} members` : "Direct message"}
          </p>
        </div>
        <span className="w-8 md:hidden shrink-0" />
      </div>

      {editingGroup && peer.is_group && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={() => setEditingGroup(false)}>
          <div className="bg-paper rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-4">
              Edit group
            </h3>
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
                      <span className="text-xs text-pine/45">(you)</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => removeMember(m.user_id)}
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
                  placeholder="Search friends…"
                  className="w-full bg-white border border-pine/15 rounded-2xl px-4 py-2.5 text-sm text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal mb-2"
                />
                {addSearch.trim() && (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {friendOptions
                      .filter((f) => f.name.toLowerCase().includes(addSearch.toLowerCase()))
                      .slice(0, 5)
                      .map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => addMember(f.id)}
                          className="w-full flex items-center gap-2 text-sm text-pine hover:bg-pine/5 rounded-xl px-2 py-1.5"
                        >
                          <span className="w-6 h-6 rounded-full bg-pine/10 flex items-center justify-center text-xs font-bold">
                            {f.name.charAt(0).toUpperCase()}
                          </span>
                          {f.name}
                          <span className="ml-auto text-signal-dark font-bold">+</span>
                        </button>
                      ))}
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

      <div className="flex-1 min-h-0 overflow-y-auto py-4 space-y-1">
        {msgs.length === 0 && secrets && (
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
                  m.mine
                    ? "bg-pine text-white rounded-br-md"
                    : "bg-[rgb(233,233,235)] text-pine rounded-bl-md"
                }`}
              >
                {showName && (
                  <p className="text-[11px] font-semibold text-pine/50 mb-0.5">{senderName}</p>
                )}
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="Shared photo" className="rounded-2xl max-h-64 object-cover" loading="lazy" />
                ) : (
                  <p className="text-[17px] leading-snug whitespace-pre-wrap break-words">
 {m.text ?? " Couldn't decrypt this message."}
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
          accept="image/jpeg,image/png,image/webp"
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
          disabled={!secrets || uploading || sending}
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
          disabled={!secrets}
          enterKeyHint="send"
          className="flex-1 min-w-0 bg-white border border-pine/15 rounded-full px-4 py-2.5 text-[17px] md:text-sm text-pine placeholder:text-pine/40 focus:outline-none focus:border-pine disabled:opacity-50"
        />
        <button
          type="button"
          onClick={send}
          disabled={!draft.trim() || sending || uploading || !secrets}
          aria-label="Send message"
          className="shrink-0 w-9 h-9 rounded-full bg-pine text-white text-lg font-bold disabled:opacity-30 transition-colors flex items-center justify-center"
        >
          {sending ? "…" : "↑"}
        </button>
      </div>
    </div>
  );
}
