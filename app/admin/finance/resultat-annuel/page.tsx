import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computeAnnualResult, type AnnualMonth, type AnnualResult, type AnnualCategory } from "@/lib/finance";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PrintButton } from "./print-button";

function fmt(n: number): string {
  if (Math.abs(n) < 0.5) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n));
}
function fmtPct(p: number): string {
  if (Math.abs(p) < 0.05) return "0,0%";
  return `${p.toFixed(1).replace(".", ",")}%`;
}
function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export default async function ResultatAnnuelPage({ searchParams }: { searchParams: Promise<{ year?: string; compare?: string }> }) {
  const { year: yearStr, compare } = await searchParams;
  const currentYear = new Date().getFullYear();
  const year = yearStr ? parseInt(yearStr, 10) : currentYear;
  const compareMode = compare === "1";

  const supabase = await createClient();
  const result = await computeAnnualResult(year, supabase);
  const prev = compareMode ? await computeAnnualResult(year - 1, supabase) : null;

  const directCats = result.categories.filter(c => c.type === "direct");
  const overheadCats = result.categories.filter(c => c.type === "overhead");
  const yearOptions = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];

  return (
    <div className="p-8 max-w-[1500px] mx-auto print:p-2">
      <Link href="/admin/finance" className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink mb-4 print:hidden">
        <ArrowLeft className="size-4" /> Retour à Finance
      </Link>

      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <p className="eyebrow mb-2 print:hidden">Finance</p>
          <h1 className="font-display text-3xl text-ink">Compte de résultat — {year}</h1>
          <p className="text-sm text-sand-700 mt-2 print:hidden">
            {compareMode ? `Comparaison ${year} vs ${year - 1}` : "Performance mois par mois et soldes intermédiaires de gestion (SIG)."}
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <div className="flex items-center gap-1 bg-sand-100 p-1 rounded-md">
            {yearOptions.map(y => (
              <Link key={y} href={`?year=${y}${compareMode ? "&compare=1" : ""}`} className={`px-3 py-1 text-sm rounded ${year === y ? "bg-white shadow-sm font-medium text-ink" : "text-sand-700 hover:text-ink"}`}>
                {y}
              </Link>
            ))}
          </div>
          <Link href={`?year=${year}&compare=${compareMode ? "0" : "1"}`}>
            <Button variant="secondary" size="sm">{compareMode ? "Vue mensuelle" : "Comparer N-1"}</Button>
          </Link>
          <PrintButton />
        </div>
      </div>

      <Card className="mb-6">
        <div className="px-5 py-3 border-b border-sand-200 bg-sand-50/50">
          <h2 className="font-display text-lg text-ink">{compareMode ? `Synthèse ${year} vs ${year - 1}` : "Compte de Produits et Charges"}</h2>
        </div>
        <div className="overflow-x-auto">
          {compareMode && prev ? <ComparisonTable current={result} previous={prev} directCats={directCats} overheadCats={overheadCats} /> : <MonthlyTable result={result} directCats={directCats} overheadCats={overheadCats} />}
        </div>
      </Card>

      <Card>
        <div className="px-5 py-3 border-b border-sand-200 bg-sand-50/50">
          <h2 className="font-display text-lg text-ink">Soldes Intermédiaires de Gestion · {year}</h2>
          <p className="text-xs text-sand-700 mt-1">Cascade des marges depuis le chiffre d'affaires HT jusqu'au résultat net.</p>
        </div>
        <CardBody>
          <SIGCascade result={result} />
        </CardBody>
      </Card>
    </div>
  );
}

function MonthlyTable({ result, directCats, overheadCats }: { result: AnnualResult; directCats: AnnualCategory[]; overheadCats: AnnualCategory[] }) {
  const { months, total } = result;
  const vals = (extractor: (m: AnnualMonth) => number): number[] => [...months.map(extractor), extractor(total)];

  type RowOpts = { bold?: boolean; section?: boolean; result?: boolean; subtle?: boolean; italic?: boolean; indent?: boolean; isPercent?: boolean; negative?: boolean };

  function Row({ label, values, opts = {} }: { label: string; values: number[]; opts?: RowOpts }) {
    const bgClass = opts.section ? "bg-sand-100" : opts.result ? "bg-emerald-50/60" : "bg-white";
    const rowCls = [opts.bold ? "font-semibold" : "", opts.section ? "text-[10px] uppercase tracking-wider text-sand-700" : "", opts.subtle ? "text-sand-600" : "", opts.italic ? "italic" : "", "border-t border-sand-100"].join(" ");

    return (
      <tr className={rowCls}>
        <td className={`sticky left-0 z-10 ${bgClass} px-3 py-1.5 text-xs ${opts.indent ? "pl-6" : ""}`}>{label}</td>
        {values.map((v, i) => {
          const isTotal = i === values.length - 1;
          const formatted = opts.isPercent ? fmtPct(v) : opts.negative ? (Math.abs(v) < 0.5 ? "—" : `(${fmt(Math.abs(v))})`) : fmt(v);
          const colorCls = !opts.isPercent && !opts.negative && v < 0 ? "text-red-700" : "";
          return (
            <td key={i} className={`px-2 py-1.5 text-right tabular-nums text-xs ${colorCls} ${isTotal ? "font-semibold bg-sand-50/80" : ""}`}>{formatted}</td>
          );
        })}
      </tr>
    );
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="bg-sand-100">
          <th className="sticky left-0 z-10 bg-sand-100 text-left px-3 py-2 font-medium text-sand-800 min-w-[220px]">Libellé</th>
          {months.map(m => <th key={m.month} className="text-right px-2 py-2 font-medium text-sand-800 min-w-[70px]">{m.monthLabel}</th>)}
          <th className="text-right px-2 py-2 font-medium text-sand-800 min-w-[90px] bg-sand-200">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        <Row label="PRODUITS" values={vals(() => 0)} opts={{ section: true }} />
        <Row label="Chiffre d'affaires TTC" values={vals(m => m.revenueTTC)} opts={{ subtle: true, indent: true }} />
        <Row label="dont TVA collectée" values={vals(m => m.vatCollected)} opts={{ subtle: true, italic: true, indent: true, negative: true }} />
        <Row label="Chiffre d'affaires HT" values={vals(m => m.revenueHT)} opts={{ bold: true }} />

        <Row label="CHARGES DIRECTES" values={vals(() => 0)} opts={{ section: true }} />
        {directCats.map(c => (<Row key={c.id} label={c.name} values={vals(m => m.costsByCategory[c.id] || 0)} opts={{ indent: true, negative: true }} />))}
        <Row label="Total charges directes" values={vals(m => m.directCosts)} opts={{ bold: true, negative: true }} />

        <Row label="MARGE BRUTE" values={vals(m => m.grossMargin)} opts={{ bold: true, result: true }} />
        <Row label="% marge brute" values={vals(m => m.grossMarginPct)} opts={{ subtle: true, italic: true, indent: true, isPercent: true }} />

        <Row label="CHARGES OVERHEAD" values={vals(() => 0)} opts={{ section: true }} />
        {overheadCats.map(c => (<Row key={c.id} label={c.name} values={vals(m => m.costsByCategory[c.id] || 0)} opts={{ indent: true, negative: true }} />))}
        <Row label="Total charges overhead" values={vals(m => m.overheadCosts)} opts={{ bold: true, negative: true }} />

        <Row label="RÉSULTAT NET" values={vals(m => m.netResult)} opts={{ bold: true, result: true }} />
        <Row label="% marge nette" values={vals(m => m.netMarginPct)} opts={{ subtle: true, italic: true, indent: true, isPercent: true }} />
      </tbody>
    </table>
  );
}

function ComparisonTable({ current, previous, directCats, overheadCats }: { current: AnnualResult; previous: AnnualResult; directCats: AnnualCategory[]; overheadCats: AnnualCategory[] }) {
  function CompareRow({ label, currentVal, previousVal, opts = {} }: { label: string; currentVal: number; previousVal: number; opts?: { bold?: boolean; section?: boolean; result?: boolean; subtle?: boolean; italic?: boolean; indent?: boolean; isPercent?: boolean; negative?: boolean; reverseGood?: boolean } }) {
    const delta = currentVal - previousVal;
    const deltaP = deltaPct(currentVal, previousVal);
    const isGood = opts.reverseGood ? delta < 0 : delta > 0;
    const showColors = !opts.section && !opts.subtle;
    const bgClass = opts.section ? "bg-sand-100" : opts.result ? "bg-emerald-50/60" : "bg-white";
    const rowCls = [opts.bold ? "font-semibold" : "", opts.section ? "text-[10px] uppercase tracking-wider text-sand-700" : "", opts.subtle ? "text-sand-600" : "", opts.italic ? "italic" : "", "border-t border-sand-100"].join(" ");

    const formatCell = (n: number) => opts.isPercent ? fmtPct(n) : opts.negative ? (Math.abs(n) < 0.5 ? "—" : `(${fmt(Math.abs(n))})`) : fmt(n);

    return (
      <tr className={rowCls}>
        <td className={`${bgClass} px-3 py-2 text-xs ${opts.indent ? "pl-6" : ""}`}>{label}</td>
        <td className={`px-3 py-2 text-right tabular-nums text-xs ${opts.bold ? "font-semibold" : ""}`}>{formatCell(currentVal)}</td>
        <td className={`px-3 py-2 text-right tabular-nums text-xs text-sand-600`}>{formatCell(previousVal)}</td>
        {!opts.section && (
          <>
            <td className={`px-3 py-2 text-right tabular-nums text-xs ${showColors && delta !== 0 ? (isGood ? "text-emerald-700" : "text-red-700") : ""}`}>
              {delta === 0 ? "—" : `${delta > 0 ? "+" : ""}${fmt(delta)}`}
            </td>
            <td className={`px-3 py-2 text-right tabular-nums text-xs ${showColors && deltaP !== null && deltaP !== 0 ? (isGood ? "text-emerald-700" : "text-red-700") : "text-sand-600"}`}>
              {deltaP === null ? "n/a" : deltaP === 0 ? "—" : <span className="inline-flex items-center gap-1">{deltaP > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}{Math.abs(deltaP).toFixed(0)}%</span>}
            </td>
          </>
        )}
        {opts.section && <td colSpan={3}></td>}
      </tr>
    );
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="bg-sand-100">
          <th className="text-left px-3 py-2 font-medium text-sand-800">Libellé</th>
          <th className="text-right px-3 py-2 font-medium text-sand-800">{current.year}</th>
          <th className="text-right px-3 py-2 font-medium text-sand-800">{previous.year}</th>
          <th className="text-right px-3 py-2 font-medium text-sand-800">Δ MAD</th>
          <th className="text-right px-3 py-2 font-medium text-sand-800">Δ %</th>
        </tr>
      </thead>
      <tbody>
        <CompareRow label="PRODUITS" currentVal={0} previousVal={0} opts={{ section: true }} />
        <CompareRow label="Chiffre d'affaires TTC" currentVal={current.total.revenueTTC} previousVal={previous.total.revenueTTC} opts={{ subtle: true, indent: true }} />
        <CompareRow label="Chiffre d'affaires HT" currentVal={current.total.revenueHT} previousVal={previous.total.revenueHT} opts={{ bold: true }} />

        <CompareRow label="CHARGES DIRECTES" currentVal={0} previousVal={0} opts={{ section: true }} />
        {directCats.map(c => (<CompareRow key={c.id} label={c.name} currentVal={current.total.costsByCategory[c.id] || 0} previousVal={previous.total.costsByCategory[c.id] || 0} opts={{ indent: true, negative: true, reverseGood: true }} />))}
        <CompareRow label="Total charges directes" currentVal={current.total.directCosts} previousVal={previous.total.directCosts} opts={{ bold: true, negative: true, reverseGood: true }} />

        <CompareRow label="MARGE BRUTE" currentVal={current.total.grossMargin} previousVal={previous.total.grossMargin} opts={{ bold: true, result: true }} />

        <CompareRow label="CHARGES OVERHEAD" currentVal={0} previousVal={0} opts={{ section: true }} />
        {overheadCats.map(c => (<CompareRow key={c.id} label={c.name} currentVal={current.total.costsByCategory[c.id] || 0} previousVal={previous.total.costsByCategory[c.id] || 0} opts={{ indent: true, negative: true, reverseGood: true }} />))}
        <CompareRow label="Total charges overhead" currentVal={current.total.overheadCosts} previousVal={previous.total.overheadCosts} opts={{ bold: true, negative: true, reverseGood: true }} />

        <CompareRow label="RÉSULTAT NET" currentVal={current.total.netResult} previousVal={previous.total.netResult} opts={{ bold: true, result: true }} />
      </tbody>
    </table>
  );
}

function SIGCascade({ result }: { result: AnnualResult }) {
  const t = result.total;
  const lines = [
    { label: "Chiffre d'affaires HT", value: t.revenueHT, bold: true, pct: 100, primary: true },
    { label: "– Achats et services directs", value: -t.directCosts, indent: true, subtle: true, pct: t.revenueHT > 0 ? (-t.directCosts / t.revenueHT) * 100 : 0 },
    { label: "= MARGE BRUTE", value: t.grossMargin, bold: true, pct: t.grossMarginPct, highlight: "emerald" },
    { label: "– Charges externes overhead", value: -t.overheadCosts, indent: true, subtle: true, pct: t.revenueHT > 0 ? (-t.overheadCosts / t.revenueHT) * 100 : 0 },
    { label: "= EXCÉDENT BRUT D'EXPLOITATION (EBE)", value: t.netResult, bold: true, pct: t.netMarginPct, highlight: "emerald" },
    { label: "– Amortissements (à venir Phase 2)", value: 0, indent: true, subtle: true, italic: true, pct: 0 },
    { label: "= RÉSULTAT D'EXPLOITATION", value: t.netResult, bold: true, pct: t.netMarginPct },
    { label: "± Résultat financier (n/c)", value: 0, indent: true, subtle: true, italic: true, pct: 0 },
    { label: "± Résultat exceptionnel (n/c)", value: 0, indent: true, subtle: true, italic: true, pct: 0 },
    { label: "– Impôt sur les sociétés (à estimer)", value: 0, indent: true, subtle: true, italic: true, pct: 0 },
    { label: "= RÉSULTAT NET", value: t.netResult, bold: true, pct: t.netMarginPct, highlight: t.netResult >= 0 ? "emerald" : "red" },
  ] as { label: string; value: number; bold?: boolean; pct: number; primary?: boolean; indent?: boolean; subtle?: boolean; italic?: boolean; highlight?: string }[];

  return (
    <div className="space-y-0.5 max-w-2xl">
      {lines.map((l, i) => {
        const bg = l.highlight === "emerald" ? "bg-emerald-50" : l.highlight === "red" ? "bg-red-50" : "";
        const txt = l.subtle ? "text-sand-600" : "text-ink";
        const wt = l.bold ? "font-semibold" : "";
        const it = l.italic ? "italic" : "";
        return (
          <div key={i} className={`grid grid-cols-[1fr_auto_80px] items-center gap-4 py-1.5 px-3 rounded ${bg}`}>
            <div className={`text-sm ${l.indent ? "pl-6" : ""} ${txt} ${wt} ${it}`}>{l.label}</div>
            <div className={`text-sm tabular-nums text-right ${txt} ${wt} ${l.value < 0 ? "text-red-700" : ""}`}>
              {l.value === 0 && l.italic ? "—" : `${l.value >= 0 ? "" : "("}${fmt(Math.abs(l.value))}${l.value >= 0 ? "" : ")"} MAD`}
            </div>
            <div className={`text-xs tabular-nums text-right ${l.subtle ? "text-sand-500" : "text-sand-600"} italic`}>
              {l.pct === 0 && l.italic ? "" : fmtPct(l.pct || 0)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
