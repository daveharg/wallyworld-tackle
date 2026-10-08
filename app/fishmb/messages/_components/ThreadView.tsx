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
  text: string | null;
  created_at: string;
}

export interface ThreadPeer {
  id: string;
  other_id: string;
  other_name: string;
  other_avatar: string | null;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
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
  const [shared, setShared] = useState<Uint8Array | null>(null);
  const [keyMissing, setKeyMissing] = useState(false);
  const [msgs, setMsgs] = useState<Decrypted[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastAtRef = useRef<string | null>(null);
  const sharedRef = useRef<Uint8Array | null>(null);

  // Their public key -> shared secret.
  useEffect(() => {
    let live = true;
    fishFetch(`/api/fishmb/msg/keys/${peer.other_id}`)
      .then((d) => {
        if (!live) return;
        const pk = (d as { public_key: string | null }).public_key;
        if (!pk) {
          setKeyMissing(true);
          return;
        }
        const s = sharedSecret(pk, keypair.secretKey);
        sharedRef.current = s;
        setShared(s);
      })
      .catch(() => {
        if (live) setNote("Could not load encryption keys.");
      });
    return () => {
      live = false;
    };
  }, [peer.other_id, keypair]);

  const decryptAll = (rows: StoredMessage[], s: Uint8Array): Decrypted[] =>
    rows.map((m) => ({
      id: m.id,
      mine: m.sender_id === myId,
      text: decryptText(m.nonce, m.ciphertext, s),
      created_at: m.created_at,
    }));

  // Initial load + polling.
  useEffect(() => {
    if (!shared) return;
    let live = true;
    let timer: ReturnType<typeof setInterval>;
    const s = shared;
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
            setMsgs((prev) => [...prev, ...decryptAll(rows, s)]);
            lastAtRef.current = rows[rows.length - 1].created_at;
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
          }
        } else {
          setMsgs(decryptAll(rows, s));
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
  }, [shared, peer.id]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !sharedRef.current || sending) return;
    if (text.length > 2000) {
      setNote("Messages are limited to 2000 characters.");
      return;
    }
    setSending(true);
    setNote(null);
    try {
      const { nonce, ciphertext } = encryptText(text, sharedRef.current);
      const d = await fishFetch(`/api/fishmb/msg/conversations/${peer.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nonce, ciphertext }),
      });
      const m = d.message as StoredMessage;
      setMsgs((prev) => [
        ...prev,
        { id: m.id, mine: true, text, created_at: m.created_at },
      ]);
      lastAtRef.current = m.created_at;
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
        {peer.other_avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={peer.other_avatar}
            alt=""
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <span className="w-10 h-10 rounded-full bg-signal text-white flex items-center justify-center font-bold">
            {peer.other_name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <Link
            href={`/fishmb/users/${peer.other_id}`}
            className="font-bold text-pine truncate block hover:text-signal-dark"
          >
            {peer.other_name}
          </Link>
          <p className="text-xs text-pine/50">🔒 End-to-end encrypted</p>
        </div>
      </div>

      {note && (
        <p className="text-sm text-signal-dark bg-signal/10 border border-signal/30 rounded-2xl px-4 py-2.5 mt-3">
          {note}
        </p>
      )}
      {keyMissing && (
        <p className="text-sm text-pine bg-pine/5 border border-pine/15 rounded-2xl px-4 py-3 mt-3">
          {peer.other_name} hasn't enabled encrypted messaging yet.
        </p>
      )}

      <div className="flex-1 overflow-y-auto py-4 space-y-2">
        {msgs.length === 0 && shared && !keyMissing && (
          <p className="text-center text-pine/45 text-sm mt-8">
            No messages yet — say hey. 🔒
          </p>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                m.mine
                  ? "bg-signal text-white rounded-br-md"
                  : "bg-white border border-pine/10 text-pine rounded-bl-md"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap break-words">
                {m.text ?? "⚠️ Couldn't decrypt this message."}
              </p>
              <p
                className={`text-[10px] mt-1 text-right ${m.mine ? "text-white/70" : "text-pine/40"}`}
              >
                {timeAgo(m.created_at)}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 pt-3 border-t border-pine/10">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          maxLength={2000}
          placeholder="Message…"
          disabled={!shared || keyMissing}
          className="flex-1 bg-white border border-pine/15 rounded-full px-4 py-3 text-sm text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal disabled:opacity-50"
        />
        <button
          type="button"
          onClick={send}
          disabled={!draft.trim() || sending || !shared || keyMissing}
          className="shrink-0 bg-signal hover:bg-signal-dark text-white font-bold text-sm px-6 rounded-full disabled:opacity-40 transition-colors"
        >
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
