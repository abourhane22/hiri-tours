"use client";

import { useState } from "react";
import Link from "next/link";

const PILL: Record<string, { bg: string; text: string; bar: string }> = {
  paid: { bg: "#E1F5EE", text: "#085041", bar: "#0F6E56" },
  completed: { bg: "#E1F5EE", text: "#085041", bar: "#0F6E56" },
  confirmed: { bg: "#E6F1FB", text: "#0C447C", bar: "#0C6B8A" },
  pending: { bg: "#FAEEDA", text: "#633806", bar: "#D98324" },
  cancelled: { bg: "#F6F4F0", text: "#968F84", bar: "#C9C4BA" },
};

export type DayItem = {
  id: string;
  status: string;
  title: string;
  pax: number;
  reference: string;
  client: string;
};

export function CalendarDayCell({
  day,
  isCurrentMonth,
  isToday,
  isWeekend,
  items,
}: {
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  items: DayItem[];
}) {
  const [expanded, setExpanded] = useState(false);

  // Jours hors mois : cellule transparente sans bordure.
  if (!isCurrentMonth) {
    return (
      <div className="min-h-[74px] max-sm:min-h-[56px] p-1.5">
        <span className="text-[11px] text-[#C9C4BA]">{day}</span>
      </div>
    );
  }

  const shown = expanded ? items : items.slice(0, 3);
  const extra = items.length - 3;

  const cellStyle: React.CSSProperties = isToday
    ? {
        border: "1.5px solid #C84B31",
        boxShadow: "0 0 0 3px rgba(200,75,49,0.08)",
        backgroundColor: isWeekend ? "#FDFBF7" : "#fff",
      }
    : {
        border: "1px solid #EBE6DC",
        backgroundColor: isWeekend ? "#FDFBF7" : "#fff",
      };

  return (
    <div className="min-h-[74px] max-sm:min-h-[56px] rounded-lg p-1.5" style={cellStyle}>
      <div className="mb-1">
        {isToday ? (
          <span
            className="inline-block text-[11px] font-medium text-white rounded-full px-1.5"
            style={{ backgroundColor: "#C84B31" }}
          >
            {day}
          </span>
        ) : (
          <span className="text-[11px] text-[#968F84]">{day}</span>
        )}
      </div>

      <div className="space-y-1">
        {shown.map((it) => {
          const c = PILL[it.status] ?? PILL.pending;
          const label = (
            <>
              <span className="hidden sm:inline">{it.title} · </span>
              {it.pax} pax
            </>
          );
          return (
            <Link
              key={it.id}
              href={`/admin/reservations/${it.id}`}
              title={`${it.reference} · ${it.client}`}
              className="block rounded text-[10px] font-medium leading-tight px-1.5 py-0.5 truncate hover:opacity-80"
              style={{ backgroundColor: c.bg, color: c.text, borderLeft: `2.5px solid ${c.bar}` }}
            >
              {it.status === "cancelled" ? <s>{label}</s> : label}
            </Link>
          );
        })}

        {!expanded && extra > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="block w-full text-left text-[10px] text-[#6B6862] font-medium px-1.5 hover:text-[#1A1F2E]"
          >
            +{extra} autre{extra > 1 ? "s" : ""}
          </button>
        )}
      </div>
    </div>
  );
}
