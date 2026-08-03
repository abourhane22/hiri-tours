"use client";

import { useEffect } from "react";

/**
 * Déclenche l'impression au chargement (utilisé via ?print=1).
 * Petit délai pour laisser le rendu se stabiliser avant window.print().
 */
export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 350);
    return () => clearTimeout(t);
  }, []);
  return null;
}
