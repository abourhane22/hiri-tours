import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { Wallet, Tag, BarChart3, Compass, Target, ArrowRight } from "lucide-react";

export default async function FinanceHubPage() {
  const supabase = await createClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

  const [expensesRes, categoriesRes] = await Promise.all([
    supabase.from("expenses").select("amount_mad").gte("expense_date", monthStart),
    supabase.from("cost_categories").select("*", { count: "exact", head: true }).eq("is_active", true),
  ]);
  const monthExpenses = (expensesRes.data || []).reduce((s: number, e: any) => s + Number(e.amount_mad), 0);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <p className="eyebrow mb-2">États financiers</p>
        <h1 className="font-display text-3xl text-ink">Pilotage économique</h1>
        <p className="text-sm text-sand-700 mt-2">Suivi des dépenses, P&amp;L mensuel, et rentabilité par circuit.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <FinanceCard href="/admin/finance/depenses" icon={<Wallet className="size-6 text-terracotta-600" />} title="Dépenses" desc="Saisir et suivre toutes les sorties d'argent." footer={`${monthExpenses.toFixed(0)} MAD ce mois`} />
        <FinanceCard href="/admin/finance/pnl" icon={<BarChart3 className="size-6 text-atlantic-700" />} title="P&L mensuel" desc="Compte de résultat : revenu, coûts, marge brute et marge nette." />
        <FinanceCard href="/admin/finance/resultat-annuel" icon={<BarChart3 className="size-6 text-atlantic-700" />} title="Compte de résultat annuel" desc="Vue annuelle mois par mois, SIG et comparaison N vs N-1." />
        <FinanceCard href="/admin/finance/rentabilite" icon={<Compass className="size-6 text-navy-700" />} title="Rentabilité par circuit" desc="Marge dégagée par chaque circuit sur les 12 derniers mois." />
        <FinanceCard href="/admin/finance/categories" icon={<Tag className="size-6 text-sand-700" />} title="Catégories de coûts" desc="Configurer les catégories (directes / overhead)." footer={`${categoriesRes.count ?? 0} catégorie(s) active(s)`} />
        <FinanceCard href="/admin/finance/pilotage" icon={<Target className="size-6 text-terracotta-700" />} title="Pilotage" desc="Définir les objectifs de l'agence et suivre le rythme de réalisation." />
      </div>
    </div>
  );
}

function FinanceCard({ href, icon, title, desc, footer }: { href: string; icon: React.ReactNode; title: string; desc: string; footer?: string }) {
  return (
    <Link href={href} className="group">
      <Card className="h-full hover:border-terracotta-300 transition-colors">
        <CardBody>
          <div className="flex items-start justify-between mb-3">
            <div className="size-12 rounded-lg bg-sand-50 border border-sand-200 flex items-center justify-center">{icon}</div>
            <ArrowRight className="size-4 text-sand-400 group-hover:text-terracotta-600 group-hover:translate-x-1 transition-all" />
          </div>
          <h2 className="font-display text-xl text-ink mb-1">{title}</h2>
          <p className="text-sm text-sand-700 mb-3">{desc}</p>
          {footer && <p className="text-xs text-sand-600 border-t border-sand-200 pt-2">{footer}</p>}
        </CardBody>
      </Card>
    </Link>
  );
}
