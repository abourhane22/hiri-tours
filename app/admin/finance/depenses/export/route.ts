import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ATTACHMENT_META, EXPENSE_PAYMENT_LABEL, attachmentOf, parseExpenseFilters } from "@/lib/expenses";
import { listExpenses, vehicleLabel } from "@/lib/expenses-query";

// Export CSV de la liste FILTRÉE (mêmes filtres que l'écran, sans pagination).
// Séparateur « ; » et BOM UTF-8 : ouverture directe dans Excel en français.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Session expirée" }, { status: 401 });

  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const f = parseExpenseFilters(sp);
  const result = await listExpenses(supabase, f, { paginate: false });
  if (result.error) {
    console.error("[dépenses] export :", result.error);
    return NextResponse.json({ error: "Export impossible : la requête a échoué." }, { status: 500 });
  }

  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["Date", "Libellé", "Catégorie", "Rattachement", "Cible", "Véhicule", "Fournisseur", "Payée par", "Montant TTC (MAD)", "Justificatif", "Notes"];
  const lines = result.rows.map((e) => {
    const att = attachmentOf(e);
    const target =
      att === "dossier" ? `${e.reservation?.reference ?? ""}${e.reservation?.customer ? ` — ${e.reservation.customer}` : ""}`
      : att === "produit" ? `${e.circuit?.title ?? ""}${e.departure_date ? ` — départ ${e.departure_date}` : ""}`
      : att === "vehicule" ? vehicleLabel(e.vehicle)
      : "Agence";
    return [
      e.expense_date,
      e.description ?? "",
      e.category?.name ?? "",
      ATTACHMENT_META[att].label,
      target,
      e.vehicle ? vehicleLabel(e.vehicle) : "",
      e.supplier?.name ?? "",
      e.payment_method ? EXPENSE_PAYMENT_LABEL[e.payment_method] ?? e.payment_method : "",
      Number(e.amount_mad).toFixed(2).replace(".", ","),
      e.receipt_path ? "oui" : "à joindre",
      e.notes ?? "",
    ].map(esc).join(";");
  });
  const csv = "﻿" + [header.join(";"), ...lines].join("\r\n");
  const name = `depenses_${result.range.start}_${result.range.end}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
