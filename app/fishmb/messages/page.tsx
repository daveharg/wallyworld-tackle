// FishMB encrypted messages — end-to-end encrypted 1:1 DMs.
// The server only ever sees ciphertext; all encryption runs on-device.

"use client";

import { useEffect, useRef, useState } from "react";
import { useFishAuth } from "../_components/FishAuth";
import { fishFetch } from "../_components/fishFetch";
import ThreadView, { type ThreadPeer } from "./_components/ThreadView";
import {
  getOrCreateKeypair,
  publicKeyB64,
  type MsgKeypair,
} from "./_components/msgCrypto";

interface ConvoMember {
  user_id: string;
  name: string;
  avatar_url: string | null;
}

interface Convo {
  id: string;
  name: string | null;
  is_group: boolean;
  members: ConvoMember[];
  last_at: string | null;
  last_sender_id: string | null;
  unread: number;
  pinned_at: string | null;
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

/** iOS-style list timestamp: "5:05 PM", "Yesterday", "Tuesday", "Oct 5". */
function iosTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((day(now) - day(d)) / 86400000);
  if (diffDays <= 0)
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString("en-US", { weekday: "long" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Stable avatar background per name, in app colors. */
function avatarBg(name: string): string {
  const colors = ["bg-pine", "bg-signal", "bg-[#2f6b4f]", "bg-[#b4552d]"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
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
  const [newMode, setNewMode] = useState<"dm" | "group">("dm");
  const [groupPicks, setGroupPicks] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [sheetConvo, setSheetConvo] = useState<Convo | null>(null);
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const cancelPress = () => {
    if (pressTimer.current !== null) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };
  const beginPress = (c: Convo) => {
    cancelPress();
    longPressed.current = false;
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      setSheetConvo(c);
    }, 500);
  };

  const openConvo = (c: Convo) => {
    // A long-press that opened the action sheet shouldn't also open the thread.
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    setSelected({
      id: c.id,
      name: c.name,
      is_group: c.is_group,
      members: c.members,
    });
  };

  const togglePin = async (c: Convo) => {
    setSheetConvo(null);
    try {
      await fishFetch(`/api/fishmb/msg/conversations/${c.id}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !c.pinned_at }),
      });
      loadConvos();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not pin conversation.");
    }
  };

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
      const convo = (await fishFetch("/api/fishmb/msg/conversations").then(
        (x) => (x.conversations as Convo[]).find((c) => c.id === d.id)
      )) as Convo | undefined;
      if (convo) {
        setSelected({
          id: convo.id,
          name: convo.name,
          is_group: convo.is_group,
          members: convo.members,
        });
      }
      loadConvos();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not start conversation.");
    }
  };

  const startGroup = async () => {
    if (groupPicks.length === 0) return;
    setNote(null);
    try {
      const d = await fishFetch("/api/fishmb/msg/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_ids: groupPicks, name: groupName.trim() || undefined }),
      });
      setNewOpen(false);
      setGroupPicks([]);
      setGroupName("");
      const convo = (await fishFetch("/api/fishmb/msg/conversations").then(
        (x) => (x.conversations as Convo[]).find((c) => c.id === d.id)
      )) as Convo | undefined;
      if (convo) {
        setSelected({
          id: convo.id,
          name: convo.name,
          is_group: convo.is_group,
          members: convo.members,
        });
      }
      loadConvos();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not create group.");
    }
  };

  const convoTitle = (c: Convo): string => {
    if (c.is_group) return c.name ?? "Group chat";
    const other = c.members.find((m) => m.user_id !== user?.id);
    return other?.name ?? "Chat";
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
            <div>
              {(() => {
                const pinned = convos.filter((c) => c.pinned_at);
                const rest = convos.filter((c) => !c.pinned_at);
                const avatar = (c: Convo, title: string, size: string, text: string) => {
                  const other = c.is_group
                    ? null
                    : c.members.find((m) => m.user_id !== user?.id);
                  if (c.is_group)
                    return (
                      <span className={`${size} rounded-full bg-pine/15 text-pine flex items-center justify-center shrink-0 ${text}`}>
                        👥
                      </span>
                    );
                  if (other?.avatar_url)
                    return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={other.avatar_url} alt="" className={`${size} rounded-full object-cover shrink-0`} />
                    );
                  return (
                    <span className={`${size} rounded-full ${avatarBg(title)} text-white flex items-center justify-center font-bold shrink-0 ${text}`}>
                      {title.charAt(0).toUpperCase()}
                    </span>
                  );
                };
                const rowProps = (c: Convo) => ({
                  onTouchStart: () => beginPress(c),
                  onTouchEnd: cancelPress,
                  onTouchMove: cancelPress,
                  onContextMenu: (e: React.MouseEvent) => {
                    e.preventDefault();
                    setSheetConvo(c);
                  },
                });
                return (
                  <>
                    {/* Pinned to the top, iOS style */}
                    {pinned.length > 0 && (
                      <div className="flex gap-4 overflow-x-auto pb-4 px-1">
                        {pinned.map((c) => {
                          const title = convoTitle(c);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => openConvo(c)}
                              {...rowProps(c)}
                              className="flex flex-col items-center gap-1 w-16 shrink-0 select-none"
                              aria-label={`${title}, pinned`}
                            >
                              <span className="relative">
                                {avatar(c, title, "w-16 h-16", "text-2xl")}
                                {c.unread > 0 && (
                                  <span className="absolute -top-1 -right-1 bg-signal text-white text-[10px] font-black rounded-full min-w-5 h-5 px-1 flex items-center justify-center">
                                    {c.unread > 99 ? "99+" : c.unread}
                                  </span>
                                )}
                              </span>
                              <span className="text-[11px] text-pine/70 font-medium truncate w-full text-center leading-tight">
                                📌 {title}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {/* Conversation rows, iOS style */}
                    <div className="bg-white rounded-3xl border border-pine/10 overflow-hidden">
                      {rest.map((c, i) => {
                        const title = convoTitle(c);
                        return (
                          <div key={c.id}>
                            <button
                              type="button"
                              onClick={() => openConvo(c)}
                              {...rowProps(c)}
                              className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-pine/5 transition-colors select-none"
                            >
                              {avatar(c, title, "w-12 h-12", "text-xl")}
                              <span className="min-w-0 flex-1">
                                <span className="flex items-baseline justify-between gap-2">
                                  <span className="font-bold text-pine text-[17px] truncate">
                                    {title}
                                  </span>
                                  <span className="text-[13px] text-pine/40 shrink-0">
                                    {iosTime(c.last_at)}
                                  </span>
                                </span>
                                <span className="flex items-center justify-between gap-2 mt-0.5">
                                  <span className="text-[15px] text-pine/50 truncate">
                                    {c.last_at ? "🔒 Encrypted message" : "Say hey 👋"}
                                  </span>
                                  <span className="flex items-center gap-1.5 shrink-0">
                                    {c.unread > 0 && (
                                      <span className="bg-signal text-white text-[11px] font-black rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center">
                                        {c.unread > 99 ? "99+" : c.unread}
                                      </span>
                                    )}
                                    <span className="text-pine/25 text-xl leading-none">›</span>
                                  </span>
                                </span>
                              </span>
                            </button>
                            {i < rest.length - 1 && <div className="ml-[76px] border-b border-pine/10" />}
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* Thread — full-screen takeover on mobile so the message box stays put */}
        <div className={peer ? "fixed inset-0 z-50 bg-paper md:static md:z-auto md:bg-transparent" : "hidden md:block"}>
          {peer ? (
            <div className="h-[100dvh] md:h-[calc(100dvh-260px)] md:min-h-[420px] bg-paper-deep/50 md:border md:border-pine/10 md:rounded-3xl p-4 md:p-6">
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
          onClick={() => {
            setNewOpen(false);
            setGroupPicks([]);
            setGroupName("");
          }}
        >
          <div
            className="bg-paper rounded-3xl p-6 w-full max-w-sm shadow-2xl max-h-[70dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-4">
              New message
            </h3>
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setNewMode("dm")}
                className={`flex-1 font-bold uppercase tracking-wider text-xs px-4 py-2.5 rounded-full transition-colors ${
                  newMode === "dm" ? "bg-pine text-white" : "bg-pine/10 text-pine/60"
                }`}
              >
                1:1 chat
              </button>
              <button
                type="button"
                onClick={() => setNewMode("group")}
                className={`flex-1 font-bold uppercase tracking-wider text-xs px-4 py-2.5 rounded-full transition-colors ${
                  newMode === "group" ? "bg-pine text-white" : "bg-pine/10 text-pine/60"
                }`}
              >
                👥 Group
              </button>
            </div>
            {friends.length === 0 ? (
              <p className="text-pine/60 text-sm">
                You need friends to message. Find fishing buddies first.
              </p>
            ) : newMode === "dm" ? (
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
            ) : (
              <div>
                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  maxLength={60}
                  placeholder="Group name (optional)"
                  className="w-full bg-white border border-pine/15 rounded-2xl px-4 py-3 text-sm text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal mb-3"
                />
                <p className="text-xs text-pine/55 mb-2">
                  Pick friends ({groupPicks.length} selected):
                </p>
                <div className="space-y-1 mb-3">
                  {friends.map((f) => {
                    const picked = groupPicks.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() =>
                          setGroupPicks((prev) =>
                            picked ? prev.filter((x) => x !== f.id) : [...prev, f.id]
                          )
                        }
                        className={`w-full flex items-center gap-3 rounded-2xl p-3 text-left transition-colors ${
                          picked ? "bg-signal/10 border border-signal/40" : "hover:bg-pine/5 border border-transparent"
                        }`}
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
                        <span className="font-bold text-pine text-sm flex-1">{f.name}</span>
                        <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-white text-xs ${picked ? "bg-signal border-signal" : "border-pine/25"}`}>
                          {picked ? "✓" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={startGroup}
                  disabled={groupPicks.length === 0}
                  className="w-full bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-full disabled:opacity-40 transition-colors"
                >
                  Create group chat
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setNewOpen(false);
                setGroupPicks([]);
                setGroupName("");
              }}
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

      {/* Pin / unpin action sheet (long-press a conversation) */}
      {sheetConvo && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Conversation options">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSheetConvo(null)} />
          <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-3xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <p className="text-center font-bold text-pine mb-3 truncate px-8">
              {convoTitle(sheetConvo)}
            </p>
            <button
              type="button"
              onClick={() => togglePin(sheetConvo)}
              className="w-full bg-pine/10 hover:bg-pine/20 text-pine font-bold text-[17px] px-6 py-3.5 rounded-2xl transition-colors"
            >
              📌 {sheetConvo.pinned_at ? "Unpin from top" : "Pin to top"}
            </button>
            <button
              type="button"
              onClick={() => setSheetConvo(null)}
              className="w-full mt-2 bg-pine/10 hover:bg-pine/20 text-pine font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-full transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
