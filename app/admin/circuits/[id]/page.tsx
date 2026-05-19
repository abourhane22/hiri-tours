import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { ArrowLeft, Trash2 } from "lucide-react";
import { ImageUpload } from "@/components/image-upload";

export default async function EditCircuitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: circuit } = await supabase
    .from("circuits")
    .select("*")
    .eq("id", id)
    .single();

  if (!circuit) notFound();

  async function updateCircuit(formData: FormData) {
    "use server";
    const supabase = await createClient();

    const payload = {
      title: formData.get("title") as string,
      slug: (formData.get("slug") as string).trim().toLowerCase(),
      category: formData.get("category") as string,
      short_description: formData.get("short_description") as string,
      description: formData.get("description") as string,
      duration_days: parseInt(formData.get("duration_days") as string, 10) || 1,
      duration_hours: formData.get("duration_hours")
        ? parseInt(formData.get("duration_hours") as string, 10)
        : null,
      base_price_mad: parseFloat(formData.get("base_price_mad") as string),
      child_price_mad: formData.get("child_price_mad")
        ? parseFloat(formData.get("child_price_mad") as string)
        : null,
      max_participants:
        parseInt(formData.get("max_participants") as string, 10) || 20,
      meeting_point: formData.get("meeting_point") as string,
      hero_image_url: formData.get("hero_image_url") as string,
      is_active: formData.get("is_active") === "on",
    };

    const { error } = await supabase.from("circuits").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    redirect("/admin/circuits");
  }

  async function deleteCircuit() {
    "use server";
    const supabase = await createClient();
    await supabase.from("circuits").delete().eq("id", id);
    redirect("/admin/circuits");
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link
        href="/admin/circuits"
        className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink mb-4"
      >
        <ArrowLeft className="size-4" /> Retour au catalogue
      </Link>

      <div className="mb-8">
        <p className="eyebrow mb-2">Module 2 — Catalogue</p>
        <h1 className="font-display text-3xl text-ink">Modifier le circuit</h1>
      </div>

      <form action={updateCircuit} className="bg-white border border-sand-200 rounded-lg p-6 space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label htmlFor="title">Titre</Label>
            <Input id="title" name="title" required defaultValue={circuit.title} />
          </div>
          <div>
            <Label htmlFor="slug">Slug (URL)</Label>
            <Input
              id="slug"
              name="slug"
              required
              pattern="[a-z0-9\-]+"
              defaultValue={circuit.slug}
            />
          </div>
          <div>
            <Label htmlFor="category">Catégorie</Label>
            <Select id="category" name="category" required defaultValue={circuit.category}>
              <option value="circuit">Circuit</option>
              <option value="excursion">Excursion</option>
              <option value="transfert">Transfert</option>
              <option value="sejour">Séjour</option>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="short_description">Description courte</Label>
          <Input
            id="short_description"
            name="short_description"
            defaultValue={circuit.short_description || ""}
          />
        </div>

        <div>
          <Label htmlFor="description">Description longue</Label>
          <Textarea
            id="description"
            name="description"
            rows={5}
            defaultValue={circuit.description || ""}
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="duration_days">Durée (jours)</Label>
            <Input
              id="duration_days"
              name="duration_days"
              type="number"
              min="1"
              defaultValue={circuit.duration_days}
              required
            />
          </div>
          <div>
            <Label htmlFor="duration_hours">Ou durée (heures)</Label>
            <Input
              id="duration_hours"
              name="duration_hours"
              type="number"
              min="1"
              defaultValue={circuit.duration_hours ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="max_participants">Max participants</Label>
            <Input
              id="max_participants"
              name="max_participants"
              type="number"
              min="1"
              defaultValue={circuit.max_participants}
              required
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="base_price_mad">Prix adulte (MAD)</Label>
            <Input
              id="base_price_mad"
              name="base_price_mad"
              type="number"
              min="0"
              step="0.01"
              defaultValue={circuit.base_price_mad}
              required
            />
          </div>
          <div>
            <Label htmlFor="child_price_mad">Prix enfant (MAD)</Label>
            <Input
              id="child_price_mad"
              name="child_price_mad"
              type="number"
              min="0"
              step="0.01"
              defaultValue={circuit.child_price_mad ?? ""}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="meeting_point">Point de rendez-vous</Label>
          <Input
            id="meeting_point"
            name="meeting_point"
            defaultValue={circuit.meeting_point || ""}
          />
        </div>

        <ImageUpload name="hero_image_url" label="Image principale" defaultValue={circuit.hero_image_url} />

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={circuit.is_active}
            className="size-4 rounded border-sand-300 text-terracotta-600 focus:ring-terracotta-500"
          />
          <span className="text-sm text-ink">
            Actif (visible sur le site public)
          </span>
        </label>

        <div className="flex justify-end items-center gap-3 pt-2 border-t border-sand-200">
          <Link href="/admin/circuits">
            <Button type="button" variant="secondary">
              Annuler
            </Button>
          </Link>
          <Button type="submit">Enregistrer</Button>
        </div>
      </form>

      <form action={deleteCircuit} className="mt-6 bg-white border border-red-200 rounded-lg p-6 flex items-center justify-between">
        <div>
          <h3 className="font-medium text-ink">Zone de danger</h3>
          <p className="text-sm text-sand-700">
            La suppression est définitive et entraînera l&apos;échec des réservations associées.
          </p>
        </div>
        <Button type="submit" variant="danger" size="sm">
          <Trash2 className="size-3.5" />
          Supprimer
        </Button>
      </form>
    </div>
  );
}
