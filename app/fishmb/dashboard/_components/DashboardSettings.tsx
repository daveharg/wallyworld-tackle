"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { useFishAuth } from "../../_components/FishAuth";
import { fishFetch } from "../../_components/fishFetch";
import { compressImage } from "../../_components/compressImage";
import { FISHMB_TOKEN_KEY } from "@/lib/fishmb-constants";

/** Dashboard settings: avatar, display name, bio, account type. */
export default function DashboardSettings({ afterSaveHref }: { afterSaveHref?: string }) {
  const router = useRouter();
  const { user, refresh } = useFishAuth();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [accountType, setAccountType] = useState("personal");
  const [allowFollow, setAllowFollow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setBio((user as { bio?: string }).bio ?? "");
      setAccountType((user as { account_type?: string }).account_type ?? "personal");
      setAllowFollow((user as { allow_follow?: boolean }).allow_follow ?? false);
    }
  }, [user]);

  const pickAvatar = async (file: File) => {
    setUploading(true);
    setNote(null);
    try {
      const token = localStorage.getItem(FISHMB_TOKEN_KEY);
      // Compress first (HEIC → JPEG, resize if large). Force re-encode to
      // strip malformed EXIF that some photos carry.
      const compressed = await compressImage(file, true);
      // Upload directly to Blob (bypasses serverless body limit).
      const blob = await upload(`fish-avatars/${Date.now()}-${compressed.name}`, compressed, {
        access: "public",
        handleUploadUrl: "/api/fish/photos/upload-url",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      // Verify the uploaded image is actually reachable before saving.
      try {
        const check = await fetch(blob.url, { method: "HEAD" });
        if (!check.ok) throw new Error(`Upload verification failed (${check.status}).`);
      } catch {
        throw new Error("Upload didn't stick — please try again.");
      }
      const updated = await fishFetch("/api/fish/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: blob.url }),
      });
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
        body: JSON.stringify({
          name: name.trim(),
          bio: bio.trim(),
          account_type: accountType,
          allow_follow: allowFollow,
        }),
      });
      await refresh();
      setNote("Profile saved!");
      if (afterSaveHref) {
        setTimeout(() => router.push(afterSaveHref), 600);
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-pine/10 rounded-3xl p-6 space-y-5">
      <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide">
 Settings
      </h2>
      {note && (
        <p className="text-sm text-pine bg-gold/20 border border-gold/50 rounded-2xl px-4 py-3">
          {note}
        </p>
      )}
      <div>
        <label className="bg-pine hover:bg-pine-deep text-white font-bold uppercase tracking-wider text-xs px-5 py-2.5 rounded-full cursor-pointer transition-colors inline-block">
          {uploading ? "Uploading…" : "Change picture"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickAvatar(f);
            }}
          />
        </label>
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
      <div>
        <label className="block text-xs font-bold uppercase tracking-[0.18em] text-pine/55 mb-2">
          Account type
        </label>
        <select
          value={accountType}
          onChange={(e) => setAccountType(e.target.value)}
          className="w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine focus:outline-none focus:border-signal"
        >
          <option value="personal">Personal</option>
          <option value="business">Business</option>
        </select>
        <p className="text-xs text-pine/45 mt-1">
          Business accounts can list a business page and advertise.
        </p>
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-[0.18em] text-pine/55 mb-2">
          Let people follow you
        </label>
        <button
          type="button"
          onClick={() => setAllowFollow((v) => !v)}
          className="w-full flex items-center justify-between bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3"
        >
          <span className="text-sm text-pine text-left">
            When on, anyone viewing your profile can follow you and see your posts in their Friends feed.
          </span>
          <span
            className={`shrink-0 ml-3 w-12 h-7 rounded-full p-1 transition-colors ${
              allowFollow ? "bg-signal" : "bg-pine/15"
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                allowFollow ? "translate-x-5" : ""
              }`}
            />
          </span>
        </button>
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-8 py-3.5 rounded-full disabled:opacity-50 transition-colors"
      >
        {saving ? "Saving…" : "Save profile"}
      </button>
    </div>
  );
}
