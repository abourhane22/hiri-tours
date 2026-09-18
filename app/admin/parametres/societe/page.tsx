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
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Label htmlFor="phone">Téléphone</Label><Input id="phone" name="phone" type="tel" defaultValue={s.phone ?? ""} /></div>
                <div><Label htmlFor="whatsapp">WhatsApp</Label><Input id="whatsapp" name="whatsapp" type="tel" defaultValue={s.whatsapp ?? ""} placeholder="+212 6…" /></div>
                <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" defaultValue={s.email ?? ""} /></div>
                <div><Label htmlFor="website">Site web</Label><Input id="website" name="website" type="text" defaultValue={s.website ?? ""} placeholder="hiritours.ma" /></div>
              </div>
            </div>

            <div className="pt-3 border-t border-sand-200 space-y-4">
              <p className="text-xs text-sand-600 uppercase tracking-wide font-medium">Identité légale</p>
              <p className="text-xs text-sand-600 -mt-2">Mentions obligatoires des factures. Elles sont figées dans chaque facture au moment de son émission ; un champ vide déclenche un avertissement à la génération.</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Label htmlFor="legal_form">Forme juridique</Label><Input id="legal_form" name="legal_form" defaultValue={s.legal_form ?? ""} placeholder="SARL, SARL AU, SA…" /></div>
                <div>
                  <Label htmlFor="capital_mad">Capital social (MAD)</Label>
                  <Input id="capital_mad" name="capital_mad" type="number" step="1" min="0" defaultValue={s.capital_mad !== null && s.capital_mad !== undefined ? String(Number(s.capital_mad)) : ""} placeholder="100000" />
                </div>
                <div><Label htmlFor="rc">RC (Registre du Commerce)</Label><Input id="rc" name="rc" defaultValue={s.rc ?? ""} /></div>
                <div><Label htmlFor="rc_city">Ville du tribunal (RC)</Label><Input id="rc_city" name="rc_city" defaultValue={s.rc_city ?? ""} placeholder="Agadir" /></div>
                <div><Label htmlFor="ice">ICE (15 chiffres)</Label><Input id="ice" name="ice" defaultValue={s.ice ?? ""} placeholder="000XXXXXX000XXX" /></div>
                <div><Label htmlFor="if_number">IF (Identifiant Fiscal)</Label><Input id="if_number" name="if_number" defaultValue={s.if_number ?? ""} /></div>
                <div><Label htmlFor="patente">Patente</Label><Input id="patente" name="patente" defaultValue={s.patente ?? ""} /></div>
                <div><Label htmlFor="tva_number">N° TVA</Label><Input id="tva_number" name="tva_number" defaultValue={s.tva_number ?? ""} /></div>
                <div><Label htmlFor="cnss">CNSS</Label><Input id="cnss" name="cnss" defaultValue={s.cnss ?? ""} /></div>
                <div><Label htmlFor="travel_license">Licence agence de voyages</Label><Input id="travel_license" name="travel_license" defaultValue={s.travel_license ?? ""} placeholder="N° de licence · catégorie A" /></div>
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
              <p className="text-xs text-sand-600 uppercase tracking-wide font-medium">Devises — taux de change par défaut</p>
              <p className="text-xs text-sand-600 -mt-2">
                MAD pour 1 unité de devise. Pré-rempli à la création d&apos;un dossier issu de la distribution aérienne ; le taux réellement appliqué est figé dossier par dossier (les prix Duffel sont en EUR sur ce compte).
              </p>
              <div className="grid sm:grid-cols-3 gap-4">
                {(["EUR", "GBP", "USD"] as const).map((cur) => (
                  <div key={cur}>
                    <Label htmlFor={`fx_${cur}`}>1 {cur} =</Label>
                    <div className="relative">
                      <Input
                        id={`fx_${cur}`}
                        name={`fx_${cur}`}
                        type="number"
                        step="0.0001"
                        min="0"
                        defaultValue={s.fx_rates && typeof s.fx_rates[cur] === "number" ? String(s.fx_rates[cur]) : ""}
                        placeholder="—"
                        className="pr-14"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sand-600 text-sm pointer-events-none">MAD</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-sand-200 space-y-4">
              <p className="text-xs text-sand-600 uppercase tracking-wide font-medium">Coordonnées bancaires (optionnel, pour facture)</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Label htmlFor="bank_name">Banque</Label><Input id="bank_name" name="bank_name" defaultValue={s.bank_name ?? ""} /></div>
                <div><Label htmlFor="bank_account_holder">Titulaire du compte</Label><Input id="bank_account_holder" name="bank_account_holder" defaultValue={s.bank_account_holder ?? ""} /></div>
                <div><Label htmlFor="bank_rib">RIB (24 chiffres)</Label><Input id="bank_rib" name="bank_rib" defaultValue={s.bank_rib ?? ""} className="font-mono" /></div>
                <div><Label htmlFor="iban">IBAN</Label><Input id="iban" name="iban" defaultValue={s.iban ?? ""} className="font-mono" /></div>
              </div>
              <p className="text-xs text-sand-600">Le RIB est affiché au client dans le tunnel de réservation (virement) et en pied de facture.</p>
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
