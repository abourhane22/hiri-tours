"use client";

import { useState, useTransition } from "react";
import { Copy, Check, Mail, Loader2, Link } from "lucide-react";
import {
  createPaymentLink,
  revokePaymentLink,
  sendPaymentLinkEmailAction,
} from "@/app/admin/reservations/[id]/payment-link-actions";

type ActiveLink = { url: string; expiresAt: string };

type ShareData = {
  firstName: string;
  reference: string;
  circuitTitle: string;
  departureDate: string;
  remaining: number;
  phone: string | null;
};

function formatDate(d: string) {
  return new Date(d).toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDayDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/** Normalise un numéro marocain au format international sans + ni espaces. */
export function normalizePhoneForWa(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const plus = phone.trim().startsWith("+");
  let d = phone.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("212")) {
    // déjà international
  } else if (!plus && d.startsWith("0")) {
    d = "212" + d.slice(1);
  } else if (d.length === 9) {
    // mobile marocain sans indicatif ni 0 (ex. 661234567)
    d = "212" + d;
  }
  return d.length >= 8 ? d : null;
}

function whatsappHref(share: ShareData, url: string): { href: string; hasNumber: boolean } {
  const num = normalizePhoneForWa(share.phone);
  const amount = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(share.remaining);
  const message =
    `Bonjour ${share.firstName || ""}, votre réservation ${share.reference} ` +
    `(${share.circuitTitle}, départ le ${formatDayDate(share.departureDate)}) : ` +
    `il reste ${amount} MAD à régler. Payez en ligne en toute sécurité : ${url} (valable 24h). — Hiri Tours`;
  const base = num ? `https://wa.me/${num}` : "https://wa.me/";
  return { href: `${base}?text=${encodeURIComponent(message)}`, hasNumber: !!num };
}

export function PaymentLinkPanel({
  reservationId,
  initialLink,
  share,
}: {
  reservationId: string;
  initialLink: ActiveLink | null;
  share: ShareData;
}) {
  const [link, setLink] = useState<ActiveLink | null>(initialLink);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [emailState, setEmailState] = useState<"idle" | "sent" | "error">("idle");
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

  function generate() {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const res = await createPaymentLink(reservationId);
      if (res.ok) setLink({ url: res.url, expiresAt: res.expiresAt });
      else setError(res.error);
    });
  }

  function copy() {
    if (!link) return;
    navigator.clipboard?.writeText(link.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function sendEmail() {
    if (isPending) return;
    setEmailState("idle");
    setEmailMsg(null);
    startTransition(async () => {
      const res = await sendPaymentLinkEmailAction(reservationId);
      if (res.ok) {
        setEmailState("sent");
      } else {
        setEmailState("error");
        setEmailMsg(res.error);
      }
    });
  }

  function revoke() {
    if (isPending) return;
    startTransition(async () => {
      const res = await revokePaymentLink(reservationId);
      if (res.ok) {
        setLink(null);
        setEmailState("idle");
        setEmailMsg(null);
      } else {
        setError(res.error);
      }
    });
  }

  if (!link) {
    return (
      <div className="mb-4">
        <button
          type="button"
          onClick={generate}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1A1F2E] hover:bg-[#2A3142] px-3.5 py-2 text-[13px] font-medium text-white transition-colors disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Link className="size-3.5" />
          )}
          <span>
            Lien de paiement en ligne
            <span className="opacity-60 font-normal"> · EDP partenaire</span>
          </span>
        </button>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>
    );
  }

  const wa = whatsappHref(share, link.url);

  return (
    <div className="mb-4 rounded-lg border border-[#E0DACF] bg-[#FBF9F5] p-3">
      <input
        readOnly
        value={link.url}
        onFocus={(e) => e.target.select()}
        className="w-full h-9 rounded-md border border-[#E0DACF] bg-white px-2.5 text-[12px] text-[#1A1F2E] font-mono"
      />

      <div className="flex flex-col sm:flex-row gap-2 mt-2.5">
        <button
          type="button"
          onClick={copy}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-md border border-[#E0DACF] bg-white px-3 h-8 text-[12px] font-medium text-[#1A1F2E] hover:bg-[#FAF5F0] transition-colors"
        >
          {copied ? <Check className="size-3.5 text-[#0F6E56]" /> : <Copy className="size-3.5" />}
          {copied ? "Copié" : "Copier"}
        </button>

        <a
          href={wa.href}
          target="_blank"
          rel="noopener noreferrer"
          title={
            wa.hasNumber
              ? undefined
              : "Numéro du client absent — choisissez le destinataire dans WhatsApp"
          }
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-md bg-[#25D366] hover:bg-[#1EBE5A] text-white px-3 h-8 text-[12px] font-medium transition-colors"
        >
          <WhatsAppGlyph />
          WhatsApp
        </a>

        <button
          type="button"
          onClick={sendEmail}
          disabled={isPending}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-md bg-[#1A1F2E] text-white px-3 h-8 text-[12px] font-medium hover:bg-[#2A3142] transition-colors disabled:opacity-60"
        >
          {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Mail className="size-3.5" />}
          Envoyer par email
        </button>
      </div>

      {emailState === "sent" && (
        <p className="text-[12px] text-[#0F6E56] inline-flex items-center gap-1 mt-2">
          <Check className="size-3.5" /> Email envoyé
        </p>
      )}
      {emailState === "error" && emailMsg && (
        <p className="text-[12px] text-red-600 mt-2">{emailMsg}</p>
      )}

      <div className="flex items-center justify-between gap-2 mt-2.5 text-[11px] text-[#968F84]">
        <span>Lien actif · expire le {formatDate(link.expiresAt)}</span>
        <button
          type="button"
          onClick={revoke}
          disabled={isPending}
          className="text-[#A32D2D] hover:underline disabled:opacity-60"
        >
          Révoquer
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}

function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5" aria-hidden focusable="false">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
