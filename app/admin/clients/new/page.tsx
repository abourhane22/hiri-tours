import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CustomerForm } from "@/components/customer-form";
import { createCustomer } from "../actions";

export default async function NewClientPage() {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Link
        href="/admin/clients"
        className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink mb-4"
      >
        <ArrowLeft className="size-4" /> Retour aux clients
      </Link>

      <div className="mb-8">
        <p className="eyebrow mb-2">CRM · Base clients</p>
        <h1 className="font-display text-3xl text-ink">Nouveau client</h1>
        <p className="text-sm text-sand-700 mt-1.5">
          Le téléphone et l&apos;email sont vérifiés contre la base pour éviter les
          doublons.
        </p>
      </div>

      <CustomerForm
        mode="create"
        action={createCustomer}
        defaults={{
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          country: "",
          nationality: "",
          city: "",
          source: "",
          language: "fr",
          notes: "",
        }}
      />
    </div>
  );
}
