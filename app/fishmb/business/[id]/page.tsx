// Public business page — photos, details, contact. Owner can edit inline.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFishAuth } from "../../_components/FishAuth";
import { fishFetch } from "../../_components/fishFetch";
import { FISHMB_TOKEN_KEY } from "@/lib/fishmb-constants";

interface Biz {
  id: string;
  owner_user_id: string;
  name: string;
  description: string;
  photos: string[];
  contact: string;
  website: string | null;
  location: string | null;
  owner_name?: string;
}

export default function BusinessPage({ params }: { params: { id: string } }) {
  const { user } = useFishAuth();
  const [biz, setBiz] = useState<Biz | null>(null);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", contact: "", website: "", location: "" });
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    fishFetch(`/api/fishmb/business/${params.id}`)
      .then((d) => {
        setBiz(d.business);
        setForm({
          name: d.business.name,
          description: d.business.description ?? "",
          contact: d.business.contact ?? "",
          website: d.business.website ?? "",
          location: d.business.location ?? "",
        });
      })
      .catch(() => setMissing(true));
  }, [params.id]);

  if (missing) {
    return <div className="max-w-2xl mx-auto px-4 py-16 text-center text-pine/60">Business not found.</div>;
  }
  if (!biz) {
    return <div className="max-w-2xl mx-auto px-4 py-16 text-center text-pine/60">Loading…</div>;
  }
  const isOwner = user?.id === biz.owner_user_id;

  const uploadAll = async (): Promise<string[]> => {
    const token = localStorage.getItem(FISHMB_TOKEN_KEY);
    const urls: string[] = [];
    for (const f of newFiles) {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/fish/photos/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Upload failed.");
      urls.push(d.url as string);
    }
    return urls;
  };

  const save = async () => {
    setSaving(true);
    setNote(null);
    try {
      const uploaded = await uploadAll();
      const photos = [...(biz.photos ?? []), ...uploaded].slice(0, 8);
      const d = await fishFetch(`/api/fishmb/business/${biz.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, photos }),
      });
      if ((d as { error?: string }).error) throw new Error((d as { error: string }).error);
      setBiz((d as { business: Biz }).business);
      setNewFiles([]);
      setEditing(false);
      setNote("Business page updated!");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine placeholder:text-pine/40 focus:outline-none focus:border-signal";

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 md:py-14">
      <Link href="/fishmb/business" className="text-sm font-bold text-signal uppercase tracking-wider">
        ← All businesses
      </Link>
      {note && <p className="text-sm text-pine bg-gold/20 border border-gold/50 rounded-2xl px-4 py-3 mt-4">{note}</p>}

      {biz.photos?.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-6">
          {biz.photos.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={p} alt={`${biz.name} photo ${i + 1}`} loading="lazy" className="w-full h-40 object-cover rounded-2xl" />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3 mt-6">
        <div>
          <h1 className="font-display font-bold uppercase text-pine text-4xl md:text-5xl tracking-wide">
            {biz.name}
          </h1>
          {biz.location && <p className="text-pine/60 mt-2">📍 {biz.location}</p>}
        </div>
        {isOwner && (
          <button
            onClick={() => setEditing((e) => !e)}
            className="bg-pine hover:bg-pine-deep text-white font-bold uppercase tracking-wider text-xs px-5 py-2.5 rounded-full transition-colors"
          >
            {editing ? "Close editor" : "Edit page"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="bg-white border border-pine/10 rounded-3xl p-6 mt-6 space-y-4">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} placeholder="Business name" className={inputCls} />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} maxLength={2000} placeholder="Description" className={`${inputCls} text-sm resize-none`} />
          <div className="grid sm:grid-cols-2 gap-4">
            <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} maxLength={200} placeholder="Contact" className={inputCls} />
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} maxLength={120} placeholder="Location" className={inputCls} />
          </div>
          <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} maxLength={300} placeholder="Website" className={inputCls} />
          <label className="block bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-sm text-pine/70 cursor-pointer">
            {newFiles.length > 0 ? `📷 ${newFiles.length} new photo(s)` : "📷 Add more photos"}
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setNewFiles(Array.from(e.target.files ?? []))} />
          </label>
          <div className="flex justify-end">
            <button onClick={save} disabled={saving} className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-8 py-3 rounded-full disabled:opacity-40 transition-colors">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 bg-white border border-pine/10 rounded-3xl p-6">
          {biz.description ? (
            <p className="text-pine/80 whitespace-pre-line">{biz.description}</p>
          ) : (
            <p className="text-pine/50 text-sm">No description yet.</p>
          )}
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-5 text-sm">
            {biz.contact && <span className="font-bold text-pine">📞 {biz.contact}</span>}
            {biz.website && (
              <a href={biz.website} target="_blank" rel="noopener noreferrer" className="font-bold text-signal-dark">
                🌐 Website →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
