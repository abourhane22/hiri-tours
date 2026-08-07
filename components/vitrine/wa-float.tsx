import { VitrineIcon } from "@/components/vitrine/icon";
import { waLink } from "@/lib/agence";

export function WaFloat({ whatsapp }: { whatsapp: string }) {
  return (
    <a
      className="wa-float"
      href={waLink(whatsapp)}
      target="_blank"
      rel="noreferrer"
      title="Réserver via WhatsApp"
      aria-label="WhatsApp"
    >
      <VitrineIcon name="wa" />
    </a>
  );
}
