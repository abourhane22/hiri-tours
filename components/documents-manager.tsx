"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input, Label } from "@/components/ui/input";
import { X, Loader2, FileText, Download } from "lucide-react";

type Doc = { name: string; url: string; uploaded_at: string };
type Props = { name: string; defaultValue?: Doc[] | null; bucket?: string; label?: string };

export function DocumentsManager({ name, defaultValue, bucket = "staff-documents", label = "Documents" }: Props) {
  const supabase = createClient();
  const [docs, setDocs] = useState<Doc[]>(defaultValue || []);
  const [uploading, setUploading] = useState(false);
  const [docName, setDocName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function removeAt(index: number) {
    setDocs(docs.filter((_, i) => i !== index));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!docName.trim()) {
      setError("Veuillez d'abord saisir le nom du document avant de choisir un fichier.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Le fichier ne doit pas dépasser 10 Mo.");
      return;
    }

    setUploading(true);
    setError(null);

    const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const filePath = `documents/${fileName}`;

    const { error: upErr } = await supabase.storage.from(bucket).upload(filePath, file, { cacheControl: "3600", upsert: false });
    if (upErr) {
      setError(`Échec upload : ${upErr.message}`);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
    setDocs([...docs, { name: docName.trim(), url: urlData.publicUrl, uploaded_at: new Date().toISOString() }]);
    setDocName("");
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
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

      <div className="border border-dashed border-sand-300 rounded-md p-3 bg-sand-50 space-y-2">
        <Input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="Nom du document (CIN, Permis, Diplôme...)" disabled={uploading} />
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFileChange} disabled={uploading || !docName.trim()}
          className="block w-full text-sm text-sand-800 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-terracotta-600 file:text-white hover:file:bg-terracotta-700 file:cursor-pointer disabled:opacity-50" />
        {uploading && <div className="flex items-center gap-2 text-sm text-terracotta-700"><Loader2 className="size-4 animate-spin" /> Upload en cours...</div>}
        <p className="text-xs text-sand-600">Saisissez d&apos;abord le nom du document, puis choisissez le fichier. Formats : PDF, JPG, PNG, WEBP — 10 Mo max.</p>
      </div>
    </div>
  );
}
