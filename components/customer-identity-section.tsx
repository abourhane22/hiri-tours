"use client";

import { useState } from "react";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";
import { CountrySelect } from "@/components/country-select";
import { maskPassport } from "@/lib/travelers";
import { documentExpiresSoon } from "@/lib/traveler-identity";
import { formatDateShort } from "@/lib/utils";

const labelCls = "block text-[12px] font-medium text-[#58524A] mb-1.5";
const fieldCls =
  "h-10 w-full rounded-lg border border-[#E0DACF] bg-white px-3 text-sm text-[#1A1F2E] placeholder:text-sand-400 focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors";

export type CustomerIdentityDefaults = {
  nationality: string;
  dateOfBirth: string;
  gender: string;
  idDocumentType: string;
  idDocumentNumber: string;
  idDocumentExpiresOn: string;
};

/**
 * Section « Identité du voyageur » (facultative) de la fiche client — création et
 * modification. Pré-remplit les voyageurs des prochaines réservations (copie).
 * Numéro de pièce masqué par défaut (comme sur les voyageurs) ; alerte si la pièce
 * expire dans moins de 6 mois. Données réservées à l'équipe.
 */
export function CustomerIdentitySection({ defaults, sectionNumber }: { defaults: CustomerIdentityDefaults; sectionNumber: number }) {
  const [docNumber, setDocNumber] = useState(defaults.idDocumentNumber);
  const [revealed, setRevealed] = useState(defaults.idDocumentNumber === "");
  const [expiresOn, setExpiresOn] = useState(defaults.idDocumentExpiresOn);
  const soon = documentExpiresSoon(expiresOn || null);
  const expired = !!expiresOn && new Date(expiresOn + "T00:00:00") < new Date();

  return (
    <section className="bg-white border border-[#E5E0D7] rounded-xl p-4">
      <div className="flex items-center gap-2">
        <span className="size-5 rounded-md bg-[#1A1F2E] text-white text-[11px] font-medium flex items-center justify-center">{sectionNumber}</span>
        <h2 className="font-display text-base text-[#1A1F2E] m-0">Identité du voyageur</h2>
        <span className="text-[11px] text-[#968F84]">facultatif</span>
      </div>
      <p className="mt-1.5 text-[11.5px] text-[#6B6862]">
        Pré-remplit les voyageurs lors des prochaines réservations. Données personnelles : masquées et réservées à l&apos;équipe.
      </p>

      <div className="grid sm:grid-cols-3 gap-4 mt-4">
        <div>
          <label htmlFor="date_of_birth" className={labelCls}>Date de naissance</label>
          <input id="date_of_birth" name="date_of_birth" type="date" max={new Date().toISOString().slice(0, 10)} defaultValue={defaults.dateOfBirth} className={fieldCls} />
        </div>
        <div>
          <label htmlFor="gender" className={labelCls}>Sexe</label>
          <select id="gender" name="gender" defaultValue={defaults.gender} className={fieldCls}>
            <option value="">—</option>
            <option value="m">Homme</option>
            <option value="f">Femme</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Nationalité</label>
          <CountrySelect name="nationality" defaultValue={defaults.nationality} />
        </div>

        <div>
          <label htmlFor="id_document_type" className={labelCls}>Type de pièce</label>
          <select id="id_document_type" name="id_document_type" defaultValue={defaults.idDocumentType} className={fieldCls}>
            <option value="">—</option>
            <option value="passeport">Passeport</option>
            <option value="cin">CIN</option>
          </select>
        </div>
        <div>
          <label htmlFor="id_document_number" className={labelCls}>N° de pièce</label>
          <div className="relative">
            {/* Masqué par défaut : le champ réel reste dans le formulaire, seul l'affichage change. */}
            <input
              id="id_document_number"
              name="id_document_number"
              type={revealed ? "text" : "password"}
              autoComplete="off"
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              className={`${fieldCls} pr-11 font-mono`}
            />
            <button
              type="button"
              onClick={() => setRevealed((r) => !r)}
              aria-label={revealed ? "Masquer le numéro" : "Afficher le numéro"}
              className="absolute right-0 top-0 inline-flex h-10 w-10 items-center justify-center text-[#968F84] hover:text-[#1A1F2E]"
            >
              {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {!revealed && docNumber && <p className="mt-1 font-mono text-[11px] text-[#968F84]">{maskPassport(docNumber)}</p>}
        </div>
        <div>
          <label htmlFor="id_document_expires_on" className={labelCls}>Date d&apos;expiration</label>
          <input id="id_document_expires_on" name="id_document_expires_on" type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={fieldCls} />
          {soon && (
            <p className="mt-1 inline-flex items-start gap-1 text-[11px]" style={{ color: expired ? "#791F1F" : "#B25F0B" }}>
              <AlertTriangle className="size-3.5 shrink-0 mt-px" />
              {expired ? `Pièce expirée le ${formatDateShort(expiresOn)}.` : `Expire le ${formatDateShort(expiresOn)} — moins de 6 mois.`}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
