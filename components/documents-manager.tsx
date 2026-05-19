"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Loader2, FileText, Download, Upload } from "lucide-react";

type Doc = { name: string; url: string; uploaded_at: string };
type Props = { name: string; defaultValue?: Doc[] | null; bucket?: string; label?: string };

export function DocumentsManager({ name, defaultValue, bucket = "staff-documents", label = "Documents" }: Props) {
  const supabase = createClient();
  const [docs, setDocs] = useState<Doc[]>(defaultValue || []);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [docName, setDocName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function removeAt(index: number) {
    setDocs(docs.filter((_, i) => i !== index));
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Le fichier ne doit pas dépasser 10 Mo.");
      e.target.value = "";
      return;
    }
    setError(null);
    setPendingFile(file);
    const nameWithoutExt = file.name.replace(/\.[^.]+$/, "");
    setDocName(nameWithoutExt);
  }

  function cancelPending() {
    setPendingFile(null);
    setDocName("");
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function confirmUpload() {
    if (!pendingFile || !docName.trim()) return;
    setUploading(true);
    setError(null);

    const ext = pendingFile.name.split(".").pop()?.toLowerCase() || "pdf";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const filePath = `documents/${fileName}`;

    const { error: upErr } = await supabase.storage.from(bucket).upload(filePath, pendingFile, { cacheControl: "3600", upsert: false });
    if (upErr) {
      setError(`Échec upload : ${upErr.message}`);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
    setDocs([...docs, { name: docName.trim(), url: urlData.publicUrl, uploaded_at: new Date().toISOString() }]);
    setUploading(false);
    cancelPending();
  }

  return (
    <div>
      <Label>{label}</Label>
      <input type="hidden" name={name} value={JSON.stringify(docs)} />

      {docs.length > 0 && (
        <div className="space-y-2 mb-3">
          {docs.map((doc, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-sand-50 border border-sand-200 rounded">
              <FileText className="size-4 text-sand-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-ink truncate">{doc.name}</div>
                <div className="text-xs text-sand-600">{new Date(doc.uploaded_at).toLocaleDateString("fr-FR")}</div>
              </div>
              <a href={doc.url} target="_blank" rel="noopener noreferrer" className="size-7 rounded border border-sand-300 hover:bg-sand-100 flex items-center justify-center" title="Télécharger / consulter">
                <Download className="size-3.5 text-sand-700" />
              </a>
              <button type="button" onClick={() => removeAt(i)} className="size-7 rounded border border-red-200 text-red-700 hover:bg-red-50 flex items-center justify-center" title="Retirer">
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <div className="mb-2 p-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded">{error}</div>}

      {pendingFile ? (
        <div className="border border-sand-300 rounded-md p-3 bg-sand-50 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-sand-600 shrink-0" />
            <span className="text-sm text-ink truncate flex-1">{pendingFile.name}</span>
            <span className="text-xs text-sand-600 shrink-0">{(pendingFile.size / 1024).toFixed(0)} Ko</span>
          </div>
          <div>
            <Label htmlFor={`${name}-doc-name`}>Nom du document *</Label>
            <Input id={`${name}-doc-name`} value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="Carte grise, Assurance, Visite technique..." disabled={uploading} autoFocus />
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={confirmUpload} disabled={!docName.trim() || uploading}>
              {uploading ? (<><Loader2 className="size-3.5 animate-spin" /> Upload...</>) : "Confirmer l'ajout"}
            </Button>
            <button type="button" onClick={cancelPending} disabled={uploading} className="px-3 py-1.5 text-sm text-sand-700 hover:text-ink disabled:opacity-50">Annuler</button>
          </div>
        </div>
      ) : (
        <div className="border border-dashed border-sand-300 rounded-md p-4 bg-sand-50 text-center">
          <label htmlFor={`${name}-file`} className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 text-sm bg-terracotta-600 text-white rounded hover:bg-terracotta-700">
            <Upload className="size-4" /> Choisir un fichier
          </label>
          <input ref={fileRef} id={`${name}-file`} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFileSelect} className="hidden" />
          <p className="text-xs text-sand-600 mt-2">PDF, JPG, PNG ou WEBP — 10 Mo max</p>
        </div>
      )}
    </div>
  );
}
