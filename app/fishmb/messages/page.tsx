// FishMB encrypted messages — end-to-end encrypted 1:1 DMs.
// The server only ever sees ciphertext; all encryption runs on-device.

"use client";

import { useEffect, useState } from "react";
import { useFishAuth } from "../_components/FishAuth";
import { fishFetch } from "../_components/fishFetch";
import ThreadView, { type ThreadPeer } from "./_components/ThreadView";
import {
  getOrCreateKeypair,
  publicKeyB64,
  type MsgKeypair,
} from "./_components/msgCrypto";

interface Convo {
  id: string;
  other_id: string;
  other_name: string;
  other_avatar: string | null;
  last_at: string | null;
  last_sender_id: string | null;
  unread: number;
}

interface Friend {
  id: string;
  name: string;
  avatar_url: string | null;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
}

export default function MessagesPage() {
  const { user, openLogin } = useFishAuth();
  const [setup, setSetup] = useState<"checking" | "needed" | "ready">("checking");
  const [enabling, setEnabling] = useState(false);
  const [keypair, setKeypair] = useState<MsgKeypair | null>(null);
  const [convos, setConvos] = useState<Convo[]>([]);
  const [selected, setSelected] = useState<ThreadPeer | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const loadConvos = async () => {
    try {
      const d = await fishFetch("/api/fishmb/msg/conversations");
      setConvos((d.conversations ?? []) as Convo[]);
    } catch {
      // list stays as-is
    }
  };

  // Setup check: local keypair + server public key.
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const d = await fishFetch("/api/fishmb/msg/keys");
        const kp = getOrCreateKeypair();
        setKeypair(kp);
        if ((d as { public_key: string | null }).public_key) {
          setSetup("ready");
          loadConvos();
        } else {
          setSetup("needed");
        }
      } catch {
        setSetup("needed");
      }
    })();
    fishFetch("/api/fish/friends")
      .then((d) => setFriends((d.friends ?? []) as Friend[]))
      .catch(() => {});
  }, [user]);

  const enable = async () => {
    setEnabling(true);
    setNote(null);
    try {
      const kp = getOrCreateKeypair();
      setKeypair(kp);
      await fishFetch("/api/fishmb/msg/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_key: publicKeyB64(kp) }),
      });
      setSetup("ready");
      loadConvos();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not enable messaging.");
    } finally {
      setEnabling(false);
    }
  };

  const startChat = async (friend: Friend) => {
    setNote(null);
    try {
      const d = await fishFetch("/api/fishmb/msg/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ other_user_id: friend.id }),
      });
      setNewOpen(false);
      setSelected({
        id: d.id as string,
        other_id: friend.id,
        other_name: friend.name,
        other_avatar: friend.avatar_url,
      });
      loadConvos();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not start conversation.");
    }
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display font-bold uppercase text-pine text-4xl tracking-wide mb-4">
          Messages
        </h1>
        <p className="text-pine/60 mb-6">
          Log in to send end-to-end encrypted messages.
        </p>
        <button
          onClick={openLogin}
          className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-8 py-3.5 rounded-full"
        >
          Log in
        </button>
      </div>
    );
  }

  if (setup === "checking") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="h-64 bg-pine/10 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (setup === "needed" || !keypair) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-5xl mb-4">🔒</p>
        <h1 className="font-display font-bold uppercase text-pine text-4xl tracking-wide mb-4">
          Encrypted messages
        </h1>
        <p className="text-pine/65 text-sm leading-relaxed mb-2 max-w-md mx-auto">
          Your messages are end-to-end encrypted — only you and the person
          you're talking to can read them. Not even FishMB can.
        </p>
        <p className="text-pine/45 text-xs mb-6 max-w-md mx-auto">
          Turning this on creates your private encryption key on this device.
          It never leaves your phone.
        </p>
        {note && (
          <p className="text-sm text-signal-dark bg-signal/10 border border-signal/30 rounded-2xl px-4 py-3 mb-4 max-w-md mx-auto">
            {note}
          </p>
        )}
        <button
          onClick={enable}
          disabled={enabling}
          className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-8 py-3.5 rounded-full disabled:opacity-50 transition-colors"
        >
          {enabling ? "Setting up…" : "🔒 Enable encrypted messaging"}
        </button>
      </div>
    );
  }

  const peer: ThreadPeer | null = selected;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 md:py-14">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-signal font-bold uppercase tracking-[0.28em] text-sm mb-2">
            🔒 Encrypted
          </p>
          <h1 className="font-display font-bold uppercase text-pine text-4xl tracking-wide">
            Messages
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="bg-pine hover:bg-pine-deep text-white font-bold uppercase tracking-wider text-xs px-5 py-3 rounded-full transition-colors"
        >
          ✏️ New
        </button>
      </div>

      {note && (
        <p className="text-sm text-signal-dark bg-signal/10 border border-signal/30 rounded-2xl px-4 py-3 mb-4">
          {note}
        </p>
      )}

      <div className="md:grid md:grid-cols-[320px_1fr] md:gap-6">
        {/* Conversation list */}
        <div className={peer ? "hidden md:block" : ""}>
          {convos.length === 0 ? (
            <div className="bg-white border border-pine/10 rounded-3xl p-8 text-center">
              <p className="text-4xl mb-3">💬</p>
              <p className="text-pine/70 font-bold">No conversations yet</p>
              <p className="text-pine/50 text-sm mt-1 mb-4">
                Start one with a fishing buddy.
              </p>
              <button
                type="button"
                onClick={() => setNewOpen(true)}
                className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-full transition-colors"
              >
                New message
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {convos.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    setSelected({
                      id: c.id,
                      other_id: c.other_id,
                      other_name: c.other_name,
                      other_avatar: c.other_avatar,
                    })
                  }
                  className={`w-full flex items-center gap-3 rounded-2xl p-3 border text-left transition-colors ${
                    peer?.id === c.id
                      ? "bg-pine text-white border-pine"
                      : "bg-white border-pine/10 hover:border-signal/40"
                  }`}
                >
                  {c.other_avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.other_avatar}
                      alt=""
                      className="w-11 h-11 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <span className="w-11 h-11 rounded-full bg-signal text-white flex items-center justify-center font-bold shrink-0">
                      {c.other_name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block font-bold text-sm truncate ${peer?.id === c.id ? "text-white" : "text-pine"}`}
                    >
                      {c.other_name}
                    </span>
                    <span
                      className={`block text-xs truncate ${peer?.id === c.id ? "text-white/60" : "text-pine/50"}`}
                    >
                      {c.last_at ? "🔒 Encrypted message" : "Say hey 👋"}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`text-[10px] ${peer?.id === c.id ? "text-white/60" : "text-pine/40"}`}
                    >
                      {timeAgo(c.last_at)}
                    </span>
                    {c.unread > 0 && (
                      <span className="bg-signal text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                        {c.unread}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Thread */}
        <div className={peer ? "" : "hidden md:block"}>
          {peer ? (
            <div className="bg-paper-deep/50 border border-pine/10 rounded-3xl p-4 md:p-6">
              <ThreadView
                peer={peer}
                myId={user.id}
                keypair={keypair}
                onBack={() => setSelected(null)}
                onSent={loadConvos}
              />
            </div>
          ) : (
            <div className="hidden md:flex bg-white border border-pine/10 rounded-3xl p-12 items-center justify-center text-center h-full min-h-[420px]">
              <div>
                <p className="text-4xl mb-3">🔒</p>
                <p className="text-pine/60 font-bold">
                  Pick a conversation to start messaging
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New conversation modal */}
      {newOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-4 bg-pine-deep/60 backdrop-blur-sm"
          onClick={() => setNewOpen(false)}
        >
          <div
            className="bg-paper rounded-3xl p-6 w-full max-w-sm shadow-2xl max-h-[70dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-4">
              New message
            </h3>
            {friends.length === 0 ? (
              <p className="text-pine/60 text-sm">
                You need friends to message. Find fishing buddies first.
              </p>
            ) : (
              <div className="space-y-1">
                {friends.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => startChat(f)}
                    className="w-full flex items-center gap-3 rounded-2xl p-3 hover:bg-pine/5 text-left"
                  >
                    {f.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={f.avatar_url}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <span className="w-10 h-10 rounded-full bg-pine/10 flex items-center justify-center font-bold text-pine">
                        {f.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="font-bold text-pine text-sm">{f.name}</span>
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setNewOpen(false)}
              className="w-full mt-4 bg-pine/10 hover:bg-pine/20 text-pine font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-full transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <p className="text-center text-pine/40 text-xs mt-8 max-w-md mx-auto">
        🔒 End-to-end encrypted: messages are scrambled on your device and only
        unscrambled on your friend's. Your encryption key never leaves this
        device.
      </p>
    </div>
  );
}
