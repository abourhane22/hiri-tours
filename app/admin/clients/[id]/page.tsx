import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Card, CardBody, Badge } from "@/components/ui/card";
import { formatMAD, formatDate, formatDateShort } from "@/lib/utils";
import { ArrowLeft, Trophy } from "lucide-react";
import { updateCustomer, deleteCustomer } from "../actions";
import type { ReservationWithCircuit } from "@/lib/types";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { computeLoyaltyPoints, getLoyaltyTier, getNextTier } from "@/lib/loyalty";

const STATUS_CONFIG: Record<
  string,
  { tone: "warning" | "info" | "success" | "danger" | "neutral"; label: string }
> = {
  pending: { tone: "warning", label: "En attente" },
  confirmed: { tone: "info", label: "Confirmée" },
  paid: { tone: "success", label: "Payée" },
  cancelled: { tone: "danger", label: "Annulée" },
  completed: { tone: "neutral", label: "Terminée" },
};

const SOURCE_LABEL: Record<string, string> = {
  walk_in: "Walk-in",
  phone: "Téléphone",
  whatsapp: "WhatsApp",
  email: "Email",
  website: "Site web",
  referral: "Bouche-à-oreille",
  social_media: "Réseaux sociaux",
  partner: "Partenaire",
  other: "Autre",
};

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; updated?: string; error?: string }>;
}) {
  const { id } = await params;
  const { created, updated, error } = await searchParams;
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();

  if (!customer) notFound();

  const { data: reservations } = await supabase
    .from("reservations")
    .select("*, circuits(title, slug, category)")
    .eq("customer_id", id)
    .order("departure_date", { ascending: false });

  const loyaltyPoints = computeLoyaltyPoints((reservations || []) as any[]);
  const tier = getLoyaltyTier(loyaltyPoints);
  const next = getNextTier(loyaltyPoints);

  const updateCustomerBound = updateCustomer.bind(null, id);
  const deleteCustomerBound = deleteCustomer.bind(null, id);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link
        href="/admin/clients"
        className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink mb-4"
      >
        <ArrowLeft className="size-4" /> Retour aux clients
      </Link>

      <div className="mb-8">
        <p className="eyebrow mb-2">Module 3 — Base clients</p>
        <h1 className="font-display text-3xl text-ink">{customer.full_name}</h1>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <p className="text-sm text-sand-700">Client depuis le {formatDate(customer.created_at)}</p>
          {customer.phone && (
            <WhatsAppButton
              phone={customer.phone}
              message={`Bonjour ${customer.full_name}, c'est l'équipe Hiri Tours.`}
              variant="compact"
            />
          )}
        </div>
      </div>

      {(created || updated) && (
        <div className="mb-6 p-3 rounded-md bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
          {created ? "Client créé avec succès." : "Fiche client mise à jour."}
        </div>
      )}
      {error && (
        <div className="mb-6 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800">
          {decodeURIComponent(error)}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="px-5 py-4 border-b border-sand-200">
              <h2 className="font-display text-lg text-ink">Informations</h2>
            </div>
            <CardBody>
              <form action={updateCustomerBound} className="space-y-4">
                <div>
                  <Label htmlFor="full_name">Nom complet *</Label>
                  <Input
                    id="full_name"
                    name="full_name"
                    type="text"
                    defaultValue={customer.full_name}
                    required
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      defaultValue={customer.email ?? ""}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      defaultValue={customer.phone ?? ""}
                    />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nationality">Nationalité</Label>
                    <Input
                      id="nationality"
                      name="nationality"
                      type="text"
                      defaultValue={customer.nationality ?? ""}
                    />
                  </div>
                  <div>
                    <Label htmlFor="city">Ville</Label>
                    <Input
                      id="city"
                      name="city"
                      type="text"
                      defaultValue={customer.city ?? ""}
                    />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="preferred_language">Langue préférée</Label>
                    <Select
                      id="preferred_language"
                      name="preferred_language"
                      defaultValue={customer.preferred_language}
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
                    <Label htmlFor="acquisition_source">Source</Label>
                    <Select
                      id="acquisition_source"
                      name="acquisition_source"
                      defaultValue={customer.acquisition_source}
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
                    defaultValue={customer.internal_notes ?? ""}
                  />
                </div>
                <Button type="submit" variant="secondary">
                  Enregistrer les modifications
                </Button>
              </form>
            </CardBody>
          </Card>

          <Card>
            <div className="px-5 py-4 border-b border-sand-200 flex items-center justify-between">
              <h2 className="font-display text-lg text-ink">Réservations</h2>
              <Link href="/admin/reservations/new">
                <Button size="sm" variant="secondary">
                  + Réservation
                </Button>
              </Link>
            </div>
            {reservations && reservations.length > 0 ? (
              <div className="divide-y divide-sand-200">
                {(reservations as ReservationWithCircuit[]).map((r) => {
                  const s = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending;
                  return (
                    <Link
                      key={r.id}
                      href={`/admin/reservations/${r.id}`}
                      className="flex items-center justify-between px-5 py-3.5 hover:bg-sand-50 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-mono text-xs text-terracotta-600">
                            {r.reference}
                          </span>
                          <Badge tone={s.tone}>{s.label}</Badge>
                        </div>
                        <div className="text-sm text-ink">
                          {r.circuits?.title ?? "—"}
                        </div>
                        <div className="text-xs text-sand-600">
                          {formatDateShort(r.departure_date)} · {r.adults}A
                          {r.children > 0 ? `/${r.children}E` : ""}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <div className="text-terracotta-600 font-medium tabular-nums">
                          {formatMAD(r.total_amount_mad)}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <CardBody>
                <p className="text-sm text-sand-700">Aucune réservation.</p>
              </CardBody>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="px-5 py-4 border-b border-sand-200">
              <h2 className="font-display text-lg text-ink">Récapitulatif</h2>
            </div>
            <CardBody className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-sand-600 uppercase tracking-wide mb-0.5">
                  Réservations
                </div>
                <div className="text-ink font-medium tabular-nums">
                  {reservations?.length ?? 0}
                </div>
              </div>
              <div>
                <div className="text-xs text-sand-600 uppercase tracking-wide mb-0.5">
                  Source
                </div>
                <div className="text-ink">
                  {SOURCE_LABEL[customer.acquisition_source] ??
                    customer.acquisition_source}
                </div>
              </div>
              {customer.nationality && (
                <div>
                  <div className="text-xs text-sand-600 uppercase tracking-wide mb-0.5">
                    Nationalité
                  </div>
                  <div className="text-ink">{customer.nationality}</div>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <div className="px-5 py-4 border-b border-sand-200 flex items-center gap-2">
              <Trophy className="size-4 text-amber-600" />
              <h2 className="font-display text-lg text-ink">Fidélité</h2>
            </div>
            <CardBody>
              <div className="text-center mb-4">
                <div className="font-display text-3xl text-ink tabular-nums">{loyaltyPoints}</div>
                <div className="text-xs text-sand-600 uppercase tracking-wide mt-1">points fidélité</div>
              </div>
              <div className="text-center mb-3">
                <span className={
                  tier.color === "amber" ? "inline-block px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-900 border border-amber-300" :
                  tier.color === "sand" ? "inline-block px-3 py-1 rounded-full text-xs font-medium bg-sand-200 text-sand-800 border border-sand-300" :
                  tier.color === "terracotta" ? "inline-block px-3 py-1 rounded-full text-xs font-medium bg-terracotta-100 text-terracotta-800 border border-terracotta-300" :
                  "inline-block px-3 py-1 rounded-full text-xs font-medium bg-sand-100 text-sand-600 border border-sand-200"
                }>
                  Niveau {tier.name}
                </span>
              </div>
              {next ? (
                <p className="text-xs text-sand-700 text-center">Plus que <strong>{next.pointsNeeded} points</strong> pour passer au niveau {next.name}</p>
              ) : (
                <p className="text-xs text-amber-700 text-center font-medium">Niveau maximum atteint 🏆</p>
              )}
              <p className="text-[10px] text-sand-500 text-center mt-3 pt-3 border-t border-sand-200">1 point = 100 MAD dépensés sur réservations payées</p>
            </CardBody>
          </Card>

          <Card className="border-red-200">
            <div className="px-5 py-4 border-b border-red-200 bg-red-50">
              <h2 className="font-display text-lg text-red-900">
                Zone de danger
              </h2>
            </div>
            <CardBody>
              <p className="text-sm text-sand-800 mb-4 leading-relaxed">
                Supprime définitivement la fiche client. Les réservations
                associées ne seront pas supprimées.
              </p>
              <form action={deleteCustomerBound}>
                <Button
                  type="submit"
                  variant="danger"
                  size="sm"
                  className="w-full"
                >
                  Supprimer ce client
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
