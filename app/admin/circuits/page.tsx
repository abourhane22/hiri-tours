import { redirect } from "next/navigation";

// Le catalogue est devenu « Produits » (lot C1). On garde cette route pour les
// anciens liens et signets internes.
export default function LegacyCircuitsRedirect() {
  redirect("/admin/produits");
}
