import { Lock, FlaskConical } from "lucide-react";

/**
 * Coquille visuelle commune au tunnel de paiement (/payer/*).
 * Bandeau navy "Hiri Tours" + bandeau test ambre, puis le corps en children.
 * Purement présentationnel — aucune logique.
 */
export function TunnelShell({
  children,
  bodyClassName = "",
}: {
  children: React.ReactNode;
  bodyClassName?: string;
}) {
  return (
    <main className="min-h-screen bg-sand-50 px-4 py-8 sm:py-12">
      <div className="max-w-[620px] mx-auto">
        {/* 1. Bandeau navy */}
        <div className="rounded-t-xl bg-[#1A1F2E] px-6 py-3.5 flex items-center justify-between">
          <div className="flex flex-col leading-none">
            <span className="font-display text-white text-lg tracking-tight">
              Hiri Tours
            </span>
            <span className="mt-1 text-[9px] tracking-[0.25em] uppercase text-[#FFB89A]">
              Plateforme
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-[#9FE1CB]">
            <Lock className="size-3.5" />
            Paiement sécurisé
          </span>
        </div>

        {/* 2. Bandeau test */}
        <div className="bg-[#FFF4E0] border-l-[3px] border-[#EF9F27] px-6 py-2 flex items-center gap-2">
          <FlaskConical className="size-3.5 text-[#8A5A00] shrink-0" />
          <p className="text-xs text-[#8A5A00]">
            Environnement de test — aucune transaction réelle
          </p>
        </div>

        {/* 3. Corps */}
        <div className={`bg-[#FAF5F0] rounded-b-xl p-6 ${bodyClassName}`}>
          {children}
        </div>
      </div>
    </main>
  );
}
