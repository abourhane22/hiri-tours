import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CustomerNewForm } from "@/components/customer-new-form";

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Link
        href="/admin/clients"
        className="inline-flex items-center gap-1 text-sm text-sand-700 hover:text-ink mb-4"
      >
        <ArrowLeft className="size-4" /> Retour aux clients
      </Link>

      <div className="mb-8">
        <p className="eyebrow mb-2">Module 3 — Base clients</p>
        <h1 className="font-display text-3xl text-ink">Nouveau client</h1>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800">
          {decodeURIComponent(error)}
        </div>
      )}

      <CustomerNewForm />
    </div>
  );
}
