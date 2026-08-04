import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { formatMAD, formatDate, formatDateShort } from "@/lib/utils";
import {
  ArrowLeft,
  Mail,
  Phone,
  Printer,
  Receipt,
  Clock,
  CircleCheck,
  CircleX,
  Flag,
  Check,
  StickyNote,
  Banknote,
  Truck,
  RefreshCw,
  AlertTriangle,
  Info,
  FileText,
  Link2,
  History,
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
import { PaymentLinkPanel } from "@/components/payment-link-panel";

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  attijari: "Attijari Payment",
  cmi: "Attijari Payment",
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

function formatDateTime(d: string): string {
  return new Date(d).toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type JournalEvent = {
  at: string;
  title: string;
  Icon: typeof Clock;
  bg: string;
  color: string;
  auto?: boolean;
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
    .select(
      "*, circuits(title, slug, category, meeting_point, category_fields), customers(id, full_name, email, phone, country)",
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

  // Lien de paiement actif + tous les liens (pour le journal).
  const { data: allLinks } = await supabase
    .from("payment_links")
    .select("token, created_at, revoked_at, expires_at, used_at")
    .eq("reservation_id", id)
    .order("created_at", { ascending: true });

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
  const canInvoice = status === "paid" || status === "completed";

  const customer = r.customers;
  const circuit = r.circuits;
  const departureTime = circuit?.category_fields?.departure_time ?? null;
  const paxLabel =
    `${r.adults} adulte${r.adults > 1 ? "s" : ""}` +
    (r.children > 0 ? ` · ${r.children} enfant${r.children > 1 ? "s" : ""}` : "");

  const now = Date.now();
  const activeLinkRow = (allLinks || []).find(
    (l: any) => !l.revoked_at && !l.used_at && new Date(l.expires_at).getTime() > now,
  );
  const activeLink = activeLinkRow
    ? {
        url: `${process.env.NEXT_PUBLIC_APP_URL || "https://hiri-tours.vercel.app"}/payer/t/${(activeLinkRow as any).token}`,
        expiresAt: (activeLinkRow as any).expires_at as string,
      }
    : null;

  const updateNotesBound = updateNotes.bind(null, id);
  const cancelReservationBound = cancelReservation.bind(null, id);

  // ---- Journal du dossier (reconstruit, antichronologique) ----
  const events: JournalEvent[] = [];
  events.push({ at: r.created_at, title: "Dossier créé", Icon: FileText, bg: "#E6F1FB", color: "#0C447C" });

  const sortedPayments = [...(payments || [])].sort(
    (a: any, b: any) => new Date(a.paid_at).getTime() - new Date(b.paid_at).getTime(),
  );
  for (const p of sortedPayments as any[]) {
    const word =
      p.method === "cash" ? "espèces"
      : p.method === "transfer" ? "virement"
      : p.method === "attijari" || p.method === "cmi" ? "Attijari"
      : p.method === "stripe" ? "Stripe"
      : p.method;
    events.push({
      at: p.paid_at,
      title: `Paiement ${word} · +${formatMAD(p.amount_mad)}`,
      Icon: Banknote,
      bg: "#E1F5EE",
      color: "#0F6E56",
    });
  }

  if ((status === "confirmed" || status === "paid") && sortedPayments.length > 0) {
    events.push({
      at: sortedPayments[0].paid_at,
      title: "Auto-confirmée — acompte reçu",
      Icon: CircleCheck,
      bg: "#E6F1FB",
      color: "#0C447C",
      auto: true,
    });
  }

  for (const l of (allLinks || []) as any[]) {
    events.push({ at: l.created_at, title: "Lien de paiement créé", Icon: Link2, bg: "#FFF4E0", color: "#8A5A00" });
    if (l.revoked_at) {
      events.push({ at: l.revoked_at, title: "Lien de paiement révoqué", Icon: CircleX, bg: "#FCEBEB", color: "#A32D2D" });
    } else if (!l.used_at && new Date(l.expires_at).getTime() < now) {
      events.push({ at: l.expires_at, title: "Lien de paiement expiré", Icon: Clock, bg: "#F1EFE8", color: "#5F5E5A" });
    }
  }

  if (status === "completed") {
    const dayAfter = new Date(r.departure_date);
    dayAfter.setDate(dayAfter.getDate() + 1);
    events.push({
      at: dayAfter.toISOString(),
      title: "Passée à Terminée",
      Icon: Flag,
      bg: "#F1EFE8",
      color: "#444441",
      auto: true,
    });
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  // ---- Styles rail ----
  const railLabel = "text-[9.5px] tracking-[1.4px] uppercase font-medium";
  const railBtn =
    "w-full inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11.5px] font-medium text-white bg-white/[0.08] hover:bg-white/[0.14] transition-colors";

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link
        href="/admin/reservations"
        className="inline-flex items-center gap-1 text-sm text-[#6B6862] hover:text-[#1A1F2E] mb-4"
      >
        <ArrowLeft className="size-4" /> Retour aux réservations
      </Link>

      <div className="grid grid-cols-1 sm:grid-cols-[215px_1fr] gap-3.5 items-start">
        {/* ---- RAIL LATÉRAL ---- */}
        <aside
          className="rounded-xl p-4 text-white sm:sticky sm:top-4"
          style={{ backgroundColor: "#1A1F2E" }}
        >
          <p className="text-[10px] tracking-[2px] uppercase font-medium" style={{ color: "#FFB89A" }}>
            Dossier
          </p>
          <h1 className="font-display text-[22px] leading-none mt-1">{r.reference}</h1>

          {isCancelled ? (
            <div
              className="mt-3 flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[12px]"
              style={{ backgroundColor: "#FCEBEB", color: "#791F1F" }}
            >
              <CircleX className="size-3.5 shrink-0" />
              <span>Annulée le {formatDateShort(r.updated_at)}</span>
            </div>
          ) : (
            <span
              className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
              style={{ backgroundColor: pill.bg, color: pill.color }}
            >
              <pill.Icon className="size-3.5" />
              {pill.label}
            </span>
          )}

          <div className="mt-4 space-y-3">
            {customer && (
              <div>
                <div className={railLabel} style={{ color: "#8B92A5" }}>Client</div>
                <Link href={`/admin/clients/${customer.id}`} className="text-[13px] font-medium hover:underline">
                  {customer.full_name}
                </Link>
                {customer.country && (
                  <div className="text-[11.5px]" style={{ color: "#8B92A5" }}>{customer.country}</div>
                )}
                {customer.phone && (
                  <div className="text-[11.5px] flex items-center gap-1 mt-0.5" style={{ color: "#B7BECC" }}>
                    <Phone className="size-3" /> {customer.phone}
                  </div>
                )}
                {customer.email && (
                  <div className="text-[11.5px] flex items-center gap-1" style={{ color: "#B7BECC" }}>
                    <Mail className="size-3" /> <span className="truncate">{customer.email}</span>
                  </div>
                )}
              </div>
            )}

            <div>
              <div className={railLabel} style={{ color: "#8B92A5" }}>Circuit</div>
              {circuit ? (
                <Link href={`/admin/circuits/${r.circuit_id}`} className="text-[13px] hover:underline">
                  {circuit.title}
                </Link>
              ) : (
                <span className="text-[13px]">—</span>
              )}
            </div>

            <div>
              <div className={railLabel} style={{ color: "#8B92A5" }}>Départ</div>
              <div className="text-[13px]">
                {formatDate(r.departure_date)}
                {departureTime && ` · ${departureTime}`}
              </div>
              <div className="text-[11.5px]" style={{ color: "#8B92A5" }}>{paxLabel}</div>
            </div>

            <div>
              <div className={railLabel} style={{ color: "#8B92A5" }}>Restant dû</div>
              {balance > 0 ? (
                <div className="tabular-nums">
                  <span className="font-display text-xl" style={{ color: "#FFB89A" }}>{formatMAD(balance)}</span>
                  <span className="text-[11.5px]" style={{ color: "#8B92A5" }}> / {formatMAD(totalAmount)}</span>
                </div>
              ) : (
                <div className="font-display text-xl" style={{ color: "#9FE1CB" }}>Soldée</div>
              )}
            </div>
          </div>

          <div className="my-4 h-px" style={{ backgroundColor: "rgba(255,255,255,0.10)" }} />

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {balance > 0 && !isCancelled && (
              <PaymentLinkPanel
                reservationId={id}
                initialLink={activeLink}
                variant="rail"
                share={{
                  firstName: (customer?.full_name || "").trim().split(/\s+/)[0] || "",
                  reference: r.reference,
                  circuitTitle: circuit?.title ?? "",
                  departureDate: r.departure_date,
                  remaining: balance,
                  phone: customer?.phone ?? null,
                }}
              />
            )}
            <SendVoucherEmailButton reservationId={id} customerEmail={customer?.email ?? null} />
            <Link href={`/admin/reservations/${id}/voucher`} target="_blank" className={railBtn}>
              <Printer className="size-3.5" /> Imprimer
            </Link>
            <WhatsAppButton
              phone={customer?.phone ?? null}
              message={`Bonjour ${customer?.full_name ?? ""}, voici votre référence de réservation Hiri Tours : ${r.reference}. Date de départ : ${r.departure_date}.`}
              label="WhatsApp"
            />
            {canInvoice &&
              (existingInvoice ? (
                <Link href={`/admin/factures/${(existingInvoice as any).id}`} target="_blank" className={railBtn}>
                  <Receipt className="size-3.5" /> Facture {(existingInvoice as any).invoice_number}
                </Link>
              ) : (
                <IssueInvoiceButton
                  reservationId={id}
                  defaultTvaRate={Number((companySettings as any)?.tva_default_rate ?? 0.2)}
                />
              ))}
          </div>
        </aside>

        {/* ---- CONTENU PRINCIPAL ---- */}
        <div className="flex flex-col gap-4">
          {/* a. PAIEMENTS */}
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

          {/* b. LOGISTIQUE */}
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

          {/* c. STATUT */}
          <InfoCard icon={RefreshCw} label="Statut du dossier">
            <ReservationStatusForm
              reservationId={id}
              currentStatus={status}
              paidAmount={totalPaid}
              totalAmount={totalAmount}
            />
            <p className="text-xs text-[#968F84] mt-3 leading-relaxed">
              Le statut passe automatiquement en{" "}
              <span className="font-medium">Payée</span> dès que le solde est
              entièrement encaissé.
            </p>
          </InfoCard>

          {/* d. NOTES INTERNES */}
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

          {/* e. JOURNAL DU DOSSIER */}
          <InfoCard icon={History} label="Journal du dossier">
            <ol className="space-y-3">
              {events.map((e, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className="size-[22px] rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: e.bg, color: e.color }}
                  >
                    <e.Icon className="size-3" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-[#1A1F2E] flex items-center gap-2 flex-wrap">
                      {e.title}
                      {e.auto && (
                        <span
                          className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ backgroundColor: "#F1EFE8", color: "#5F5E5A" }}
                        >
                          automatique
                        </span>
                      )}
                    </div>
                    <div className="text-[11.5px] text-[#968F84]">{formatDateTime(e.at)}</div>
                  </div>
                </li>
              ))}
            </ol>
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
