import Link from "next/link";
import { BarChart3, Compass, Target, Table2, CalendarRange, Wallet, Tag, type LucideIcon } from "lucide-react";

type Tab<K extends string> = { key: K; label: string; href: string; Icon: LucideIcon };

function Tabs<K extends string>({ tabs, active }: { tabs: Tab<K>[]; active: K }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg bg-[#F1EFE8] p-[3px] mb-4 print:hidden">
      {tabs.map(({ key, label, href, Icon }) => {
        const isActive = key === active;
        return (
          <Link
            key={key}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
              isActive ? "bg-white text-[#1A1F2E] shadow-sm" : "text-[#6B6862] hover:text-[#1A1F2E]"
            }`}
          >
            <Icon className="size-3.5" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}

export type ReportTabKey = "rapports" | "rentabilite" | "pilotage" | "pnl" | "resultat-annuel";

/**
 * Onglets de « Rapports & rentabilité » : une entrée de menu, cinq routes
 * conservées (aucune page orpheline).
 */
export function ReportTabs({ active }: { active: ReportTabKey }) {
  const tabs: Tab<ReportTabKey>[] = [
    { key: "rapports", label: "Rapports", href: "/admin/rapports", Icon: BarChart3 },
    { key: "rentabilite", label: "Rentabilité", href: "/admin/finance/rentabilite", Icon: Compass },
    { key: "pilotage", label: "Pilotage", href: "/admin/finance/pilotage", Icon: Target },
    { key: "pnl", label: "Compte de résultat", href: "/admin/finance/pnl", Icon: Table2 },
    { key: "resultat-annuel", label: "Résultat annuel", href: "/admin/finance/resultat-annuel", Icon: CalendarRange },
  ];
  return <Tabs tabs={tabs} active={active} />;
}

export type ExpenseTabKey = "depenses" | "categories";

/** Onglets de « Dépenses » : registre et catégories de coûts. */
export function ExpenseTabs({ active }: { active: ExpenseTabKey }) {
  const tabs: Tab<ExpenseTabKey>[] = [
    { key: "depenses", label: "Dépenses", href: "/admin/finance/depenses", Icon: Wallet },
    { key: "categories", label: "Catégories de coûts", href: "/admin/finance/categories", Icon: Tag },
  ];
  return <Tabs tabs={tabs} active={active} />;
}
