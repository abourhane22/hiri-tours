import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CircuitForm } from "@/components/circuit-form";
import { createCircuit } from "@/app/admin/circuits/actions";

export default function NewCircuitPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link
        href="/admin/circuits"
        className="inline-flex items-center gap-1 text-sm text-[#6B6862] hover:text-[#1A1F2E] mb-4"
      >
        <ArrowLeft className="size-4" /> Retour au catalogue
      </Link>
      <div className="mb-6">
        <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">
          Catalogue · Nouveau produit
        </p>
        <h1 className="font-display text-3xl text-[#1A1F2E] mt-1">Nouveau circuit</h1>
      </div>

      <CircuitForm
        mode="create"
        action={createCircuit}
        defaults={{
          title: "",
          slug: "",
          shortDescription: "",
          description: "",
          basePrice: "",
          childPrice: "",
          maxParticipants: "20",
          category: "circuit",
          categoryFields: {},
          heroImageUrl: "",
          galleryUrls: null,
          isActive: true,
          dayCount: 1,
        }}
      />
    </div>
  );
}
