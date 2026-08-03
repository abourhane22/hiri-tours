"use client";

import { useState, useTransition } from "react";
import { Link2, Copy, Check, Mail, Loader2 } from "lucide-react";
import {
  createPaymentLink,
  revokePaymentLink,
  sendPaymentLinkEmailAction,
} from "@/app/admin/reservations/[id]/payment-link-actions";

type ActiveLink = { url: string; expiresAt: string };

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function PaymentLinkPanel({
  reservationId,
  initialLink,
}: {
  reservationId: string;
  initialLink: ActiveLink | null;
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
          className="inline-flex items-center gap-2 rounded-lg border border-[#E0DACF] bg-white px-3.5 py-2 text-[13px] font-medium text-[#1A1F2E] hover:bg-[#FAF5F0] transition-colors disabled:opacity-60"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
          Lien de paiement
        </button>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-[#E0DACF] bg-[#FBF9F5] p-3">
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={link.url}
          onFocus={(e) => e.target.select()}
          className="flex-1 min-w-0 h-9 rounded-md border border-[#E0DACF] bg-white px-2.5 text-[12px] text-[#1A1F2E] font-mono"
        />
        <button
          type="button"
          onClick={copy}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-[#E0DACF] bg-white px-2.5 h-9 text-[12px] font-medium text-[#1A1F2E] hover:bg-[#FAF5F0] transition-colors"
        >
          {copied ? <Check className="size-3.5 text-[#0F6E56]" /> : <Copy className="size-3.5" />}
          {copied ? "Copié" : "Copier"}
        </button>
      </div>

      <div className="flex items-center gap-3 mt-2.5 flex-wrap">
        <button
          type="button"
          onClick={sendEmail}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#1A1F2E] text-white px-3 h-8 text-[12px] font-medium hover:bg-[#2A3142] transition-colors disabled:opacity-60"
        >
          {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Mail className="size-3.5" />}
          Envoyer par email
        </button>
        {emailState === "sent" && (
          <span className="text-[12px] text-[#0F6E56] inline-flex items-center gap-1">
            <Check className="size-3.5" /> Email envoyé
          </span>
        )}
        {emailState === "error" && emailMsg && (
          <span className="text-[12px] text-red-600">{emailMsg}</span>
        )}
      </div>

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
