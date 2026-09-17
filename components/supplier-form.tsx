"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Check, Plus, Trash2 } from "lucide-react";
import { AlertBanner } from "@/components/ui/alert-banner";
import { SUPPLIER_TYPES, PAYMENT_TERMS_OPTIONS } from "@/lib/purchasing";
import type { AchatActionState } from "@/app/admin/fournisseurs/actions";
import type { SupplierContact } from "@/lib/types";

const labelCls = "block text-[12px] font-medium text-[#58524A] mb-1.5";
const fieldCls =
  "h-10 w-full rounded-lg border border-[#E0DACF] bg-white px-3 text-sm text-[#1A1F2E] placeholder:text-sand-400 focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors";

export type SupplierFormDefaults = {
  name: string;
  legalName: string;
  supplierType: string;
  ice: string;
  ifNumber: string;
  rc: string;
  addressLine: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  contacts: SupplierContact[];
  paymentTerms: string;
  defaultCurrency: string;
  isActive: boolean;
  notes: string;
};

type Action = (prev: AchatActionState, fd: FormData) => Promise<AchatActionState>;

export function SupplierForm({
  mode,
  action,
  defaults,
  cancelHref,
}: {
  mode: "create" | "edit";
  action: Action;
  defaults: SupplierFormDefaults;
  cancelHref: string;
}) {
  const [state, formAction, isPending] = useActionState<AchatActionState, FormData>(action, { ok: true });
  const [contacts, setContacts] = useState<SupplierContact[]>(defaults.contacts ?? []);

  function updateContact(i: number, patch: Partial<SupplierContact>) {
    setContacts((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.ok === false && <AlertBanner tone="error" message={state.error} />}
      {state.ok && state.savedAt && <AlertBanner tone="success" message="Fournisseur enregistré." />}

      {/* Contacts sérialisés pour la server action */}
      <input type="hidden" name="contacts" value={JSON.stringify(contacts.filter((c) => c.name?.trim()))} />

      {/* Section 1 — Identité */}
      <section className="bg-white border border-[#E5E0D7] rounded-xl p-4">
        <SectionHeader n={1} title="Identité" />
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label htmlFor="name" className={labelCls}>
              Nom commercial <span className="text-red-600">*</span>
            </label>
            <input id="name" name="name" required defaultValue={defaults.name} className={fieldCls} placeholder="Riad Dar Amal" />
          </div>
          <div>
            <label htmlFor="legal_name" className={labelCls}>Raison sociale</label>
            <input id="legal_name" name="legal_name" defaultValue={defaults.legalName} className={fieldCls} />
          </div>
          <div>
            <label htmlFor="supplier_type" className={labelCls}>
              Type <span className="text-red-600">*</span>
            </label>
            <select id="supplier_type" name="supplier_type" required defaultValue={defaults.supplierType} className={fieldCls}>
              {SUPPLIER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end pb-2">
            <label className="inline-flex items-center gap-2 text-[13px] text-[#1A1F2E]">
              <input type="checkbox" name="is_active" defaultChecked={defaults.isActive} className="size-4 rounded border-[#E0DACF]" />
              Fournisseur actif
            </label>
          </div>
        </div>
      </section>

      {/* Section 2 — Identifiants légaux */}
      <section className="bg-white border border-[#E5E0D7] rounded-xl p-4">
        <SectionHeader n={2} title="Identifiants légaux" />
        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          <div>
            <label htmlFor="ice" className={labelCls}>ICE</label>
            <input id="ice" name="ice" defaultValue={defaults.ice} className={fieldCls} placeholder="000XXXXXX000XXX" />
          </div>
          <div>
            <label htmlFor="if_number" className={labelCls}>IF</label>
            <input id="if_number" name="if_number" defaultValue={defaults.ifNumber} className={fieldCls} />
          </div>
          <div>
            <label htmlFor="rc" className={labelCls}>RC</label>
            <input id="rc" name="rc" defaultValue={defaults.rc} className={fieldCls} />
          </div>
        </div>
      </section>

      {/* Section 3 — Coordonnées */}
      <section className="bg-white border border-[#E5E0D7] rounded-xl p-4">
        <SectionHeader n={3} title="Coordonnées" />
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div className="sm:col-span-2">
            <label htmlFor="address_line" className={labelCls}>Adresse</label>
            <input id="address_line" name="address_line" defaultValue={defaults.addressLine} className={fieldCls} />
          </div>
          <div>
            <label htmlFor="city" className={labelCls}>Ville</label>
            <input id="city" name="city" defaultValue={defaults.city} className={fieldCls} />
          </div>
          <div>
            <label htmlFor="country" className={labelCls}>Pays</label>
            <input id="country" name="country" defaultValue={defaults.country} className={fieldCls} />
          </div>
          <div>
            <label htmlFor="phone" className={labelCls}>Téléphone</label>
            <input id="phone" name="phone" type="tel" defaultValue={defaults.phone} className={fieldCls} />
          </div>
          <div>
            <label htmlFor="email" className={labelCls}>Email</label>
            <input id="email" name="email" type="email" defaultValue={defaults.email} className={fieldCls} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="website" className={labelCls}>Site web</label>
            <input id="website" name="website" defaultValue={defaults.website} className={fieldCls} />
          </div>
        </div>

        {/* Contacts multiples */}
        <div className="mt-5 pt-4 border-t border-[#F1EDE5]">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <span className="text-[11px] uppercase tracking-wide text-[#968F84] font-medium">Interlocuteurs</span>
            <button
              type="button"
              onClick={() => setContacts((cs) => [...cs, { name: "", role: "", phone: "", email: "" }])}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E0DACF] bg-white px-2.5 text-[12px] font-medium text-[#1A1F2E] hover:bg-[#FBF9F5] transition-colors"
            >
              <Plus className="size-3.5" /> Ajouter
            </button>
          </div>
          {contacts.length === 0 ? (
            <p className="text-[12px] text-[#968F84] italic">Aucun interlocuteur enregistré.</p>
          ) : (
            <div className="space-y-2">
              {contacts.map((c, i) => (
                <div key={i} className="grid sm:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center">
                  <input value={c.name ?? ""} onChange={(e) => updateContact(i, { name: e.target.value })} placeholder="Nom" className={`${fieldCls} h-9 text-[13px]`} />
                  <input value={c.role ?? ""} onChange={(e) => updateContact(i, { role: e.target.value })} placeholder="Fonction" className={`${fieldCls} h-9 text-[13px]`} />
                  <input value={c.phone ?? ""} onChange={(e) => updateContact(i, { phone: e.target.value })} placeholder="Téléphone" className={`${fieldCls} h-9 text-[13px]`} />
                  <input value={c.email ?? ""} onChange={(e) => updateContact(i, { email: e.target.value })} placeholder="Email" className={`${fieldCls} h-9 text-[13px]`} />
                  <button
                    type="button"
                    onClick={() => setContacts((cs) => cs.filter((_, j) => j !== i))}
                    aria-label="Retirer cet interlocuteur"
                    className="inline-flex items-center justify-center size-8 rounded-md border border-[#E5E0D7] bg-white text-[#6B6862] hover:text-[#791F1F] hover:bg-[#FCEBEB] hover:border-[#F7C1C1] transition-colors"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Section 4 — Conditions et notes */}
      <section className="bg-white border border-[#E5E0D7] rounded-xl p-4">
        <SectionHeader n={4} title="Conditions commerciales par défaut" />
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label htmlFor="payment_terms" className={labelCls}>
              Conditions de paiement <span className="text-red-600">*</span>
            </label>
            <select id="payment_terms" name="payment_terms" required defaultValue={defaults.paymentTerms} className={fieldCls}>
              {PAYMENT_TERMS_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] text-[#968F84]">Valeur par défaut ; chaque contrat peut préciser son propre échéancier.</p>
          </div>
          <div>
            <label htmlFor="default_currency" className={labelCls}>Devise par défaut</label>
            <input id="default_currency" name="default_currency" defaultValue={defaults.defaultCurrency} className={fieldCls} placeholder="MAD" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="notes" className={labelCls}>Notes internes</label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={defaults.notes}
              className="w-full rounded-lg border border-[#E0DACF] bg-white px-3 py-2 text-sm text-[#1A1F2E] placeholder:text-sand-400 focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors"
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <Link
          href={cancelHref}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-[#E0DACF] bg-white px-4 text-sm font-medium text-[#1A1F2E] hover:bg-sand-50 transition-colors"
        >
          Annuler
        </Link>
        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#1A1F2E] px-4 text-sm font-medium text-white transition-colors hover:bg-[#2A3142] disabled:opacity-60"
        >
          <Check className="size-4" />
          {isPending ? "Enregistrement…" : mode === "create" ? "Créer le fournisseur" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

function SectionHeader({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-5 rounded-md bg-[#1A1F2E] text-white text-[11px] font-medium flex items-center justify-center">{n}</span>
      <h2 className="font-display text-base text-[#1A1F2E] m-0">{title}</h2>
    </div>
  );
}
