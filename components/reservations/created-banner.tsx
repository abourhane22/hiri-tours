"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { CircleCheck, MessageCircle, Link2, Printer, Users, Copy, Check, Loader2, AlertTriangle, X } from "lucide-react";
import { createPaymentLink } from "@/app/admin/reservations/[id]/payment-link-actions";

type Stored = { followups?: string[]; linkUrl?: string | null; onRequest?: boolean };

/**
 * Encart affiché une seule fois après la création (?created=1) : actions
 * suivantes. Le paramètre est retiré de l'URL sans navigation, donc un
 * rechargement ne le ré-affiche pas.
 */
export function CreatedBanner({
  reservationId,
  reference,
  phone,
  whatsappMessage,
  balance,
  travelersCount,
  expectedPax,
}: {
  reservationId: string;
  reference: string;
  phone: string | null;
  whatsappMessage: string;
  balance: number;
  travelersCount: number;
  expectedPax: number;
}) {
  const [stored, setStored] = useState<Stored>({});
  const [hidden, setHidden] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`hiri.created.${reservationId}`);
      if (raw) {
        const s = JSON.parse(raw) as Stored;
        setStored(s);
        if (s.linkUrl) setLink(s.linkUrl);
        sessionStorage.removeItem(`hiri.created.${reservationId}`);
      }
    } catch {}
    // Retire ?created=1 sans déclencher de navigation Next.
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("created")) {
        url.searchParams.delete("created");
        window.history.replaceState(null, "", url.pathname + (url.search ? url.search : "") + url.hash);
      }
    } catch {}
  }, [reservationId]);

  if (hidden) return null;

  const cleanPhone = (phone ?? "").replace(/\D/g, "");
  const waHref = cleanPhone.length >= 8 ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}` : null;
  const waLinkHref = link && cleanPhone.length >= 8 ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Bonjour, voici votre lien de paiement sécurisé pour la réservation ${reference} : ${link}`)}` : null;

  function generateLink() {
    setLinkError(null);
    startTransition(async () => {
      const res = await createPaymentLink(reservationId);
      if (res.ok) setLink(res.url);
      else setLinkError(res.error);
    });
  }
  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  const action = "inline-flex items-center gap-1.5 rounded-lg border border-[#A9DFCC] bg-white text-[12.5px] font-medium px-3 py-2 text-[#085041] hover:bg-[#E1F5EE] transition-colors disabled:opacity-60";

  return (
    <div className="mb-5 rounded-xl p-4" style={{ backgroundColor: "#E1F5EE", border: "1px solid #A9DFCC" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <CircleCheck className="size-5 shrink-0 mt-px" style={{ color: "#0F6E56" }} />
          <div>
            <p className="font-display text-[16px] text-[#085041] leading-tight">Dossier {reference} créé</p>
            <p className="text-[12.5px] text-[#085041] mt-0.5 opacity-90">
              {stored.onRequest ? "Placé sur demande (allotement épuisé) — à confirmer auprès du fournisseur. " : ""}
              Prochaines étapes :
            </p>
          </div>
        </div>
        <button type="button" onClick={() => setHidden(true)} className="inline-flex size-7 items-center justify-center rounded-md text-[#085041] hover:bg-[#C9EEDD]" aria-label="Fermer">
          <X className="size-4" />
        </button>
      </div>

      {stored.followups && stored.followups.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-lg px-3 py-2 text-[12px]" style={{ backgroundColor: "#FAEEDA", color: "#633806", border: "1px solid #F3D9A4" }}>
          {stored.followups.map((f) => (
            <li key={f} className="flex items-start gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0 mt-px" /> {f}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {waHref && (
          <a href={waHref} target="_blank" rel="noopener noreferrer" className={action}>
            <MessageCircle className="size-4" /> Envoyer la confirmation WhatsApp
          </a>
        )}
        {balance > 0 && !link && (
          <button type="button" onClick={generateLink} disabled={isPending} className={action}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />} Envoyer le lien de paiement
          </button>
        )}
        <Link href={`/admin/reservations/${reservationId}/voucher`} target="_blank" className={action}>
          <Printer className="size-4" /> Imprimer le voucher
        </Link>
        <a href="#voyageurs" className={action}>
          <Users className="size-4" /> Compléter les voyageurs ({travelersCount}/{expectedPax})
        </a>
      </div>

      {linkError && <p className="mt-2 text-[12px]" style={{ color: "#791F1F" }}>{linkError}</p>}
      {link && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2" style={{ border: "1px solid #A9DFCC" }}>
          <span className="text-[11px] uppercase tracking-wide text-[#085041] font-medium">Lien de paiement (24 h)</span>
          <code className="text-[12px] text-[#1A1F2E] break-all flex-1 min-w-[200px]">{link}</code>
          <button type="button" onClick={copy} className={action}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copié" : "Copier"}
          </button>
          {waLinkHref && (
            <a href={waLinkHref} target="_blank" rel="noopener noreferrer" className={action}>
              <MessageCircle className="size-4" /> WhatsApp
            </a>
          )}
        </div>
      )}
    </div>
  );
}
