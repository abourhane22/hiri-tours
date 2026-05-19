import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { LanguageSelector } from "@/components/language-selector";
import { DocumentsManager } from "@/components/documents-manager";
import { ArrowLeft, Trash2 } from "lucide-react";
import { updateStaff, deleteStaff } from "../actions";
import type { StaffMember } from "@/lib/types";

export default async function EditStaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: staff } = await supabase.from("staff_members").select("*").eq("id", id).single();
  if (!staff) notFound();
  const m = staff as StaffMember;
  const updateBound = updateStaff.bind(null, id);
  const deleteBound = deleteStaff.bind(null, id);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Link href="/admin/logistique/equipe" className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink mb-4">
        <ArrowLeft className="size-4" /> Retour à l&apos;équipe
      </Link>
      <div className="mb-8">
        <p className="eyebrow mb-2">Module 5 — Logistique</p>
        <h1 className="font-display text-3xl text-ink">{m.full_name}</h1>
      </div>

      <form action={updateBound} className="bg-white border border-sand-200 rounded-lg p-6 space-y-5">
        <div><Label htmlFor="full_name">Nom complet *</Label><Input id="full_name" name="full_name" required defaultValue={m.full_name} /></div>
        <div>
          <Label htmlFor="role">Rôle</Label>
          <Select id="role" name="role" defaultValue={m.role}>
            <option value="guide">Guide</option>
            <option value="driver">Chauffeur</option>
            <option value="both">Guide + Chauffeur</option>
          </Select>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label htmlFor="phone">Téléphone</Label><Input id="phone" name="phone" type="tel" defaultValue={m.phone ?? ""} /></div>
          <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" defaultValue={m.email ?? ""} /></div>
        </div>

        <div className="pt-3 border-t border-sand-200">
          <LanguageSelector name="languages" defaultValue={m.languages} />
        </div>

        <div className="pt-3 border-t border-sand-200">
          <DocumentsManager name="documents" defaultValue={m.documents} />
        </div>

        <div className="pt-3 border-t border-sand-200">
          <Label htmlFor="notes">Notes internes</Label>
          <Textarea id="notes" name="notes" rows={2} defaultValue={m.notes ?? ""} />
        </div>

        <label className="flex items-center gap-2 pt-3 border-t border-sand-200">
          <input type="checkbox" name="is_active" defaultChecked={m.is_active} className="size-4 rounded border-sand-300 text-terracotta-600 focus:ring-terracotta-500" />
          <span className="text-sm text-ink">Actif</span>
        </label>

        <div className="flex justify-end gap-3 pt-3 border-t border-sand-200">
          <Link href="/admin/logistique/equipe"><Button type="button" variant="secondary">Annuler</Button></Link>
          <Button type="submit">Enregistrer</Button>
        </div>
      </form>

      <form action={deleteBound} className="mt-6">
        <Card className="border-red-200">
          <div className="px-5 py-4 border-b border-red-200 bg-red-50">
            <h2 className="font-display text-lg text-red-900">Zone de danger</h2>
          </div>
          <CardBody>
            <p className="text-sm text-sand-800 mb-4">Suppression définitive. Impossible s&apos;il est lié à des réservations.</p>
            <Button type="submit" variant="danger" size="sm"><Trash2 className="size-3.5" />Supprimer</Button>
          </CardBody>
        </Card>
      </form>
    </div>
  );
}
