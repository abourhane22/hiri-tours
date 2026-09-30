import { AlertCircle } from "lucide-react";

/** Erreur PostgREST/Postgres telle que renvoyée par supabase-js. */
export type QueryError = { code?: string; message?: string; details?: string | null; hint?: string | null } | null | undefined;

/**
 * « Aucune ligne » (PGRST116, renvoyé par `.single()` sur un résultat vide) est une
 * vraie 404 ; toute autre erreur est une panne de requête et doit s'afficher comme
 * telle — jamais se déguiser en page introuvable.
 */
export function isNoRowError(error: QueryError): boolean {
  return error?.code === "PGRST116";
}

/** Panneau d'erreur de chargement (pages serveur du backoffice). L'appelant logue l'erreur. */
export function QueryErrorPanel({ title, error }: { title: string; error: QueryError }) {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div role="alert" className="rounded-xl border border-[#F7C1C1] bg-[#FCEBEB] p-5 text-[#791F1F]">
        <p className="flex items-center gap-2 font-medium">
          <AlertCircle className="size-4 shrink-0" /> {title}
        </p>
        <p className="mt-1.5 text-[13px]">
          La requête a échoué : ce n&apos;est pas une page introuvable. Réessayez ; si l&apos;erreur persiste, transmettez
          le code ci-dessous à l&apos;administrateur.
        </p>
        <p className="mt-2 font-mono text-[11.5px] break-all opacity-90">
          {error?.code ?? "erreur"} — {error?.message ?? "inconnue"}
          {error?.details ? ` · ${error.details}` : ""}
        </p>
      </div>
    </div>
  );
}
