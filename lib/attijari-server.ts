import { existsSync } from "fs";
import path from "path";

/**
 * Vrai uniquement si le logo Attijari a été déposé dans /public.
 * Server-only (accès filesystem) — appelé depuis les Server Components /payer.
 */
export function hasAttijariLogo(): boolean {
  try {
    return existsSync(path.join(process.cwd(), "public", "attijari-logo.png"));
  } catch {
    return false;
  }
}
