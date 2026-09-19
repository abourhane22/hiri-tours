import Link from "next/link";
import { BarChart3, Compass } from "lucide-react";

/** Bascule Rapports ⇄ Rentabilité par circuit : une entrée de menu, deux routes conservées. */
export function ReportTabs({ active }: { active: "rapports" | "rentabilite" }) {
  const tabs = [
    { key: "rapports" as const, label: "Rapports analytiques", href: "/admin/rapports", Icon: BarChart3 },
    { key: "rentabilite" as const, label: "Rentabilité par circuit", href: "/admin/finance/rentabilite", Icon: Compass },
  ];
  return (
    <div className="inline-flex gap-1 rounded-lg bg-[#F1EFE8] p-[3px] mb-4 print:hidden">
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
