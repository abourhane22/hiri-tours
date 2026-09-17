import { redirect } from "next/navigation";

// Ancienne fiche produit — conservée pour les liens existants (lot C1).
export default async function LegacyCircuitDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/produits/${id}`);
}
