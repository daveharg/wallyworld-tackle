// Facebook-style stories row — sits right under the mobile header.
// Shows your own "Create story" card plus stories from friends and people you follow.

"use client";

import { useEffect, useRef, useState } from "react";
import { fishFetch } from "../../_components/fishFetch";
import { useFishAuth } from "../../_components/FishAuth";
import { compressImage } from "../../_components/compressImage";
import { FISHMB_TOKEN_KEY } from "@/lib/fishmb-constants";

interface Story {
  id: string;
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  viewed: boolean;
}

export default function StoriesRow() {
  const { user } = useFishAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [viewing, setViewing] = useState<Story | null>(null);
  const [creating, setCreating] = useState(false);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const d = await fishFetch("/api/fishmb/stories");
      setStories(((d as { stories?: Story[] }).stories ?? []) as Story[]);
    } catch {
      // Stories stay empty.
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openViewer = async (s: Story) => {
    setViewing(s);
    try {
      await fishFetch(`/api/fishmb/stories/${s.id}/view`, { method: "POST" });
      setStories((list) => list.map((x) => (x.id === s.id ? { ...x, viewed: true } : x)));
    } catch {
      // View tracking is best-effort.
    }
  };

  const deleteStory = async (id: string) => {
    try {
      await fishFetch(`/api/fishmb/stories/${id}`, { method: "DELETE" });
      setStories((list) => list.filter((x) => x.id !== id));
      setViewing(null);
    } catch {
      // Best effort.
    }
  };

  const createStory = async (file: File) => {
    setUploading(true);
    setNote(null);
    try {
      const token = localStorage.getItem(FISHMB_TOKEN_KEY);
      const form = new FormData();
      form.append("file", await compressImage(file));
      const upRes = await fetch("/api/fish/photos/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const up = await upRes.json();
      if (!upRes.ok) throw new Error(up.error || "Upload failed.");
      await fishFetch("/api/fishmb/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_url: up.url, caption: caption.trim() || undefined }),
      });
      setCaption("");
      setCreating(false);
      await load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not create story.");
    } finally {
      setUploading(false);
    }
  };

  // Group stories by user — one card per person, newest story as the cover.
  const byUser = new Map<string, Story[]>();
  for (const s of stories) {
    const list: Story[] = byUser.get(s.user_id) ?? [];
    list.push(s);
    byUser.set(s.user_id, list);
  }
  const cards = Array.from(byUser.entries()).map(([userId, list]: [string, Story[]]) => ({
    userId,
    userName: list[0].user_name,
    avatarUrl: list[0].avatar_url,
    cover: list[0],
    allViewed: list.every((s) => s.viewed),
    count: list.length,
  }));

  if (!user) return null;

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 mb-4" style={{ scrollbarWidth: "none" }}>
        {/* Create story card */}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="shrink-0 w-28 h-44 rounded-3xl bg-white border border-pine/10 overflow-hidden relative text-left"
        >
          {user.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar_url} alt="" className="w-full h-2/3 object-cover" />
          ) : (
            <div className="w-full h-2/3 bg-pine/10 flex items-center justify-center">
              <span className="text-3xl font-bold text-pine/40">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <span className="absolute left-1/2 -translate-x-1/2 top-[calc(66.6%-20px)] w-10 h-10 rounded-full bg-signal text-white flex items-center justify-center text-2xl font-bold border-4 border-white">
            +
          </span>
          <span className="absolute bottom-0 inset-x-0 pt-6 pb-2 text-center text-xs font-bold text-pine bg-white">
            Create story
          </span>
        </button>

        {/* Story cards */}
        {cards.map((c) => (
          <button
            key={c.userId}
            type="button"
            onClick={() => openViewer(c.cover)}
            className="shrink-0 w-28 h-44 rounded-3xl overflow-hidden relative text-left"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.cover.media_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <span className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />
            {c.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.avatarUrl}
                alt={c.userName}
                className={`absolute top-2 left-2 w-10 h-10 rounded-full object-cover border-[3px] ${
                  c.allViewed ? "border-white/40" : "border-signal"
                }`}
              />
            ) : (
              <span
                className={`absolute top-2 left-2 w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center font-bold text-white border-[3px] ${
                  c.allViewed ? "border-white/40" : "border-signal"
                }`}
              >
                {c.userName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="absolute bottom-2 inset-x-2 text-white text-xs font-bold leading-tight line-clamp-2">
              {c.userName}
            </span>
          </button>
        ))}
      </div>

      {/* Create story modal */}
      {creating && (
        <div className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={() => setCreating(false)}>
          <div className="bg-paper rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-4">
              Create story
            </h3>
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption (optional)…"
              maxLength={200}
              className="w-full bg-white border border-pine/15 rounded-2xl px-4 py-3 text-sm text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal mb-4"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void createStory(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full py-3.5 rounded-full bg-signal text-white font-bold text-sm uppercase tracking-wider disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Pick photo or video"}
            </button>
            {note && <p className="text-sm text-red-600 mt-3 text-center">{note}</p>}
            <p className="text-xs text-pine/45 mt-3 text-center">
              Stories disappear after 24 hours.
            </p>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="w-full mt-2 py-3 rounded-full border border-pine/20 text-pine font-bold text-sm uppercase tracking-wider"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Story viewer */}
      {viewing && (
        <div className="fixed inset-0 z-[1300] bg-black flex flex-col" onClick={() => setViewing(null)}>
          <div className="flex items-center gap-3 p-4 text-white" onClick={(e) => e.stopPropagation()}>
            {viewing.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewing.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <span className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold">
                {viewing.user_name.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{viewing.user_name}</p>
              <p className="text-xs text-white/60">
                {new Date(viewing.created_at).toLocaleString()}
              </p>
            </div>
            {viewing.user_id === user.id && (
              <button
                type="button"
                onClick={() => deleteStory(viewing.id)}
                className="text-white/70 hover:text-white text-sm font-bold"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={() => setViewing(null)}
              aria-label="Close story"
              className="text-white text-3xl leading-none"
            >
              ×
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center min-h-0" onClick={(e) => e.stopPropagation()}>
            {viewing.media_type === "video" ? (
              <video src={viewing.media_url} controls autoPlay playsInline className="max-h-full max-w-full" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewing.media_url} alt="" className="max-h-full max-w-full object-contain" />
            )}
          </div>
          {viewing.caption && (
            <p className="p-4 text-white text-center text-sm" onClick={(e) => e.stopPropagation()}>
              {viewing.caption}
            </p>
          )}
        </div>
      )}
    </>
  );
}
