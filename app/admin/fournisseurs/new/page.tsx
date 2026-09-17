import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SupplierForm } from "@/components/supplier-form";
import { createSupplier } from "../actions";

export default function NewSupplierPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link
        href="/admin/fournisseurs"
        className="inline-flex items-center gap-1 text-sm text-[#6B6862] hover:text-[#1A1F2E] mb-4"
      >
        <ArrowLeft className="size-4" /> Retour aux fournisseurs
      </Link>

      <div className="mb-6">
        <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium">Achats · Fournisseurs</p>
        <h1 className="font-display text-3xl text-[#1A1F2E] mt-1">Nouveau fournisseur</h1>
        <p className="text-[12px] text-[#6B6862] mt-1">
          Les conditions commerciales détaillées (rémunération, annulation, échéancier) se saisissent contrat par contrat.
        </p>
      </div>

      <SupplierForm
        mode="create"
        action={createSupplier}
        cancelHref="/admin/fournisseurs"
        defaults={{
          name: "",
          legalName: "",
          supplierType: "hotel",
          ice: "",
          ifNumber: "",
          rc: "",
          addressLine: "",
          city: "Agadir",
          country: "Maroc",
          phone: "",
          email: "",
          website: "",
          contacts: [],
          paymentTerms: "comptant",
          defaultCurrency: "MAD",
          isActive: true,
          notes: "",
        }}
      />
    </div>
  );
}
