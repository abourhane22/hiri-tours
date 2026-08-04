"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { TunnelShell } from "@/components/payer/tunnel-shell";
import { setLinkSessionCookie } from "@/app/payer/actions";

/**
 * Écran de bascule à l'entrée d'un lien tokenisé valide : pose le cookie de
 * session (httpOnly, via server action) puis redirige vers le parcours de
 * paiement. Nécessaire car un Server Component ne peut pas écrire de cookie.
 */
export function StartLinkSession({ linkId, target }: { linkId: string; target: string }) {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await setLinkSessionCookie(linkId);
      } catch {
        // même en cas d'échec cookie, on poursuit vers le parcours
      }
      if (active) router.replace(target);
    })();
    return () => {
      active = false;
    };
  }, [linkId, target, router]);

  return (
    <TunnelShell bodyClassName="text-center">
      <div className="py-8 flex flex-col items-center gap-3 text-[#6B6862]">
        <Loader2 className="size-6 animate-spin text-[#0F6E56]" />
        <p className="text-sm">Redirection vers le paiement sécurisé…</p>
      </div>
    </TunnelShell>
  );
}
