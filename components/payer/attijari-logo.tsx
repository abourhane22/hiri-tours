"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logo Attijari (next/image) servant de titre.
 * - `hasLogo` (calculé côté serveur) : le fichier /public/attijari-logo.png existe.
 * - Fallback runtime : si l'image ne charge pas (onError) ou est absente,
 *   on retombe sur le titre texte stylé — l'écran ne casse jamais.
 */
export function AttijariLogo({
  hasLogo = false,
  className,
}: {
  hasLogo?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (hasLogo && !failed) {
    return (
      <Image
        src="/attijari-logo.png"
        alt="Attijari Payment"
        height={28}
        width={120}
        className={cn("h-7 w-auto", className)}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center font-display font-semibold tracking-tight text-lg text-[#E67817]",
        className,
      )}
    >
      attijari<span className="text-navy-700">payment</span>
    </span>
  );
}
