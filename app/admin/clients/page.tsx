import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search, Trophy, Medal, Award, Users, Globe, Clock, List, ChevronRight, Activity } from "lucide-react";
import { formatMAD } from "@/lib/utils";

const COUNTRY_FLAGS: Record<string, string> = {
  "France": "🇫🇷", "Royaume-Uni": "🇬🇧", "Irlande": "🇮🇪", "Allemagne": "🇩🇪",
  "Espagne": "🇪🇸", "Italie": "🇮🇹", "Portugal": "🇵🇹",
  "Pays-Bas": "🇳🇱", "Belgique": "🇧🇪", "Suisse": "🇨🇭", "Autriche": "🇦🇹",
  "Suède": "🇸🇪", "Danemark": "🇩🇰", "Norvège": "🇳🇴", "Finlande": "🇫🇮",
  "États-Unis": "🇺🇸", "Canada": "🇨🇦",
  "Japon": "🇯🇵", "Corée du Sud": "🇰🇷", "Chine": "🇨🇳",
  "Australie": "🇦🇺", "Nouvelle-Zélande": "🇳🇿",
  "Maroc": "🇲🇦", "Émirats arabes unis": "🇦🇪",
};

type Tier = "or" | "argent" | "bronze" | "none";
type ActivityBucket = "active" | "dormant" | "lost" | "inactive";

const TIER_CONFIG: Record<Tier, { label: string; icon: any; bgIcon: string; textIcon: string; avatar: string }> = {
  or:     { label: "Or",        icon: Trophy, bgIcon: "bg-amber-100",  textIcon: "text-amber-800",  avatar: "bg-amber-300 text-amber-900" },
  argent: { label: "Argent",    icon: Medal,  bgIcon: "bg-sand-200",   textIcon: "text-sand-800",   avatar: "bg-sand-300 text-sand-900" },
  bronze: { label: "Bronze",    icon: Award,  bgIcon: "bg-orange-100", textIcon: "text-orange-800", avatar: "bg-orange-200 text-orange-900" },
  none:   { label: "Sans tier", icon: Users,  bgIcon: "bg-sand-100",   textIcon: "text-sand-700",   avatar: "bg-sand-100 text-sand-700" },
};

const ACTIVITY_CONFIG: Record<ActivityBucket, { label: string; subtitle: string; icon: any; bgIcon: string; textIcon: string; avatar: string }> = {
  active:   { label: "Actifs",         subtitle: "Dernière réservation < 6 mois",    icon: Activity, bgIcon: "bg-emerald-100", textIcon: "text-emerald-800", avatar: "bg-emerald-100 text-emerald-800" },
  dormant:  { label: "Dormants",       subtitle: "Entre 6 et 12 mois sans activité", icon: Clock,    bgIcon: "bg-amber-100",   textIcon: "text-amber-800",   avatar: "bg-amber-100 text-amber-800" },
  lost:     { label: "Perdus",         subtitle: "Plus d'1 an sans réservation",     icon: Clock,    bgIcon: "bg-red-50",      textIcon: "text-red-800",     avatar: "bg-red-50 text-red-700" },
  inactive: { label: "Jamais réservé", subtitle: "Aucune réservation enregistrée",   icon: Users,    bgIcon: "bg-sand-100",    textIcon: "text-sand-700",    avatar: "bg-sand-100 text-sand-700" },
};

function computeTier(totalPaid: number): Tier {
  const points = Math.floor(totalPaid / 100);
  if (points >= 100) return "or";
  if (points >= 30)  return "argent";
  if (points >= 1)   return "bronze";
  return "none";
}

function computeActivity(lastDate: string | null): ActivityBucket {
  if (!lastDate) return "inactive";
  const d = new Date(lastDate);
  const now = new Date();
  const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (monthsAgo < 6)  return "active";
  if (monthsAgo < 12) return "dormant";
  return "lost";
}

function getInitials(name: string): string {
  return (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();
}

interface CustomerWithStats {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  reservations_count: number;
  total_paid: number;
  last_reservation_date: string | null;
}

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string }> }) {
  const params = await searchParams;
  const view = params.view || "tier";
  const q = params.q || "";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: rawCustomers } = await supabase
    .from("customers")
    .select(`id, full_name, email, phone, country, city,
             reservations(id, total_amount_mad, status, departure_date)`)
    .order("full_name", { ascending: true })
    .limit(1000);

  const customers: CustomerWithStats[] = (rawCustomers || []).map(c => {
    const validRes = ((c as any).reservations || []).filter((r: any) => ["paid", "completed"].includes(r.status));
    const totalPaid = validRes.reduce((s: number, r: any) => s + Number(r.total_amount_mad), 0);
    const dates = validRes.map((r: any) => r.departure_date).sort();
    return {
      id: c.id, full_name: c.full_name, email: c.email, phone: c.phone, country: c.country, city: c.city,
      reservations_count: validRes.length, total_paid: totalPaid,
      last_reservation_date: dates.length > 0 ? dates[dates.length - 1] : null,
    };
  });

  const ql = q.toLowerCase();
  const items = q
    ? customers.filter(c =>
        (c.full_name || "").toLowerCase().includes(ql) ||
        (c.email || "").toLowerCase().includes(ql) ||
        (c.country || "").toLowerCase().includes(ql) ||
        (c.city || "").toLowerCase().includes(ql)
      )
    : customers;

  const buildViewLink = (newView: string) => {
    const sp = new URLSearchParams();
    if (newView !== "tier") sp.set("view", newView);
    if (q) sp.set("q", q);
    const s = sp.toString();
    return s ? `?${s}` : "/admin/clients";
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <p className="eyebrow mb-2">CRM</p>
          <h1 className="font-display text-3xl text-ink">Clients · {customers.length}</h1>
        </div>
        <Link href="/admin/clients/new"><Button><Plus className="size-4" />Nouveau client</Button></Link>
      </div>

      <div className="bg-white border border-sand-200 rounded-lg p-3 mb-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex gap-0.5 bg-sand-100 p-0.5 rounded-md">
          {[
            { v: "tier",     l: "Par fidélité", I: Trophy },
            { v: "country",  l: "Par pays",     I: Globe },
            { v: "activity", l: "Par activité", I: Clock },
            { v: "list",     l: "Liste",        I: List },
          ].map(opt => {
            const Icon = opt.I;
            return (
              <Link key={opt.v} href={buildViewLink(opt.v)}
                className={`px-3 py-1 text-sm rounded transition inline-flex items-center gap-1.5 ${view === opt.v ? "bg-white shadow-sm font-medium text-ink" : "text-sand-700 hover:text-ink"}`}>
                <Icon className="size-3.5" />{opt.l}
              </Link>
            );
          })}
        </div>

        <form action="/admin/clients" method="get" className="flex-1 max-w-sm relative">
          {view !== "tier" && <input type="hidden" name="view" value={view} />}
          <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-sand-500 pointer-events-none" />
          <input name="q" defaultValue={q} placeholder="Rechercher (nom, email, pays...)"
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded border border-sand-300" />
        </form>
      </div>

      {items.length === 0 ? (
        <Card><div className="p-8 text-center text-sand-700">Aucun client trouvé.</div></Card>
      ) : view === "list" ? (
        <ListView items={items} />
      ) : view === "country" ? (
        <CountryView items={items} />
      ) : view === "activity" ? (
        <ActivityView items={items} />
      ) : (
        <TierView items={items} />
      )}
    </div>
  );
}

function TierView({ items }: { items: CustomerWithStats[] }) {
  const groups: Record<Tier, CustomerWithStats[]> = { or: [], argent: [], bronze: [], none: [] };
  for (const c of items) groups[computeTier(c.total_paid)].push(c);
  groups.or.sort((a, b) => b.total_paid - a.total_paid);
  groups.argent.sort((a, b) => b.total_paid - a.total_paid);
  groups.bronze.sort((a, b) => b.total_paid - a.total_paid);
  const tierOrder: Tier[] = ["or", "argent", "bronze", "none"];

  return (
    <div className="space-y-6">
      {tierOrder.map(tier => {
        const list = groups[tier];
        if (list.length === 0) return null;
        const total = list.reduce((s, c) => s + c.total_paid, 0);
        const cfg = TIER_CONFIG[tier];
        const Icon = cfg.icon;
        const isLarge = list.length > 12;

        const grid = (
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
            {list.map(c => <CustomerCard key={c.id} c={c} avatarClass={cfg.avatar} />)}
          </div>
        );

        if (isLarge) {
          return (
            <details key={tier} className="group [&_summary::-webkit-details-marker]:hidden">
              <summary className="cursor-pointer list-none mb-3 flex items-center gap-2.5">
                <ChevronRight className="size-4 text-sand-600 transition-transform group-open:rotate-90" />
                <span className={`size-7 rounded-full flex items-center justify-center ${cfg.bgIcon} ${cfg.textIcon}`}><Icon className="size-4" /></span>
                <h3 className="font-display text-lg text-ink m-0">Tier {cfg.label}</h3>
                <span className="text-xs text-sand-700">{list.length} client{list.length > 1 ? "s" : ""} · {formatMAD(total)} cumulés</span>
              </summary>
              {grid}
            </details>
          );
        }
        return (
          <div key={tier}>
            <div className="flex items-center gap-2.5 mb-3">
              <span className={`size-7 rounded-full flex items-center justify-center ${cfg.bgIcon} ${cfg.textIcon}`}><Icon className="size-4" /></span>
              <h3 className="font-display text-lg text-ink m-0">Tier {cfg.label}</h3>
              <span className="text-xs text-sand-700">{list.length} client{list.length > 1 ? "s" : ""} · {formatMAD(total)} cumulés</span>
            </div>
            {grid}
          </div>
        );
      })}
    </div>
  );
}

function CountryView({ items }: { items: CustomerWithStats[] }) {
  const groups: Record<string, CustomerWithStats[]> = {};
  for (const c of items) {
    const k = c.country || "Pays non renseigné";
    if (!groups[k]) groups[k] = [];
    groups[k].push(c);
  }
  const sorted = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="space-y-6">
      {sorted.map(([country, list]) => {
        const total = list.reduce((s, c) => s + c.total_paid, 0);
        const flag = COUNTRY_FLAGS[country] || "🌍";
        list.sort((a, b) => b.total_paid - a.total_paid);
        return (
          <div key={country}>
            <div className="flex items-center gap-2.5 mb-3">
              <span className="text-2xl leading-none">{flag}</span>
              <h3 className="font-display text-lg text-ink m-0">{country}</h3>
              <span className="text-xs text-sand-700">{list.length} client{list.length > 1 ? "s" : ""} · {formatMAD(total)} cumulés</span>
            </div>
            <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
              {list.map(c => <CustomerCard key={c.id} c={c} avatarClass="bg-atlantic-100 text-atlantic-800" />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActivityView({ items }: { items: CustomerWithStats[] }) {
  const groups: Record<ActivityBucket, CustomerWithStats[]> = { active: [], dormant: [], lost: [], inactive: [] };
  for (const c of items) groups[computeActivity(c.last_reservation_date)].push(c);
  const order: ActivityBucket[] = ["active", "dormant", "lost", "inactive"];

  return (
    <div className="space-y-6">
      {order.map(a => {
        const list = groups[a];
        if (list.length === 0) return null;
        const total = list.reduce((s, c) => s + c.total_paid, 0);
        const cfg = ACTIVITY_CONFIG[a];
        const Icon = cfg.icon;
        list.sort((a, b) => (b.last_reservation_date || "").localeCompare(a.last_reservation_date || ""));
        return (
          <div key={a}>
            <div className="flex items-center gap-2.5 mb-3 flex-wrap">
              <span className={`size-7 rounded-full flex items-center justify-center ${cfg.bgIcon} ${cfg.textIcon}`}><Icon className="size-4" /></span>
              <h3 className="font-display text-lg text-ink m-0">{cfg.label}</h3>
              <span className="text-xs text-sand-700">{cfg.subtitle} · {list.length} client{list.length > 1 ? "s" : ""} · {formatMAD(total)} cumulés</span>
            </div>
            <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
              {list.map(c => <CustomerCard key={c.id} c={c} avatarClass={cfg.avatar} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListView({ items }: { items: CustomerWithStats[] }) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-sand-50 border-b border-sand-200">
            <tr>
              <th className="text-left px-4 py-2.5 text-[11px] font-medium text-sand-700 uppercase tracking-wider">Nom</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-medium text-sand-700 uppercase tracking-wider">Pays</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-medium text-sand-700 uppercase tracking-wider">Email</th>
              <th className="text-center px-3 py-2.5 text-[11px] font-medium text-sand-700 uppercase tracking-wider">Tier</th>
              <th className="text-center px-3 py-2.5 text-[11px] font-medium text-sand-700 uppercase tracking-wider">Rés.</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-medium text-sand-700 uppercase tracking-wider">CA cumulé</th>
            </tr>
          </thead>
          <tbody>
            {items.map(c => {
              const tier = computeTier(c.total_paid);
              const cfg = TIER_CONFIG[tier];
              const flag = COUNTRY_FLAGS[c.country || ""] || "";
              return (
                <tr key={c.id} className="border-t border-sand-100 hover:bg-sand-50/50">
                  <td className="px-4 py-2.5"><Link href={`/admin/clients/${c.id}`} className="text-ink hover:text-terracotta-700 font-medium">{c.full_name}</Link></td>
                  <td className="px-3 py-2.5 text-sand-700">{flag} {c.country || "—"}</td>
                  <td className="px-3 py-2.5 text-sand-700 text-xs">{c.email || "—"}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.bgIcon} ${cfg.textIcon}`}>{cfg.label}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-sand-800">{c.reservations_count}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatMAD(c.total_paid)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function CustomerCard({ c, avatarClass }: { c: CustomerWithStats; avatarClass: string }) {
  const flag = COUNTRY_FLAGS[c.country || ""] || "🌍";
  return (
    <Link href={`/admin/clients/${c.id}`} className="block">
      <div className="bg-white border border-sand-200 rounded-lg p-3 hover:shadow-sm hover:border-sand-300 transition cursor-pointer h-full">
        <div className="flex gap-2.5 items-center mb-2.5">
          <div className={`size-9 rounded-full flex items-center justify-center font-medium text-xs flex-shrink-0 ${avatarClass}`}>
            {getInitials(c.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-ink truncate">{c.full_name}</div>
            <div className="text-[11px] text-sand-700 truncate">{flag} {c.city || c.country || "—"}</div>
          </div>
        </div>
        <div className="flex justify-between pt-2 border-t border-sand-100">
          <div>
            <div className="text-[10px] text-sand-600 uppercase tracking-wider">Rés.</div>
            <div className="font-medium text-sm">{c.reservations_count}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-sand-600 uppercase tracking-wider">CA</div>
            <div className="font-medium text-sm">{formatMAD(c.total_paid)}</div>
          </div>
        </div>
      </div>
    </Link>
  );
}
