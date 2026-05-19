import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { updateCompanySettings } from "../actions";
import type { CompanySettings } from "@/lib/types";

export default async function SocietePage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: settings } = await supabase.from("company_settings").select("*").limit(1).single();
  const s = settings as CompanySettings;
  const updateBound = updateCompanySettings.bind(null, s.id);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/admin/parametres" className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink mb-4">
        <ArrowLeft className="size-4" /> Retour aux paramètres
      </Link>

      <div className="mb-8">
        <p className="eyebrow mb-2">Paramètres</p>
        <h1 className="font-display text-3xl text-ink">Informations société</h1>
        <p className="text-sm text-sand-700 mt-2">Ces informations apparaîtront sur toutes les factures. Capturées au moment de l&apos;émission pour conformité légale.</p>
      </div>

      {saved && (
        <div className="mb-6 p-4 rounded-md bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
          ✅ Informations société enregistrées.
        </div>
      )}

      <Card>
        <CardBody>
          <form action={updateBound} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div><Label htmlFor="legal_name">Raison sociale *</Label><Input id="legal_name" name="legal_name" required defaultValue={s.legal_name} /></div>
              <div><Label htmlFor="commercial_name">Nom commercial *</Label><Input id="commercial_name" name="commercial_name" required defaultValue={s.commercial_name} /></div>
            </div>

            <div className="pt-3 border-t border-sand-200 space-y-4">
              <p className="text-xs text-sand-600 uppercase tracking-wide font-medium">Adresse du siège</p>
              <div><Label htmlFor="address_line">Adresse</Label><Input id="address_line" name="address_line" defaultValue={s.address_line ?? ""} /></div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div><Label htmlFor="postal_code">Code postal</Label><Input id="postal_code" name="postal_code" defaultValue={s.postal_code ?? ""} /></div>
                <div><Label htmlFor="city">Ville</Label><Input id="city" name="city" defaultValue={s.city ?? "Agadir"} /></div>
                <div><Label htmlFor="country">Pays</Label><Input id="country" name="country" defaultValue={s.country ?? "Maroc"} /></div>
              </div>
            </div>

            <div className="pt-3 border-t border-sand-200 space-y-4">
              <p className="text-xs text-sand-600 uppercase tracking-wide font-medium">Contact</p>
              <div className="grid sm:grid-cols-3 gap-4">
                <div><Label htmlFor="phone">Téléphone</Label><Input id="phone" name="phone" type="tel" defaultValue={s.phone ?? ""} /></div>
                <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" defaultValue={s.email ?? ""} /></div>
                <div><Label htmlFor="website">Site web</Label><Input id="website" name="website" type="text" defaultValue={s.website ?? ""} placeholder="hiritours.ma" /></div>
              </div>
            </div>

            <div className="pt-3 border-t border-sand-200 space-y-4">
              <p className="text-xs text-sand-600 uppercase tracking-wide font-medium">Identifiants fiscaux marocains</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Label htmlFor="ice">ICE (15 chiffres)</Label><Input id="ice" name="ice" defaultValue={s.ice ?? ""} placeholder="000XXXXXX000XXX" /></div>
                <div><Label htmlFor="rc">RC (Registre du Commerce)</Label><Input id="rc" name="rc" defaultValue={s.rc ?? ""} /></div>
                <div><Label htmlFor="if_number">IF (Identifiant Fiscal)</Label><Input id="if_number" name="if_number" defaultValue={s.if_number ?? ""} /></div>
                <div><Label htmlFor="patente">Patente</Label><Input id="patente" name="patente" defaultValue={s.patente ?? ""} /></div>
                <div><Label htmlFor="cnss">CNSS</Label><Input id="cnss" name="cnss" defaultValue={s.cnss ?? ""} /></div>
                <div>
                  <Label htmlFor="tva_default_rate">Taux TVA par défaut (%)</Label>
                  <div className="relative">
                    <Input id="tva_default_rate" name="tva_default_rate" type="number" step="0.1" min="0" max="100" defaultValue={(Number(s.tva_default_rate) * 100).toFixed(1).replace(/\.0$/, "")} required className="pr-8" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sand-600 text-sm pointer-events-none">%</span>
                  </div>
                  <p className="text-xs text-sand-600 mt-1">Ex : 20 pour 20% (standard), 10 pour 10% (tourisme)</p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-sand-200 space-y-4">
              <p className="text-xs text-sand-600 uppercase tracking-wide font-medium">Coordonnées bancaires (optionnel, pour facture)</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Label htmlFor="bank_name">Banque</Label><Input id="bank_name" name="bank_name" defaultValue={s.bank_name ?? ""} /></div>
                <div><Label htmlFor="iban">IBAN / RIB</Label><Input id="iban" name="iban" defaultValue={s.iban ?? ""} /></div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-sand-200">
              <Button type="submit">Enregistrer les paramètres</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
