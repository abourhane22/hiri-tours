import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, CreditCard, Globe, Users, ArrowRight, Wrench } from "lucide-react";
import type { CompanySettings } from "@/lib/types";

export default async function ParametresPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: settings } = await supabase.from("company_settings").select("*").limit(1).single();
  const { data: callerProfile } = user ? await supabase.from("profiles").select("role").eq("id", user.id).single() : { data: null };
  const isAdmin = (callerProfile as any)?.role === "admin";
  const s = settings as CompanySettings | null;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <p className="eyebrow mb-2">Configuration</p>
        <h1 className="font-display text-3xl text-ink">Paramètres</h1>
      </div>

      <Card className="mb-6">
        <div className="px-5 py-4 border-b border-sand-200 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg text-ink">Informations société</h2>
            <p className="text-xs text-sand-700 mt-1">Coordonnées légales, fiscales et bancaires. Apparaissent sur toutes les factures.</p>
          </div>
          <Link href="/admin/parametres/societe">
            <Button variant="secondary" size="sm" className="shrink-0">
              <Building2 className="size-3.5" /> Gérer
              <ArrowRight className="size-3" />
            </Button>
          </Link>
        </div>
        <div className="px-5 py-3 text-xs text-sand-700 flex items-center gap-2 flex-wrap">
          <Building2 className="size-3.5 text-terracotta-600" />
          {s ? (
            <span>
              <span className="font-medium text-ink">{s.legal_name}</span>
              {s.ice && <> · ICE <span className="font-mono">{s.ice}</span></>}
              <> · TVA par défaut <span className="font-medium">{(Number(s.tva_default_rate) * 100).toFixed(0)}%</span></>
              {s.city && <> · {s.city}</>}
            </span>
          ) : (
            <span className="italic">Pas encore configuré</span>
          )}
        </div>
      </Card>

      <Card className="mb-6">
        <div className="px-5 py-4 border-b border-sand-200 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg text-ink">Paiements en ligne</h2>
            <p className="text-xs text-sand-700 mt-1">Intégrations pour encaisser les acomptes et soldes directement depuis le voucher.</p>
          </div>
          <span className="shrink-0 bg-amber-100 text-amber-800 text-[10px] uppercase tracking-wider font-medium px-2 py-1 rounded">En construction</span>
        </div>
        <CardBody>
          <div className="grid sm:grid-cols-2 gap-4">
            <ComingSoonCard
              icon={<CreditCard className="size-5 text-terracotta-600" />}
              title="CMI Maroc"
              description="Centre Monétique Interbancaire — encaissement MAD via cartes marocaines."
            />
            <ComingSoonCard
              icon={<Globe className="size-5 text-atlantic-700" />}
              title="Stripe"
              description="Paiement international en devises (EUR, USD, GBP)."
            />
          </div>
        </CardBody>
      </Card>

      {isAdmin && (
        <Card>
          <div className="px-5 py-4 border-b border-sand-200 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg text-ink">Utilisateurs &amp; accès</h2>
              <p className="text-xs text-sand-700 mt-1">Gérez les comptes de la plateforme, les rôles et les invitations.</p>
            </div>
            <Link href="/admin/parametres/utilisateurs">
              <Button variant="secondary" size="sm" className="shrink-0">
                <Users className="size-3.5" /> Gérer
                <ArrowRight className="size-3" />
              </Button>
            </Link>
          </div>
          <div className="px-5 py-3 text-xs text-sand-700 flex items-center gap-2">
            <Users className="size-3.5 text-atlantic-700" />
            <span>4 rôles : Administrateur, Commercial, Comptable, Opérationnel</span>
          </div>
        </Card>
      )}
    </div>
  );
}

function ComingSoonCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="relative border border-dashed border-sand-300 rounded-lg p-4 bg-sand-50/50">
      <div className="flex items-start gap-3 mb-2">
        <div className="size-10 bg-white rounded-md border border-sand-200 flex items-center justify-center shrink-0">{icon}</div>
        <div className="flex-1">
          <h3 className="font-medium text-ink text-sm">{title}</h3>
          <div className="flex items-center gap-1 text-xs text-amber-700 mt-0.5"><Wrench className="size-3" />Travaux en cours</div>
        </div>
      </div>
      <p className="text-xs text-sand-700 leading-relaxed">{description}</p>
    </div>
  );
}
