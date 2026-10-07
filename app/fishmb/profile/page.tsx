"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFishAuth } from "../_components/FishAuth";
import { fishFetch } from "../_components/fishFetch";
import { FISHMB_TOKEN_KEY } from "@/lib/fishmb-constants";

export default function ProfilePage() {
  const { user, openLogin, refresh } = useFishAuth();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setBio((user as { bio?: string }).bio ?? "");
      setAvatar(user.avatar_url ?? null);
    }
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display font-bold uppercase text-pine text-4xl tracking-wide mb-4">Your profile</h1>
        <p className="text-pine/60 mb-6">Log in to set your profile picture and bio.</p>
        <button onClick={openLogin} className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-8 py-3.5 rounded-full">
          Log in
        </button>
      </div>
    );
  }

  const pickAvatar = async (file: File) => {
    setUploading(true);
    setNote(null);
    try {
      const token = localStorage.getItem(FISHMB_TOKEN_KEY);
      const form = new FormData();
      form.append("file", file);
      const upRes = await fetch("/api/fish/photos/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const up = await upRes.json();
      if (!upRes.ok) throw new Error(up.error || "Upload failed.");
      const url = up.url as string;
      await fishFetch("/api/fish/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: url }),
      });
      setAvatar(url);
      await refresh();
      setNote("Profile picture updated!");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not upload.");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setNote(null);
    try {
      await fishFetch("/api/fish/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), bio: bio.trim() }),
      });
      await refresh();
      setNote("Profile saved!");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 md:py-14">
      <Link href="/fishmb/feed" className="text-sm font-bold text-signal uppercase tracking-wider">← Community feed</Link>
      <h1 className="font-display font-bold uppercase text-pine text-4xl md:text-5xl tracking-wide mt-4 mb-8">
        Your profile
      </h1>

      {note && <p className="text-sm text-pine bg-gold/20 border border-gold/50 rounded-2xl px-4 py-3 mb-6">{note}</p>}

      <div className="bg-white border border-pine/10 rounded-3xl p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-5">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt={name} className="w-24 h-24 rounded-full object-cover border-2 border-gold" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-pine/10 flex items-center justify-center font-bold text-pine text-3xl">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <label className="bg-pine hover:bg-pine-deep text-white font-bold uppercase tracking-wider text-xs px-5 py-2.5 rounded-full cursor-pointer transition-colors">
              {uploading ? "Uploading…" : "Change picture"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) pickAvatar(f);
                }}
              />
            </label>
            <p className="text-xs text-pine/50 mt-2">Saved to your account right away.</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-[0.18em] text-pine/55 mb-2">
            Display name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className="w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine focus:outline-none focus:border-signal"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-[0.18em] text-pine/55 mb-2">
            Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Tell the community about yourself — where you fish, what you chase…"
            className="w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-sm placeholder:text-pine/40 focus:outline-none focus:border-signal resize-none"
          />
          <p className="text-xs text-pine/45 mt-1 text-right">{bio.length}/500</p>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-8 py-3.5 rounded-full disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </div>
  );
}
