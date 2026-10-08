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
  is_group: boolean;
  members: { user_id: string; name: string; avatar_url: string | null }[];
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
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
  const [keyMissing, setKeyMissing] = useState(false);
  const [msgs, setMsgs] = useState<Decrypted[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastAtRef = useRef<string | null>(null);
  const secretsRef = useRef<{ user_id: string; shared: Uint8Array }[] | null>(null);

  // Every member's public key -> per-member shared secret. Each message is
  // encrypted separately for each member (including yourself).
  useEffect(() => {
    let live = true;
    fishFetch(`/api/fishmb/msg/conversations/${peer.id}/members`)
      .then((d) => {
        if (!live) return;
        const members = (d.members ?? []) as {
          user_id: string;
          public_key: string | null;
        }[];
        const missing = members.filter((m) => !m.public_key);
        if (missing.length > 0) {
          setKeyMissing(true);
          return;
        }
        const s = members.map((m) => ({
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
            setMsgs((prev) => [...prev, ...decryptAll(rows)]);
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
    if (!payload || !secs || sending) return;
    if (payload.length > 8000) {
      setNote("That message is too long.");
      return;
    }
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
      const mine = (d.messages as StoredMessage[]).find((m) => m.sender_id === myId);
      if (mine) {
        setMsgs((prev) => [
          ...prev,
          { id: mine.id, mine: true, sender_id: myId, text: optimisticText ?? payload, created_at: mine.created_at },
        ]);
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
  const [uploading, setUploading] = useState(false);

  const sendPhoto = async (file: File) => {
    const secs = secretsRef.current;
    if (!secs || sending || uploading) return;
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
      setUploading(false);
    }
  };

  const title = peer.is_group
    ? (peer.name ?? "Group chat")
    : (peer.members.find((m) => m.user_id !== myId)?.name ?? "Chat");
  const others = peer.members.filter((m) => m.user_id !== myId);

  return (
    <div className="flex flex-col h-[calc(100dvh-220px)] min-h-[420px]">
      <div className="flex items-center gap-3 pb-3 border-b border-pine/10">
        <button
          type="button"
          onClick={onBack}
          className="md:hidden text-pine/60 text-xl px-1"
          aria-label="Back to conversations"
        >
          ←
        </button>
        {peer.is_group ? (
          <span className="w-10 h-10 rounded-full bg-pine text-white flex items-center justify-center font-bold shrink-0">
            👥
          </span>
        ) : others[0]?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={others[0].avatar_url}
            alt=""
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <span className="w-10 h-10 rounded-full bg-signal text-white flex items-center justify-center font-bold">
            {title.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => peer.is_group && setShowMembers((s) => !s)}
            className={`font-bold text-pine truncate block ${peer.is_group ? "hover:text-signal-dark" : ""}`}
          >
            {title}
          </button>
          <p className="text-xs text-pine/50">
            🔒 End-to-end encrypted
            {peer.is_group ? ` · ${peer.members.length} members` : ""}
          </p>
        </div>
      </div>

      {showMembers && peer.is_group && (
        <div className="bg-white border border-pine/10 rounded-2xl p-3 mt-3 space-y-1">
          {peer.members.map((m) => (
            <Link
              key={m.user_id}
              href={`/fishmb/users/${m.user_id}`}
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
      {keyMissing && (
        <p className="text-sm text-pine bg-pine/5 border border-pine/15 rounded-2xl px-4 py-3 mt-3">
          Someone in this chat hasn't enabled encrypted messaging yet.
        </p>
      )}

      <div className="flex-1 overflow-y-auto py-4 space-y-2">
        {msgs.length === 0 && secrets && !keyMissing && (
          <p className="text-center text-pine/45 text-sm mt-8">
            No messages yet — say hey. 🔒
          </p>
        )}
        {msgs.map((m) => {
          const senderName = m.mine
            ? null
            : (peer.members.find((x) => x.user_id === m.sender_id)?.name ?? null);
          const photo = photoUrl(m.text);
          return (
          <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                m.mine
                  ? "bg-signal text-white rounded-br-md"
                  : "bg-white border border-pine/10 text-pine rounded-bl-md"
              }`}
            >
              {senderName && peer.is_group && (
                <p className="text-[11px] font-bold text-signal-dark mb-0.5">{senderName}</p>
              )}
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="Shared photo" className="rounded-xl max-h-64 object-cover" loading="lazy" />
              ) : (
                <p className="text-sm whitespace-pre-wrap break-words">
                  {m.text ?? "⚠️ Couldn't decrypt this message."}
                </p>
              )}
              <p
                className={`text-[10px] mt-1 text-right ${m.mine ? "text-white/70" : "text-pine/40"}`}
              >
                {timeAgo(m.created_at)}
              </p>
            </div>
          </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 pt-3 border-t border-pine/10">
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
          disabled={!secrets || keyMissing || uploading || sending}
          aria-label="Send a photo"
          className="shrink-0 w-12 h-12 rounded-full bg-pine/10 hover:bg-pine/20 text-pine font-bold text-lg disabled:opacity-40 transition-colors"
        >
          {uploading ? "…" : "📷"}
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          maxLength={2000}
          placeholder="Message…"
          disabled={!secrets || keyMissing}
          className="flex-1 bg-white border border-pine/15 rounded-full px-4 py-3 text-sm text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal disabled:opacity-50"
        />
        <button
          type="button"
          onClick={send}
          disabled={!draft.trim() || sending || uploading || !secrets || keyMissing}
          className="shrink-0 bg-signal hover:bg-signal-dark text-white font-bold text-sm px-6 rounded-full disabled:opacity-40 transition-colors"
        >
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
