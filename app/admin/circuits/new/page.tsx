import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { ImageUpload } from "@/components/image-upload";
import { GalleryEditor } from "@/components/gallery-editor";
import { ItineraryEditor } from "@/components/itinerary-editor";
import { ArrowLeft } from "lucide-react";

export default function NewCircuitPage() {
  async function createCircuit(formData: FormData) {
    "use server";
    const supabase = await createClient();

    let galleryUrls: string[] = [];
    try {
      const raw = formData.get("gallery_urls") as string;
      if (raw) galleryUrls = JSON.parse(raw);
    } catch {}

    let itinerary: unknown[] = [];
    try {
      const raw = formData.get("itinerary") as string;
      if (raw) itinerary = JSON.parse(raw);
    } catch {}

    const slug = (formData.get("slug") as string).trim().toLowerCase();
    const payload = {
      slug,
      title: formData.get("title") as string,
      category: formData.get("category") as string,
      short_description: formData.get("short_description") as string,
      description: formData.get("description") as string,
      duration_days: parseInt(formData.get("duration_days") as string, 10) || 1,
      duration_hours: formData.get("duration_hours") ? parseInt(formData.get("duration_hours") as string, 10) : null,
      base_price_mad: parseFloat(formData.get("base_price_mad") as string),
      child_price_mad: formData.get("child_price_mad") ? parseFloat(formData.get("child_price_mad") as string) : null,
      max_participants: parseInt(formData.get("max_participants") as string, 10) || 20,
      meeting_point: formData.get("meeting_point") as string,
      hero_image_url: formData.get("hero_image_url") as string,
      gallery_urls: galleryUrls.length > 0 ? galleryUrls : null,
      itinerary: itinerary.length > 0 ? itinerary : null,
      is_active: formData.get("is_active") === "on",
    };

    const { data, error } = await supabase.from("circuits").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    redirect(`/admin/circuits/${data.id}`);
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href="/admin/circuits" className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink mb-4">
        <ArrowLeft className="size-4" /> Retour au catalogue
      </Link>
      <div className="mb-8">
        <p className="eyebrow mb-2">Module 2 — Catalogue</p>
        <h1 className="font-display text-3xl text-ink">Nouveau circuit</h1>
        <p className="text-sand-700 mt-2 text-sm">Les périodes saisonnières peuvent être ajoutées après la création.</p>
      </div>

      <form action={createCircuit} className="bg-white border border-sand-200 rounded-lg p-6 space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><Label htmlFor="title">Titre</Label><Input id="title" name="title" required placeholder="Paradise Valley & Tafraout" /></div>
          <div><Label htmlFor="slug">Slug (URL)</Label><Input id="slug" name="slug" required pattern="[a-z0-9\-]+" placeholder="paradise-valley-tafraout" /></div>
          <div>
            <Label htmlFor="category">Catégorie</Label>
            <Select id="category" name="category" required defaultValue="circuit">
              <option value="circuit">Circuit</option>
              <option value="excursion">Excursion</option>
              <option value="transfert">Transfert</option>
              <option value="sejour">Séjour</option>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="short_description">Description courte</Label>
          <Input id="short_description" name="short_description" placeholder="Une phrase qui donne envie." />
        </div>
        <div>
          <Label htmlFor="description">Description longue</Label>
          <Textarea id="description" name="description" rows={5} />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div><Label htmlFor="duration_days">Durée (jours)</Label><Input id="duration_days" name="duration_days" type="number" min="1" defaultValue="1" required /></div>
          <div><Label htmlFor="duration_hours">Ou durée (heures)</Label><Input id="duration_hours" name="duration_hours" type="number" min="1" /></div>
          <div><Label htmlFor="max_participants">Max participants</Label><Input id="max_participants" name="max_participants" type="number" min="1" defaultValue="20" required /></div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label htmlFor="base_price_mad">Prix adulte (MAD)</Label><Input id="base_price_mad" name="base_price_mad" type="number" min="0" step="0.01" required /></div>
          <div><Label htmlFor="child_price_mad">Prix enfant (MAD)</Label><Input id="child_price_mad" name="child_price_mad" type="number" min="0" step="0.01" /></div>
        </div>

        <div>
          <Label htmlFor="meeting_point">Point de rendez-vous</Label>
          <Input id="meeting_point" name="meeting_point" />
        </div>

        <div className="pt-3 border-t border-sand-200">
          <ImageUpload name="hero_image_url" label="Image principale" />
        </div>

        <div className="pt-3 border-t border-sand-200">
          <GalleryEditor name="gallery_urls" />
        </div>

        <div className="pt-3 border-t border-sand-200">
          <ItineraryEditor name="itinerary" />
        </div>

        <label className="flex items-center gap-2 pt-3 border-t border-sand-200">
          <input type="checkbox" name="is_active" defaultChecked className="size-4 rounded border-sand-300 text-terracotta-600 focus:ring-terracotta-500" />
          <span className="text-sm text-ink">Actif (visible)</span>
        </label>

        <div className="flex justify-end gap-3 pt-3 border-t border-sand-200">
          <Link href="/admin/circuits"><Button type="button" variant="secondary">Annuler</Button></Link>
          <Button type="submit">Créer le circuit</Button>
        </div>
      </form>
    </div>
  );
}
