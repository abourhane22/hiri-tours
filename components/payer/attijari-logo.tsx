import { cn } from "@/lib/utils";

/**
 * Logo Attijari si /public/attijari-logo.png existe, sinon un placeholder
 * texte stylé. `hasLogo` est calculé côté serveur (accès filesystem).
 */
export function AttijariLogo({
  hasLogo,
  className,
}: {
  hasLogo: boolean;
  className?: string;
}) {
  if (hasLogo) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src="/attijari-logo.png"
        alt="Attijari Payment"
        className={cn("h-8 w-auto object-contain", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center font-display font-semibold tracking-tight text-[#E67817]",
        className,
      )}
    >
      attijari<span className="text-navy-700">payment</span>
    </span>
  );
}
