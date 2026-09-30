// Messages éphémères (« flash ») posés par une server action et affichés en toast
// côté client — indispensable quand l'action REDIRIGE (la page qui a soumis le
// formulaire n'existe plus pour afficher le résultat) et pour les formulaires
// serveur sans état client. Consommés par components/ui/toaster.tsx (à l'arrivée
// sur la page, ou à la fin de l'envoi), puis effacés.
//
// Serveur uniquement (next/headers). Règle « jamais d'échec silencieux » : une
// action qui échoue pose un flashError (avec le champ en cause quand il est connu)
// au lieu de lever une exception.

import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { FLASH_COOKIE, type FlashMessage } from "@/lib/flash-shared";

async function push(msg: FlashMessage) {
  const jar = await cookies();
  let prev: FlashMessage[] = [];
  try {
    const raw = jar.get(FLASH_COOKIE)?.value;
    if (raw) prev = JSON.parse(decodeURIComponent(raw)) as FlashMessage[];
  } catch {
    prev = [];
  }
  const next = [...prev, msg].slice(-5);
  jar.set(FLASH_COOKIE, encodeURIComponent(JSON.stringify(next)), {
    path: "/",
    maxAge: 60,
    sameSite: "lax",
    httpOnly: false, // lu puis effacé par le client
  });
}

export async function flashSuccess(message: string): Promise<void> {
  await push({ type: "success", message });
}

export async function flashError(message: string, field?: string | null): Promise<void> {
  await push({ type: "error", message, field: field ?? null });
}

/** Message d'une erreur quelconque, pour un flashError. */
export function errorMessage(e: unknown, fallback = "Enregistrement impossible."): string {
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    const m = (e as { message: string }).message.trim();
    if (m) return m;
  }
  return fallback;
}

/** Erreur métier d'une action de formulaire, avec le champ (`name`) à mettre en évidence. */
export class ActionError extends Error {
  field: string | null;
  constructor(message: string, field?: string | null) {
    super(message);
    this.name = "ActionError";
    this.field = field ?? null;
  }
}

/**
 * Enveloppe d'une server action de formulaire SERVEUR (<form action={…}> sans état client) :
 *  - succès → toast `success` (libellé de l'écran), puis redirection si `fn` renvoie une URL ;
 *  - échec → toast d'erreur avec le message métier et le champ (ActionError), sans redirection.
 * Jamais d'exception vers l'utilisateur : « jamais d'échec silencieux », jamais d'écran d'erreur.
 */
export async function formAction(success: string | ((target: string | void) => string), fn: () => Promise<string | void>): Promise<void> {
  let target: string | void;
  try {
    target = await fn();
  } catch (e) {
    unstable_rethrow(e); // laisse passer redirect() / notFound() du framework
    console.error("[formAction]", e);
    await flashError(errorMessage(e), e instanceof ActionError ? e.field : null);
    return;
  }
  await flashSuccess(typeof success === "function" ? success(target) : success);
  if (target) redirect(target);
}
