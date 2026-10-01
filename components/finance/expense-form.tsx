"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Briefcase, Map as MapIcon, Truck, Building2, Check, Loader2, Upload, FileText, X, Camera, Trash2, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatMAD, formatDateShort } from "@/lib/utils";
import { margin, variance, realCost, marginTone, varianceTone, formatPct, hasMainCostExpense, realMarginState, MARGIN_TONE_STYLE } from "@/lib/margin";
import {
  ATTACHMENTS,
  ATTACHMENT_META,
  EXPENSE_HELP,
  EXPENSE_PAYMENT_METHODS,
  IMPACT_TEXT,
  RECEIPT_BUCKET,
  RECEIPT_MAX_BYTES,
  RECEIPT_TYPES,
  WHICH_ATTACHMENT,
  type ExpenseAttachment,
} from "@/lib/expenses";
import { useActionFeedback, useToast } from "@/components/ui/toaster";
import {
  deleteExpense,
  loadDossierImpact,
  receiptUrl,
  saveExpense,
  searchDossiers,
  type DossierImpact,
  type DossierOption,
  type ExpenseFormState,
} from "@/app/admin/finance/depenses/actions";

export type ExpenseCategoryOption = { id: string; name: string; type: string; description: string | null; main_cost_for?: string[] };
export type ExpenseOption = { id: string; label: string };

export type ExpenseFormInitial = {
  id: string;
  description: string;
  category_id: string;
  amount_mad: string;
  expense_date: string;
  payment_method: string;
  attachment: ExpenseAttachment;
  dossier: DossierOption | null;
  circuit_id: string;
  vehicle_id: string;
  receipt_path: string | null;
  notes: string;
};

const label = "block text-[12.5px] font-medium text-[#1A1F2E] mb-1.5";
const field =
  "h-11 w-full rounded-lg border border-[#E0DACF] bg-white px-3 text-[14px] text-[#1A1F2E] placeholder:text-[#B4AEA3] focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10";
const help = "mt-1.5 text-[11.5px] leading-snug text-[#6B6862]";
const ICON: Record<ExpenseAttachment, typeof Briefcase> = { dossier: Briefcase, produit: MapIcon, vehicule: Truck, general: Building2 };

const newId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`);

export function ExpenseForm({
  mode,
  initial,
  categories,
  circuits,
  vehicles,
  returnTo,
}: {
  mode: "create" | "edit";
  initial: ExpenseFormInitial;
  categories: ExpenseCategoryOption[];
  circuits: ExpenseOption[];
  vehicles: ExpenseOption[];
  returnTo: string;
}) {
  const toast = useToast();
  const [state, formAction, isPending] = useActionState<ExpenseFormState, FormData>(saveExpense, { ok: true });
  useActionFeedback(state, null);
  const formRef = useRef<HTMLFormElement>(null);
  const againRef = useRef<HTMLInputElement>(null);

  // Identité de la saisie : régénérée après « Enregistrer et en saisir une autre ».
  const [expenseId, setExpenseId] = useState(initial.id);
  const [formKey, setFormKey] = useState(0);

  const [categoryId, setCategoryId] = useState(initial.category_id);
  const [amount, setAmount] = useState(initial.amount_mad);
  const [expenseDate, setExpenseDate] = useState(initial.expense_date);
  const [attachment, setAttachment] = useState<ExpenseAttachment>(initial.attachment);
  const [dossier, setDossier] = useState<DossierOption | null>(initial.dossier);
  const [circuitId, setCircuitId] = useState(initial.circuit_id);
  const [vehicleId, setVehicleId] = useState(initial.vehicle_id);
  const [receiptPath, setReceiptPath] = useState<string | null>(initial.receipt_path);

  const category = categories.find((c) => c.id === categoryId) ?? null;

  // « Enregistrer et en saisir une autre » : on garde catégorie, date et rattachement.
  useEffect(() => {
    if (state.ok === true && state.again) {
      setExpenseId(newId());
      setAmount("");
      setReceiptPath(null);
      setFormKey((k) => k + 1);
      if (againRef.current) againRef.current.value = "";
    }
  }, [state]);

  return (
    <form key={formKey} ref={formRef} action={formAction} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="id" value={expenseId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <input type="hidden" name="attachment" value={attachment} />
      <input type="hidden" name="reservation_id" value={attachment === "dossier" ? dossier?.id ?? "" : ""} />
      <input type="hidden" name="receipt_path" value={receiptPath ?? ""} />
      <input ref={againRef} type="hidden" name="again" defaultValue="" />

      <div className="space-y-4 min-w-0">
        {/* 1. Nature */}
        <Section n={1} title="Nature de la dépense">
          <div>
            <label htmlFor="description" className={label}>Libellé <span className="text-[#C84B31]">*</span></label>
            <input id="description" name="description" required defaultValue={mode === "edit" ? initial.description : ""} className={field} placeholder="Carburant Sprinter — semaine 39" />
            <p className={help}>{EXPENSE_HELP.label}</p>
          </div>
          <div>
            <div>
              <label htmlFor="category_id" className={label}>Catégorie <span className="text-[#C84B31]">*</span></label>
              <select id="category_id" name="category_id" required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={field}>
                <option value="">— Choisir —</option>
                <optgroup label="Coûts directs">
                  {categories.filter((c) => c.type === "direct").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
                <optgroup label="Frais généraux">
                  {categories.filter((c) => c.type !== "direct").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              </select>
              <p className={help} aria-live="polite">{category?.description || "Choisissez la catégorie : sa définition s'affiche ici."}</p>
            </div>
          </div>
        </Section>

        {/* 2. Montant et date */}
        <Section n={2} title="Montant et date">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="amount_mad" className={label}>Montant TTC (MAD) <span className="text-[#C84B31]">*</span></label>
              <input id="amount_mad" name="amount_mad" type="number" inputMode="decimal" min="0.01" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className={`${field} tabular-nums`} />
              <p className={help}>{EXPENSE_HELP.amount}</p>
            </div>
            <div>
              <label htmlFor="expense_date" className={label}>Date de la dépense <span className="text-[#C84B31]">*</span></label>
              <input id="expense_date" name="expense_date" type="date" required value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className={field} />
              <p className={help}>{EXPENSE_HELP.date}</p>
            </div>
            <div>
              <label htmlFor="payment_method" className={label}>Payée par</label>
              <select id="payment_method" name="payment_method" defaultValue={initial.payment_method} className={field}>
                <option value="">—</option>
                {EXPENSE_PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <p className={help}>{EXPENSE_HELP.paidBy}</p>
            </div>
          </div>
        </Section>

        {/* 3. Pour qui ? */}
        <Section n={3} title="Pour qui ?" required>
          <p className="-mt-1 text-[12.5px] text-[#58524A]">{EXPENSE_HELP.forWhom}</p>
          <div role="radiogroup" aria-label="Rattachement" className="grid grid-cols-2 gap-2 lg:grid-cols-4" data-name="attachment">
            {ATTACHMENTS.map((a) => {
              const Icon = ICON[a];
              const active = attachment === a;
              return (
                <button
                  key={a}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setAttachment(a)}
                  className={`min-h-[44px] rounded-xl border p-3 text-left transition-colors ${active ? "border-[#1A1F2E] bg-[#1A1F2E] text-white" : "border-[#E0DACF] bg-white text-[#1A1F2E] hover:border-[#C9C4BA]"}`}
                >
                  <span className="flex items-center gap-1.5 text-[13.5px] font-medium">
                    <Icon className="size-4" /> {ATTACHMENT_META[a].label}
                    {active && <Check className="ml-auto size-4" />}
                  </span>
                  <span className={`mt-1 block text-[11.5px] leading-snug ${active ? "text-white/80" : "text-[#6B6862]"}`}>{ATTACHMENT_META[a].card}</span>
                </button>
              );
            })}
          </div>

          {attachment === "dossier" && <DossierPicker value={dossier} onChange={setDossier} />}
          {attachment === "produit" && (
            <div>
              <label htmlFor="circuit_id" className={label}>Produit <span className="text-[#C84B31]">*</span></label>
              <select id="circuit_id" name="circuit_id" value={circuitId} onChange={(e) => setCircuitId(e.target.value)} className={field}>
                <option value="">— Choisir —</option>
                {circuits.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <p className={help}>{ATTACHMENT_META.produit.help}</p>
            </div>
          )}
          {attachment === "vehicule" && (
            <div>
              <VehicleSelect vehicles={vehicles} value={vehicleId} onChange={setVehicleId} />
              <p className={help}>{ATTACHMENT_META.vehicule.help}</p>
            </div>
          )}
          {attachment === "general" && <p className="rounded-lg bg-[#FBF9F5] px-3 py-2.5 text-[12.5px] text-[#58524A]">{ATTACHMENT_META.general.help}</p>}
        </Section>

        {/* 4. Justificatif et notes */}
        <Section n={4} title="Justificatif et notes">
          <ReceiptField expenseId={expenseId} value={receiptPath} onChange={setReceiptPath} />
          <div>
            <label htmlFor="notes" className={label}>Notes internes</label>
            <textarea id="notes" name="notes" rows={3} defaultValue={mode === "edit" ? initial.notes : ""} placeholder={EXPENSE_HELP.notesPlaceholder} className="w-full rounded-lg border border-[#E0DACF] bg-white px-3 py-2 text-[14px] text-[#1A1F2E] placeholder:text-[#B4AEA3] focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10" />
          </div>
        </Section>

        {/* Boutons */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Link href={returnTo} className="inline-flex h-11 items-center justify-center rounded-lg px-4 text-[13.5px] font-medium text-[#58524A] hover:bg-[#F1EFE8]">
            Annuler
          </Link>
          <button
            type="submit"
            disabled={isPending}
            onClick={() => againRef.current && (againRef.current.value = "1")}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-[#E0DACF] bg-white px-4 text-[13.5px] font-medium text-[#1A1F2E] hover:bg-[#FAF5F0] disabled:opacity-60"
          >
            {isPending ? "Enregistrement…" : "Enregistrer et en saisir une autre"}
          </button>
          <button
            type="submit"
            disabled={isPending}
            aria-busy={isPending}
            onClick={() => againRef.current && (againRef.current.value = "")}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-[#1A1F2E] px-5 text-[13.5px] font-medium text-white hover:bg-[#2A3142] disabled:opacity-60"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {isPending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>

        {mode === "edit" && <DeleteZone expenseId={expenseId} returnTo={returnTo} onError={(m) => toast.error(m)} />}
      </div>

      {/* Panneau latéral */}
      <aside className="space-y-4 lg:sticky lg:top-20">
        <ImpactPanel
          attachment={attachment}
          dossier={attachment === "dossier" ? dossier : null}
          productName={circuits.find((c) => c.id === circuitId)?.label ?? null}
          vehicleName={vehicles.find((v) => v.id === vehicleId)?.label ?? null}
          amount={Number(String(amount).replace(",", ".")) || 0}
          excludeId={mode === "edit" ? initial.id : undefined}
          categoryMainCostFor={category?.main_cost_for ?? []}
        />
        <div className="rounded-xl border border-[#E5E0D7] bg-white p-4">
          <p className="text-[10.5px] font-medium uppercase tracking-[1.4px] text-[#968F84]">Quel rattachement choisir ?</p>
          <ul className="mt-2 space-y-2 text-[12.5px] text-[#58524A]">
            {WHICH_ATTACHMENT.map((w) => (
              <li key={w.target} className="leading-snug">
                {w.text} → <span className="font-medium text-[#1A1F2E]">{w.target}</span>.
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </form>
  );
}

function Section({ n, title, required, children }: { n: number; title: string; required?: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#E5E0D7] bg-white p-4 sm:p-5 space-y-4">
      <h2 className="flex items-center gap-2 m-0">
        <span className="flex size-6 items-center justify-center rounded-md bg-[#1A1F2E] text-[12px] font-semibold text-white">{n}</span>
        <span className="font-display text-[17px] tracking-[-0.02em] text-[#1A1F2E]">
          {title}
          {required && <span className="text-[#C84B31]"> *</span>}
        </span>
      </h2>
      {children}
    </section>
  );
}

function VehicleSelect({ vehicles, value, onChange }: { vehicles: ExpenseOption[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor="vehicle_id" className={label}>Véhicule <span className="text-[#C84B31]">*</span></label>
      <select id="vehicle_id" name="vehicle_id" value={value} onChange={(e) => onChange(e.target.value)} className={field}>
        <option value="">— Choisir —</option>
        {vehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
      </select>
    </div>
  );
}

function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function DossierPicker({ value, onChange }: { value: DossierOption | null; onChange: (d: DossierOption | null) => void }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [results, setResults] = useState<DossierOption[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (value || dq.trim().length < 2) return setResults([]);
    let live = true;
    setLoading(true);
    searchDossiers(dq).then((r) => live && setResults(r)).finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [dq, value]);

  if (value) {
    return (
      <div className="rounded-lg border border-[#A9DFCC] bg-[#E1F5EE] px-3 py-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 text-[13px]">
            <p className="font-medium text-[#1A1F2E]">
              <span className="font-mono">{value.reference}</span> · {value.customer ?? "—"}
              {value.status === "cancelled" && <span className="ml-1.5 rounded-full bg-[#FCEBEB] px-2 py-0.5 text-[11px] text-[#791F1F]">annulé</span>}
            </p>
            <p className="text-[12px] text-[#085041]">
              {value.product ?? "Produit"} · départ {formatDateShort(value.departure_date)} · {value.pax} pax
            </p>
          </div>
          <button type="button" onClick={() => onChange(null)} className="h-11 shrink-0 px-2 text-[12.5px] font-medium text-[#085041] hover:underline">
            Changer
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="relative">
      <label htmlFor="dossier_search" className={label}>Dossier <span className="text-[#C84B31]">*</span></label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#968F84]" />
        <input id="dossier_search" name="dossier_search" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" placeholder="HT-2026-… ou nom du client" className={`${field} pl-9`} />
        {loading && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-[#968F84]" />}
      </div>
      <p className={help}>{ATTACHMENT_META.dossier.help}</p>
      {results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-[#E5E0D7] bg-white shadow-lg">
          {results.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => onChange(r)} className="flex min-h-[44px] w-full flex-col items-start px-3 py-2 text-left hover:bg-[#FBF9F5]">
                <span className="text-[13px] text-[#1A1F2E]"><span className="font-mono">{r.reference}</span> · {r.customer ?? "—"}</span>
                <span className="text-[11.5px] text-[#6B6862]">{r.product ?? "Produit"} · {formatDateShort(r.departure_date)} · {r.pax} pax</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!loading && dq.trim().length >= 2 && results.length === 0 && <p className="mt-1 text-[12px] text-[#968F84]">Aucun dossier actif ne correspond.</p>}
    </div>
  );
}

function ReceiptField({ expenseId, value, onChange }: { expenseId: string; value: string | null; onChange: (p: string | null) => void }) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{ url: string; isImage: boolean; name: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const pickRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  // Justificatif existant : aperçu par URL signée (bucket privé).
  useEffect(() => {
    if (!value || preview) return;
    let live = true;
    receiptUrl(value).then((r) => {
      if (live && r.ok) setPreview({ url: r.url, isImage: !/\.pdf$/i.test(value), name: value.split("/").pop() ?? "justificatif" });
    });
    return () => {
      live = false;
    };
  }, [value, preview]);

  async function upload(file: File) {
    if (!RECEIPT_TYPES.includes(file.type)) return void toast.error("Format refusé : PDF, JPG, PNG ou WEBP uniquement.", "receipt");
    if (file.size > RECEIPT_MAX_BYTES) return void toast.error("Fichier trop lourd : 10 Mo maximum.", "receipt");
    setUploading(true);
    const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1].replace("jpeg", "jpg");
    const base = file.name.replace(/\.[^.]+$/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 60) || "justificatif";
    const path = `${expenseId}/${Date.now()}-${base}.${ext}`;
    const { error } = await createClient().storage.from(RECEIPT_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    setUploading(false);
    if (error) return void toast.error(`Justificatif non envoyé : ${error.message}`, "receipt");
    setPreview({ url: URL.createObjectURL(file), isImage: file.type.startsWith("image/"), name: file.name });
    onChange(path);
    toast.success("Justificatif joint — il sera conservé à l'enregistrement");
  }

  function onFiles(files: FileList | null) {
    const f = files?.[0];
    if (f) void upload(f);
  }

  return (
    <div>
      <span className={label}>Justificatif</span>
      {value && preview ? (
        <div className="flex items-center gap-3 rounded-lg border border-[#E5E0D7] bg-[#FBF9F5] p-2.5">
          {preview.isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.url} alt="Aperçu du justificatif" className="size-16 shrink-0 rounded-md object-cover" />
          ) : (
            <span className="flex size-16 shrink-0 items-center justify-center rounded-md bg-white text-[#C84B31]"><FileText className="size-7" /></span>
          )}
          <div className="min-w-0 flex-1">
            <a href={preview.url} target="_blank" rel="noreferrer" className="block truncate text-[13px] font-medium text-[#0C6B8A] hover:underline">{preview.name}</a>
            <div className="mt-1 flex gap-1">
              <button type="button" onClick={() => pickRef.current?.click()} className="h-11 rounded-md px-2 text-[12.5px] font-medium text-[#1A1F2E] hover:bg-white">Remplacer</button>
              <button type="button" onClick={() => { onChange(null); setPreview(null); }} className="h-11 rounded-md px-2 text-[12.5px] font-medium text-[#791F1F] hover:bg-white">Retirer</button>
            </div>
          </div>
        </div>
      ) : (
        <div
          data-name="receipt"
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer.files); }}
          className={`rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${drag ? "border-[#0C6B8A] bg-[#F2F8FA]" : "border-[#D6D0C4] bg-[#FBF9F5]"}`}
        >
          {uploading ? (
            <p className="inline-flex items-center gap-2 text-[13px] text-[#58524A]"><Loader2 className="size-4 animate-spin" /> Envoi du justificatif…</p>
          ) : (
            <>
              <Upload className="mx-auto size-6 text-[#968F84]" />
              <p className="mt-1.5 text-[13px] font-medium text-[#1A1F2E]">{EXPENSE_HELP.receiptZone}</p>
              <p className="text-[11.5px] text-[#6B6862]">{EXPENSE_HELP.receiptFormats}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => pickRef.current?.click()} className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-[#E0DACF] bg-white px-3.5 text-[13px] font-medium text-[#1A1F2E] hover:bg-[#FAF5F0]">
                  <FileText className="size-4" /> Choisir un fichier
                </button>
                <button type="button" onClick={() => camRef.current?.click()} className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-[#E0DACF] bg-white px-3.5 text-[13px] font-medium text-[#1A1F2E] hover:bg-[#FAF5F0] sm:hidden">
                  <Camera className="size-4" /> Prendre une photo
                </button>
              </div>
            </>
          )}
        </div>
      )}
      <input ref={pickRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
      <input ref={camRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
      <p className={help}>{EXPENSE_HELP.receipt}</p>
    </div>
  );
}

function ImpactPanel({
  attachment,
  dossier,
  productName,
  vehicleName,
  amount,
  excludeId,
  categoryMainCostFor,
}: {
  categoryMainCostFor: string[];
  attachment: ExpenseAttachment;
  dossier: DossierOption | null;
  productName: string | null;
  vehicleName: string | null;
  amount: number;
  excludeId?: string;
}) {
  const [impact, setImpact] = useState<DossierImpact | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!dossier) return setImpact(null);
    let live = true;
    setLoading(true);
    loadDossierImpact(dossier.id, excludeId).then((d) => live && setImpact(d)).finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [dossier, excludeId]);

  const name = attachment === "dossier" ? dossier?.reference ?? "—" : attachment === "produit" ? productName ?? "—" : attachment === "vehicule" ? vehicleName ?? "—" : "";
  const text = IMPACT_TEXT[attachment];

  // Aperçu EN DIRECT — fonctions pures de lib/margin.ts uniquement.
  const live = useMemo(() => {
    if (!impact) return null;
    const without = realCost(impact.otherExpenses);
    const withThis = realCost([...impact.otherExpenses, ...(amount > 0 ? [{ amount_mad: amount }] : [])]);
    // Marge réelle provisoire tant qu'aucune dépense (y compris celle-ci) ne couvre le coût fournisseur principal.
    const hasMain = hasMainCostExpense([...impact.otherExpenses, { main_cost_for: categoryMainCostFor }], impact.productCategory);
    const provisional = realMarginState({ expectedCost: impact.expectedCost, realCost: withThis, hasMainCost: hasMain }) === "provisional";
    return {
      without,
      withThis,
      provisional,
      mExp: margin(impact.saleNet, impact.expectedCost),
      mReal: margin(impact.saleNet, withThis),
      v: variance(impact.expectedCost, withThis),
    };
  }, [impact, amount, categoryMainCostFor]);

  return (
    <div className="rounded-xl border border-[#E5E0D7] bg-white p-4">
      <p className="text-[10.5px] font-medium uppercase tracking-[1.4px] text-[#968F84]">Impact de cette dépense</p>
      <p className="mt-1.5 font-display text-[16px] leading-snug tracking-[-0.02em] text-[#1A1F2E]">{text.title(name)}</p>
      <p className="mt-1 text-[12.5px] leading-snug text-[#58524A]">{text.body}</p>

      {attachment === "dossier" && dossier && (
        <div className="mt-3">
          {loading && !impact ? (
            <p className="inline-flex items-center gap-2 text-[12px] text-[#968F84]"><Loader2 className="size-3.5 animate-spin" /> Chargement du dossier…</p>
          ) : impact && live ? (
            <dl className="divide-y divide-[#F1EDE5] text-[12.5px] tabular-nums">
              <Row k="Vente nette" v={formatMAD(impact.saleNet)} sub={impact.credited > 0 ? `après avoirs (− ${formatMAD(impact.credited)})` : undefined} />
              <Row k="Coût prévisionnel" v={impact.expectedCost === null ? "—" : formatMAD(impact.expectedCost)} />
              <Row k="Coût réel avec cette dépense" v={live.withThis === null ? "—" : formatMAD(live.withThis)} sub={live.without === null ? "première dépense du dossier" : `dont ${formatMAD(live.without)} déjà saisis`} />
              <ToneRow k="Marge prév." m={live.mExp} tone={marginTone(live.mExp.pct)} />
              <ToneRow k={live.provisional ? "Marge réelle provisoire" : "Marge réelle"} m={live.mReal} tone={live.provisional ? "unknown" : marginTone(live.mReal.pct)} />
              {live.provisional ? (
                <Row k="Écart réel − prév." v="—" sub="en attente du coût fournisseur" />
              ) : (
                <ToneRow k="Écart réel − prév." m={live.v} tone={varianceTone(live.v)} signed />
              )}
            </dl>
          ) : null}
          {impact && live?.provisional && impact.expectedCost !== null && (
            <p className="mt-2 rounded-lg bg-[#F1EFE8] px-3 py-2 text-[11.5px] text-[#58524A]">
              Coût fournisseur pas encore saisi : {formatMAD(impact.expectedCost)} prévus.
            </p>
          )}
          {!impact && !loading && <p className="text-[12px] text-[#791F1F]">Données du dossier indisponibles.</p>}
        </div>
      )}
    </div>
  );
}

function Row({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-[#6B6862]">
        {k}
        {sub && <span className="block text-[11px] text-[#968F84]">{sub}</span>}
      </dt>
      <dd className="font-medium text-[#1A1F2E]">{v}</dd>
    </div>
  );
}

function ToneRow({ k, m, tone, signed }: { k: string; m: { amount: number | null; pct: number | null }; tone: ReturnType<typeof marginTone>; signed?: boolean }) {
  const st = MARGIN_TONE_STYLE[tone];
  const sign = signed && m.amount !== null && m.amount > 0 ? "+ " : "";
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-[#6B6862]">{k}</dt>
      <dd className="inline-flex items-center gap-1.5">
        <span className="font-medium text-[#1A1F2E]">{m.amount === null ? "—" : `${sign}${formatMAD(m.amount)}`}</span>
        <span className="rounded px-1.5 py-px text-[11px] font-medium" style={{ backgroundColor: st.bg, color: st.color }}>{formatPct(m.pct)}</span>
      </dd>
    </div>
  );
}

function DeleteZone({ expenseId, returnTo, onError }: { expenseId: string; returnTo: string; onError: (m: string) => void }) {
  const [isPending, startTransition] = useTransition();
  return (
    <div className="rounded-xl border border-[#F7C1C1] bg-white p-4">
      <p className="text-[13px] text-[#58524A]">Supprimer cette dépense la retire des marges, de la rentabilité et des rapports. Son justificatif est supprimé.</p>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!confirm("Supprimer définitivement cette dépense et son justificatif ?")) return;
          startTransition(async () => {
            const res = await deleteExpense(expenseId, returnTo);
            if (res && !res.ok) onError(res.error);
          });
        }}
        className="mt-3 inline-flex h-11 items-center gap-1.5 rounded-lg bg-[#791F1F] px-4 text-[13px] font-medium text-white hover:bg-[#5E1717] disabled:opacity-60"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        {isPending ? "Suppression…" : "Supprimer la dépense"}
      </button>
    </div>
  );
}
