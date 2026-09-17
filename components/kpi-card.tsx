// Stat-cards du backoffice (Rapports analytiques, liste CRM) : libellé en
// petites capitales, valeur font-display, sous-ligne, badge delta optionnel,
// bordure gauche d'accent (ocean / amber).
import { TrendingUp, TrendingDown } from "lucide-react";

export function KpiCard({
  label,
  value,
  sub,
  accent,
  delta,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "ocean" | "amber";
  delta?: React.ReactNode;
}) {
  const borderStyle =
    accent === "ocean"
      ? { borderLeft: "3px solid #0C6B8A", borderRadius: "0 12px 12px 0" }
      : accent === "amber"
        ? { borderLeft: "3px solid #D98324", borderRadius: "0 12px 12px 0" }
        : undefined;
  return (
    <div className="bg-white border border-[#E5E0D7] rounded-xl p-3.5 print:break-inside-avoid" style={borderStyle}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide text-[#968F84] font-medium">{label}</span>
        {delta}
      </div>
      <div className="font-display text-[21px] text-[#1A1F2E] tabular-nums mt-1">{value}</div>
      {sub && <div className="text-[10px] text-[#968F84] mt-0.5">{sub}</div>}
    </div>
  );
}

export function DeltaPill({ up, children }: { up: boolean; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0"
      style={up ? { backgroundColor: "#E3F0F5", color: "#0C447C" } : { backgroundColor: "#FCEBEB", color: "#791F1F" }}
    >
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {children}
    </span>
  );
}
