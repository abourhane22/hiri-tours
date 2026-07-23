import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn, formatMAD, formatDate, formatDateShort } from "@/lib/utils";
import {
  ArrowLeft,
  Mail,
  Phone,
  Printer,
  Receipt,
  CreditCard,
  Clock,
  CircleCheck,
  CircleX,
  Flag,
  Check,
  User,
  MapPin,
  StickyNote,
  Banknote,
  Truck,
  RefreshCw,
  AlertTriangle,
  Info,
} from "lucide-react";
import { updateNotes, cancelReservation } from "./actions";
import { IssueInvoiceButton } from "@/components/issue-invoice-button";
import { AttijariLogo } from "@/components/payer/attijari-logo";
import { hasAttijariLogo } from "@/lib/attijari-server";
import { AffectationForm } from "@/components/affectation-form";
import { SendVoucherEmailButton } from "@/components/send-voucher-email-button";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { ReservationStatusForm } from "@/components/reservation-status-form";
import { PaymentForm } from "@/components/payment-form";

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  attijari: "Attijari Payment",
  cmi: "Attijari Payment", // legacy : anciens paiements stockés en 'cmi'
  stripe: "Stripe",
  paypal: "PayPal",
  cash: "Espèces",
  transfer: "Virement",
};

const STATUS_PILL: Record<
  string,
  { label: string; bg: string; color: string; Icon: typeof Clock }
> = {
  pending: { label: "Demande", bg: "#FAEEDA", color: "#633806", Icon: Clock },
  confirmed: { label: "Confirmée", bg: "#E6F1FB", color: "#0C447C", Icon: CircleCheck },
  paid: { label: "Payée", bg: "#E1F5EE", color: "#085041", Icon: CircleCheck },
  completed: { label: "Terminée", bg: "#F1EFE8", color: "#444441", Icon: Flag },
  cancelled: { label: "Annulée", bg: "#FCEBEB", color: "#791F1F", Icon: CircleX },
};

const STEPS = [
  { key: "pending", label: "Demande" },
  { key: "confirmed", label: "Confirmée" },
  { key: "paid", label: "Payée" },
  { key: "completed", label: "Terminée" },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function relativeTime(dateStr: string): string {
  const then = new Date(dateStr).getTime();
  const diffSec = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];
  for (const [unit, secs] of units) {
    if (abs >= secs || unit === "second") {
      return rtf.format(Math.round(diffSec / secs), unit);
    }
  }
  return "";
}

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: reservation } = await supabase
    .from("reservations")
    .select(
      "*, circuits(title, slug, category, meeting_point), customers(id, full_name, email, phone, country)",
    )
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
  const allAssigned = Boolean(af?.guide_id && af?.driver_id && af?.vehicle_id);

  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .eq("reservation_id", id)
    .order("paid_at", { ascending: false });

  const r = reservation as any;
  const status = r.status as string;
  const pill = STATUS_PILL[status] ?? STATUS_PILL.pending;
  const totalPaid = Number(r.paid_amount_mad);
  const totalAmount = Number(r.total_amount_mad);
  const balance = totalAmount - totalPaid;
  const paymentProgress = totalAmount > 0 ? Math.min(100, (totalPaid / totalAmount) * 100) : 0;
  const isCancelled = status === "cancelled";
  const isSettled = balance <= 0 && totalAmount > 0;
  const attijariHasLogo = hasAttijariLogo();
  const currentStepIndex = STEPS.findIndex((s) => s.key === status);
  const canInvoice = status === "paid" || status === "completed";

  const customer = r.customers;
  const circuit = r.circuits;
  const paxLabel =
    `${r.adults} adulte${r.adults > 1 ? "s" : ""}` +
    (r.children > 0 ? ` · ${r.children} enfant${r.children > 1 ? "s" : ""}` : "");

  const updateNotesBound = updateNotes.bind(null, id);
  const cancelReservationBound = cancelReservation.bind(null, id);

  const actionBtn =
    "inline-flex items-center gap-1.5 rounded-lg border border-[#E5E0D7] bg-white text-[12.5px] font-medium px-3.5 py-2 text-[#1A1F2E] hover:bg-[#FAF5F0] transition-colors";

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link
        href="/admin/reservations"
        className="inline-flex items-center gap-1 text-sm text-[#6B6862] hover:text-[#1A1F2E] mb-4"
      >
        <ArrowLeft className="size-4" /> Retour aux réservations
      </Link>

      {/* 1. EN-TÊTE DE DOSSIER */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <div>
          <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">
            Ventes · Dossier de réservation
          </p>
          <div className="flex items-center gap-3 flex-wrap mt-1.5">
            <h1 className="font-display text-[26px] text-[#1A1F2E] leading-none">
              {r.reference}
            </h1>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
              style={{ backgroundColor: pill.bg, color: pill.color }}
            >
              <pill.Icon className="size-3.5" />
              {pill.label}
            </span>
          </div>
          <p className="text-xs text-[#968F84] mt-2">
            Créée le {formatDate(r.created_at)} · dernière mise à jour{" "}
            {relativeTime(r.updated_at)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <SendVoucherEmailButton reservationId={id} customerEmail={customer?.email ?? null} />
          <Link href={`/admin/reservations/${id}/voucher`} target="_blank" className={actionBtn}>
            <Printer className="size-4" /> Imprimer
          </Link>
          <WhatsAppButton
            phone={customer?.phone ?? null}
            message={`Bonjour ${customer?.full_name ?? ""}, voici votre référence de réservation Hiri Tours : ${r.reference}. Date de départ : ${r.departure_date}.`}
            label="WhatsApp"
          />
          {canInvoice &&
            (existingInvoice ? (
              <Link href={`/admin/factures/${(existingInvoice as any).id}`} target="_blank" className={actionBtn}>
                <Receipt className="size-4" /> Facture {(existingInvoice as any).invoice_number}
              </Link>
            ) : (
              <IssueInvoiceButton
                reservationId={id}
                defaultTvaRate={Number((companySettings as any)?.tva_default_rate ?? 0.2)}
              />
            ))}
          {balance > 0 && !isCancelled && (
            <Link
              href={`/payer/${id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1A1F2E] text-white text-[12.5px] font-medium px-3.5 py-2 hover:bg-[#2A3142] transition-colors"
            >
              <CreditCard className="size-4" /> Encaisser en ligne
            </Link>
          )}
        </div>
      </div>

      {/* 2. STEPPER / BANDEAU ANNULÉE */}
      <div className="mt-6 mb-6">
        {isCancelled ? (
          <div
            className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-[13px]"
            style={{ backgroundColor: "#FCEBEB", borderColor: "#F7C1C1", color: "#791F1F" }}
          >
            <CircleX className="size-4 shrink-0" />
            <span>Réservation annulée le {formatDate(r.updated_at)}.</span>
          </div>
        ) : (
          <div className="flex items-start">
            {STEPS.map((step, i) => {
              const done = i < currentStepIndex;
              const current = i === currentStepIndex;
              return (
                <Fragment key={step.key}>
                  <div className="flex flex-col items-center gap-1.5 w-[72px] shrink-0">
                    <div
                      className={cn(
                        "size-[22px] rounded-full flex items-center justify-center text-[11px] font-medium border",
                        done && "bg-[#1A1F2E] text-white border-transparent",
                        current && "bg-[#0F6E56] text-white border-transparent",
                        !done && !current && "bg-white text-[#968F84] border-[#E0DACF]",
                      )}
                    >
                      {done ? <Check className="size-3" /> : i + 1}
                    </div>
                    <span
                      className={cn(
                        "text-[11px] text-center leading-tight",
                        current ? "text-[#0F6E56] font-medium" : "text-[#6B6862]",
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className="flex-1 h-0.5 mt-[10px]"
                      style={{ backgroundColor: i < currentStepIndex ? "#1A1F2E" : "#E0DACF" }}
                    />
                  )}
                </Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. GRILLE 2 COLONNES */}
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        {/* COLONNE GAUCHE */}
        <div className="flex flex-col gap-4">
          {/* a. CLIENT */}
          <InfoCard icon={User} label="Client">
            {customer ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="size-10 rounded-full flex items-center justify-center text-sm font-medium shrink-0"
                    style={{ backgroundColor: "#FAECE7", color: "#712B13" }}
                  >
                    {initials(customer.full_name)}
                  </div>
                  <div className="min-w-0">
                    <Link
                      href={`/admin/clients/${customer.id}`}
                      className="text-[#1A1F2E] font-medium hover:text-[#C84B31]"
                    >
                      {customer.full_name}
                    </Link>
                    {customer.country && (
                      <div className="text-xs text-[#6B6862]">{customer.country}</div>
                    )}
                  </div>
                </div>
                <div className="space-y-2 pt-1">
                  {customer.phone && (
                    <KV
                      label={<span className="inline-flex items-center gap-1.5"><Phone className="size-3.5" />Téléphone</span>}
                      value={customer.phone}
                    />
                  )}
                  {customer.email && (
                    <KV
                      label={<span className="inline-flex items-center gap-1.5"><Mail className="size-3.5" />Email</span>}
                      value={<span className="text-[#C84B31]">{customer.email}</span>}
                    />
                  )}
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-[#968F84] italic">Aucun client associé.</p>
            )}
          </InfoCard>

          {/* b. CIRCUIT & DÉPART */}
          <InfoCard icon={MapPin} label="Circuit & départ">
            <div className="space-y-2">
              <KV
                label="Circuit"
                value={
                  circuit ? (
                    <Link
                      href={`/admin/circuits/${r.circuit_id}`}
                      className="text-[#1A1F2E] hover:text-[#C84B31]"
                    >
                      {circuit.title}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              <KV label="Départ" value={formatDate(r.departure_date)} />
              <KV label="Passagers" value={paxLabel} />
              {circuit?.meeting_point && (
                <KV label="Point de rendez-vous" value={circuit.meeting_point} />
              )}
            </div>
          </InfoCard>

          {/* c. NOTES INTERNES */}
          <InfoCard icon={StickyNote} label="Notes internes">
            <form action={updateNotesBound} className="space-y-3">
              <Textarea
                name="notes"
                rows={4}
                defaultValue={r.notes ?? ""}
                placeholder="Allergies, préférences, demandes spéciales, particularités du groupe…"
                className="text-[13px]"
              />
              <div className="flex items-center gap-2">
                <Button type="submit" variant="secondary" size="sm">
                  Enregistrer les notes
                </Button>
                <span className="relative group inline-flex">
                  <Info className="size-3.5 text-[#968F84] cursor-help" />
                  <span
                    role="tooltip"
                    className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 rounded-lg bg-[#1A1F2E] text-white text-xs px-3 py-2 leading-snug opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg"
                  >
                    Renseignez ici les informations spécifiques à la réservation :
                    allergies, régimes, hébergement, demandes particulières.
                  </span>
                </span>
              </div>
            </form>
          </InfoCard>
        </div>

        {/* COLONNE DROITE */}
        <div className="flex flex-col gap-4">
          {/* d. PAIEMENTS */}
          <InfoCard icon={Banknote} label="Paiements">
            <div className="mb-4">
              <div className="flex items-baseline justify-between mb-1.5 text-sm tabular-nums">
                <span className="text-[#6B6862]">Encaissé</span>
                <span>
                  <span className="text-[#0F6E56] font-medium">{formatMAD(totalPaid)}</span>
                  <span className="text-[#B4AC9E]"> / {formatMAD(totalAmount)}</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#EEE9E0" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${paymentProgress}%`, backgroundColor: "#0F6E56" }}
                />
              </div>
              {balance > 0 && (
                <div className="text-xs text-[#968F84] mt-1.5">
                  Solde restant :{" "}
                  <span className="font-medium tabular-nums text-[#6B6862]">{formatMAD(balance)}</span>
                </div>
              )}
            </div>

            {payments && payments.length > 0 && (
              <div className="mb-3">
                {payments.map((p) => {
                  const isAttijari =
                    p.source === "attijari_test" || p.method === "attijari" || p.method === "cmi";
                  const badge =
                    p.source === "attijari_test"
                      ? { label: "test", bg: "#FFF4E0", color: "#8A5A00" }
                      : p.source === "stripe" || p.method === "stripe"
                        ? { label: "Stripe", bg: "#EEEDFE", color: "#3C3489" }
                        : { label: "manuel", bg: "#F1EFE8", color: "#5F5E5A" };
                  const ref = p.external_ref ?? p.transaction_ref;
                  return (
                    <div
                      key={p.id}
                      className="flex items-start justify-between gap-3 rounded-lg px-3 py-2.5 mb-2"
                      style={{ backgroundColor: "#FBF9F5", border: "1px solid #EEE9E0" }}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isAttijari ? (
                            <AttijariLogo hasLogo={attijariHasLogo} className="h-4" />
                          ) : (
                            <span className="font-medium text-[#1A1F2E]">
                              {PAYMENT_METHOD_LABEL[p.method] ?? p.method}
                            </span>
                          )}
                          <span
                            className="inline-flex items-center rounded px-1.5 py-0.5 text-[10.5px] font-medium"
                            style={{ backgroundColor: badge.bg, color: badge.color }}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <div className="text-[11.5px] text-[#968F84] mt-0.5">
                          {formatDateShort(p.paid_at)}
                          {ref && <span className="font-mono"> · {ref}</span>}
                        </div>
                      </div>
                      <div className="text-[#0F6E56] font-medium tabular-nums shrink-0">
                        +{formatMAD(p.amount_mad)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {isSettled && !isCancelled ? (
              <div
                className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium"
                style={{ backgroundColor: "#E1F5EE", color: "#085041" }}
              >
                <CircleCheck className="size-4" /> Réservation soldée
              </div>
            ) : (
              balance > 0 &&
              !isCancelled && <PaymentForm reservationId={id} balance={balance} />
            )}
          </InfoCard>

          {/* MONTANT TOTAL */}
          <InfoCard icon={Banknote} label="Montant total">
            <div className="font-display text-[26px] text-[#C84B31] tabular-nums leading-none">
              {formatMAD(totalAmount)}
            </div>
            <div className="text-xs text-[#6B6862] mt-2">{paxLabel}</div>
          </InfoCard>

          {/* e. LOGISTIQUE */}
          <InfoCard icon={Truck} label="Logistique">
            <div className="flex justify-end mb-3">
              {allAssigned ? (
                <span
                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium"
                  style={{ backgroundColor: "#E1F5EE", color: "#085041" }}
                >
                  <Check className="size-3" /> Équipage affecté
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium"
                  style={{ backgroundColor: "#FAEEDA", color: "#633806" }}
                >
                  <AlertTriangle className="size-3" /> À affecter
                </span>
              )}
            </div>
            <AffectationForm
              reservationId={id}
              totalPax={r.adults + r.children}
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
          </InfoCard>

          {/* f. STATUT */}
          <InfoCard icon={RefreshCw} label="Statut du dossier">
            <ReservationStatusForm reservationId={id} currentStatus={status} />
            <p className="text-xs text-[#968F84] mt-3 leading-relaxed">
              Le statut passe automatiquement en{" "}
              <span className="font-medium">Payée</span> dès que le solde est
              entièrement encaissé.
            </p>
          </InfoCard>

          {/* Zone de danger */}
          {!isCancelled && (
            <form action={cancelReservationBound}>
              <div className="bg-white border border-[#F7C1C1] rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <CircleX className="size-[13px] text-[#791F1F]" />
                  <span className="text-[10.5px] tracking-[1.4px] uppercase text-[#791F1F] font-medium">
                    Zone de danger
                  </span>
                </div>
                <p className="text-[13px] text-[#6B6862] mb-3 leading-relaxed">
                  Annule le dossier. Le client devra être recontacté pour un
                  remboursement éventuel.
                </p>
                <Button type="submit" variant="danger" size="sm" className="w-full">
                  Annuler la réservation
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Clock;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[#E5E0D7] rounded-xl p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <Icon className="size-[13px] text-[#968F84]" />
        <span className="text-[10.5px] tracking-[1.4px] uppercase text-[#968F84] font-medium">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function KV({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-[13px]">
      <span className="text-[#6B6862] shrink-0">{label}</span>
      <span className="text-[#1A1F2E] font-medium text-right">{value}</span>
    </div>
  );
}
