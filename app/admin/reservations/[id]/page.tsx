import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Card, CardBody, Badge } from "@/components/ui/card";
import { formatMAD, formatDate, formatDateShort } from "@/lib/utils";
import { ArrowLeft, Plus, Mail, Phone, FileText } from "lucide-react";
import {
  updateStatus,
  addPayment,
  updateNotes,
  cancelReservation,
} from "./actions";

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
  const updateStatusBound = updateStatus.bind(null, id);
  const addPaymentBound = addPayment.bind(null, id);
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
        <div className="mt-4">
          <Link href={`/admin/reservations/${id}/voucher`} target="_blank">
            <Button variant="secondary" size="sm"><FileText className="size-3.5" />Générer le voucher PDF</Button>
          </Link>
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

              {balance > 0 && !isCancelled && (
                <form
                  action={addPaymentBound}
                  className="space-y-3 pt-4 border-t border-sand-200"
                >
                  <p className="text-xs text-sand-600 uppercase tracking-wide font-medium">
                    Enregistrer un paiement
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="method">Méthode</Label>
                      <Select
                        id="method"
                        name="method"
                        required
                        defaultValue="cash"
                      >
                        <option value="cash">Espèces</option>
                        <option value="cmi">CMI Maroc</option>
                        <option value="transfer">Virement</option>
                        <option value="stripe">Stripe</option>
                        <option value="paypal">PayPal</option>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="amount_mad">Montant (MAD)</Label>
                      <Input
                        id="amount_mad"
                        name="amount_mad"
                        type="number"
                        min="0.01"
                        step="0.01"
                        max={balance}
                        defaultValue={balance.toFixed(2)}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="transaction_ref">
                      Référence transaction (optionnel)
                    </Label>
                    <Input
                      id="transaction_ref"
                      name="transaction_ref"
                      type="text"
                      placeholder="TXN-12345..."
                    />
                  </div>
                  <Button type="submit" size="sm">
                    <Plus className="size-3.5" />
                    Enregistrer le paiement
                  </Button>
                </form>
              )}
            </CardBody>
          </Card>

          {/* Notes */}
          <Card>
            <div className="px-5 py-4 border-b border-sand-200">
              <h2 className="font-display text-lg text-ink">Notes internes</h2>
            </div>
            <CardBody>
              <form action={updateNotesBound} className="space-y-3">
                <Textarea
                  name="notes"
                  rows={4}
                  defaultValue={reservation.notes ?? ""}
                  placeholder="Ajouter des notes sur ce dossier (allergies, demandes spéciales, source, etc.)..."
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
              <form action={updateStatusBound} className="space-y-3">
                <Label htmlFor="status">Statut du dossier</Label>
                <Select
                  id="status"
                  name="status"
                  defaultValue={reservation.status}
                >
                  <option value="pending">En attente</option>
                  <option value="confirmed">Confirmée</option>
                  <option value="paid">Payée</option>
                  <option value="completed">Terminée</option>
                  <option value="cancelled">Annulée</option>
                </Select>
                <Button type="submit" className="w-full">
                  Mettre à jour
                </Button>
              </form>
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
