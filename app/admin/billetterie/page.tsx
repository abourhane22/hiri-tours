import { Plane, ShieldOff, FlaskConical, Lock, HelpCircle } from "lucide-react";
import { duffelConfigured, duffelTokenMode, DUFFEL_ENV_VAR, type DuffelMode } from "@/lib/duffel";
import { FlightSearch } from "@/components/billetterie/flight-search";

// Lot D1a — recherche en lecture seule. Aucun appel Duffel au chargement :
// la page ne fait qu'inspecter la configuration ; les appels partent des
// server actions, à l'action de l'utilisateur.
export default function BilletteriePage() {
  const configured = duffelConfigured();
  const mode = duffelTokenMode();
  const now = new Date();

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">Ventes · Distribution aérienne</p>
        <h1 className="font-display text-3xl text-[#1A1F2E] mt-1">Billetterie</h1>
        <p className="text-[12px] text-[#6B6862] mt-1 max-w-3xl">
          Connexion à un agrégateur de distribution aérienne s&apos;appuyant sur les GDS (Duffel : NDC, GDS et
          low-cost en production). Connexion GDS directe certifiée : phase projet · au {now.toLocaleDateString("fr-FR")}
        </p>
      </div>

      {!configured ? <NotConfigured /> : (
        <>
          <ModeBanner mode={mode} />
          <FlightSearch mode={mode} />
        </>
      )}
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="bg-white border border-[#E5E0D7] rounded-xl p-10 text-center max-w-2xl mx-auto">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full" style={{ backgroundColor: "#F1EFE8" }}>
        <ShieldOff className="size-7 text-[#968F84]" />
      </div>
      <h2 className="font-display text-xl text-[#1A1F2E]">Distribution aérienne non configurée</h2>
      <p className="text-[13px] text-[#6B6862] mt-2 leading-relaxed">
        Aucun identifiant Duffel n&apos;est présent sur ce déploiement. Ajoutez la variable d&apos;environnement{" "}
        <code className="rounded bg-[#F1EFE8] px-1.5 py-0.5 font-mono text-[12px] text-[#1A1F2E]">{DUFFEL_ENV_VAR}</code>{" "}
        (token de <span className="font-medium">test</span>, préfixe <code className="font-mono text-[12px]">duffel_test_</code>),
        côté serveur uniquement — jamais en <code className="font-mono text-[12px]">NEXT_PUBLIC_</code>.
      </p>
      <p className="text-[11.5px] text-[#968F84] mt-3">
        Aucun appel réseau n&apos;a été effectué. Cet écran disparaîtra au prochain déploiement une fois la variable définie.
      </p>
    </div>
  );
}

function ModeBanner({ mode }: { mode: DuffelMode }) {
  if (mode === "test") {
    return (
      <div className="mb-4 flex items-start gap-2.5 rounded-xl px-4 py-3 text-[13px]" style={{ backgroundColor: "#FFF4E0", border: "1px solid #EF9F27", color: "#7A4B00" }}>
        <FlaskConical className="size-4 shrink-0 mt-px" />
        <div>
          <span className="font-medium">Environnement de test Duffel</span> · offres de bac à sable, horaires et prix non réels ·
          aucune réservation réelle, aucun paiement.
          <span className="block text-[11.5px] mt-0.5 opacity-80">
            Plusieurs compagnies apparaissent, mais seule la compagnie fictive{" "}
            <span className="font-medium">Duffel Airways (ZZ)</span> est réservable de façon fiable. Le contrat d&apos;API est celui de la production ; seule la donnée est fictive.
          </span>
        </div>
        <span className="ml-auto inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide shrink-0" style={{ backgroundColor: "#7A4B00", color: "#FFF4E0" }}>
          TEST
        </span>
      </div>
    );
  }
  if (mode === "live") {
    return (
      <div className="mb-4 flex items-start gap-2.5 rounded-xl px-4 py-3 text-[13px]" style={{ backgroundColor: "#FCEBEB", border: "1px solid #F7C1C1", color: "#791F1F" }}>
        <Lock className="size-4 shrink-0 mt-px" />
        <div>
          <span className="font-medium">Identifiant LIVE détecté.</span> La recherche reste possible en lecture seule ;{" "}
          <span className="font-medium">aucune émission d&apos;ordre ne sera autorisée</span> depuis ce démonstrateur. Remplacez-le par un token de test.
        </div>
        <span className="ml-auto inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide shrink-0" style={{ backgroundColor: "#791F1F", color: "#FCEBEB" }}>
          LIVE
        </span>
      </div>
    );
  }
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-xl px-4 py-3 text-[13px]" style={{ backgroundColor: "#F1EFE8", border: "1px solid #E0DACF", color: "#58524A" }}>
      <HelpCircle className="size-4 shrink-0 mt-px" />
      <div>
        Préfixe de token non reconnu (ni <code className="font-mono text-[12px]">duffel_test_</code> ni <code className="font-mono text-[12px]">duffel_live_</code>).
        Le mode sera confirmé par le champ <code className="font-mono text-[12px]">live_mode</code> de la première réponse ; toute émission d&apos;ordre est refusée tant qu&apos;il n&apos;est pas prouvé « test ».
      </div>
    </div>
  );
}

// Icône réservée pour l'entrée de menu (cohérence visuelle).
export const BILLETTERIE_ICON = Plane;
