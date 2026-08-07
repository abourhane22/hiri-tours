"use client";

import { useActionState } from "react";
import { Search, Loader2 } from "lucide-react";
import { findReservationForTracking, type TrackingState } from "@/app/reserver/actions";

const labelCls = "block text-[12px] font-medium text-[#58524A] mb-1.5";
const fieldCls =
  "h-10 w-full rounded-lg border border-[#E0DACF] bg-white px-3 text-sm text-[#1A1F2E] placeholder:text-sand-400 focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors";

export function TrackingForm() {
  const [state, formAction, isPending] = useActionState<TrackingState, FormData>(
    findReservationForTracking,
    null,
  );

  return (
    <form action={formAction} className="rounded-xl border border-[#E5E0D7] bg-white p-4 space-y-4">
      <div>
        <label htmlFor="reference" className={labelCls}>
          Référence du dossier
        </label>
        <input
          id="reference"
          name="reference"
          type="text"
          required
          placeholder="AG-2026-00123"
          className={`${fieldCls} font-mono`}
        />
      </div>

      <div>
        <label htmlFor="contact" className={labelCls}>
          Email ou téléphone
        </label>
        <input
          id="contact"
          name="contact"
          type="text"
          required
          placeholder="vous@email.com ou 06 12 34 56 78"
          className={fieldCls}
        />
      </div>

      {/* Honeypot anti-bot (masqué) */}
      <div aria-hidden className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden">
        <label htmlFor="website">Ne pas remplir</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0f6d78] px-4 text-sm font-medium text-white transition-colors hover:bg-[#0a4c54] disabled:opacity-60 disabled:pointer-events-none"
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Recherche…
          </>
        ) : (
          <>
            <Search className="size-4" /> Retrouver mon dossier
          </>
        )}
      </button>
    </form>
  );
}
