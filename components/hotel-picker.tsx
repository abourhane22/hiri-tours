"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Building2, Check, Loader2, Plus, Search, X } from "lucide-react";
import { categoryFieldFormName } from "@/lib/category-fields";
import { quickCreateHotel } from "@/app/admin/fournisseurs/actions";
import { useToast, highlightField } from "@/components/ui/toaster";

export type HotelOption = {
  id: string;
  name: string;
  address_line: string | null;
  city: string | null;
  country: string | null;
  is_active: boolean;
};

const labelCls = "block text-[12px] font-medium text-[#58524A] mb-1.5";
const fieldCls =
  "h-10 w-full rounded-lg border border-[#E0DACF] bg-white px-3 text-sm text-[#1A1F2E] placeholder:text-sand-400 focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors";

/**
 * Établissement d'un hébergement = un fournisseur de type hôtel (circuits.supplier_id,
 * obligatoire pour un hébergement). Envoie `supplier_id` et la copie du nom dans
 * `property_name` (le serveur y recopie de toute façon le nom officiel du fournisseur).
 * « Créer un établissement » : fenêtre de création rapide, sans quitter le formulaire.
 */
export function HotelPicker({
  hotels: initialHotels,
  defaultSupplierId,
  onSelect,
}: {
  hotels: HotelOption[];
  defaultSupplierId: string | null;
  /** Appelé à la sélection : pré-remplissage de l'adresse par le formulaire. */
  onSelect: (h: HotelOption) => void;
}) {
  const toast = useToast();
  const [hotels, setHotels] = useState(initialHotels);
  const [selectedId, setSelectedId] = useState<string | null>(defaultSupplierId);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const selected = hotels.find((h) => h.id === selectedId) ?? null;

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const list = hotels.filter((h) => h.is_active || h.id === selectedId);
    if (!s) return list;
    return list.filter((h) =>
      `${h.name} ${h.city ?? ""}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(s),
    );
  }, [hotels, q, selectedId]);

  function choose(h: HotelOption) {
    setSelectedId(h.id);
    setQ("");
    setOpen(false);
    onSelect(h);
  }

  return (
    <div className="sm:col-span-2">
      <input type="hidden" name="supplier_id" value={selectedId ?? ""} />
      <input type="hidden" name={categoryFieldFormName("property_name")} value={selected?.name ?? ""} />

      <label htmlFor="hotel_search" className={labelCls}>
        Établissement <span className="text-red-600">*</span>
      </label>
      {selected ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-[#A9DFCC] bg-[#E1F5EE] px-3 py-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-medium text-[#1A1F2E]">
              <Building2 className="size-4 text-[#085041]" /> {selected.name}
              {!selected.is_active && <span className="rounded-full bg-[#F1EFE8] px-2 py-0.5 text-[11px] text-[#58524A]">inactif</span>}
            </p>
            {(selected.address_line || selected.city) && (
              <p className="text-[12px] text-[#085041]">{[selected.address_line, selected.city].filter(Boolean).join(", ")}</p>
            )}
          </div>
          <button type="button" onClick={() => { setSelectedId(null); setOpen(true); }} className="h-10 shrink-0 px-2 text-[12.5px] font-medium text-[#085041] hover:underline">
            Changer
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#968F84]" />
          <input
            id="hotel_search"
            name="supplier_search"
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            autoComplete="off"
            placeholder="Rechercher un hôtel, un riad…"
            className={`${fieldCls} pl-9`}
          />
          {open && (
            <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[#E5E0D7] bg-white shadow-lg">
              {matches.map((h) => (
                <li key={h.id}>
                  <button type="button" onClick={() => choose(h)} className="flex min-h-[44px] w-full flex-col items-start px-3 py-2 text-left hover:bg-[#FBF9F5]">
                    <span className="text-sm text-[#1A1F2E]">{h.name}</span>
                    {h.city && <span className="text-[11.5px] text-[#6B6862]">{h.city}</span>}
                  </button>
                </li>
              ))}
              {matches.length === 0 && <li className="px-3 py-2.5 text-[12.5px] text-[#968F84]">Aucun établissement ne correspond.</li>}
            </ul>
          )}
        </div>
      )}
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px] text-[#968F84]">
        Fournisseur de type hôtel : contrats, allotements et tarifs d&apos;achat s&apos;y rattachent.
        <button type="button" onClick={() => setCreating(true)} className="inline-flex min-h-[32px] items-center gap-1 font-medium text-[#0C6B8A] hover:underline">
          <Plus className="size-3.5" /> Créer un établissement
        </button>
      </p>

      {creating && (
        <QuickHotelDialog
          initialName={q}
          onClose={() => setCreating(false)}
          onCreated={(h) => {
            setHotels((l) => [...l, h].sort((a, b) => a.name.localeCompare(b.name, "fr")));
            setCreating(false);
            choose(h);
            toast.success(`Établissement « ${h.name} » créé et sélectionné`);
          }}
        />
      )}
    </div>
  );
}

/** Fenêtre de création : champs SANS attribut `name` (ils ne partent pas avec le formulaire produit). */
function QuickHotelDialog({ initialName, onClose, onCreated }: { initialName: string; onClose: () => void; onCreated: (h: HotelOption) => void }) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState({ name: initialName, city: "", address_line: "", phone: "", email: "" });
  const boxRef = useRef<HTMLDivElement>(null);
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));

  function submit() {
    setError(null);
    const fd = new FormData();
    for (const [k, v] of Object.entries(values)) fd.set(k, v);
    fd.set("country", "Maroc");
    startTransition(async () => {
      const res = await quickCreateHotel(fd);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        if (res.field) highlightField(`hotel_${res.field}`, boxRef.current);
        return;
      }
      onCreated({ ...res.supplier, is_active: true });
    });
  }

  const input = (k: keyof typeof values, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`hotel_${k}`} className={labelCls}>{label}</label>
      <input
        id={`hotel_${k}`}
        data-name={`hotel_${k}`}
        value={values[k]}
        onChange={set(k)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
        className={fieldCls}
        {...props}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#1A1F2E]/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="quick-hotel-title">
      <div ref={boxRef} className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="quick-hotel-title" className="m-0 font-display text-lg tracking-[-0.02em] text-[#1A1F2E]">Créer un établissement</h2>
            <p className="text-[12px] text-[#6B6862]">Fournisseur de type hôtel. La fiche complète reste modifiable dans Fournisseurs.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="inline-flex size-10 items-center justify-center rounded-md text-[#6B6862] hover:bg-[#FBF9F5]">
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3">
          {input("name", "Nom de l'établissement *", { autoFocus: true, placeholder: "Riad Dar Amal" })}
          <div className="grid grid-cols-2 gap-3">
            {input("city", "Ville", { placeholder: "Agadir" })}
            {input("phone", "Téléphone", { type: "tel" })}
          </div>
          {input("address_line", "Adresse")}
          {input("email", "Email", { type: "email" })}
          {error && <p className="rounded-lg border border-[#F7C1C1] bg-[#FCEBEB] px-3 py-2 text-[12px] text-[#791F1F]">{error}</p>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-lg px-3 text-[13px] text-[#58524A] hover:bg-[#F1EFE8]">Annuler</button>
          <button type="button" onClick={submit} disabled={isPending || !values.name.trim()} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#1A1F2E] px-4 text-[13px] font-medium text-white hover:bg-[#2A3142] disabled:opacity-60">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {isPending ? "Enregistrement…" : "Créer et sélectionner"}
          </button>
        </div>
      </div>
    </div>
  );
}
