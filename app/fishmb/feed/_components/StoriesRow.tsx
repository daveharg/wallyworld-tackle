// Facebook-style stories row — sits right under the mobile header.
// Shows your own "Create story" card plus stories from friends and people you follow.

"use client";

import { useEffect, useRef, useState } from "react";
import { fishFetch } from "../../_components/fishFetch";
import { useFishAuth } from "../../_components/FishAuth";
import StoryCreator from "./StoryCreator";

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
  overlays?: { text: string; x: number; y: number; font: string; color: string; bg: string; size: number }[];
  zoom?: number;
}

export default function StoriesRow() {
  const { user } = useFishAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [viewing, setViewing] = useState<Story | null>(null);
  const [creating, setCreating] = useState(false);

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

      {/* Full-screen story creator */}
      {creating && (
        <StoryCreator
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            load();
          }}
        />
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
          <div className="flex-1 flex items-center justify-center min-h-0 relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ transform: `scale(${viewing.zoom ?? 1})`, transformOrigin: "center" }}
            >
              {viewing.media_type === "video" ? (
                <video src={viewing.media_url} controls autoPlay playsInline className="max-h-full max-w-full" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={viewing.media_url} alt="" className="max-h-full max-w-full object-contain" />
              )}
            </div>
            {(viewing.overlays ?? []).map((o, i) => (
              <span
                key={i}
                className="absolute whitespace-nowrap font-extrabold"
                style={{
                  left: `${o.x}%`,
                  top: `${o.y}%`,
                  transform: "translate(-50%, -50%)",
                  color: o.color,
                  background: o.bg,
                  fontSize: `${o.size}px`,
                  padding: o.bg !== "transparent" ? "4px 12px" : undefined,
                  borderRadius: o.bg !== "transparent" ? "12px" : undefined,
                  textShadow: o.bg === "transparent" ? "0 2px 8px rgba(0,0,0,0.6)" : undefined,
                }}
              >
                {o.text}
              </span>
            ))}
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
