import Link from "next/link";
import { CircleCheck, Clock, Flag, CircleX, Ban, CreditCard } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMAD, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_PILL: Record<string, { label: string; bg: string; color: string; Icon: typeof Clock }> = {
  pending: { label: "Demande", bg: "#FAEEDA", color: "#633806", Icon: Clock },
  confirmed: { label: "Confirmée", bg: "#E6F1FB", color: "#0C447C", Icon: CircleCheck },
  paid: { label: "Payée", bg: "#E1F5EE", color: "#0a4c54", Icon: CircleCheck },
  completed: { label: "Terminée", bg: "#F1EFE8", color: "#444441", Icon: Flag },
  cancelled: { label: "Annulée", bg: "#FCEBEB", color: "#791F1F", Icon: CircleX },
};

const STEPS = [
  { key: "pending", label: "Demande" },
  { key: "confirmed", label: "Confirmée" },
  { key: "paid", label: "Payée" },
  { key: "completed", label: "Terminée" },
];

function InvalidLink() {
  return (
    <div className="max-w-[560px] mx-auto px-4 py-16 text-center">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-[#F1EFE8]">
        <Ban className="size-7 text-[#968F84]" />
      </div>
      <h1 className="font-display text-xl text-[#1A1F2E]">Ce lien n&apos;est plus valide.</h1>
      <p className="mt-2 text-[13px] text-[#6B6862]">
        Le lien de suivi a peut-être été révoqué. Contactez l&apos;agence si besoin.
      </p>
    </div>
  );
}

export default async function SuiviPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: tokenRow } = await supabase
    .from("reservation_access_tokens")
    .select("reservation_id, revoked_at")
    .eq("token", token)
    .maybeSingle();

  if (!tokenRow || (tokenRow as any).revoked_at) return <InvalidLink />;

  const { data: reservation } = await supabase
    .from("reservations")
    .select(
      "id, reference, status, total_amount_mad, paid_amount_mad, departure_date, adults, children, intended_payment_channel, circuits(title), customers(full_name)",
    )
    .eq("id", (tokenRow as any).reservation_id)
    .maybeSingle();

  if (!reservation) return <InvalidLink />;
  const r = reservation as any;

  const status = r.status as string;
  const isCancelled = status === "cancelled";
  const totalAmount = Number(r.total_amount_mad);
  const totalPaid = Number(r.paid_amount_mad);
  const balance = totalAmount - totalPaid;
  const isSettled = balance <= 0 && totalAmount > 0;
  const progress = totalAmount > 0 ? Math.round(Math.min(100, (totalPaid / totalAmount) * 100)) : 0;

  const firstName = (r.customers?.full_name || "").trim().split(/\s+/)[0] || "";
  const pax = Number(r.adults) + Number(r.children);
  const pill = STATUS_PILL[status] ?? STATUS_PILL.pending;
  const currentStepIndex = STEPS.findIndex((s) => s.key === status);
  const channel = r.intended_payment_channel as string | null;

  const agenceButoir =
    channel === "agence" && r.departure_date
      ? new Date(new Date(r.departure_date).getTime() - 7 * 86400000).toISOString().slice(0, 10)
      : null;

  let bank: { rib: string | null; name: string | null; holder: string | null } | null = null;
  if (channel === "virement" && balance > 0 && !isCancelled) {
    const { data: company } = await supabase
      .from("company_settings")
      .select("bank_rib, bank_name, bank_account_holder")
      .limit(1)
      .maybeSingle();
    bank = {
      rib: (company as any)?.bank_rib ?? null,
      name: (company as any)?.bank_name ?? null,
      holder: (company as any)?.bank_account_holder ?? null,
    };
  }

  return (
    <div className="max-w-[560px] mx-auto px-4 py-6">
      {/* En-tête */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-[#968F84]">Réservation</div>
          <div className="font-mono text-lg text-[#1A1F2E]">{r.reference}</div>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium"
          style={{ backgroundColor: pill.bg, color: pill.color }}
        >
          <pill.Icon className="size-3.5" /> {pill.label}
        </span>
      </div>

      {/* Stepper compact */}
      {!isCancelled && (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {STEPS.map((s, i) => {
            const done = i < currentStepIndex;
            const active = i === currentStepIndex;
            const color = done ? "#0f6d78" : active ? "#C84B31" : "#E0DACF";
            return (
              <div key={s.key} className="pb-1.5" style={{ borderBottom: `2px solid ${color}` }}>
                <div
                  className="text-[11px] font-medium truncate"
                  style={{ color: done || active ? "#1A1F2E" : "#968F84" }}
                >
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Récap */}
      <div className="mt-5 rounded-xl border border-[#E5E0D7] bg-white p-4">
        <p className="text-[15px] text-[#1A1F2E] font-medium">Bonjour {firstName || "à vous"} 👋</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
          <div className="col-span-2">
            <dt className="text-[11px] uppercase tracking-wide text-[#968F84]">Prestation</dt>
            <dd className="text-[14px] text-[#1A1F2E]">{r.circuits?.title ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-[#968F84]">Départ</dt>
            <dd className="text-[14px] text-[#1A1F2E]">{formatDate(r.departure_date)}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-[#968F84]">Passagers</dt>
            <dd className="text-[14px] text-[#1A1F2E]">
              {pax} passager{pax > 1 ? "s" : ""}
            </dd>
          </div>
        </dl>
      </div>

      {/* Annulée */}
      {isCancelled ? (
        <div className="mt-4 rounded-xl border border-[#F1D9D9] bg-[#FCF4F4] p-4 text-[13px] text-[#791F1F]">
          Cette réservation a été annulée. Pour toute question, contactez l&apos;agence.
        </div>
      ) : (
        <>
          {/* Bloc paiement */}
          <div className="mt-4 rounded-xl border border-[#E5E0D7] bg-white p-4">
            <div className="flex items-baseline justify-between text-sm tabular-nums mb-1.5">
              <span className="text-[#6B6862]">Encaissé</span>
              <span>
                <span className="text-[#0f6d78] font-medium">{formatMAD(totalPaid)}</span>
                <span className="text-[#B4AC9E]"> / {formatMAD(totalAmount)}</span>
                {totalAmount > 0 && <span className="text-[#B4AC9E]"> · {progress} %</span>}
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#EEE9E0" }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${progress}%`, backgroundColor: "#0f6d78" }}
              />
            </div>

            {isSettled ? (
              <div
                className="mt-3 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium"
                style={{ backgroundColor: "#E1F5EE", color: "#0a4c54" }}
              >
                <CircleCheck className="size-4" /> Réservation réglée, à bientôt !
              </div>
            ) : (
              <>
                <div className="mt-2 text-[13px] text-[#6B6862]">
                  Restant dû :{" "}
                  <span className="font-medium tabular-nums text-[#1A1F2E]">{formatMAD(balance)}</span>
                </div>
                <Link
                  href={`/payer/${r.id}`}
                  className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0f6d78] px-4 text-sm font-medium text-white transition-colors hover:bg-[#0a4c54]"
                >
                  <CreditCard className="size-4" /> Payer {formatMAD(balance)} maintenant
                </Link>
              </>
            )}
          </div>

          {/* Canal virement : RIB + référence */}
          {channel === "virement" && balance > 0 && bank && (
            <div className="mt-4 rounded-xl border border-[#E5E0D7] bg-white p-4">
              <div className="rounded-lg bg-[#1A1F2E] p-4 text-white">
                <span className="text-[11px] uppercase tracking-wide text-[#9FB0C4]">RIB</span>
                <div className="mt-1.5 font-mono text-sm break-all">{bank.rib ?? "—"}</div>
                {bank.holder && (
                  <div className="mt-2 text-[12px] text-[#C7D2DE]">Titulaire : {bank.holder}</div>
                )}
                {bank.name && <div className="text-[12px] text-[#C7D2DE]">Banque : {bank.name}</div>}
              </div>
              <p className="mt-3 text-[13px] text-[#6B6862]">
                Indiquez la référence{" "}
                <span className="font-mono font-medium text-[#1A1F2E]">{r.reference}</span> dans le
                motif du virement. Vous pouvez aussi régler en ligne ci-dessus.
              </p>
            </div>
          )}

          {/* Canal agence : rappel du butoir */}
          {channel === "agence" && balance > 0 && (
            <div className="mt-4 rounded-xl border border-[#E5E0D7] bg-white p-4 text-[13px] text-[#6B6862]">
              Règlement à l&apos;agence (espèces ou carte)
              {agenceButoir ? (
                <>
                  {" "}
                  au plus tard le{" "}
                  <span className="font-medium text-[#1A1F2E]">{formatDate(agenceButoir)}</span>
                </>
              ) : null}
              . Vous pouvez aussi régler en ligne ci-dessus.
            </div>
          )}
        </>
      )}

      <p className="mt-6 text-center text-[11px] text-[#968F84]">
        Environnement de démonstration — aucune transaction bancaire réelle.
      </p>
    </div>
  );
}
