"use client";

/** Formulaire GET de filtres : se soumet au changement d'une liste ou d'une case (les filtres vivent dans l'URL). */
export function AutoSubmitForm({ children, className, action }: { children: React.ReactNode; className?: string; action: string }) {
  return (
    <form
      action={action}
      method="get"
      className={className}
      onChange={(e) => {
        const t = e.target as HTMLElement;
        if (t instanceof HTMLSelectElement || (t instanceof HTMLInputElement && (t.type === "checkbox" || t.type === "date"))) {
          e.currentTarget.requestSubmit();
        }
      }}
    >
      {children}
    </form>
  );
}
