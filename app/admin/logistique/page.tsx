import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { Truck, Users, ArrowRight } from "lucide-react";

export default async function LogistiquePage() {
  const supabase = await createClient();
  const [vehiclesCount, staffCount] = await Promise.all([
    supabase.from("vehicles").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("staff_members").select("*", { count: "exact", head: true }).eq("is_active", true),
  ]);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <p className="eyebrow mb-2">Module 5 — Logistique</p>
        <h1 className="font-display text-3xl text-ink">Ressources opérationnelles</h1>
        <p className="text-sand-700 mt-2">Gérez votre flotte de véhicules et votre équipe (guides + chauffeurs).</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Link href="/admin/logistique/vehicules" className="group">
          <Card className="h-full hover:border-terracotta-300 transition-colors">
            <CardBody>
              <div className="flex items-start justify-between mb-3">
                <div className="size-12 rounded-lg bg-terracotta-50 border border-terracotta-200 flex items-center justify-center">
                  <Truck className="size-6 text-terracotta-600" />
                </div>
                <ArrowRight className="size-4 text-sand-400 group-hover:text-terracotta-600 group-hover:translate-x-1 transition-all" />
              </div>
              <h2 className="font-display text-xl text-ink mb-1">Véhicules</h2>
              <p className="text-sm text-sand-700 mb-3">Immatriculations, capacités, état du parc.</p>
              <p className="text-xs text-sand-600"><span className="font-medium text-ink">{vehiclesCount.count ?? 0}</span> véhicule(s) actif(s)</p>
            </CardBody>
          </Card>
        </Link>

        <Link href="/admin/logistique/equipe" className="group">
          <Card className="h-full hover:border-atlantic-300 transition-colors">
            <CardBody>
              <div className="flex items-start justify-between mb-3">
                <div className="size-12 rounded-lg bg-atlantic-50 border border-atlantic-200 flex items-center justify-center">
                  <Users className="size-6 text-atlantic-700" />
                </div>
                <ArrowRight className="size-4 text-sand-400 group-hover:text-atlantic-700 group-hover:translate-x-1 transition-all" />
              </div>
              <h2 className="font-display text-xl text-ink mb-1">Équipe</h2>
              <p className="text-sm text-sand-700 mb-3">Guides et chauffeurs : profils, langues, certifications.</p>
              <p className="text-xs text-sand-600"><span className="font-medium text-ink">{staffCount.count ?? 0}</span> membre(s) actif(s)</p>
            </CardBody>
          </Card>
        </Link>
      </div>
    </div>
  );
}
