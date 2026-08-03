import { redirect } from "next/navigation";
import Link from "next/link";
import { XCircle, Clock, CircleCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { TunnelShell } from "@/components/payer/tunnel-shell";

export const metadata = {
  title: "Paiement — Hiri Tours",
};

function StatusCard({
  icon,
  iconBg,
  iconColor,
  title,
  message,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <TunnelShell bodyClassName="text-center">
      <div className="py-6">
        <div
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: iconBg, color: iconColor }}
        >
          {icon}
        </div>
        <h1 className="font-display text-[22px] text-[#1A1F2E] mb-1.5">{title}</h1>
        <p className="text-[13px] text-[#6B6862]">{message}</p>
        {children}
      </div>
    </TunnelShell>
  );
}

export default async function TokenPayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: link } = await supabase
    .from("payment_links")
    .select("reservation_id, expires_at, used_at, revoked_at")
    .eq("token", token)
    .maybeSingle();

  const l = link as any;

  // Introuvable ou révoqué — pas de détail technique.
  if (!l || l.revoked_at) {
    return (
      <StatusCard
        icon={<XCircle className="size-9" />}
        iconBg="#FCEBEB"
        iconColor="#A32D2D"
        title="Lien non valide"
        message="Ce lien de paiement n'est plus valide. Contactez l'agence."
      />
    );
  }

  // Expiré.
  if (new Date(l.expires_at).getTime() < Date.now()) {
    return (
      <StatusCard
        icon={<Clock className="size-9" />}
        iconBg="#FAEEDA"
        iconColor="#B25F0B"
        title="Lien expiré"
        message="Ce lien a expiré. Demandez un nouveau lien à l'agence."
      />
    );
  }

  // Réservation soldée ?
  const { data: reservation } = await supabase
    .from("reservations")
    .select("id, total_amount_mad, paid_amount_mad")
    .eq("id", l.reservation_id)
    .maybeSingle();

  if (!reservation) {
    return (
      <StatusCard
        icon={<XCircle className="size-9" />}
        iconBg="#FCEBEB"
        iconColor="#A32D2D"
        title="Lien non valide"
        message="Ce lien de paiement n'est plus valide. Contactez l'agence."
      />
    );
  }

  const rr = reservation as any;
  const remaining = Number(rr.total_amount_mad) - Number(rr.paid_amount_mad);

  if (remaining <= 0) {
    // Récupère un éventuel paiement en ligne pour proposer le reçu.
    const { data: onlinePayment } = await supabase
      .from("payments")
      .select("external_ref")
      .eq("reservation_id", rr.id)
      .not("external_ref", "is", null)
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const ref = (onlinePayment as any)?.external_ref as string | undefined;

    return (
      <StatusCard
        icon={<CircleCheck className="size-9" />}
        iconBg="#E1F5EE"
        iconColor="#0F6E56"
        title="Réservation réglée"
        message="Cette réservation est déjà réglée. Merci !"
      >
        {ref && (
          <Link
            href={`/payer/${rr.id}/merci?ref=${ref}`}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[#E0DACF] bg-white px-5 text-sm font-medium text-[#1A1F2E] hover:bg-sand-100 transition-colors mt-6"
          >
            Voir le reçu
          </Link>
        )}
      </StatusCard>
    );
  }

  // Valide → le parcours de paiement existant prend le relais.
  redirect(`/payer/${l.reservation_id}`);
}
