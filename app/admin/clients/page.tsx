import Link from "next/link";
import { redirect } from "next/navigation";
import "flag-icons/css/flag-icons.min.css";
import { Plus, Search, ChevronDown, Globe, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatMAD, formatDateShort, foldAccents } from "@/lib/utils";
import { normalizePhone, SOURCE_LABELS } from "@/lib/customers";
import {
  computeLoyaltyPoints,
  getLoyaltyTier,
  LOYALTY_TIERS,
  tierThresholdMad,
  type LoyaltyTier,
} from "@/lib/loyalty";
import { countryCode } from "@/lib/countries";
import { KpiCard, DeltaPill } from "@/components/kpi-card";

// Cartes affichées par groupe avant le lien « Afficher plus ».
const PAGE_SIZE = 24;

const fmtInt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
const isConverted = (status: string) => status === "paid" || status === "completed";

type ReservationRow = {
  total_amount_mad: number;
  status: string;
  departure_date: string;
  circuits: { title: string } | { title: string }[] | null;
};

type CustomerRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  phone_normalized: string | null;
  country: string | null;
  acquisition_source: string | null;
  created_at: string;
  reservations: ReservationRow[] | null;
};

type Departure = { title: string; date: string };

type ClientStat = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  phoneNormalized: string | null;
  country: string | null;
  source: string | null;
  createdAt: string;
  count: number; // réservations abouties
  revenue: number; // CA cumulé paid/completed
  tier: LoyaltyTier;
  lastDeparture: Departure | null; // dernier départ passé
  nextDeparture: Departure | null; // prochain départ à venir (si aucun passé)
};

type Group = {
  key: string;
  label: string;
  criteria: string;
  tier: LoyaltyTier | null;
  defaultOpen: boolean;
  items: ClientStat[];
};

const circuitTitle = (c: ReservationRow["circuits"]) =>
  (Array.isArray(c) ? c[0]?.title : c?.title) ?? "Circuit";

/** Classes du badge tier, alignées sur la fiche client. */
function tierBadgeClass(color: LoyaltyTier["color"]) {
  switch (color) {
    case "amber":
      return "bg-amber-100 text-amber-900 border-amber-300";
    case "sand":
      return "bg-sand-200 text-sand-800 border-sand-300";
    case "terracotta":
      return "bg-terracotta-100 text-terracotta-800 border-terracotta-300";
    default:
      return "bg-sand-100 text-sand-600 border-sand-200";
  }
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; source?: string; country?: string; more?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const sourceFilter = params.source ?? "";
  const countryFilter = params.country ?? "";
  const moreKeys = new Set((params.more ?? "").split(",").filter(Boolean));
  const hasFilter = Boolean(q || sourceFilter || countryFilter);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Une seule requête : clients + réservations (+ titre circuit) embarquées.
  const { data: rows } = await supabase
    .from("customers")
    .select(
      `id, full_name, email, phone, phone_normalized, country, acquisition_source, created_at,
       reservations(total_amount_mad, status, departure_date, circuits(title))`,
    )
    .limit(1000);

  const today = new Date().toISOString().split("T")[0];
  const now = new Date();

  const clients: ClientStat[] = ((rows ?? []) as unknown as CustomerRow[]).map((c) => {
    const conv = (c.reservations ?? []).filter((r) => isConverted(r.status));
    const revenue = conv.reduce((s, r) => s + Number(r.total_amount_mad), 0);
    const past = conv.filter((r) => r.departure_date <= today).sort((a, b) => b.departure_date.localeCompare(a.departure_date));
    const future = conv.filter((r) => r.departure_date > today).sort((a, b) => a.departure_date.localeCompare(b.departure_date));
    const toDep = (r: ReservationRow | undefined): Departure | null =>
      r ? { title: circuitTitle(r.circuits), date: r.departure_date } : null;
    return {
      id: c.id,
      fullName: c.full_name,
      email: c.email,
      phone: c.phone,
      phoneNormalized: c.phone_normalized,
      country: c.country,
      source: c.acquisition_source,
      createdAt: c.created_at,
      count: conv.length,
      revenue,
      tier: getLoyaltyTier(computeLoyaltyPoints(conv)),
      lastDeparture: toDep(past[0]),
      nextDeparture: past.length === 0 ? toDep(future[0]) : null,
    };
  });

  // --- Synthèse (sur la base complète, hors filtres) ---
  const active = clients.filter((c) => c.count > 0);
  const prospects = clients.length - active.length;
  const totalRevenue = active.reduce((s, c) => s + c.revenue, 0);
  const totalConv = active.reduce((s, c) => s + c.count, 0);
  const basketPerClient = active.length > 0 ? totalRevenue / active.length : 0;

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const newThisMonth = clients.filter((c) => new Date(c.createdAt) >= monthStart).length;
  const newPrevMonth = clients.filter((c) => {
    const d = new Date(c.createdAt);
    return d >= prevMonthStart && d < monthStart;
  }).length;
  const newDelta = newPrevMonth > 0 ? Math.round(((newThisMonth - newPrevMonth) / newPrevMonth) * 100) : null;
  const prevMonthName = prevMonthStart.toLocaleDateString("fr-FR", { month: "long" });

  // --- Filtres ---
  const countries = Array.from(new Set(clients.map((c) => c.country).filter((v): v is string => Boolean(v)))).sort((a, b) =>
    a.localeCompare(b, "fr"),
  );
  const sourceOptions = Object.entries(SOURCE_LABELS);

  const qFold = foldAccents(q);
  const qDigits = q.replace(/\D/g, "");
  const qPhone = normalizePhone(q);
  const matches = (c: ClientStat) => {
    if (sourceFilter && c.source !== sourceFilter) return false;
    if (countryFilter && c.country !== countryFilter) return false;
    if (!q) return true;
    if (foldAccents(c.fullName).includes(qFold)) return true;
    if (c.email && c.email.toLowerCase().includes(q.toLowerCase())) return true;
    if (qDigits) {
      if (c.phone && c.phone.replace(/\D/g, "").includes(qDigits)) return true;
      if (c.phoneNormalized && (c.phoneNormalized.includes(qDigits) || (qPhone && c.phoneNormalized.includes(qPhone)))) return true;
    }
    return false;
  };
  const filtered = clients.filter(matches);

  // --- Groupes par tier (du plus haut au plus bas), puis occasionnels, puis prospects ---
  const noneTier = getLoyaltyTier(0);
  const groups: Group[] = [
    ...LOYALTY_TIERS.map((t) => ({
      key: t.name.toLowerCase(),
      label: t.name,
      criteria: `≥ ${fmtInt(tierThresholdMad(t))} MAD de réservations`,
      tier: t,
      defaultOpen: true,
      items: [] as ClientStat[],
    })),
    {
      key: "occasionnels",
      label: "Clients occasionnels",
      criteria: `≥ 1 réservation aboutie · < ${fmtInt(tierThresholdMad(LOYALTY_TIERS[LOYALTY_TIERS.length - 1]))} MAD`,
      tier: noneTier,
      defaultOpen: true,
      items: [],
    },
    {
      key: "prospects",
      label: "Prospects",
      criteria: "Aucune réservation aboutie",
      tier: null,
      defaultOpen: false,
      items: [],
    },
  ];
  const byKey = new Map(groups.map((g) => [g.key, g]));
  for (const c of filtered) {
    const key = c.count === 0 ? "prospects" : c.tier.name === "Aucun" ? "occasionnels" : c.tier.name.toLowerCase();
    byKey.get(key)!.items.push(c);
  }
  for (const g of groups) g.items.sort((a, b) => b.revenue - a.revenue || a.fullName.localeCompare(b.fullName, "fr"));

  const visibleGroups = hasFilter ? groups.filter((g) => g.items.length > 0) : groups;

  // Conserve recherche + filtres dans les liens (« Afficher plus »).
  const buildHref = (overrides: { more?: string[] }) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (sourceFilter) sp.set("source", sourceFilter);
    if (countryFilter) sp.set("country", countryFilter);
    const more = overrides.more ?? Array.from(moreKeys);
    if (more.length > 0) sp.set("more", more.join(","));
    const s = sp.toString();
    return s ? `/admin/clients?${s}` : "/admin/clients";
  };

  const fieldCls =
    "h-9 rounded-lg border border-[#E0DACF] bg-white px-3 text-[13px] text-[#1A1F2E] focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors";

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">CRM · Base clients</p>
          <h1 className="font-display text-3xl text-[#1A1F2E] mt-1">Clients</h1>
          <p className="text-[12px] text-[#6B6862] mt-1">
            {active.length} client{active.length > 1 ? "s" : ""} · {prospects} prospect{prospects > 1 ? "s" : ""} · au{" "}
            {now.toLocaleDateString("fr-FR")}
          </p>
        </div>
        <Link
          href="/admin/clients/new"
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-[#1A1F2E] px-4 text-sm font-medium text-white hover:bg-[#2A3142] transition-colors"
        >
          <Plus className="size-4" />
          Nouveau client
        </Link>
      </div>

      {/* Synthèse */}
      <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <KpiCard
          label="Clients actifs"
          value={String(active.length)}
          sub={`≥ 1 réservation aboutie · ${clients.length} fiche${clients.length > 1 ? "s" : ""} au total`}
        />
        <KpiCard
          label="Nouveaux ce mois"
          value={String(newThisMonth)}
          sub={`vs ${prevMonthName} · ${newPrevMonth}`}
          delta={
            newDelta !== null ? (
              <DeltaPill up={newDelta >= 0}>
                {newDelta >= 0 ? "+" : "−"}
                {Math.abs(newDelta)} %
              </DeltaPill>
            ) : undefined
          }
        />
        <KpiCard
          label="CA cumulé base"
          value={formatMAD(totalRevenue)}
          accent="ocean"
          sub={`${totalConv} réservation${totalConv > 1 ? "s" : ""} aboutie${totalConv > 1 ? "s" : ""}`}
        />
        <KpiCard label="Panier moyen par client" value={formatMAD(basketPerClient)} sub="CA cumulé ÷ clients actifs" />
      </div>

      {/* Recherche & filtres */}
      <form
        action="/admin/clients"
        method="get"
        className="bg-white border border-[#E5E0D7] rounded-xl p-3 mb-4 flex flex-wrap items-center gap-2"
      >
        <div className="relative flex-1 min-w-[220px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#968F84] pointer-events-none" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Nom, téléphone, email…"
            className={`${fieldCls} w-full pl-9`}
          />
        </div>
        <select name="source" defaultValue={sourceFilter} className={`${fieldCls} min-w-[170px]`} aria-label="Source d'acquisition">
          <option value="">Toutes les sources</option>
          {sourceOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select name="country" defaultValue={countryFilter} className={`${fieldCls} min-w-[150px]`} aria-label="Pays">
          <option value="">Tous les pays</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="inline-flex h-9 items-center rounded-lg border border-[#E0DACF] bg-white px-3 text-[13px] font-medium text-[#1A1F2E] hover:bg-[#FBF9F5] transition-colors"
        >
          Filtrer
        </button>
        {hasFilter && (
          <Link
            href="/admin/clients"
            className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-[12px] font-medium text-[#6B6862] hover:text-[#1A1F2E] hover:underline"
          >
            <X className="size-3.5" />
            Réinitialiser
          </Link>
        )}
        <span className="ml-auto text-[11px] text-[#968F84] tabular-nums">
          {hasFilter ? `${filtered.length} résultat${filtered.length > 1 ? "s" : ""}` : `${clients.length} fiche${clients.length > 1 ? "s" : ""}`}
        </span>
      </form>

      {/* Aucun résultat global */}
      {hasFilter && filtered.length === 0 && (
        <div className="bg-white border border-[#E5E0D7] rounded-xl p-10 text-center">
          <p className="text-[14px] text-[#1A1F2E]">
            Aucun client ne correspond{q ? <> à « <span className="font-medium">{q}</span> »</> : " à ces filtres"}.
          </p>
          <p className="text-[12px] text-[#968F84] mt-1">
            Vérifiez l&apos;orthographe ou{" "}
            <Link href="/admin/clients" className="text-terracotta-600 hover:underline">
              réinitialisez les filtres
            </Link>
            .
          </p>
        </div>
      )}

      {/* Groupes par tier */}
      <div className="space-y-4">
        {visibleGroups.map((g) => {
          const expanded = moreKeys.has(g.key);
          const open = g.defaultOpen || hasFilter || expanded;
          const shown = expanded ? g.items : g.items.slice(0, PAGE_SIZE);
          const rest = g.items.length - shown.length;
          const groupRevenue = g.items.reduce((s, c) => s + c.revenue, 0);

          return (
            <details key={g.key} open={open} className="group bg-white border border-[#E5E0D7] rounded-xl">
              <summary className="list-none cursor-pointer select-none flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <ChevronDown className="size-4 text-[#968F84] transition-transform group-open:-rotate-180" />
                <h2 className="font-display text-base text-[#1A1F2E] m-0">{g.label}</h2>
                <span className="inline-flex items-center justify-center min-w-6 h-5 rounded-full bg-[#F1EDE5] px-1.5 text-[11px] font-medium text-[#58524A] tabular-nums">
                  {g.items.length}
                </span>
                <span className="text-[11px] text-[#968F84]">{g.criteria}</span>
                {g.tier !== null && g.items.length > 0 && (
                  <span className="ml-auto text-[11px] text-[#6B6862] tabular-nums">{formatMAD(groupRevenue)} cumulés</span>
                )}
              </summary>

              <div className="border-t border-[#F1EDE5] px-4 pt-4 pb-4">
                {g.items.length === 0 ? (
                  <p className="text-[13px] text-[#968F84] text-center py-6">
                    {g.key === "prospects"
                      ? "Aucun prospect — toutes les fiches ont au moins une réservation aboutie."
                      : "Aucun client dans ce groupe pour l'instant."}
                  </p>
                ) : (
                  <>
                    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                      {shown.map((c) => (
                        <ClientCard key={c.id} c={c} />
                      ))}
                    </div>
                    {rest > 0 && (
                      <div className="mt-4 text-center">
                        <Link
                          href={buildHref({ more: [...Array.from(moreKeys), g.key] })}
                          className="inline-flex h-9 items-center rounded-full border border-[#E0DACF] bg-white px-4 text-[12px] font-medium text-[#1A1F2E] hover:bg-[#FBF9F5] transition-colors"
                        >
                          Afficher les {rest} autres client{rest > 1 ? "s" : ""}
                        </Link>
                      </div>
                    )}
                  </>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

function Flag({ country }: { country: string | null }) {
  const code = countryCode(country);
  if (!code) return <Globe className="size-4 text-[#C9C4BA] shrink-0" aria-label={country ?? "Pays non renseigné"} />;
  return <span className={`fi fi-${code} shrink-0 rounded-[2px]`} style={{ width: 20, height: 15 }} title={country ?? undefined} />;
}

function ClientCard({ c }: { c: ClientStat }) {
  const sourceLabel = c.source ? SOURCE_LABELS[c.source] ?? c.source : null;
  const showTier = c.tier.name !== "Aucun";
  const contact = [c.phone, c.email].filter(Boolean).join(" · ");

  let departure: React.ReactNode;
  if (c.lastDeparture) {
    departure = (
      <>
        Dernier départ : <span className="text-[#58524A]">{c.lastDeparture.title}</span> · {formatDateShort(c.lastDeparture.date)}
      </>
    );
  } else if (c.nextDeparture) {
    departure = (
      <>
        Prochain départ : <span className="text-[#58524A]">{c.nextDeparture.title}</span> · {formatDateShort(c.nextDeparture.date)}
      </>
    );
  } else {
    departure = "Aucun départ";
  }

  return (
    <Link
      href={`/admin/clients/${c.id}`}
      className="relative block h-full bg-white border border-[#E5E0D7] rounded-xl p-3.5 hover:border-[#C9C4BA] hover:shadow-sm transition"
    >
      {sourceLabel && (
        <span className="absolute top-2.5 right-3 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[#968F84] bg-[#F7F5F0]">
          {sourceLabel}
        </span>
      )}

      {/* Ligne 1 : drapeau + nom + tier */}
      <div className={`flex items-center gap-2 min-w-0 ${sourceLabel ? "pr-24" : ""}`}>
        <Flag country={c.country} />
        <span className="font-display text-[15px] text-[#1A1F2E] truncate">{c.fullName}</span>
        {showTier && (
          <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-px text-[10px] font-medium ${tierBadgeClass(c.tier.color)}`}>
            {c.tier.name}
          </span>
        )}
      </div>

      {/* Ligne 2 : coordonnées */}
      <div className="mt-1.5 text-[12px] text-[#6B6862] truncate">{contact || "Aucune coordonnée"}</div>

      {/* Ligne 3 : activité */}
      <div className="mt-2 text-[12px] text-[#1A1F2E] tabular-nums">
        {c.count} réservation{c.count > 1 ? "s" : ""} · <span className="font-medium">{formatMAD(c.revenue)}</span>
      </div>

      {/* Ligne 4 : dernier départ */}
      <div className="mt-1 text-[11px] text-[#968F84] truncate">{departure}</div>
    </Link>
  );
}
