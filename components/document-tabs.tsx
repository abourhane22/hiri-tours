import Link from "next/link";
import { FileText, FileMinus } from "lucide-react";

/** Bascule Factures ⇄ Avoirs, partagée par les deux registres. */
export function DocumentTabs({ active }: { active: "factures" | "avoirs" }) {
  const tabs = [
    { key: "factures" as const, label: "Factures", href: "/admin/factures", Icon: FileText },
    { key: "avoirs" as const, label: "Avoirs", href: "/admin/avoirs", Icon: FileMinus },
  ];
  return (
    <div className="inline-flex gap-1 rounded-lg bg-[#F1EFE8] p-[3px] mb-4">
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
