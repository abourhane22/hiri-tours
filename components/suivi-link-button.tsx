"use client";

import { useState } from "react";
import { LinkIcon, Check, Copy } from "lucide-react";

/**
 * Bouton discret « Lien de suivi client » : révèle le lien de suivi
 * (déjà généré côté serveur) et permet de le copier.
 */
export function SuiviLinkButton({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const btn =
    "inline-flex items-center gap-1.5 rounded-lg border border-[#E5E0D7] bg-white text-[12.5px] font-medium px-3.5 py-2 text-[#1A1F2E] hover:bg-[#FAF5F0] transition-colors";

  return (
    <div className="inline-flex flex-col items-start gap-2">
      <button type="button" onClick={() => setOpen((o) => !o)} className={btn}>
        <LinkIcon className="size-4" /> Lien de suivi client
      </button>
      {open && (
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="w-[240px] rounded-md border border-[#E0DACF] bg-white px-2.5 py-1.5 text-[12px] font-mono text-[#1A1F2E]"
          />
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#1A1F2E] px-2.5 py-1.5 text-[12px] font-medium text-white hover:bg-[#2A3142]"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copié" : "Copier"}
          </button>
        </div>
      )}
    </div>
  );
}
