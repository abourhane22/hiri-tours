import Link from "next/link";
import { ExternalLink, Info } from "lucide-react";
import { formatMAD, formatDateShort } from "@/lib/utils";
import {
  margin,
  variance,
  marginTone,
  varianceTone,
  realCost,
  realMarginState,
  formatPct,
  MARGIN_TONE_STYLE,
  COST_SOURCE_LABEL,
  type CostSnapshot,
} from "@/lib/margin";
import { RefreshCostButton } from "@/components/reservations/refresh-cost-button";

export type MarginExpense = {
  id: string;
  expense_date: string;
  amount_mad: number;
  description: string | null;
  category: string | null;
  /** Dépense automatique (billet de l'ordre de distribution) — non modifiable. */
  automatic?: boolean;
};

/**
 * Carte « Marge » de la fiche dossier : vente nette, coût prévisionnel figé
 * (source cliquable), coût réel (dépenses du dossier, cliquable), marges en
 * MAD et %, écart. Les dépenses produit non ventilées sont mentionnées, jamais
 * réparties.
 */
export function MarginCard({
  reservationId,
  saleMad,
  credited = 0,
  expectedCost,
  snapshot,
  expenses,
  unallocated,
  departureDate,
  circuitId,
  readOnly,
  fromDistribution = false,
  hasMainCost = false,
}: {
  reservationId: string;
  /** Vente nette d'avoirs (lib/credit-notes.ts#netSaleOfReservation). */
  saleMad: number;
  credited?: number;
  expectedCost: number | null;
  snapshot: CostSnapshot | null;
  expenses: MarginExpense[];
  unallocated: { count: number; total: number };
  departureDate: string;
  circuitId: string;
  readOnly: boolean;
  /** Dossier issu de la distribution aérienne : coût prévisionnel = offre figée, jamais recalculé. */
  fromDistribution?: boolean;
  /** Une dépense du dossier couvre le coût fournisseur principal du type (cost_categories.main_cost_for). */
  hasMainCost?: boolean;
}) {
  const real = realCost(expenses);
  const mExp = margin(saleMad, expectedCost);
  const mReal = margin(saleMad, real);
  const v = variance(expectedCost, real);
  const tExp = MARGIN_TONE_STYLE[marginTone(mExp.pct)];
  // Marge réelle PROVISOIRE (lib/margin.ts#realMarginState) : jamais verte, écart en attente.
  const provisional = realMarginState({ expectedCost, realCost: real, hasMainCost }) === "provisional";
  const tReal = provisional ? MARGIN_TONE_STYLE.unknown : MARGIN_TONE_STYLE[marginTone(mReal.pct)];
  const tVar = provisional ? MARGIN_TONE_STYLE.unknown : MARGIN_TONE_STYLE[varianceTone(v)];

  const dep = new Date(departureDate + "T00:00:00");
  const expensesLink = (extra: string) => `/admin/finance/depenses?year=${dep.getFullYear()}&month=${dep.getMonth()}&${extra}`;

  const sourceHref =
    snapshot?.source === "contract" && snapshot.supplier_id
      ? `/admin/fournisseurs/${snapshot.supplier_id}${snapshot.contract_id ? `/contrats/${snapshot.contract_id}` : ""}`
      : snapshot?.source === "interne"
        ? `/admin/produits/${circuitId}`
        : null;

  return (
    <div className="space-y-3">
      {/* Trois montants */}
      <div className="grid grid-cols-3 gap-2">
        <Amount label="Vente nette" value={formatMAD(saleMad)} sub={credited > 0 ? `après avoirs (− ${formatMAD(credited)})` : undefined} />
        <Amount
          label="Coût prévisionnel"
          value={expectedCost !== null ? formatMAD(expectedCost) : "—"}
          sub={expectedCost === null ? "non renseigné" : undefined}
        />
        <Amount label="Coût réel" value={real !== null ? formatMAD(real) : "—"} sub={real === null ? "aucune dépense rattachée" : `${expenses.length} dépense${expenses.length > 1 ? "s" : ""}`} />
      </div>

      {/* Marges + écart */}
      <div className="grid grid-cols-3 gap-2">
        <Tone label="Marge prév." amount={mExp.amount} pct={mExp.pct} style={tExp} />
        <Tone label={provisional ? "Marge réelle provisoire" : "Marge réelle"} amount={mReal.amount} pct={mReal.pct} style={tReal} />
        {provisional ? (
          <div className="rounded-lg px-2.5 py-2" style={{ backgroundColor: tVar.bg }}>
            <div className="text-[10px] uppercase tracking-wide" style={{ color: tVar.color }}>Écart réel − prév.</div>
            <div className="font-display text-[16px] leading-tight mt-0.5" style={{ color: tVar.color }}>—</div>
            <div className="text-[10.5px]" style={{ color: tVar.color }}>en attente du coût fournisseur</div>
          </div>
        ) : (
          <Tone label="Écart réel − prév." amount={v.amount} pct={v.pct} style={tVar} signed />
        )}
      </div>
      {provisional && expectedCost !== null && (
        <p className="flex items-start gap-1.5 rounded-lg px-3 py-2 text-[12px]" style={{ backgroundColor: "#F1EFE8", color: "#58524A" }}>
          <Info className="size-3.5 shrink-0 mt-px" />
          Coût fournisseur pas encore saisi : {formatMAD(expectedCost)} prévus. La marge réelle sera définitive quand la dépense
          principale (hébergement, billet, transport…) sera rattachée au dossier.
        </p>
      )}

      {/* Source du coût prévisionnel */}
      <div className="text-[12px] text-[#6B6862] rounded-lg px-3 py-2" style={{ backgroundColor: "#FBF9F5", border: "1px solid #EEE9E0" }}>
        {snapshot ? (
          <>
            <div className="flex items-start justify-between gap-2">
              <span>
                <span className="font-medium text-[#1A1F2E]">{COST_SOURCE_LABEL[snapshot.source]}</span>
                {snapshot.supplier_name && <> · {snapshot.supplier_name}</>}
              </span>
              {sourceHref && (
                <Link href={sourceHref} className="inline-flex items-center gap-1 text-[#0C6B8A] hover:underline shrink-0">
                  ouvrir <ExternalLink className="size-3" />
                </Link>
              )}
            </div>
            <div className="mt-0.5 tabular-nums">
              {snapshot.unit_cost.toLocaleString("fr-FR")} {snapshot.currency}
              {snapshot.child_cost !== null && <> · enfant {snapshot.child_cost.toLocaleString("fr-FR")} {snapshot.currency}</>}
              {snapshot.currency !== "MAD" && <> × {snapshot.fx_rate} MAD</>}
              {" · "}figé le {formatDateShort(snapshot.computed_at)}
              {snapshot.previous && snapshot.previous.length > 0 && (
                <span className="text-[#968F84]"> · {snapshot.previous.length} recalcul{snapshot.previous.length > 1 ? "s" : ""}</span>
              )}
            </div>
          </>
        ) : (
          <span className="flex items-start gap-1.5">
            <Info className="size-3.5 shrink-0 mt-px" />
            {fromDistribution
              ? "Coût de l'offre non figé sur ce dossier billetterie. Il ne se recalcule pas : signalez-le à l'administrateur."
              : "Aucun coût figé : pas de tarif d'achat résolu ni de coût interne au moment de la vente. Le bouton ci-dessous réessaie avec les tarifs actuels."}
          </span>
        )}
      </div>

      {/* Dépenses du dossier */}
      {expenses.length > 0 && (
        <ul className="text-[12px] divide-y divide-[#F1EDE5] rounded-lg border border-[#EEE9E0]">
          {expenses.slice(0, 6).map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
              <span className="min-w-0 truncate text-[#1A1F2E]">
                {e.automatic && (
                  <span className="mr-1.5 rounded px-1.5 py-px text-[10.5px] font-medium" style={{ backgroundColor: "#E3F0F4", color: "#0C6B8A" }}>
                    auto
                  </span>
                )}
                {e.category ?? "Dépense"}
                {e.description && <span className="text-[#6B6862]"> · {e.description}</span>}
              </span>
              <span className="shrink-0 tabular-nums text-[#6B6862]">
                {formatDateShort(e.expense_date)} · {formatMAD(e.amount_mad)}
              </span>
            </li>
          ))}
          {expenses.length > 6 && <li className="px-3 py-1.5 text-[#968F84]">+ {expenses.length - 6} autre{expenses.length - 6 > 1 ? "s" : ""}</li>}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
        <span className="inline-flex flex-wrap items-center gap-3">
          <Link href={expensesLink(`reservation=${reservationId}`)} className="text-[#0C6B8A] hover:underline">
            Dépenses du dossier →
          </Link>
          {!readOnly && (
            <Link href={`/admin/finance/depenses/new?reservation=${reservationId}`} className="font-medium text-[#1A1F2E] hover:text-[#C84B31]">
              + Ajouter une dépense
            </Link>
          )}
        </span>
        {unallocated.count > 0 && (
          <Link href={expensesLink(`circuit=${circuitId}`)} className="text-[#B25F0B] hover:underline">
            {unallocated.count} dépense{unallocated.count > 1 ? "s" : ""} produit non ventilée{unallocated.count > 1 ? "s" : ""} ({formatMAD(unallocated.total)}) →
          </Link>
        )}
      </div>

      {/* Billetterie (offre figée) : pas de recalcul possible, donc pas de bouton. */}
      {!readOnly && !fromDistribution && snapshot?.source !== "distribution" && (
        <RefreshCostButton reservationId={reservationId} hasSnapshot={!!snapshot} />
      )}
    </div>
  );
}

function Amount({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg px-2.5 py-2" style={{ backgroundColor: "#FBF9F5", border: "1px solid #EEE9E0" }}>
      <div className="text-[10px] uppercase tracking-wide text-[#968F84]">{label}</div>
      <div className="font-display text-[16px] text-[#1A1F2E] tabular-nums leading-tight mt-0.5">{value}</div>
      {sub && <div className="text-[10.5px] text-[#968F84] mt-0.5">{sub}</div>}
    </div>
  );
}

function Tone({ label, amount, pct, style, signed }: { label: string; amount: number | null; pct: number | null; style: { color: string; bg: string }; signed?: boolean }) {
  const sign = signed && amount !== null && amount > 0 ? "+ " : "";
  return (
    <div className="rounded-lg px-2.5 py-2" style={{ backgroundColor: style.bg }}>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: style.color, opacity: 0.8 }}>{label}</div>
      <div className="font-display text-[16px] tabular-nums leading-tight mt-0.5" style={{ color: style.color }}>
        {amount === null ? "—" : `${sign}${formatMAD(amount)}`}
      </div>
      <div className="text-[10.5px] tabular-nums" style={{ color: style.color, opacity: 0.85 }}>{formatPct(pct)}</div>
    </div>
  );
}
