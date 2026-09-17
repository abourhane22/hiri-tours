"use client";

import "flag-icons/css/flag-icons.min.css";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Eye, EyeOff, Pencil, Trash2, Plus, UserPlus, Globe, ShieldCheck, Check } from "lucide-react";
import { CountrySelect } from "@/components/country-select";
import { countryCode } from "@/lib/countries";
import { formatDateShort, foldAccents } from "@/lib/utils";
import { ageFromDob, maskPassport, TRAVELER_TYPE_LABEL } from "@/lib/travelers";
import type { ReservationTraveler, TravelerType } from "@/lib/types";
import {
  addTraveler,
  updateTraveler,
  deleteTraveler,
  addPayerAsTraveler,
  type TravelerActionState,
} from "@/app/admin/reservations/[id]/traveler-actions";

const labelCls = "block text-[11px] font-medium text-[#58524A] mb-1";
const fieldCls =
  "h-9 w-full rounded-lg border border-[#E0DACF] bg-white px-2.5 text-[13px] text-[#1A1F2E] placeholder:text-sand-400 focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors";
const iconBtn =
  "inline-flex items-center justify-center size-7 rounded-md border border-[#E5E0D7] bg-white text-[#6B6862] hover:text-[#1A1F2E] hover:bg-[#FAF5F0] disabled:opacity-50 transition-colors";

type Props = {
  reservationId: string;
  travelers: ReservationTraveler[];
  expectedAdults: number;
  expectedChildren: number;
  payer: { fullName: string; country: string | null } | null;
  readOnly: boolean;
};

export function TravelersPanel({ reservationId, travelers, expectedAdults, expectedChildren, payer, readOnly }: Props) {
  const [adding, setAdding] = useState(travelers.length === 0 && !readOnly);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [rowError, setRowError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const adultsFilled = travelers.filter((t) => t.traveler_type === "adult").length;
  const defaultType: TravelerType = adultsFilled >= expectedAdults && expectedChildren > 0 ? "child" : "adult";

  const payerAlreadyIn =
    !payer || travelers.some((t) => foldAccents(t.full_name) === foldAccents(payer.fullName));

  function toggleReveal(id: string) {
    setRevealed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function onDelete(t: ReservationTraveler) {
    if (!confirm(`Retirer ${t.full_name} des voyageurs de ce dossier ?`)) return;
    setRowError(null);
    startTransition(async () => {
      const res = await deleteTraveler(reservationId, t.id);
      if (!res.ok) setRowError(res.error);
    });
  }

  function onAddPayer() {
    setRowError(null);
    startTransition(async () => {
      const res = await addPayerAsTraveler(reservationId);
      if (!res.ok) setRowError(res.error);
    });
  }

  return (
    <div className="space-y-2.5">
      {travelers.length === 0 && (readOnly || !adding) && (
        <p className="text-[13px] text-[#968F84] italic">Aucun voyageur renseigné.</p>
      )}

      {travelers.map((t) =>
        editingId === t.id ? (
          <TravelerForm
            key={t.id}
            mode="edit"
            reservationId={reservationId}
            traveler={t}
            defaultType={t.traveler_type}
            onDone={() => setEditingId(null)}
          />
        ) : (
          <TravelerRow
            key={t.id}
            t={t}
            readOnly={readOnly}
            revealed={revealed.has(t.id)}
            onReveal={() => toggleReveal(t.id)}
            onEdit={() => {
              setAdding(false);
              setEditingId(t.id);
            }}
            onDelete={() => onDelete(t)}
            disabled={isPending}
          />
        ),
      )}

      {rowError && (
        <p className="text-[12px] text-[#791F1F] bg-[#FCEBEB] border border-[#F7C1C1] rounded-lg px-3 py-2">{rowError}</p>
      )}

      {!readOnly && adding && (
        <TravelerForm
          key={`add-${travelers.length}`}
          mode="create"
          reservationId={reservationId}
          defaultType={defaultType}
          onDone={() => setAdding(false)}
          onCancel={travelers.length > 0 ? () => setAdding(false) : undefined}
        />
      )}

      {!readOnly && !adding && editingId === null && (
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1A1F2E] px-3 text-[12px] font-medium text-white hover:bg-[#2A3142] transition-colors"
          >
            <Plus className="size-3.5" /> Ajouter un voyageur
          </button>
          {!payerAlreadyIn && payer && (
            <button
              type="button"
              onClick={onAddPayer}
              disabled={isPending}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E5E0D7] bg-white px-3 text-[12px] font-medium text-[#1A1F2E] hover:bg-[#FAF5F0] disabled:opacity-50 transition-colors"
            >
              <UserPlus className="size-3.5" /> Ajouter le client payeur ({payer.fullName.split(/\s+/)[0]})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Flag({ country }: { country: string | null }) {
  const code = countryCode(country);
  if (!code) return <Globe className="size-3.5 text-[#C9C4BA] shrink-0" />;
  return <span className={`fi fi-${code} shrink-0 rounded-[2px]`} style={{ width: 16, height: 12 }} title={country ?? undefined} />;
}

function TypeChip({ type }: { type: TravelerType }) {
  const child = type === "child";
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-px text-[10px] font-medium shrink-0"
      style={child ? { backgroundColor: "#FAEEDA", color: "#633806" } : { backgroundColor: "#F1EFE8", color: "#5F5E5A" }}
    >
      {TRAVELER_TYPE_LABEL[type]}
    </span>
  );
}

function TravelerRow({
  t,
  readOnly,
  revealed,
  onReveal,
  onEdit,
  onDelete,
  disabled,
}: {
  t: ReservationTraveler;
  readOnly: boolean;
  revealed: boolean;
  onReveal: () => void;
  onEdit: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const meta = [
    t.date_of_birth ? `Né(e) le ${formatDateShort(t.date_of_birth)} · ${ageFromDob(t.date_of_birth)} ans` : null,
    t.nationality,
  ].filter(Boolean);

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-lg px-3 py-2.5 ${readOnly ? "opacity-70" : ""}`}
      style={{ backgroundColor: "#FBF9F5", border: "1px solid #EEE9E0" }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <Flag country={t.nationality} />
          <span className="font-display text-[15px] text-[#1A1F2E] truncate">{t.full_name}</span>
          <TypeChip type={t.traveler_type} />
        </div>
        {meta.length > 0 && <div className="text-[11.5px] text-[#6B6862] mt-0.5">{meta.join(" · ")}</div>}
        {t.passport_number && (
          <div className="flex items-center gap-1.5 text-[11.5px] text-[#58524A] mt-0.5">
            <ShieldCheck className="size-3.5 text-[#968F84]" />
            <span>Passeport</span>
            <span className="font-mono tabular-nums">{revealed ? t.passport_number : maskPassport(t.passport_number)}</span>
            <button
              type="button"
              onClick={onReveal}
              className="inline-flex items-center justify-center size-5 rounded text-[#968F84] hover:text-[#1A1F2E]"
              aria-label={revealed ? "Masquer le numéro de passeport" : "Révéler le numéro de passeport"}
              title={revealed ? "Masquer" : "Révéler"}
            >
              {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          </div>
        )}
        {t.notes && <div className="text-[11.5px] text-[#6B6862] italic mt-0.5">{t.notes}</div>}
      </div>

      {!readOnly && (
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={onEdit} disabled={disabled} className={iconBtn} title="Modifier" aria-label="Modifier le voyageur">
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            className={`${iconBtn} hover:!text-[#791F1F] hover:!bg-[#FCEBEB] hover:!border-[#F7C1C1]`}
            title="Supprimer"
            aria-label="Supprimer le voyageur"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function TravelerForm({
  mode,
  reservationId,
  traveler,
  defaultType,
  onDone,
  onCancel,
}: {
  mode: "create" | "edit";
  reservationId: string;
  traveler?: ReservationTraveler;
  defaultType: TravelerType;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const action =
    mode === "edit" && traveler
      ? updateTraveler.bind(null, reservationId, traveler.id)
      : addTraveler.bind(null, reservationId);
  const [state, formAction, isPending] = useActionState<TravelerActionState, FormData>(action, { ok: true });

  // Succès signalé par savedAt → on referme le formulaire.
  useEffect(() => {
    if (state.ok && state.savedAt) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const today = new Date().toISOString().split("T")[0];

  return (
    <form
      action={formAction}
      className="rounded-lg p-3 space-y-2.5"
      style={{ backgroundColor: "#FFFFFF", border: "1px dashed #C9C4BA" }}
    >
      {state.ok === false && (
        <p className="text-[12px] text-[#791F1F] bg-[#FCEBEB] border border-[#F7C1C1] rounded-lg px-3 py-2">{state.error}</p>
      )}

      <div className="grid grid-cols-3 gap-2.5">
        <div className="col-span-2">
          <label htmlFor={`full_name-${traveler?.id ?? "new"}`} className={labelCls}>
            Nom complet <span className="text-red-600">*</span>
          </label>
          <input
            id={`full_name-${traveler?.id ?? "new"}`}
            name="full_name"
            type="text"
            required
            autoFocus
            defaultValue={traveler?.full_name ?? ""}
            placeholder="Tel qu'il figure sur le passeport"
            className={fieldCls}
          />
        </div>
        <div>
          <label htmlFor={`traveler_type-${traveler?.id ?? "new"}`} className={labelCls}>
            Type <span className="text-red-600">*</span>
          </label>
          <select id={`traveler_type-${traveler?.id ?? "new"}`} name="traveler_type" required defaultValue={defaultType} className={fieldCls}>
            <option value="adult">Adulte</option>
            <option value="child">Enfant</option>
          </select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-2.5">
        <div>
          <label htmlFor={`dob-${traveler?.id ?? "new"}`} className={labelCls}>
            Date de naissance
          </label>
          <input
            id={`dob-${traveler?.id ?? "new"}`}
            name="date_of_birth"
            type="date"
            max={today}
            defaultValue={traveler?.date_of_birth ?? ""}
            className={fieldCls}
          />
        </div>
        <div>
          <label className={labelCls}>Nationalité</label>
          <CountrySelect name="nationality" defaultValue={traveler?.nationality ?? ""} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-2.5">
        <div>
          <label htmlFor={`passport-${traveler?.id ?? "new"}`} className={labelCls}>
            N° de passeport
          </label>
          <input
            id={`passport-${traveler?.id ?? "new"}`}
            name="passport_number"
            type="text"
            autoComplete="off"
            defaultValue={traveler?.passport_number ?? ""}
            className={`${fieldCls} font-mono`}
          />
        </div>
        <div>
          <label htmlFor={`notes-${traveler?.id ?? "new"}`} className={labelCls}>
            Notes
          </label>
          <input
            id={`notes-${traveler?.id ?? "new"}`}
            name="notes"
            type="text"
            defaultValue={traveler?.notes ?? ""}
            placeholder="Régime, mobilité, siège enfant…"
            className={fieldCls}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1A1F2E] px-3 text-[12px] font-medium text-white hover:bg-[#2A3142] disabled:opacity-60 transition-colors"
        >
          <Check className="size-3.5" />
          {isPending ? "Enregistrement…" : mode === "edit" ? "Enregistrer" : "Ajouter"}
        </button>
        {(onCancel || mode === "edit") && (
          <button
            type="button"
            onClick={onCancel ?? onDone}
            disabled={isPending}
            className="h-8 px-2.5 text-[12px] text-[#6B6862] hover:text-[#1A1F2E] disabled:opacity-50"
          >
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}
