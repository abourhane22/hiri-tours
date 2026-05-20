"use client";

import { useState } from "react";
import { Input, Label } from "@/components/ui/input";

type Status = "ok" | "soon" | "expired" | "missing";

function getStatus(dateStr: string | null | undefined): Status {
  if (!dateStr || dateStr === "") return "missing";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "missing";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "expired";
  if (diffDays <= 30) return "soon";
  return "ok";
}

const STYLES: Record<Status, { border: string; bg: string; text: string; badge: string; badgeText: string; label: string }> = {
  expired: {
    border: "!border-red-400 focus:!border-red-500 focus:!ring-red-200",
    bg: "!bg-red-50",
    text: "!text-red-900 font-medium",
    badge: "bg-red-100",
    badgeText: "text-red-700",
    label: "Expirée",
  },
  soon: {
    border: "!border-amber-400 focus:!border-amber-500 focus:!ring-amber-200",
    bg: "!bg-amber-50",
    text: "!text-amber-900 font-medium",
    badge: "bg-amber-100",
    badgeText: "text-amber-700",
    label: "Bientôt expirée",
  },
  ok: {
    border: "!border-emerald-300",
    bg: "!bg-emerald-50/40",
    text: "!text-ink",
    badge: "bg-emerald-100",
    badgeText: "text-emerald-700",
    label: "À jour",
  },
  missing: { border: "", bg: "", text: "", badge: "", badgeText: "", label: "" },
};

export function DateWithStatusInput({
  id,
  name,
  label,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue?: string | null;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const status = getStatus(value);
  const s = STYLES[status];

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <Label htmlFor={id} className="mb-0">{label}</Label>
        {status !== "missing" && (
          <span className={`text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ${s.badge} ${s.badgeText}`}>
            {s.label}
          </span>
        )}
      </div>
      <Input
        id={id}
        name={name}
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={`${s.border} ${s.bg} ${s.text}`}
      />
    </div>
  );
}
