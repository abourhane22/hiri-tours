import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Card, CardBody, Badge } from "@/components/ui/card";
import { formatMAD, formatDate, formatDateShort } from "@/lib/utils";
import { ArrowLeft, Mail, Phone, FileText, Receipt, Truck, Info } from "lucide-react";
import { updateNotes, cancelReservation } from "./actions";
import { IssueInvoiceButton } from "@/components/issue-invoice-button";
import { AffectationForm } from "@/components/affectation-form";
import { SendVoucherEmailButton } from "@/components/send-voucher-email-button";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { ReservationStatusForm } from "@/components/reservation-status-form";
import { PaymentForm } from "@/components/payment-form";
import type { Invoice, CompanySettings } from "@/lib/types";

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

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cmi: "CMI Maroc",
  stripe: "Stripe",
  paypal: "PayPal",
  cash: "Espèces",
  transfer: "Virement",
};

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: reservation } = await supabase
    .from("reservations")
    .select("*, circuits(title, slug, category, meeting_point), customers(id, full_name, email, phone)")
    .eq("id", id)
    .single();

  if (!reservation) notFound();

  const { data: existingInvoice } = await supabase
    .from("invoices")
    .select("id, invoice_number")
    .eq("reservation_id", id)
    .eq("status", "issued")
    .maybeSingle();

  const { data: companySettings } = await supabase
    .from("company_settings")
    .select("tva_default_rate")
    .limit(1)
    .single();

  const [vehiclesResult, staffResult, conflictsResult] = await Promise.all([
    supabase.from("vehicles").select("id, registration, make, model, capacity").eq("is_active", true).order("registration"),
    supabase.from("staff_members").select("id, full_name, role").eq("is_active", true).order("full_name"),
    supabase.from("reservations").select("id, vehicle_id, guide_id, driver_id").eq("departure_date", (reservation as any).departure_date).neq("id", id),
  ]);

  const vehiclesList = vehiclesResult.data || [];
  const staffList = staffResult.data || [];
  const sameDayReservations = conflictsResult.data || [];
  const conflictedVehicleIds = sameDayReservations.map((r: any) => r.vehicle_id).filter(Boolean);
  const conflictedStaffIds = [...sameDayReservations.map((r: any) => r.guide_id), ...sameDayReservations.map((r: any) => r.driver_id)].filter(Boolean);

  const { data: affectationData } = await supabase
    .from("reservations")
    .select("vehicle_id, guide_id, driver_id, vehicles(registration, make, model), guide:staff_members!reservations_guide_id_fkey(full_name), driver:staff_members!reservations_driver_id_fkey(full_name)")
    .eq("id", id)
    .single();

  const af = affectationData as any;
  const affectationNames = {
    vehicle: af?.vehicles ? `${af.vehicles.registration}${af.vehicles.make ? " · " + af.vehicles.make + " " + (af.vehicles.model || "") : ""}` : null,
    guide: af?.guide?.full_name ?? null,
    driver: af?.driver?.full_name ?? null,
  };

  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .eq("reservation_id", id)
    .order("paid_at", { ascending: false });

  const statusConf = STATUS_CONFIG[reservation.status] ?? STATUS_CONFIG.pending;
  const totalPaid = Number(reservation.paid_amount_mad);
  const totalAmount = Number(reservation.total_amount_mad);
  const balance = totalAmount - totalPaid;
  const paymentProgress =
    totalAmount > 0 ? Math.min(100, (totalPaid / totalAmount) * 100) : 0;
  const isCancelled = reservation.status === "cancelled";

  // Bind actions to this reservation's id
  const updateNotesBound = updateNotes.bind(null, id);
  const cancelReservationBound = cancelReservation.bind(null, id);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link
        href="/admin/reservations"
        className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink mb-4"
      >
        <ArrowLeft className="size-4" /> Retour aux réservations
      </Link>

      <div className="mb-8">
        <p className="eyebrow mb-2">Module 1 — Dossier de réservation</p>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-display text-3xl text-ink font-mono">
            {reservation.reference}
          </h1>
          <Badge tone={statusConf.tone}>{statusConf.label}</Badge>
        </div>
        <p className="text-sm text-sand-700 mt-2">
          Créée le {formatDate(reservation.created_at)} · Dernière mise à jour{" "}
          {formatDate(reservation.updated_at)}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link href={`/admin/reservations/${id}/voucher`} target="_blank">
            <Button variant="secondary" size="sm"><FileText className="size-3.5" />Générer le voucher PDF</Button>
          </Link>
          <SendVoucherEmailButton reservationId={id} customerEmail={(reservation as any).customers?.email ?? null} />
          <WhatsAppButton
            phone={(reservation as any).customers?.phone ?? null}
            message={`Bonjour ${(reservation as any).customers?.full_name ?? ""}, voici votre référence de réservation Hiri Tours : ${(reservation as any).reference}. Date de départ : ${(reservation as any).departure_date}.`}
            label="Envoyer par WhatsApp"
          />
          {(reservation.status === "paid" || reservation.status === "completed") && (
            existingInvoice ? (
              <Link href={`/admin/factures/${(existingInvoice as any).id}`} target="_blank" className="inline-block ml-2">
                <Button variant="secondary" size="sm">
                  <Receipt className="size-3.5" />
                  Voir facture {(existingInvoice as any).invoice_number}
                </Button>
              </Link>
            ) : (
              <span className="inline-block ml-2">
                <IssueInvoiceButton
                  reservationId={id}
                  defaultTvaRate={Number((companySettings as any)?.tva_default_rate ?? 0.20)}
                />
              </span>
            )
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Prestation */}
          <Card>
            <div className="px-5 py-4 border-b border-sand-200">
              <h2 className="font-display text-lg text-ink">
                Détails de la prestation
              </h2>
            </div>
            <CardBody className="space-y-4">
              <div>
                <div className="text-xs text-sand-600 uppercase tracking-wide mb-1">
                  Circuit
                </div>
                <div className="text-ink font-medium">
                  {(reservation as any).circuits?.title ?? "—"}
                </div>
                <div className="text-xs text-sand-600 capitalize">
                  {(reservation as any).circuits?.category}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-sand-600 uppercase tracking-wide mb-1">
                    Date de départ
                  </div>
                  <div className="text-ink">
                    {formatDate(reservation.departure_date)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-sand-600 uppercase tracking-wide mb-1">
                    Participants
                  </div>
                  <div className="text-ink">
                    {reservation.adults} adulte
                    {reservation.adults > 1 ? "s" : ""}
                    {reservation.children > 0 &&
                      `, ${reservation.children} enfant${
                        reservation.children > 1 ? "s" : ""
                      }`}
                  </div>
                </div>
              </div>
              {(reservation as any).circuits?.meeting_point && (
                <div>
                  <div className="text-xs text-sand-600 uppercase tracking-wide mb-1">
                    Point de rendez-vous
                  </div>
                  <div className="text-sm text-ink">
                    {(reservation as any).circuits.meeting_point}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Client */}
          <Card>
            <div className="px-5 py-4 border-b border-sand-200">
              <h2 className="font-display text-lg text-ink">Client</h2>
            </div>
            <CardBody className="space-y-2">
              {(reservation as any).customers ? (
                <>
                  <Link
                    href={`/admin/clients/${(reservation as any).customers.id}`}
                    className="text-ink font-medium hover:text-terracotta-600"
                  >
                    {(reservation as any).customers.full_name}
                  </Link>
                  {(reservation as any).customers.email && (
                    <div className="text-sm text-sand-800 flex items-center gap-2">
                      <Mail className="size-3.5" />{" "}
                      {(reservation as any).customers.email}
                    </div>
                  )}
                  {(reservation as any).customers.phone && (
                    <div className="text-sm text-sand-800 flex items-center gap-2">
                      <Phone className="size-3.5" />{" "}
                      {(reservation as any).customers.phone}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-sand-500">
                  Aucun client associé.
                </div>
              )}
            </CardBody>
          </Card>

          {/* Paiements */}
          <Card>
            <div className="px-5 py-4 border-b border-sand-200">
              <h2 className="font-display text-lg text-ink">Paiements</h2>
            </div>
            <CardBody>
              <div className="mb-5">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-sm text-sand-700">Encaissé</span>
                  <span className="text-sm tabular-nums">
                    <span
                      className={
                        balance <= 0
                          ? "text-emerald-700 font-medium"
                          : "text-ink font-medium"
                      }
                    >
                      {formatMAD(totalPaid)}
                    </span>
                    <span className="text-sand-500">
                      {" "}
                      / {formatMAD(totalAmount)}
                    </span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-sand-200 overflow-hidden">
                  <div
                    className={
                      balance <= 0
                        ? "h-full bg-emerald-500 transition-all"
                        : "h-full bg-terracotta-500 transition-all"
                    }
                    style={{ width: `${paymentProgress}%` }}
                  />
                </div>
                {balance > 0 && (
                  <div className="text-xs text-sand-600 mt-1.5">
                    Solde restant :{" "}
                    <span className="font-medium tabular-nums">
                      {formatMAD(balance)}
                    </span>
                  </div>
                )}
              </div>

              {payments && payments.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-3 py-2.5 bg-sand-50 rounded-md text-sm border border-sand-200"
                    >
                      <div>
                        <div className="text-ink font-medium">
                          {PAYMENT_METHOD_LABEL[p.method] ?? p.method}
                        </div>
                        <div className="text-xs text-sand-600">
                          {formatDateShort(p.paid_at)}
                          {p.transaction_ref && ` · ${p.transaction_ref}`}
                        </div>
                      </div>
                      <div className="font-mono text-emerald-700 font-medium tabular-nums">
                        +{formatMAD(p.amount_mad)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-sand-700 mb-4">
                  Aucun paiement enregistré.
                </p>
              )}

              {!isCancelled && balance <= 0 && totalAmount > 0 && (
                <div className="pt-4 border-t border-sand-200">
                  <Badge tone="success">Réservation soldée</Badge>
                </div>
              )}

              {balance > 0 && !isCancelled && (
                <PaymentForm reservationId={id} balance={balance} />
              )}
            </CardBody>
          </Card>

          {/* Notes */}
          <Card className="overflow-visible">
            <div className="px-5 py-4 border-b border-sand-200 flex items-center gap-1.5">
              <h2 className="font-display text-lg text-ink">Notes internes</h2>
              <span className="relative group inline-flex">
                <Info className="size-3.5 text-sand-600 cursor-help" />
                <span
                  role="tooltip"
                  className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 rounded-lg bg-[#1A1F2E] text-white text-xs px-3 py-2 leading-snug opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg"
                >
                  Renseignez ici les informations spécifiques à la réservation
                  et à son type : allergies, régimes, hébergement, demandes
                  particulières du client.
                </span>
              </span>
            </div>
            <CardBody>
              <form action={updateNotesBound} className="space-y-3">
                <Textarea
                  name="notes"
                  rows={4}
                  defaultValue={reservation.notes ?? ""}
                  placeholder="Allergies, préférences, demandes spéciales, particularités du groupe…"
                />
                <Button type="submit" variant="secondary" size="sm">
                  Enregistrer les notes
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <Card>
            <div className="px-5 py-4 border-b border-sand-200">
              <h2 className="font-display text-lg text-ink">Statut</h2>
            </div>
            <CardBody>
              <ReservationStatusForm
                reservationId={id}
                currentStatus={reservation.status}
              />
              <p className="text-xs text-sand-600 mt-3 leading-relaxed">
                Le statut passe automatiquement en{" "}
                <span className="font-medium">Payée</span> dès que le solde est
                entièrement encaissé.
              </p>
            </CardBody>
          </Card>

          <Card>
            <div className="px-5 py-4 border-b border-sand-200">
              <h2 className="font-display text-lg text-ink">Total</h2>
            </div>
            <CardBody>
              <div className="font-display text-3xl text-terracotta-600 tabular-nums">
                {formatMAD(totalAmount)}
              </div>
              <div className="text-xs text-sand-700 mt-2">
                {reservation.adults} adulte
                {reservation.adults > 1 ? "s" : ""}
                {reservation.children > 0 &&
                  `, ${reservation.children} enfant${
                    reservation.children > 1 ? "s" : ""
                  }`}
              </div>
            </CardBody>
          </Card>

          <Card>
            <div className="px-5 py-4 border-b border-sand-200 flex items-center gap-2">
              <Truck className="size-4 text-sand-700" />
              <h2 className="font-display text-lg text-ink">Affectation logistique</h2>
            </div>
            <CardBody>
              <AffectationForm
                reservationId={id}
                totalPax={(reservation as any).adults + (reservation as any).children}
                current={{
                  vehicle_id: af?.vehicle_id ?? null,
                  guide_id: af?.guide_id ?? null,
                  driver_id: af?.driver_id ?? null,
                }}
                currentNames={affectationNames}
                vehicles={vehiclesList as any}
                staff={staffList as any}
                conflictedVehicleIds={conflictedVehicleIds}
                conflictedStaffIds={conflictedStaffIds}
              />
            </CardBody>
          </Card>

          {!isCancelled && (
            <form action={cancelReservationBound}>
              <Card className="border-red-200">
                <div className="px-5 py-4 border-b border-red-200 bg-red-50">
                  <h2 className="font-display text-lg text-red-900">
                    Zone de danger
                  </h2>
                </div>
                <CardBody>
                  <p className="text-sm text-sand-800 mb-4 leading-relaxed">
                    Annule le dossier. Le client devra être recontacté pour un
                    remboursement éventuel.
                  </p>
                  <Button
                    type="submit"
                    variant="danger"
                    size="sm"
                    className="w-full"
                  >
                    Annuler la réservation
                  </Button>
                </CardBody>
              </Card>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
