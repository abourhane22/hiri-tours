// Contrat partagé serveur / client du flash (lib/flash.ts ↔ components/ui/toaster.tsx).

export const FLASH_COOKIE = "hiri_flash";

export type FlashMessage = {
  type: "success" | "error";
  message: string;
  /** Nom (attribut `name`) du champ à mettre en évidence en cas d'erreur. */
  field?: string | null;
};

/**
 * État renvoyé par les server actions des formulaires client (useActionState).
 * `field` désigne le champ en erreur ; `message` remplace le libellé de succès par défaut.
 */
export type FormFeedback = { ok: true; message?: string } | { ok: false; error: string; field?: string | null };
