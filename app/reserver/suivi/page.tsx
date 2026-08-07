import { TrackingForm } from "@/components/public/tracking-form";

export const metadata = {
  title: "Suivre ma réservation — Hiri Tours",
};

export default function SuiviFormPage() {
  return (
    <div className="max-w-[520px] mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="font-display text-2xl text-[#1A1F2E]">Suivre ma réservation</h1>
        <p className="mt-1.5 text-[13px] text-[#6B6862]">
          Retrouvez votre dossier avec votre référence et l&apos;email ou le téléphone utilisé
          lors de la réservation.
        </p>
      </div>

      <TrackingForm />
    </div>
  );
}
