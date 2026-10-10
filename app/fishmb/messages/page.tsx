// FishMB encrypted messages — end-to-end encrypted 1:1 DMs.
// The server only ever sees ciphertext; all encryption runs on-device.

"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useFishAuth } from "../_components/FishAuth";
import { fishFetch } from "../_components/fishFetch";
import ThreadView, { type ThreadPeer } from "./_components/ThreadView";
import {
  getOrCreateKeypair,
  publicKeyB64,
  decryptText,
  sharedSecret,
  type MsgKeypair,
} from "./_components/msgCrypto";

interface ConvoMember {
  user_id: string;
  name: string;
  avatar_url: string | null;
  public_key?: string | null;
}

interface Convo {
  id: string;
  name: string | null;
  avatar_url: string | null;
  is_group: boolean;
  members: ConvoMember[];
  last_at: string | null;
  last_sender_id: string | null;
  last_nonce: string | null;
  last_ciphertext: string | null;
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

/** Decrypts and shows the last message preview in the conversation list. */
function LastMessagePreview({
  convo,
  keypair,
  myId,
}: {
  convo: Convo;
  keypair: MsgKeypair | null;
  myId: string | undefined;
}) {
  const [preview, setPreview] = useState<string>("…");
  useEffect(() => {
    if (!convo.last_nonce || !convo.last_ciphertext || !keypair) {
      setPreview("Encrypted message");
      return;
    }
    // The message was encrypted by its sender for us — decrypt with the
    // shared secret for THAT sender (their public key x our secret key).
    const sender = convo.members.find((m) => m.user_id === convo.last_sender_id);
    const pubKey = sender?.public_key;
    if (!pubKey) {
      setPreview("Encrypted message");
      return;
    }
    try {
      const sec = sharedSecret(pubKey, keypair.secretKey);
      const text = decryptText(convo.last_nonce, convo.last_ciphertext, sec);
      if (!text) {
        setPreview("Encrypted message");
        return;
      }
      // Photo messages are JSON { t: "photo", url }.
      try {
        const parsed = JSON.parse(text);
        if (parsed && parsed.t === "photo") {
          setPreview(`${convo.last_sender_id === myId ? "You" : sender.name ?? "Someone"} sent a photo`);
          return;
        }
      } catch {
        // Not JSON — plain text.
      }
      const prefix = convo.last_sender_id === myId ? "You: " : "";
      const short = text.length > 60 ? text.slice(0, 60) + "…" : text;
      setPreview(prefix + short);
    } catch {
      setPreview("Encrypted message");
    }
  }, [convo.id, convo.last_at, keypair]);
  return <>{preview}</>;
}

function MessagesPageInner() {
  const { user, openLogin } = useFishAuth();
  const searchParams = useSearchParams();
  const [setup, setSetup] = useState<"checking" | "needed" | "ready">("checking");
  const [enabling, setEnabling] = useState(false);
  const [keypair, setKeypair] = useState<MsgKeypair | null>(null);
  const [convos, setConvos] = useState<Convo[]>([]);
  const [selected, setSelected] = useState<ThreadPeer | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [newSearch, setNewSearch] = useState("");
  const [newPicks, setNewPicks] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  // New-message sheet mode: friends list, find-by-username, or group picker.
  const [newChatMode, setNewChatMode] = useState<"friends" | "username" | "group">("friends");
  const [unameQuery, setUnameQuery] = useState("");
  const [unameResults, setUnameResults] = useState<Friend[]>([]);
  const [unameSearching, setUnameSearching] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [chatTab, setChatTab] = useState<"friends" | "other">("friends");
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
      avatar_url: c.avatar_url,
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
      const list = (d.conversations ?? []) as Convo[];
      setConvos(list);
      // Deep link: /fishmb/messages?convo=<id> opens that thread directly.
      const target = searchParams.get("convo");
      if (target) {
        const hit = list.find((c) => c.id === target);
        if (hit) {
          setSelected({ id: hit.id, name: hit.name, avatar_url: hit.avatar_url, is_group: hit.is_group, members: hit.members });
        }
      }
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

  const startChat = async (userId: string) => {
    setNote(null);
    try {
      const d = await fishFetch("/api/fishmb/msg/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ other_user_id: userId }),
      });
      setNewOpen(false);
      setNewPicks([]);
      setNewSearch("");
      setGroupName("");
      const convo = (await fishFetch("/api/fishmb/msg/conversations").then(
        (x) => (x.conversations as Convo[]).find((c) => c.id === d.id)
      )) as Convo | undefined;
      if (convo) {
        setSelected({
          id: convo.id,
          name: convo.name,
          avatar_url: convo.avatar_url,
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
    if (newPicks.length === 0) return;
    setNote(null);
    try {
      const d = await fishFetch("/api/fishmb/msg/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_ids: newPicks, name: groupName.trim() || undefined }),
      });
      setNewOpen(false);
      setNewPicks([]);
      setNewSearch("");
      setGroupName("");
      const convo = (await fishFetch("/api/fishmb/msg/conversations").then(
        (x) => (x.conversations as Convo[]).find((c) => c.id === d.id)
      )) as Convo | undefined;
      if (convo) {
        setSelected({
          id: convo.id,
          name: convo.name,
          avatar_url: convo.avatar_url,
          is_group: convo.is_group,
          members: convo.members,
        });
      }
      loadConvos();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not create group.");
    }
  };

  const toggleNewPick = (id: string) => {
    setNewPicks((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const closeNewChat = () => {
    setNewOpen(false);
    setNewPicks([]);
    setNewSearch("");
    setGroupName("");
    setNewChatMode("friends");
    setUnameQuery("");
    setUnameResults([]);
  };

  // Find-by-username search (all users, API).
  useEffect(() => {
    if (!newOpen || newChatMode !== "username") return;
    const q = unameQuery.trim();
    if (q.length < 2) {
      setUnameResults([]);
      setUnameSearching(false);
      return;
    }
    setUnameSearching(true);
    const t = window.setTimeout(async () => {
      try {
        const d = await fishFetch(`/api/fishmb/users/search?q=${encodeURIComponent(q)}`);
        setUnameResults((d.users ?? []) as Friend[]);
      } catch {
        setUnameResults([]);
      } finally {
        setUnameSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [newOpen, newChatMode, unameQuery]);

  // Pastel avatar colors, deterministic per name (Telegram-style).
  const AVATAR_COLORS = [
    ["#D6E9F8", "#1B7AC4"], // blue
    ["#FFF3C4", "#B78A00"], // yellow
    ["#E9D5FF", "#7C3AED"], // purple
    ["#D1FAE5", "#059669"], // green
    ["#FCE7F3", "#DB2777"], // pink
    ["#FED7AA", "#C2410C"], // orange
    ["#E0E7FF", "#4F46E5"], // indigo
    ["#FECDD3", "#E11D48"], // red
  ] as const;
  const avatarColor = (name: string) => {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  };

  // Group a user list alphabetically by first letter.
  const groupByLetter = (list: Friend[]) => {
    const groups = new Map<string, Friend[]>();
    const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
    for (const f of sorted) {
      const ch = f.name.charAt(0).toUpperCase();
      const letter = ch >= "A" && ch <= "Z" ? ch : "#";
      const g = groups.get(letter) ?? [];
      g.push(f);
      groups.set(letter, g);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)));
  };
  const ALPHA_INDEX = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), "#"];

  const convoTitle = (c: Convo): string => {
    if (c.is_group) return c.name ?? "Group chat";
    const other = c.members.find((m) => m.user_id !== user?.id);
    return other?.name ?? "Chat";
  };

  // Split conversations: Friends tab (1:1 with friends + all groups),
  // Other tab (1:1 with non-friends).
  const friendIds = new Set(friends.map((f) => f.id));
  const isFriendConvo = (c: Convo): boolean => {
    if (c.is_group) return true;
    const other = c.members.find((m) => m.user_id !== user?.id);
    return other ? friendIds.has(other.user_id) : false;
  };
  const friendsConvos = convos.filter(isFriendConvo);
  const otherConvos = convos.filter((c) => !isFriendConvo(c));
  const friendsUnread = friendsConvos.reduce((sum, c) => sum + (c.unread ?? 0), 0);
  const otherUnread = otherConvos.reduce((sum, c) => sum + (c.unread ?? 0), 0);
  const visibleConvos = chatTab === "friends" ? friendsConvos : otherConvos;

  if (!user) {
    const perks = [
      {
 icon: "",
        title: "End-to-end encrypted",
        text: "Only you and the people you're talking to can read your messages. Not even FishMB can see them.",
      },
      {
 icon: "",
        title: "One-on-one & group chats",
        text: "Message a buddy or round up the whole crew to plan the next trip together.",
      },
      {
 icon: "",
        title: "Photos & spots in chat",
        text: "Send catch photos and drop your saved fishing spots right into the conversation.",
      },
      {
 icon: "",
        title: "Pins & unread badges",
        text: "Pin important chats to the top and see at a glance which conversations need you.",
      },
    ];
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="font-display font-bold uppercase text-pine text-4xl tracking-wide mb-3">
          Talk fishing, privately
        </h1>
        <p className="text-pine/60 text-sm mb-6">
          Built-in messaging for Manitoba anglers — plan trips, share spots
          and brag about the big one, all without leaving FishMB.
        </p>
        <button
          onClick={openLogin}
          className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-8 py-3.5 rounded-full mb-8"
        >
          Log in — it's free
        </button>
        <div className="flex flex-col gap-3 text-left">
          {perks.map((p) => (
            <div
              key={p.title}
              className="bg-white border border-pine/10 rounded-2xl px-4 py-3.5 flex items-start gap-3"
            >
              <span className="text-2xl shrink-0">{p.icon}</span>
              <span>
                <span className="block text-sm font-black text-pine">{p.title}</span>
                <span className="block text-xs text-pine/65 leading-snug mt-0.5">{p.text}</span>
              </span>
            </div>
          ))}
        </div>
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
 {enabling ? "Setting up…" : " Enable encrypted messaging"}
        </button>
      </div>
    );
  }

  const peer: ThreadPeer | null = selected;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 md:py-10">
      <div className="relative flex items-center justify-between mb-6">
        {/* User avatar */}
        <div className="w-12 h-12 rounded-full bg-pine/10 flex items-center justify-center shrink-0">
          {user?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <span className="font-bold text-pine/60 text-lg">
              {(user?.name ?? "F").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        {/* Friends / Other tabs */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 bg-pine/5 rounded-full p-1">
          <button
            type="button"
            onClick={() => setChatTab("friends")}
            className={`relative flex items-center gap-1.5 px-5 py-2 rounded-full font-bold text-sm transition-colors ${
              chatTab === "friends" ? "bg-white text-pine shadow-sm" : "text-pine/50"
            }`}
          >
            Friends
            {friendsUnread > 0 && (
              <span className="min-w-5 h-5 px-1 rounded-full bg-signal text-white text-[11px] font-black flex items-center justify-center">
                {friendsUnread > 99 ? "99+" : friendsUnread}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setChatTab("other")}
            className={`relative flex items-center gap-1.5 px-5 py-2 rounded-full font-bold text-sm transition-colors ${
              chatTab === "other" ? "bg-white text-pine shadow-sm" : "text-pine/50"
            }`}
          >
            Other
            {otherUnread > 0 && (
              <span className="min-w-5 h-5 px-1 rounded-full bg-signal text-white text-[11px] font-black flex items-center justify-center">
                {otherUnread > 99 ? "99+" : otherUnread}
              </span>
            )}
          </button>
        </div>
        {/* New chat button */}
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          aria-label="New chat"
          title="New chat"
          className="w-12 h-12 rounded-full bg-white border border-pine/10 shadow-sm flex items-center justify-center text-pine shrink-0 active:scale-95 transition-transform"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
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
          {visibleConvos.length === 0 ? (
            <div className="bg-white border border-pine/10 rounded-3xl p-8 text-center">
              <p className="text-pine/70 font-bold">
                {chatTab === "friends" ? "No friend chats yet" : "No other chats"}
              </p>
              <p className="text-pine/50 text-sm mt-1 mb-4">
                {chatTab === "friends"
                  ? "Start one with a fishing friend."
                  : "Chats with anglers who aren't friends yet show up here."}
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
                const pinned = visibleConvos.filter((c) => c.pinned_at);
                const rest = visibleConvos.filter((c) => !c.pinned_at);
                const avatar = (c: Convo, title: string, size: string, text: string) => {
                  const other = c.is_group
                    ? null
                    : c.members.find((m) => m.user_id !== user?.id);
                  if (c.is_group)
                    return (
                      <span className={`${size} rounded-full bg-pine/15 text-pine flex items-center justify-center shrink-0 ${text}`}>
 
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
 {title}
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
                                    {c.last_at ? (
                                      <LastMessagePreview convo={c} keypair={keypair} myId={user?.id} />
                                    ) : (
                                      "Say hey "
                                    )}
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
                <p className="text-pine/60 font-bold">
                  Pick a conversation to start messaging
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New message sheet (Telegram-style) */}
      {newOpen && (
        <div className="fixed inset-0 z-[1000]" onClick={closeNewChat}>
          <div className="absolute inset-0 bg-black/25" />
          <div
            className="absolute inset-x-0 bottom-0 top-16 bg-[#EFEFF4] rounded-t-[28px] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative flex items-center justify-center pt-5 pb-3 shrink-0">
              <h3 className="text-[17px] font-semibold text-black">
                {newChatMode === "username" ? "Find by Username" : newChatMode === "group" ? "New Group" : "New Message"}
              </h3>
              {newChatMode !== "friends" ? (
                <button
                  type="button"
                  onClick={() => setNewChatMode("friends")}
                  aria-label="Back"
                  className="absolute left-4 w-9 h-9 rounded-full bg-white flex items-center justify-center text-black shadow-sm"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
              ) : (
                <span className="absolute left-4 w-9" />
              )}
              <button
                type="button"
                onClick={closeNewChat}
                aria-label="Close"
                className="absolute right-4 w-9 h-9 rounded-full bg-white flex items-center justify-center text-black shadow-sm"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 relative">
              {newChatMode === "friends" && (
                <>
                  {/* Action card */}
                  <div className="bg-white rounded-[20px] overflow-hidden mb-5">
                    <button
                      type="button"
                      onClick={() => setNewChatMode("group")}
                      className="w-full flex items-center gap-4 px-5 py-4 text-left active:bg-black/5"
                    >
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-black shrink-0">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      <span className="flex-1 text-[17px] text-black border-b border-black/10 pb-4">New Group</span>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 -mt-4">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewChatMode("username")}
                      className="w-full flex items-center gap-4 px-5 py-4 text-left active:bg-black/5"
                    >
                      <span className="text-[24px] text-black shrink-0 font-medium">@</span>
                      <span className="flex-1 text-[17px] text-black">Find by Username</span>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  </div>

                  {/* Friends, alphabetical */}
                  {(() => {
                    const q = newSearch.trim().toLowerCase();
                    const list = q ? friends.filter((f) => f.name.toLowerCase().includes(q)) : friends;
                    const groups = groupByLetter(list);
                    if (list.length === 0) {
                      return (
                        <p className="text-center text-black/40 text-[15px] py-10">
                          {friends.length === 0 ? (
                            <>You don't have any friends yet.</>
                          ) : (
                            "No friends match that search."
                          )}
                        </p>
                      );
                    }
                    return groups.map(([letter, members]) => (
                      <div key={letter} ref={(el) => { sectionRefs.current[letter] = el; }}>
                        <p className="text-[15px] font-semibold text-black px-4 mb-1.5">{letter}</p>
                        <div className="bg-white rounded-[20px] overflow-hidden mb-5">
                          {members.map((f, i) => {
                            const [bg, fg] = avatarColor(f.name);
                            return (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => startChat(f.id)}
                                className="w-full flex items-center gap-3.5 px-4 py-2.5 text-left active:bg-black/5"
                              >
                                {f.avatar_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={f.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                                ) : (
                                  <span
                                    className="w-12 h-12 rounded-full flex items-center justify-center text-[20px] font-semibold shrink-0"
                                    style={{ backgroundColor: bg, color: fg }}
                                  >
                                    {f.name.charAt(0).toUpperCase()}
                                  </span>
                                )}
                                <span className={`flex-1 text-[17px] text-black truncate ${i < members.length - 1 ? "border-b border-black/10 pb-2.5" : ""}`}>
                                  {f.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}

                  {/* A–Z index */}
                  <div className="fixed right-1.5 top-1/2 -translate-y-1/2 flex flex-col items-center z-10">
                    {ALPHA_INDEX.map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => sectionRefs.current[ch]?.scrollIntoView({ behavior: "smooth", block: "start" })}
                        className="text-[10px] font-semibold text-black/60 leading-[1.35] px-1 active:text-black"
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {newChatMode === "username" && (
                <div className="bg-white rounded-[20px] overflow-hidden">
                  <div className="px-4 py-3 border-b border-black/10">
                    <input
                      value={unameQuery}
                      onChange={(e) => setUnameQuery(e.target.value)}
                      placeholder="Search by username…"
                      autoFocus
                      className="w-full text-[17px] text-black placeholder:text-black/35 focus:outline-none"
                    />
                  </div>
                  {unameSearching ? (
                    <p className="text-black/40 text-[15px] text-center py-8">Searching…</p>
                  ) : unameQuery.trim().length < 2 ? (
                    <p className="text-black/40 text-[15px] text-center py-8">Type at least 2 letters.</p>
                  ) : unameResults.length === 0 ? (
                    <p className="text-black/40 text-[15px] text-center py-8">No anglers found.</p>
                  ) : (
                    unameResults.map((f, i) => {
                      const [bg, fg] = avatarColor(f.name);
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => startChat(f.id)}
                          className="w-full flex items-center gap-3.5 px-4 py-2.5 text-left active:bg-black/5"
                        >
                          {f.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={f.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                          ) : (
                            <span
                              className="w-12 h-12 rounded-full flex items-center justify-center text-[20px] font-semibold shrink-0"
                              style={{ backgroundColor: bg, color: fg }}
                            >
                              {f.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <span className={`flex-1 text-[17px] text-black truncate ${i < unameResults.length - 1 ? "border-b border-black/10 pb-2.5" : ""}`}>
                            {f.name}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {newChatMode === "group" && (
                <>
                  {newPicks.length > 0 && (
                    <input
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      maxLength={60}
                      placeholder="Group name (optional)"
                      className="w-full bg-white rounded-[20px] px-5 py-4 text-[17px] text-black placeholder:text-black/35 focus:outline-none mb-4"
                    />
                  )}
                  {(() => {
                    const q = newSearch.trim().toLowerCase();
                    const list = q ? friends.filter((f) => f.name.toLowerCase().includes(q)) : friends;
                    const groups = groupByLetter(list);
                    if (list.length === 0) {
                      return (
                        <p className="text-center text-black/40 text-[15px] py-10">
                          {friends.length === 0 ? "You don't have any friends yet." : "No friends match that search."}
                        </p>
                      );
                    }
                    return groups.map(([letter, members]) => (
                      <div key={letter}>
                        <p className="text-[15px] font-semibold text-black px-4 mb-1.5">{letter}</p>
                        <div className="bg-white rounded-[20px] overflow-hidden mb-5">
                          {members.map((f, i) => {
                            const [bg, fg] = avatarColor(f.name);
                            const picked = newPicks.includes(f.id);
                            return (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => toggleNewPick(f.id)}
                                className="w-full flex items-center gap-3.5 px-4 py-2.5 text-left active:bg-black/5"
                              >
                                {f.avatar_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={f.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                                ) : (
                                  <span
                                    className="w-12 h-12 rounded-full flex items-center justify-center text-[20px] font-semibold shrink-0"
                                    style={{ backgroundColor: bg, color: fg }}
                                  >
                                    {f.name.charAt(0).toUpperCase()}
                                  </span>
                                )}
                                <span className={`flex-1 text-[17px] text-black truncate ${i < members.length - 1 ? "border-b border-black/10 pb-2.5" : ""}`}>
                                  {f.name}
                                </span>
                                <span
                                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-white text-[13px] shrink-0 ${
                                    picked ? "bg-[#007AFF] border-[#007AFF]" : "border-black/20"
                                  }`}
                                >
                                  {picked ? "✓" : ""}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                  <button
                    type="button"
                    onClick={startGroup}
                    disabled={newPicks.length < 2}
                    className="w-full bg-[#007AFF] text-white font-semibold text-[17px] py-3.5 rounded-[20px] disabled:opacity-40 mb-2"
                  >
                    Create group ({newPicks.length} selected)
                  </button>
                </>
              )}
            </div>

            {/* Bottom search bar */}
            {newChatMode !== "username" && (
              <div className="shrink-0 px-4 pb-6 pt-2 bg-gradient-to-t from-[#EFEFF4] via-[#EFEFF4]/85 to-transparent">
                <div className="bg-white/90 backdrop-blur rounded-full flex items-center gap-2.5 px-5 py-3.5 shadow-sm">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2.2" strokeLinecap="round" className="shrink-0">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.3-4.3" />
                  </svg>
                  <input
                    value={newSearch}
                    onChange={(e) => setNewSearch(e.target.value)}
                    placeholder="Name or username"
                    className="flex-1 bg-transparent text-[17px] text-black placeholder:text-[#8E8E93] focus:outline-none"
                  />
                  {newSearch && (
                    <button type="button" onClick={() => setNewSearch("")} aria-label="Clear search" className="text-[#8E8E93] text-lg leading-none">
                      ×
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <p className="text-center text-pine/40 text-xs mt-8 max-w-md mx-auto">
 End-to-end encrypted: messages are scrambled on your device and only
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
 {sheetConvo.pinned_at ? "Unpin from top" : "Pin to top"}
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

export default function MessagesPage() {
  return (
    <Suspense>
      <MessagesPageInner />
    </Suspense>
  );
}
