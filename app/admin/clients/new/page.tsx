import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";
import { createCustomer } from "../actions";

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Link
        href="/admin/clients"
        className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink mb-4"
      >
        <ArrowLeft className="size-4" /> Retour aux clients
      </Link>

      <div className="mb-8">
        <p className="eyebrow mb-2">Module 3 — Base clients</p>
        <h1 className="font-display text-3xl text-ink">Nouveau client</h1>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800">
          {decodeURIComponent(error)}
        </div>
      )}

      <form
        action={createCustomer}
        className="bg-white border border-sand-200 rounded-lg p-6 space-y-5"
      >
        <div>
          <Label htmlFor="full_name">Nom complet *</Label>
          <Input id="full_name" name="full_name" type="text" required />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" />
          </div>
          <div>
            <Label htmlFor="phone">Téléphone</Label>
            <Input id="phone" name="phone" type="tel" />
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
            <Select
              id="preferred_language"
              name="preferred_language"
              defaultValue="fr"
            >
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
            <Select
              id="acquisition_source"
              name="acquisition_source"
              defaultValue="walk_in"
            >
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

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/admin/clients">
            <Button type="button" variant="secondary">
              Annuler
            </Button>
          </Link>
          <Button type="submit">Créer le client</Button>
        </div>
      </form>
    </div>
  );
}
