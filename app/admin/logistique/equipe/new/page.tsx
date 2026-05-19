import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";
import { createStaff } from "../actions";

export default function NewStaffPage() {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Link href="/admin/logistique/equipe" className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink mb-4">
        <ArrowLeft className="size-4" /> Retour à l&apos;équipe
      </Link>
      <div className="mb-8">
        <p className="eyebrow mb-2">Module 5 — Logistique</p>
        <h1 className="font-display text-3xl text-ink">Nouveau membre</h1>
      </div>

      <form action={createStaff} className="bg-white border border-sand-200 rounded-lg p-6 space-y-5">
        <div><Label htmlFor="full_name">Nom complet *</Label><Input id="full_name" name="full_name" required /></div>
        <div>
          <Label htmlFor="role">Rôle</Label>
          <Select id="role" name="role" defaultValue="guide">
            <option value="guide">Guide</option>
            <option value="driver">Chauffeur</option>
            <option value="both">Guide + Chauffeur</option>
          </Select>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label htmlFor="phone">Téléphone</Label><Input id="phone" name="phone" type="tel" placeholder="+212 6 ..." /></div>
          <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" /></div>
        </div>
        <div>
          <Label htmlFor="languages">Langues parlées (séparées par virgule)</Label>
          <Input id="languages" name="languages" placeholder="Français, Anglais, Arabe, Berbère" />
        </div>
        <div><Label htmlFor="certifications">Certifications / Diplômes</Label><Textarea id="certifications" name="certifications" rows={2} placeholder="Carte de guide officiel, permis tourisme..." /></div>
        <div><Label htmlFor="notes">Notes internes</Label><Textarea id="notes" name="notes" rows={2} /></div>
        <label className="flex items-center gap-2 pt-3 border-t border-sand-200">
          <input type="checkbox" name="is_active" defaultChecked className="size-4 rounded border-sand-300 text-terracotta-600 focus:ring-terracotta-500" />
          <span className="text-sm text-ink">Actif</span>
        </label>
        <div className="flex justify-end gap-3 pt-3 border-t border-sand-200">
          <Link href="/admin/logistique/equipe"><Button type="button" variant="secondary">Annuler</Button></Link>
          <Button type="submit">Créer le membre</Button>
        </div>
      </form>
    </div>
  );
}
