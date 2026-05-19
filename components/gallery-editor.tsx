"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload, Link as LinkIcon, X, Loader2, Plus } from "lucide-react";

type Props = { name: string; defaultValue?: string[] | null; label?: string };

export function GalleryEditor({ name, defaultValue, label = "Galerie photos" }: Props) {
  const supabase = createClient();
  const [urls, setUrls] = useState<string[]>(defaultValue || []);
  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState<"url" | "upload">("upload");
  const [newUrl, setNewUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function removeAt(index: number) {
    setUrls(urls.filter((_, i) => i !== index));
  }

  function addUrl() {
    const u = newUrl.trim();
    if (!u) return;
    setUrls([...urls, u]);
    setNewUrl("");
    setAdding(false);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Doit être une image."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("5 Mo maximum."); return; }

    setUploading(true); setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = `circuits/gallery/${fileName}`;

    const { error: upErr } = await supabase.storage.from("circuit-images").upload(filePath, file, { cacheControl: "3600", upsert: false });
    if (upErr) { setError(`Échec upload : ${upErr.message}`); setUploading(false); return; }

    const { data: urlData } = supabase.storage.from("circuit-images").getPublicUrl(filePath);
    setUrls([...urls, urlData.publicUrl]);
    setUploading(false);
    setAdding(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div>
      <Label>{label}</Label>
      <input type="hidden" name={name} value={JSON.stringify(urls)} />

      {urls.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-3">
          {urls.map((u, i) => (
            <div key={i} className="relative aspect-square rounded-md overflow-hidden border border-sand-200 bg-sand-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              <button type="button" onClick={() => removeAt(i)} className="absolute top-1 right-1 size-6 rounded-full bg-white border border-sand-300 hover:bg-red-50 hover:border-red-300 hover:text-red-700 flex items-center justify-center shadow-sm">
                <X className="size-3.5" />
              </button>
              <div className="absolute bottom-1 left-1 text-[10px] bg-white/90 px-1.5 py-0.5 rounded">#{i + 1}</div>
            </div>
          ))}
        </div>
      )}

      {error && <div className="mb-2 p-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded">{error}</div>}

      {adding ? (
        <div className="border border-sand-200 rounded-md p-3 bg-sand-50 space-y-3">
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode("upload")} className={mode === "upload" ? "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-sm bg-terracotta-600 text-white" : "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-sm bg-white border border-sand-300 text-sand-700"}>
              <Upload className="size-3.5" /> Upload
            </button>
            <button type="button" onClick={() => setMode("url")} className={mode === "url" ? "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-sm bg-terracotta-600 text-white" : "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-sm bg-white border border-sand-300 text-sand-700"}>
              <LinkIcon className="size-3.5" /> URL externe
            </button>
            <button type="button" onClick={() => { setAdding(false); setNewUrl(""); setError(null); }} className="px-2 py-1.5 text-xs text-sand-700 hover:text-ink">Annuler</button>
          </div>
          {mode === "upload" ? (
            <div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} className="block w-full text-sm text-sand-800 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-terracotta-600 file:text-white hover:file:bg-terracotta-700 file:cursor-pointer disabled:opacity-50" />
              {uploading && <div className="flex items-center gap-2 mt-2 text-sm text-terracotta-700"><Loader2 className="size-4 animate-spin" /> Upload...</div>}
            </div>
          ) : (
            <div className="flex gap-2">
              <Input type="url" placeholder="https://..." value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
              <Button type="button" size="sm" onClick={addUrl} disabled={!newUrl.trim()}>Ajouter</Button>
            </div>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-terracotta-600 hover:bg-sand-100 rounded-md border border-dashed border-sand-300">
          <Plus className="size-4" /> Ajouter une photo
        </button>
      )}
    </div>
  );
}
