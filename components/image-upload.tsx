"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Upload, Link as LinkIcon, X, Loader2 } from "lucide-react";

type Mode = "url" | "upload";

type Props = {
  name: string;
  defaultValue?: string | null;
  label?: string;
};

export function ImageUpload({ name, defaultValue, label = "Image principale" }: Props) {
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>("url");
  const [currentUrl, setCurrentUrl] = useState<string>(defaultValue || "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Le fichier doit être une image (JPG, PNG, WEBP...).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("L'image ne doit pas dépasser 5 Mo.");
      return;
    }

    setUploading(true);
    setError(null);

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = `circuits/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("circuit-images")
      .upload(filePath, file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      setError(`Échec upload : ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("circuit-images")
      .getPublicUrl(filePath);

    setCurrentUrl(urlData.publicUrl);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function clearImage() {
    setCurrentUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div>
      <Label>{label}</Label>
      <input type="hidden" name={name} value={currentUrl} />

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setMode("url")}
          className={
            mode === "url"
              ? "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm bg-terracotta-600 text-white"
              : "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm bg-white border border-sand-300 text-sand-700 hover:border-sand-400"
          }
        >
          <LinkIcon className="size-4" /> URL externe
        </button>
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={
            mode === "upload"
              ? "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm bg-terracotta-600 text-white"
              : "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm bg-white border border-sand-300 text-sand-700 hover:border-sand-400"
          }
        >
          <Upload className="size-4" /> Upload fichier
        </button>
      </div>

      {error && (
        <div className="mb-3 p-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded">{error}</div>
      )}

      {mode === "url" ? (
        <Input
          type="url"
          placeholder="https://images.unsplash.com/..."
          value={currentUrl}
          onChange={(e) => setCurrentUrl(e.target.value)}
        />
      ) : (
        <div className="border-2 border-dashed border-sand-300 rounded-md p-4 bg-sand-50">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
            className="block w-full text-sm text-sand-800 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-terracotta-600 file:text-white hover:file:bg-terracotta-700 file:cursor-pointer disabled:opacity-50"
          />
          <p className="text-xs text-sand-600 mt-2">
            JPG, PNG ou WEBP — 5 Mo max. L&apos;image sera stockée dans votre bucket Supabase.
          </p>
          {uploading && (
            <div className="flex items-center gap-2 mt-2 text-sm text-terracotta-700">
              <Loader2 className="size-4 animate-spin" /> Upload en cours...
            </div>
          )}
        </div>
      )}

      {currentUrl && (
        <div className="mt-3 relative">
          <div className="aspect-[5/3] bg-sand-200 rounded-md overflow-hidden border border-sand-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={currentUrl} alt="Aperçu" className="w-full h-full object-cover" />
          </div>
          <button
            type="button"
            onClick={clearImage}
            className="absolute top-2 right-2 size-7 rounded-full bg-white border border-sand-300 hover:bg-red-50 hover:border-red-300 hover:text-red-700 flex items-center justify-center shadow-sm"
            title="Retirer l'image"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
