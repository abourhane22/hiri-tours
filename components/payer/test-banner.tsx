import { FlaskConical } from "lucide-react";

/**
 * Bandeau ambre affiché en haut de CHAQUE écran du simulateur.
 * Rappelle qu'aucune transaction réelle n'est effectuée.
 */
export function TestBanner() {
  return (
    <div className="w-full bg-amber-100 border-b border-amber-300 text-amber-900">
      <div className="max-w-lg mx-auto px-4 py-2.5 flex items-center justify-center gap-2 text-center">
        <FlaskConical className="size-4 shrink-0" />
        <p className="text-xs sm:text-sm font-medium">
          Environnement de test — aucune transaction réelle
        </p>
      </div>
    </div>
  );
}
