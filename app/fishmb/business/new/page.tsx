// Create your business page (business accounts only).

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFishAuth } from "../../_components/FishAuth";
import { fishFetch } from "../../_components/fishFetch";
import { compressImage } from "../../_components/compressImage";
import { FISHMB_TOKEN_KEY } from "@/lib/fishmb-constants";

export default function NewBusinessPage() {
  const { user, openLogin } = useFishAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const isBusiness = (user as { account_type?: string } | null)?.account_type === "business";

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <p className="text-pine/60 mb-6">Log in to list your business.</p>
        <button onClick={openLogin} className="bg-signal text-white font-bold uppercase tracking-wider text-sm px-8 py-3.5 rounded-full">
          Log in
        </button>
      </div>
    );
  }
  if (!isBusiness) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display font-bold uppercase text-pine text-3xl mb-4">Business accounts only</h1>
        <p className="text-pine/60">Switch your account type to Business in your profile to list a business.</p>
      </div>
    );
  }

  const uploadAll = async (): Promise<string[]> => {
    const token = localStorage.getItem(FISHMB_TOKEN_KEY);
    const urls: string[] = [];
    for (const f of files.slice(0, 8)) {
      const form = new FormData();
      form.append("file", await compressImage(f));
      const res = await fetch("/api/fish/photos/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Upload failed.");
      urls.push(d.url as string);
    }
    return urls;
  };

  const submit = async () => {
    if (!name.trim() || !contact.trim() || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const photos = await uploadAll();
      const d = await fishFetch("/api/fishmb/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          contact: contact.trim(),
          website: website.trim() || null,
          location: location.trim() || null,
          photos,
        }),
      });
      if ((d as { error?: string }).error) throw new Error((d as { error: string }).error);
      router.push(`/fishmb/business/${(d as { business: { id: string } }).business.id}`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not create your page.");
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal";

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 md:py-14">
      <h1 className="font-display font-bold uppercase text-pine text-4xl tracking-wide mb-2">
        List your business
      </h1>
      <p className="text-pine/60 text-sm mb-8">Your own page on FishMB — photos, details, contact info. Free.</p>
      {note && <p className="text-sm text-signal-dark bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-6">{note}</p>}
      <div className="bg-white border border-pine/10 rounded-3xl p-6 space-y-4">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Business name *" className={inputCls} />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={2000} placeholder="What do you do? (fishing trips, tackle, lodging…)" className={`${inputCls} text-sm resize-none`} />
        <div className="grid sm:grid-cols-2 gap-4">
          <input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={200} placeholder="Contact — phone or email *" className={inputCls} />
          <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} placeholder="Location (e.g. Selkirk, MB)" className={inputCls} />
        </div>
        <input value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={300} placeholder="Website (https://…)" className={inputCls} />
        <label className="block bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-sm text-pine/70 cursor-pointer">
 {files.length > 0 ? ` ${files.length} photo(s) selected` : " Add photos (up to 8)"}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 8))}
          />
        </label>
        <div className="flex justify-end">
          <button
            onClick={submit}
            disabled={busy || !name.trim() || !contact.trim()}
            className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-8 py-3.5 rounded-full disabled:opacity-40 transition-colors"
          >
            {busy ? "Creating…" : "Create business page"}
          </button>
        </div>
      </div>
    </div>
  );
}
