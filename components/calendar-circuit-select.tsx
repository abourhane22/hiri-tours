"use client";

import { useRouter } from "next/navigation";

/**
 * Filtre par circuit du calendrier — navigue au changement (préserve mois/année).
 * Remplace le formulaire GET + bouton "Filtrer" par une sélection instantanée.
 */
export function CalendarCircuitSelect({
  circuits,
  current,
  year,
  month,
}: {
  circuits: { id: string; title: string }[];
  current: string;
  year: number;
  month: number;
}) {
  const router = useRouter();

  return (
    <select
      value={current}
      onChange={(e) => {
        const qs = new URLSearchParams({ y: String(year), m: String(month) });
        if (e.target.value) qs.set("circuit", e.target.value);
        router.push(`/admin/calendrier?${qs.toString()}`);
      }}
      className="h-9 rounded-lg border border-[#E0DACF] bg-white px-3 text-[12px] text-[#1A1F2E] focus:border-[#C84B31] focus:outline-none focus:ring-2 focus:ring-[#C84B31]/10"
    >
      <option value="">Tous les circuits</option>
      {circuits.map((c) => (
        <option key={c.id} value={c.id}>
          {c.title}
        </option>
      ))}
    </select>
  );
}
