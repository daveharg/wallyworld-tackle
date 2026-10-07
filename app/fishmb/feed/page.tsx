"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFishAuth } from "../_components/FishAuth";
import { fishFetch } from "../_components/fishFetch";
import { FISHMB_TOKEN_KEY } from "@/lib/fishmb-constants";

interface FeedItem {
  id: string;
  kind: "catch" | "post";
  user_name: string;
  avatar_url: string | null;
  body: string | null;
  photo_url: string | null;
  species: string | null;
  length_in: number | null;
  comment_count: number;
  created_at: string;
}

interface FeedComment {
  id: string;
  user_name: string;
  avatar_url: string | null;
  body: string;
  created_at: string;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="w-10 h-10 rounded-full object-cover" />;
  }
  return (
    <span className="w-10 h-10 rounded-full bg-signal text-white flex items-center justify-center font-bold">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function Comments({ postId }: { postId: string }) {
  const { user, openLogin } = useFishAuth();
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    fishFetch(`/api/fishmb/feed/${postId}/comments`)
      .then((d) => setComments(d.comments))
      .catch(() => {});
  }, [postId]);

  const send = async () => {
    if (!user) {
      openLogin();
      return;
    }
    if (!draft.trim() || busy) return;
    setBusy(true);
    try {
      const d = await fishFetch(`/api/fishmb/feed/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim() }),
      });
      setComments([...comments, d.comment]);
      setDraft("");
    } catch {
      // non-fatal
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-pine/10 space-y-3">
      {comments.map((c) => (
        <div key={c.id} className="flex gap-2.5">
          <Avatar name={c.user_name} url={c.avatar_url} />
          <div className="bg-paper-deep rounded-2xl px-3.5 py-2.5 flex-1">
            <p className="text-xs font-bold text-pine">
              {c.user_name} <span className="font-normal text-pine/45">· {timeAgo(c.created_at)}</span>
            </p>
            <p className="text-sm text-pine/80 mt-0.5">{c.body}</p>
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={user ? "Write a comment…" : "Log in to comment"}
          onFocus={() => !user && openLogin()}
          className="flex-1 bg-paper-deep border border-pine/15 rounded-full px-4 py-2 text-sm text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal"
        />
        <button
          onClick={send}
          disabled={busy}
          className="bg-pine text-white text-xs font-bold uppercase tracking-wider px-4 rounded-full disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default function FeedPage() {
  const { user, openLogin } = useFishAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "catch" | "post">("all");
  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const d = await fishFetch("/api/fishmb/feed?limit=40");
      setItems(d.items);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const post = async () => {
    if (!user) {
      openLogin();
      return;
    }
    if (!draft.trim() || posting) return;
    setPosting(true);
    try {
      let photoUrl: string | null = null;
      if (photo) {
        const token = localStorage.getItem(FISHMB_TOKEN_KEY);
        const form = new FormData();
        form.append("file", photo);
        const upRes = await fetch("/api/fish/photos/upload", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        });
        const up = await upRes.json();
        if (!upRes.ok) throw new Error(up.error || "Photo upload failed.");
        photoUrl = up.url;
      }
      const d = await fishFetch("/api/fishmb/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim(), photo_url: photoUrl }),
      });
      setItems([d.item, ...items]);
      setDraft("");
      setPhoto(null);
    } catch {
      // non-fatal
    } finally {
      setPosting(false);
    }
  };

  const toggleComments = (id: string) => {
    const next = new Set(openComments);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpenComments(next);
  };

  const visible = items.filter((i) => tab === "all" || i.kind === tab);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 md:py-14">
      <p className="text-signal font-bold uppercase tracking-[0.28em] text-sm mb-3">Community</p>
      <h1 className="font-display font-bold uppercase text-pine text-4xl md:text-5xl tracking-wide mb-2">
        The feed
      </h1>
      <p className="text-pine/60 mb-8">
        Catches and discussions from Manitoba anglers — the same feed as the FishMB app.
      </p>

      {/* Composer */}
      <div className="bg-white border border-pine/10 rounded-3xl p-5 mb-6">
        {user ? (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder="How's the bite? Share a report…"
              className="w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-sm placeholder:text-pine/40 focus:outline-none focus:border-signal resize-none"
            />
            <div className="flex items-center justify-between mt-3">
              <label className="text-sm font-bold text-signal-dark cursor-pointer">
                {photo ? `📷 ${photo.name.slice(0, 24)}` : "📷 Add photo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                />
              </label>
              <button
                onClick={post}
                disabled={posting || !draft.trim()}
                className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-xs px-6 py-2.5 rounded-full disabled:opacity-40 transition-colors"
              >
                {posting ? "Posting…" : "Post"}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-2">
            <p className="text-pine/60 text-sm mb-4">
              Log in to join the discussion and share your catches.
            </p>
            <button
              onClick={openLogin}
              className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-7 py-3 rounded-full transition-colors"
            >
              Log in
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(
          [
            ["all", "All"],
            ["catch", "Catches"],
            ["post", "Discussions"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
              tab === v ? "bg-pine text-white" : "bg-pine/5 text-pine/60 hover:bg-pine/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Items */}
      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white border border-pine/10 rounded-3xl p-5 h-40 animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="text-pine/55 text-center py-10">Nothing here yet — be the first to post.</p>
      ) : (
        <div className="space-y-4">
          {visible.map((item) => (
            <article key={item.id} className="bg-white border border-pine/10 rounded-3xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <Avatar name={item.user_name} url={item.avatar_url} />
                <div>
                  <p className="font-bold text-pine text-sm">{item.user_name}</p>
                  <p className="text-xs text-pine/45">
                    {timeAgo(item.created_at)} · {item.kind === "catch" ? "logged a catch" : "posted"}
                  </p>
                </div>
                {item.kind === "catch" && (
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-wider bg-accentTeal/15 text-accentTeal px-3 py-1 rounded-full">
                    Catch
                  </span>
                )}
              </div>
              {item.species && (
                <p className="font-bold text-pine mb-1">
                  {item.species}
                  {item.length_in ? ` · ${Number(item.length_in).toFixed(1)}″` : ""}
                </p>
              )}
              {item.body && <p className="text-pine/80 text-sm whitespace-pre-line">{item.body}</p>}
              {item.photo_url && (
                <div className="mt-3 rounded-2xl overflow-hidden bg-pine-deep/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.photo_url} alt="" className="w-full max-h-96 object-cover" loading="lazy" />
                </div>
              )}
              <button
                onClick={() => toggleComments(item.id)}
                className="mt-3 text-xs font-bold uppercase tracking-wider text-pine/50 hover:text-signal-dark"
              >
                💬 {item.comment_count} {item.comment_count === 1 ? "comment" : "comments"}
              </button>
              {openComments.has(item.id) && <Comments postId={item.id} />}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
