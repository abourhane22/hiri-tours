"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Check, AlertTriangle } from "lucide-react";
import { AlertBanner } from "@/components/ui/alert-banner";
import { CountrySelect } from "@/components/country-select";
import { formatDateShort } from "@/lib/utils";
import {
  findPotentialDuplicates,
  type CustomerActionState,
  type DuplicateMatch,
} from "@/app/admin/clients/actions";

const labelCls = "block text-[12px] font-medium text-[#58524A] mb-1.5";
const fieldCls =
  "h-10 w-full rounded-lg border border-[#E0DACF] bg-white px-3 text-sm text-[#1A1F2E] placeholder:text-sand-400 focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors";
const hintCls = "mt-1.5 text-[11px] text-[#968F84]";

// Réutilise la colonne acquisition_source existante (rapport « Sources
// d'acquisition »). Les clés walk_in/… restent valides ; hotel/event sont
// ajoutées pour la maquette.
const SOURCES: { value: string; label: string }[] = [
  { value: "website", label: "Site web" },
  { value: "social_media", label: "Réseaux sociaux" },
  { value: "partner", label: "Agence partenaire" },
  { value: "hotel", label: "Hôtel" },
  { value: "referral", label: "Bouche-à-oreille" },
  { value: "event", label: "Salon / événement" },
  { value: "other", label: "Autre" },
];

const LANGUAGES: { value: string; label: string }[] = [
  { value: "fr", label: "Français" },
  { value: "ar", label: "Arabe" },
  { value: "en", label: "Anglais" },
  { value: "es", label: "Espagnol" },
  { value: "de", label: "Allemand" },
];

export type CustomerFormDefaults = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  nationality: string;
  city: string;
  source: string;
  language: string;
  notes: string;
};

type Action = (
  prev: CustomerActionState,
  formData: FormData,
) => Promise<CustomerActionState>;

export function CustomerForm({
  mode,
  action,
  defaults,
}: {
  mode: "create" | "edit";
  action: Action;
  defaults: CustomerFormDefaults;
}) {
  const [state, formAction, isPending] = useActionState<CustomerActionState, FormData>(
    action,
    { ok: true },
  );

  const detect = mode === "create";

  const [phoneMatch, setPhoneMatch] = useState<DuplicateMatch | null>(null);
  const [emailMatch, setEmailMatch] = useState<DuplicateMatch | null>(null);
  const [nameMatches, setNameMatches] = useState<DuplicateMatch[]>([]);
  const [dismissedPhone, setDismissedPhone] = useState(false);
  const [dismissedEmail, setDismissedEmail] = useState(false);

  const [lastPhone, setLastPhone] = useState<string | null>(null);
  const [lastEmail, setLastEmail] = useState<string | null>(null);
  const [lastName, setLastNameQ] = useState<string | null>(null);

  async function onPhoneBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (!detect) return;
    const v = e.target.value.trim();
    if (v === lastPhone) return;
    setLastPhone(v);
    setDismissedPhone(false);
    if (!v) return setPhoneMatch(null);
    const res = await findPotentialDuplicates({ phone: v });
    setPhoneMatch(res.phoneMatch);
  }

  async function onEmailBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (!detect) return;
    const v = e.target.value.trim();
    if (v === lastEmail) return;
    setLastEmail(v);
    setDismissedEmail(false);
    if (!v) return setEmailMatch(null);
    const res = await findPotentialDuplicates({ email: v });
    setEmailMatch(res.emailMatch);
  }

  async function onNameBlur(getOther: () => string, e: React.FocusEvent<HTMLInputElement>) {
    if (!detect) return;
    // On combine prénom + nom pour la recherche par nom complet.
    const parts = [e.target.value.trim(), getOther().trim()].filter(Boolean);
    const v = e.target.name === "first_name" ? parts.join(" ") : parts.reverse().join(" ");
    if (v === lastName) return;
    setLastNameQ(v);
    if (v.length < 2) return setNameMatches([]);
    const res = await findPotentialDuplicates({ name: v });
    setNameMatches(res.nameMatches);
  }

  const showPhoneAlert = phoneMatch && !dismissedPhone;
  const showEmailAlert = emailMatch && !dismissedEmail;

  return (
    <form action={formAction} className="space-y-4">
      {state.ok === false && <AlertBanner tone="error" message={state.error} />}

      {/* Section 1 — Identité */}
      <section className="bg-white border border-[#E5E0D7] rounded-xl p-4">
        <SectionHeader n={1} title="Identité" />
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label htmlFor="last_name" className={labelCls}>
              Nom <span className="text-red-600">*</span>
            </label>
            <input
              id="last_name"
              name="last_name"
              type="text"
              required
              defaultValue={defaults.lastName}
              className={fieldCls}
              onBlur={(e) =>
                onNameBlur(
                  () =>
                    (document.getElementById("first_name") as HTMLInputElement)?.value ?? "",
                  e,
                )
              }
            />
          </div>
          <div>
            <label htmlFor="first_name" className={labelCls}>
              Prénom <span className="text-red-600">*</span>
            </label>
            <input
              id="first_name"
              name="first_name"
              type="text"
              required
              defaultValue={defaults.firstName}
              className={fieldCls}
              onBlur={(e) =>
                onNameBlur(
                  () =>
                    (document.getElementById("last_name") as HTMLInputElement)?.value ?? "",
                  e,
                )
              }
            />
          </div>

          {detect && nameMatches.length > 0 && (
            <p className="sm:col-span-2 text-[12px] text-[#968F84] -mt-1">
              Client proche :{" "}
              {nameMatches.map((m, i) => (
                <span key={m.id}>
                  {i > 0 && ", "}
                  <Link
                    href={`/admin/clients/${m.id}`}
                    target="_blank"
                    className="text-terracotta-600 hover:underline"
                  >
                    {m.fullName}
                  </Link>
                </span>
              ))}
            </p>
          )}

          <div className="sm:col-span-2">
            <label htmlFor="country" className={labelCls}>
              Pays <span className="text-red-600">*</span>
            </label>
            <CountrySelect name="country" defaultValue={defaults.country} required />
          </div>
        </div>
      </section>

      {/* Section 2 — Coordonnées */}
      <section className="bg-white border border-[#E5E0D7] rounded-xl p-4">
        <SectionHeader n={2} title="Coordonnées" />
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label htmlFor="phone" className={labelCls}>
              Téléphone <span className="text-red-600">*</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              defaultValue={defaults.phone}
              className={fieldCls}
              onBlur={onPhoneBlur}
            />
            <p className={hintCls}>Format libre — normalisé automatiquement (06… = +212 6…)</p>
          </div>
          <div>
            <label htmlFor="email" className={labelCls}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={defaults.email}
              className={fieldCls}
              onBlur={onEmailBlur}
            />
          </div>
        </div>

        {/* Encarts doublon (haute confiance) */}
        {detect && showPhoneAlert && (
          <DuplicateAlert
            kind="téléphone"
            match={phoneMatch}
            onDismiss={() => setDismissedPhone(true)}
          />
        )}
        {detect && showEmailAlert && (
          <DuplicateAlert
            kind="email"
            match={emailMatch}
            onDismiss={() => setDismissedEmail(true)}
          />
        )}
      </section>

      {/* Section 3 — Acquisition & notes */}
      <section className="bg-white border border-[#E5E0D7] rounded-xl p-4">
        <SectionHeader n={3} title="Acquisition & notes" />
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label htmlFor="acquisition_source" className={labelCls}>
              Source d&apos;acquisition <span className="text-red-600">*</span>
            </label>
            <select
              id="acquisition_source"
              name="acquisition_source"
              required
              defaultValue={defaults.source}
              className={fieldCls}
            >
              <option value="" disabled>
                — Choisir —
              </option>
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <p className={hintCls}>Alimente le rapport « Sources d&apos;acquisition »</p>
          </div>
          <div>
            <label htmlFor="preferred_language" className={labelCls}>
              Langue préférée
            </label>
            <select
              id="preferred_language"
              name="preferred_language"
              defaultValue={defaults.language || "fr"}
              className={fieldCls}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="internal_notes" className={labelCls}>
              Notes internes
            </label>
            <textarea
              id="internal_notes"
              name="internal_notes"
              rows={3}
              defaultValue={defaults.notes}
              placeholder="Informations complémentaires, préférences, remarques…"
              className="w-full rounded-lg border border-[#E0DACF] bg-white px-3 py-2 text-sm text-[#1A1F2E] placeholder:text-sand-400 focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors"
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <Link
          href="/admin/clients"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-[#E0DACF] bg-white px-4 text-sm font-medium text-[#1A1F2E] hover:bg-sand-50 transition-colors"
        >
          Annuler
        </Link>
        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#1A1F2E] px-4 text-sm font-medium text-white transition-colors hover:bg-[#2A3142] disabled:opacity-60 disabled:pointer-events-none"
        >
          <Check className="size-4" />
          {mode === "create"
            ? isPending
              ? "Création…"
              : "Créer le client"
            : isPending
              ? "Enregistrement…"
              : "Enregistrer les modifications"}
        </button>
      </div>
    </form>
  );
}

function SectionHeader({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-5 rounded-md bg-[#1A1F2E] text-white text-[11px] font-medium flex items-center justify-center">
        {n}
      </span>
      <h2 className="font-display text-base text-[#1A1F2E] m-0">{title}</h2>
    </div>
  );
}

function DuplicateAlert({
  kind,
  match,
  onDismiss,
}: {
  kind: "téléphone" | "email";
  match: DuplicateMatch;
  onDismiss: () => void;
}) {
  const bits = [
    match.country,
    match.tier && `Fidélité ${match.tier}`,
    match.maskedPhone,
    `${match.reservationCount} réservation${match.reservationCount > 1 ? "s" : ""}`,
    match.lastDeparture && `dernier départ ${formatDateShort(match.lastDeparture)}`,
  ].filter(Boolean);

  return (
    <div className="mt-3 rounded-lg p-3" style={{ backgroundColor: "#FFF4E0", border: "1px solid #EF9F27" }}>
      <p className="flex items-start gap-2 text-[13px] text-[#7A4B00]">
        <AlertTriangle className="size-4 shrink-0 mt-px" />
        <span>
          Un client existe avec ce {kind} : <span className="font-medium">{match.fullName}</span>
          {bits.length > 0 && <> · {bits.join(" · ")}</>}
        </span>
      </p>
      <div className="flex flex-wrap gap-2 mt-2.5 pl-6">
        <Link
          href={`/admin/clients/${match.id}`}
          target="_blank"
          className="inline-flex h-8 items-center rounded-md bg-[#1A1F2E] px-3 text-[12.5px] font-medium text-white hover:bg-[#2A3142] transition-colors"
        >
          Ouvrir sa fiche
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex h-8 items-center rounded-md px-3 text-[12.5px] font-medium text-[#7A4B00] hover:underline"
        >
          Créer quand même
        </button>
      </div>
    </div>
  );
}
