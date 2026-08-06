"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { AlertTriangle } from "lucide-react";
import { formatDateShort } from "@/lib/utils";
import {
  createCustomer,
  findPotentialDuplicates,
  type DuplicateMatch,
} from "@/app/admin/clients/actions";

export function CustomerNewForm() {
  const [phoneMatch, setPhoneMatch] = useState<DuplicateMatch | null>(null);
  const [emailMatch, setEmailMatch] = useState<DuplicateMatch | null>(null);
  const [nameMatches, setNameMatches] = useState<DuplicateMatch[]>([]);
  const [dismissedPhone, setDismissedPhone] = useState(false);
  const [dismissedEmail, setDismissedEmail] = useState(false);

  // Dernières valeurs interrogées → un seul appel par blur, et seulement si
  // la valeur a changé.
  const [lastPhone, setLastPhone] = useState<string | null>(null);
  const [lastEmail, setLastEmail] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);

  async function onPhoneBlur(e: React.FocusEvent<HTMLInputElement>) {
    const v = e.target.value.trim();
    if (v === lastPhone) return;
    setLastPhone(v);
    setDismissedPhone(false);
    if (!v) {
      setPhoneMatch(null);
      return;
    }
    const res = await findPotentialDuplicates({ phone: v });
    setPhoneMatch(res.phoneMatch);
  }

  async function onEmailBlur(e: React.FocusEvent<HTMLInputElement>) {
    const v = e.target.value.trim();
    if (v === lastEmail) return;
    setLastEmail(v);
    setDismissedEmail(false);
    if (!v) {
      setEmailMatch(null);
      return;
    }
    const res = await findPotentialDuplicates({ email: v });
    setEmailMatch(res.emailMatch);
  }

  async function onNameBlur(e: React.FocusEvent<HTMLInputElement>) {
    const v = e.target.value.trim();
    if (v === lastName) return;
    setLastName(v);
    if (v.length < 2) {
      setNameMatches([]);
      return;
    }
    const res = await findPotentialDuplicates({ fullName: v });
    setNameMatches(res.nameMatches);
  }

  const showPhoneAlert = phoneMatch && !dismissedPhone;
  const showEmailAlert = emailMatch && !dismissedEmail;

  return (
    <form
      action={createCustomer}
      className="bg-white border border-sand-200 rounded-lg p-6 space-y-5"
    >
      <div>
        <Label htmlFor="full_name">Nom complet *</Label>
        <Input
          id="full_name"
          name="full_name"
          type="text"
          required
          onBlur={onNameBlur}
        />
        {nameMatches.length > 0 && (
          <p className="text-[12px] text-sand-600 mt-1.5">
            Clients proches :{" "}
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
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" onBlur={onEmailBlur} />
        </div>
        <div>
          <Label htmlFor="phone">Téléphone</Label>
          <Input id="phone" name="phone" type="tel" onBlur={onPhoneBlur} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="nationality">Nationalité</Label>
          <Input
            id="nationality"
            name="nationality"
            type="text"
            placeholder="Marocaine, Française…"
          />
        </div>
        <div>
          <Label htmlFor="city">Ville</Label>
          <Input id="city" name="city" type="text" />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="preferred_language">Langue préférée</Label>
          <Select id="preferred_language" name="preferred_language" defaultValue="fr">
            <option value="fr">Français</option>
            <option value="ar">Arabe</option>
            <option value="en">Anglais</option>
            <option value="es">Espagnol</option>
            <option value="de">Allemand</option>
            <option value="it">Italien</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="acquisition_source">Source d&apos;acquisition</Label>
          <Select id="acquisition_source" name="acquisition_source" defaultValue="walk_in">
            <option value="walk_in">Walk-in</option>
            <option value="phone">Téléphone</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="website">Site web</option>
            <option value="referral">Bouche-à-oreille</option>
            <option value="social_media">Réseaux sociaux</option>
            <option value="partner">Partenaire</option>
            <option value="other">Autre</option>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="internal_notes">Notes internes</Label>
        <Textarea
          id="internal_notes"
          name="internal_notes"
          rows={3}
          placeholder="Informations complémentaires, préférences, remarques…"
        />
      </div>

      {/* Encarts d'avertissement (haute confiance) */}
      {showPhoneAlert && (
        <DuplicateAlert
          kind="téléphone"
          match={phoneMatch}
          onDismiss={() => setDismissedPhone(true)}
        />
      )}
      {showEmailAlert && (
        <DuplicateAlert
          kind="email"
          match={emailMatch}
          onDismiss={() => setDismissedEmail(true)}
        />
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Link href="/admin/clients">
          <Button type="button" variant="secondary">
            Annuler
          </Button>
        </Link>
        <Button type="submit">Créer le client</Button>
      </div>
    </form>
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
  return (
    <div
      className="rounded-lg p-3"
      style={{ backgroundColor: "#FFF4E0", border: "1px solid #EF9F27" }}
    >
      <p className="flex items-start gap-2 text-[13px] text-[#7A4B00]">
        <AlertTriangle className="size-4 shrink-0 mt-px" />
        <span>
          Un client existe avec ce {kind} :{" "}
          <span className="font-medium">{match.fullName}</span> ·{" "}
          {match.reservationCount} réservation{match.reservationCount > 1 ? "s" : ""}
          {match.lastDeparture && ` · dernier départ ${formatDateShort(match.lastDeparture)}`}
        </span>
      </p>
      <div className="flex flex-wrap gap-2 mt-2.5 pl-6">
        <Link href={`/admin/clients/${match.id}`} target="_blank">
          <Button type="button" size="sm" variant="secondary">
            Ouvrir sa fiche
          </Button>
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex items-center rounded-md px-3 text-[13px] font-medium text-[#7A4B00] hover:underline"
        >
          Créer quand même
        </button>
      </div>
    </div>
  );
}
