import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const COUNTRY_FLAGS: Record<string, string> = {
  FR: "🇫🇷", UK: "🇬🇧", GB: "🇬🇧", DE: "🇩🇪", ES: "🇪🇸", IT: "🇮🇹",
  NL: "🇳🇱", BE: "🇧🇪", SE: "🇸🇪", DK: "🇩🇰", US: "🇺🇸", CA: "🇨🇦",
  JP: "🇯🇵", AU: "🇦🇺", MA: "🇲🇦",
};

const STATUS_CONFIG = {
  issued: {
    label: "Émises", singular: "Émise",
    card: "bg-purple-50 border-purple-200 text-purple-900",
    badge: "bg-purple-100 text-purple-900",
    ring: "ring-purple-400",
  },
  paid: {
    label: "Payées", singular: "Payée",
    card: "bg-emerald-50 border-emerald-200 text-emerald-900",
    badge: "bg-emerald-100 text-emerald-900",
    ring: "ring-emerald-400",
  },
  cancelled: {
    label: "Annulées", singular: "Annulée",
    card: "bg-red-50 border-red-200 text-red-900",
    badge: "bg-red-100 text-red-900",
    ring: "ring-red-400",
  },
} as const;

const AGING_BUCKETS = [
  { id: "recent", label: "Récent",          subtitle: "0-30 jours",  min: 0,  max: 30,
    cardClass: "border-emerald-200 bg-emerald-50/40", headerClass: "text-emerald-900",
    dotClass: "bg-emerald-500", badgeClass: "bg-emerald-100 text-emerald-900", defaultOpen: false },
  { id: "follow", label: "À relancer",      subtitle: "31-60 jours", min: 31, max: 60,
    cardClass: "border-amber-200 bg-amber-50/40",   headerClass: "text-amber-900",
    dotClass: "bg-amber-500",   badgeClass: "bg-amber-100 text-amber-900",   defaultOpen: false },
  { id: "urgent", label: "Urgent",          subtitle: "61-90 jours", min: 61, max: 90,
    cardClass: "border-orange-200 bg-orange-50/40", headerClass: "text-orange-900",
    dotClass: "bg-orange-500",  badgeClass: "bg-orange-100 text-orange-900", defaultOpen: true },
  { id: "old",    label: "Créance ancienne", subtitle: "> 90 jours", min: 91, max: Infinity,
    cardClass: "border-red-200 bg-red-50/40",       headerClass: "text-red-900",
    dotClass: "bg-red-500",     badgeClass: "bg-red-100 text-red-900",       defaultOpen: true },
] as const;

function formatMad(amount: number | string): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " MAD";
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function getAgeInDays(issuedAt: string): number {
  return Math.floor((Date.now() - new Date(issuedAt).getTime()) / 86400000);
}

function buildUrl(
  current: { status: string; year: string; q: string },
  updates: Partial<{ status: string | null; year: string | null; q: string | null }>
): string {
  const merged = { ...current, ...updates };
  const params = new URLSearchParams();
  if (merged.status) params.set("status", merged.status);
  if (merged.year && merged.year !== "all") params.set("year", merged.year);
  if (merged.q) params.set("q", merged.q);
  const qs = params.toString();
  return `/admin/factures${qs ? "?" + qs : ""}`;
}

type Invoice = {
  id: string;
  invoice_number: string;
  issued_at: string;
  status: "issued" | "paid" | "cancelled";
  customer_snapshot: { full_name?: string; country?: string };
  total_ht_mad: number;
  tva_amount_mad: number;
  total_ttc_mad: number;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  reservation: { id: string; reference: string } | null;
};

type SearchParams = Promise<{ status?: string; year?: string; q?: string }>;

export default async function FacturesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const statusFilter = params.status ?? "";
  const yearFilter = params.year ?? "all";
  const q = params.q ?? "";
  const current = { status: statusFilter, year: yearFilter, q };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(`
      id, invoice_number, issued_at, status,
      customer_snapshot, total_ht_mad, tva_amount_mad, total_ttc_mad,
      cancelled_at, cancellation_reason,
      reservation:reservations(id, reference)
    `)
    .order("issued_at", { ascending: false });

  if (error) console.error("Failed to load invoices", error);
  const all = (data ?? []) as unknown as Invoice[];

  const stats: Record<string, { count: number; total: number }> = {
    issued: { count: 0, total: 0 },
    paid: { count: 0, total: 0 },
    cancelled: { count: 0, total: 0 },
  };
  all.forEach((inv) => {
    if (stats[inv.status]) {
      stats[inv.status].count++;
      stats[inv.status].total += Number(inv.total_ttc_mad);
    }
  });

  const yearsSet = new Set<number>();
  all.forEach((inv) => yearsSet.add(new Date(inv.issued_at).getFullYear()));
  const years = Array.from(yearsSet).sort((a, b) => b - a);

  let filtered = all;
  if (statusFilter) filtered = filtered.filter((i) => i.status === statusFilter);
  if (yearFilter !== "all") {
    filtered = filtered.filter((i) => new Date(i.issued_at).getFullYear() === parseInt(yearFilter));
  }
  if (q) {
    const term = q.toLowerCase();
    filtered = filtered.filter((i) => {
      const name = (i.customer_snapshot?.full_name ?? "").toLowerCase();
      const num = i.invoice_number.toLowerCase();
      const ref = (i.reservation?.reference ?? "").toLowerCase();
      return name.includes(term) || num.includes(term) || ref.includes(term);
    });
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <header>
        <h1 className="font-serif text-3xl text-navy-900">Factures</h1>
        <p className="text-sm text-stone-600 mt-1">Suivi des factures émises, payées et annulées</p>
      </header>

      <StatusCards stats={stats} active={statusFilter} current={current} />
      <FiltersBar years={years} current={current} />

      {statusFilter === "issued" ? (
        <AgingView invoices={filtered} />
      ) : (
        <MonthlyView invoices={filtered} showStatusBadge={!statusFilter} />
      )}
    </div>
  );
}

function StatusCards({
  stats, active, current,
}: {
  stats: Record<string, { count: number; total: number }>;
  active: string;
  current: { status: string; year: string; q: string };
}) {
  const keys = ["issued", "paid", "cancelled"] as const;
  return (
    <div className="grid grid-cols-3 gap-4">
      {keys.map((s) => {
        const cfg = STATUS_CONFIG[s];
        const isActive = active === s;
        const href = buildUrl(current, { status: isActive ? null : s });
        return (
          <Link
            key={s}
            href={href}
            className={`block rounded-2xl border ${cfg.card} p-5 transition ${
              isActive ? `ring-2 ring-offset-2 ${cfg.ring}` : "hover:shadow-sm"
            }`}
          >
            <p className="text-sm font-medium">{cfg.label}</p>
            <p className="font-serif text-3xl mt-2">{stats[s].count}</p>
            <p className="text-xs mt-1 opacity-80">{formatMad(stats[s].total)}</p>
          </Link>
        );
      })}
    </div>
  );
}

function FiltersBar({
  years, current,
}: {
  years: number[];
  current: { status: string; year: string; q: string };
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-2 flex-wrap">
        <Link
          href={buildUrl(current, { year: null })}
          className={`px-3 py-1.5 rounded-full text-sm border ${
            current.year === "all"
              ? "bg-navy-900 text-white border-navy-900"
              : "bg-white text-stone-700 border-stone-200 hover:border-stone-300"
          }`}
        >
          Toutes années
        </Link>
        {years.map((y) => (
          <Link
            key={y}
            href={buildUrl(current, { year: String(y) })}
            className={`px-3 py-1.5 rounded-full text-sm border ${
              current.year === String(y)
                ? "bg-navy-900 text-white border-navy-900"
                : "bg-white text-stone-700 border-stone-200 hover:border-stone-300"
            }`}
          >
            {y}
          </Link>
        ))}
      </div>

      <form action="/admin/factures" method="GET" className="ml-auto">
        {current.status && <input type="hidden" name="status" value={current.status} />}
        {current.year !== "all" && <input type="hidden" name="year" value={current.year} />}
        <input
          type="search"
          name="q"
          defaultValue={current.q}
          placeholder="Numéro, client, réf…"
          className="px-3 py-1.5 rounded-full text-sm border border-stone-200 bg-white w-64 focus:outline-none focus:border-stone-400"
        />
      </form>
    </div>
  );
}

function AgingView({ invoices }: { invoices: Invoice[] }) {
  if (invoices.length === 0) {
    return <EmptyState>Aucune facture en attente de paiement.</EmptyState>;
  }

  let totalAmount = 0;
  let totalAge = 0;
  let maxAge = 0;
  const withAge = invoices.map((inv) => {
    const age = getAgeInDays(inv.issued_at);
    totalAmount += Number(inv.total_ttc_mad);
    totalAge += age;
    if (age > maxAge) maxAge = age;
    return { ...inv, age };
  });
  const avgAge = Math.round(totalAge / invoices.length);
  const maxMonths = Math.round(maxAge / 30);

  const byBucket = new Map<string, (Invoice & { age: number })[]>();
  AGING_BUCKETS.forEach((b) => byBucket.set(b.id, []));
  withAge.forEach((inv) => {
    const bucket = AGING_BUCKETS.find((b) => inv.age >= b.min && inv.age <= b.max);
    if (bucket) byBucket.get(bucket.id)!.push(inv);
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Encours total TTC" value={formatMad(totalAmount)} />
        <KpiCard label="Délai moyen de paiement" value={`${avgAge} j`} />
        <KpiCard label="Plus ancienne" value={maxMonths > 0 ? `${maxMonths} mois` : `${maxAge} j`} />
      </div>

      <div className="space-y-3">
        {AGING_BUCKETS.map((bucket) => {
          const items = byBucket.get(bucket.id) ?? [];
          if (items.length === 0) return null;
          const total = items.reduce((s, i) => s + Number(i.total_ttc_mad), 0);
          return (
            <details
              key={bucket.id}
              open={bucket.defaultOpen}
              className={`group rounded-xl border ${bucket.cardClass} overflow-hidden`}
            >
              <summary className={`flex items-center justify-between p-4 cursor-pointer ${bucket.headerClass} list-none`}>
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${bucket.dotClass}`}></span>
                  <span className="font-medium">
                    {bucket.label} <span className="opacity-70 font-normal">· {bucket.subtitle}</span>
                  </span>
                  <span className="text-sm opacity-70">
                    {items.length} {items.length > 1 ? "factures" : "facture"}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-medium">{formatMad(total)}</span>
                  <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                </div>
              </summary>
              <div className="bg-white border-t border-stone-200">
                <InvoiceTable items={items} showAge ageBadgeClass={bucket.badgeClass} />
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

function MonthlyView({ invoices, showStatusBadge }: { invoices: Invoice[]; showStatusBadge: boolean }) {
  if (invoices.length === 0) {
    return <EmptyState>Aucune facture pour les critères sélectionnés.</EmptyState>;
  }

  const months = new Map<string, Invoice[]>();
  invoices.forEach((inv) => {
    const d = new Date(inv.issued_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!months.has(key)) months.set(key, []);
    months.get(key)!.push(inv);
  });

  const sortedKeys = Array.from(months.keys()).sort().reverse();
  const today = new Date();
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-3">
      {sortedKeys.map((key) => {
        const items = months.get(key)!;
        const total = items.reduce((s, i) => s + Number(i.total_ttc_mad), 0);
        const totalHt = items.reduce((s, i) => s + Number(i.total_ht_mad), 0);
        const totalTva = items.reduce((s, i) => s + Number(i.tva_amount_mad), 0);
        const [y, m] = key.split("-");
        const label = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString("fr-FR", {
          month: "long", year: "numeric",
        });

        return (
          <details
            key={key}
            open={key === currentMonthKey || sortedKeys.length === 1}
            className="group bg-white border border-stone-200 rounded-xl overflow-hidden"
          >
            <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-stone-50 list-none">
              <div className="flex items-center gap-3">
                <span className="font-medium capitalize">{label}</span>
                <span className="text-sm text-stone-500">
                  {items.length} {items.length > 1 ? "factures" : "facture"}
                </span>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <span className="text-stone-500">HT {formatMad(totalHt)}</span>
                <span className="text-stone-500">TVA {formatMad(totalTva)}</span>
                <span className="font-medium">{formatMad(total)}</span>
                <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
              </div>
            </summary>
            <div className="border-t border-stone-200">
              <InvoiceTable items={items} showStatus={showStatusBadge} />
            </div>
          </details>
        );
      })}
    </div>
  );
}

function InvoiceTable({
  items, showStatus = false, showAge = false,
  ageBadgeClass = "bg-stone-100 text-stone-900",
}: {
  items: (Invoice & { age?: number })[];
  showStatus?: boolean;
  showAge?: boolean;
  ageBadgeClass?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-stone-50">
          <tr className="text-stone-500 text-xs">
            <th className="text-left px-4 py-2 font-medium">Numéro</th>
            <th className="text-left px-2 py-2 font-medium">Émise le</th>
            {showAge && <th className="text-center px-2 py-2 font-medium">Âge</th>}
            <th className="text-left px-2 py-2 font-medium">Client</th>
            <th className="text-left px-2 py-2 font-medium">Réservation</th>
            {showStatus && <th className="text-left px-2 py-2 font-medium">Statut</th>}
            <th className="text-right px-2 py-2 font-medium">HT</th>
            <th className="text-right px-2 py-2 font-medium">TVA</th>
            <th className="text-right px-4 py-2 font-medium">TTC</th>
          </tr>
        </thead>
        <tbody>
          {items.map((inv) => {
            const country = inv.customer_snapshot?.country ?? "";
            const flag = COUNTRY_FLAGS[country] ?? "🌍";
            const name = inv.customer_snapshot?.full_name ?? "—";
            return (
              <tr key={inv.id} className="border-t border-stone-100 hover:bg-stone-50">
                <td className="px-4 py-3 font-mono text-xs">
                  <Link href={`/admin/factures/${inv.id}`} className="text-navy-900 hover:underline">
                    {inv.invoice_number}
                  </Link>
                </td>
                <td className="px-2 py-3 text-stone-600">{formatDate(inv.issued_at)}</td>
                {showAge && (
                  <td className="px-2 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${ageBadgeClass}`}>
                      {inv.age} j
                    </span>
                  </td>
                )}
                <td className="px-2 py-3">
                  <span className="mr-1">{flag}</span>{name}
                </td>
                <td className="px-2 py-3 text-stone-600 font-mono text-xs">
                  {inv.reservation?.reference ?? "—"}
                </td>
                {showStatus && (
                  <td className="px-2 py-3"><StatusBadge status={inv.status} /></td>
                )}
                <td className="px-2 py-3 text-right">{formatMad(inv.total_ht_mad)}</td>
                <td className="px-2 py-3 text-right text-stone-500">{formatMad(inv.tva_amount_mad)}</td>
                <td className="px-4 py-3 text-right font-medium">{formatMad(inv.total_ttc_mad)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: "issued" | "paid" | "cancelled" }) {
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return null;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${cfg.badge}`}>
      {cfg.singular}
    </span>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <p className="text-sm text-stone-500">{label}</p>
      <p className="font-serif text-2xl text-navy-900 mt-1">{value}</p>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center py-16 text-stone-500 border border-dashed border-stone-200 rounded-xl">
      {children}
    </div>
  );
}
