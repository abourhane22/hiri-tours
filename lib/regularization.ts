// Régularisation d'un dossier ANNULÉ (facture + avoir du montant encaissé) — montant
// réellement à régulariser, calculé à la lecture. Correctif ciblé : ne modifie ni
// paid_amount_mad, ni les triggers, ni les fonctions d'avoir (lot « encaissé net »).
//
//   encaissé net   = Σ paiements − Σ remboursements de ses avoirs
//                    − Σ utilisations de ses avoirs sur d'autres dossiers
//   à régulariser  = max(0, encaissé net − Σ remaining_mad de ses avoirs ouverts)
//
// Un avoir déjà remboursé, ou encore ouvert, couvre l'encaissé : rien à régulariser —
// sinon on créerait un crédit fantôme.

import type { SupabaseClient } from "@supabase/supabase-js";

export type RegularizationState = {
  ok: boolean;
  /** Σ paiements du dossier. */
  collected: number;
  /** Σ remboursements de ses avoirs + Σ utilisations sur d'autres dossiers. */
  outflows: number;
  netCollected: number;
  /** Σ remaining_mad des avoirs ouverts (status issued) du dossier. */
  openCredits: number;
  toRegularize: number;
  /** Chaîne lisible : « Facture … annulée par l'avoir … · remboursé le … ». */
  history: {
    invoiceId: string | null;
    invoiceNumber: string | null;
    creditNoteId: string;
    creditNoteNumber: string;
    amount: number;
    remaining: number;
    status: string;
    refundedAt: string | null;
    refunded: number;
    usedElsewhere: number;
  }[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function regularizationState(supabase: SupabaseClient, reservationId: string): Promise<RegularizationState> {
  const [payRes, notesRes] = await Promise.all([
    supabase.from("payments").select("amount_mad").eq("reservation_id", reservationId),
    supabase
      .from("credit_notes")
      .select("id, credit_note_number, amount_mad, remaining_mad, status, invoice:invoices!invoice_id(id, invoice_number)")
      .eq("reservation_id", reservationId)
      .order("created_at", { ascending: true }),
  ]);
  const notes = (notesRes.data ?? []) as any[];
  const noteIds = notes.map((n) => n.id as string);
  const movRes = noteIds.length
    ? await supabase.from("credit_note_movements").select("credit_note_id, kind, amount_mad, target_reservation_id, created_at").in("credit_note_id", noteIds)
    : { data: [], error: null };
  const ok = !payRes.error && !notesRes.error && !movRes.error;
  const movements = (movRes.data ?? []) as { credit_note_id: string; kind: string; amount_mad: number; target_reservation_id: string | null; created_at: string }[];

  const collected = round2(((payRes.data ?? []) as { amount_mad: number }[]).reduce((s, p) => s + Number(p.amount_mad), 0));
  const isOutflow = (m: (typeof movements)[number]) =>
    m.kind === "refund" || (m.kind === "use" && m.target_reservation_id !== reservationId);
  const outflows = round2(movements.filter(isOutflow).reduce((s, m) => s + Number(m.amount_mad), 0));
  const netCollected = round2(collected - outflows);
  const openCredits = round2(notes.filter((n) => n.status === "issued").reduce((s, n) => s + Number(n.remaining_mad), 0));

  const history = notes.map((n) => {
    const inv = Array.isArray(n.invoice) ? n.invoice[0] : n.invoice;
    const own = movements.filter((m) => m.credit_note_id === n.id);
    const refunds = own.filter((m) => m.kind === "refund");
    return {
      invoiceId: inv?.id ?? null,
      invoiceNumber: inv?.invoice_number ?? null,
      creditNoteId: n.id as string,
      creditNoteNumber: n.credit_note_number as string,
      amount: Number(n.amount_mad),
      remaining: Number(n.remaining_mad),
      status: n.status as string,
      refunded: round2(refunds.reduce((s, m) => s + Number(m.amount_mad), 0)),
      refundedAt: refunds.length ? refunds.map((m) => m.created_at).sort().slice(-1)[0] : null,
      usedElsewhere: round2(own.filter((m) => m.kind === "use" && m.target_reservation_id !== reservationId).reduce((s, m) => s + Number(m.amount_mad), 0)),
    };
  });

  return {
    ok,
    collected,
    outflows,
    netCollected,
    openCredits,
    toRegularize: ok ? Math.max(0, round2(netCollected - openCredits)) : 0,
    history,
  };
}
