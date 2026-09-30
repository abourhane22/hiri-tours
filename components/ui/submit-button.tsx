"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";

/**
 * Bouton d'enregistrement à trois états, pour TOUT formulaire du backoffice :
 *  - envoi : libellé « Enregistrement… », bouton désactivé (pas de double clic) ;
 *  - fin d'envoi : consomme le flash serveur (toast succès / erreur + champ en évidence).
 * Fonctionne avec un <form action={serverAction}> de Server Component comme avec useActionState.
 */
export function SubmitButton({
  children,
  pendingLabel = "Enregistrement…",
  className,
  variant,
  size,
  disabled,
  name,
  value,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  variant?: "primary" | "secondary" | "accent" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  const toast = useToast();
  const was = useRef(false);
  useEffect(() => {
    if (was.current && !pending) toast.consumeFlash();
    was.current = pending;
  }, [pending, toast]);

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      disabled={pending || disabled}
      aria-busy={pending}
      name={name}
      value={value}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
