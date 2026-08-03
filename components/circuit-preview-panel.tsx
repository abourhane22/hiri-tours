"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Image as ImageIcon } from "lucide-react";
import { formatMAD } from "@/lib/utils";

type PreviewState = {
  title: string;
  price: number;
  max: number;
  category: string;
  dayCount: number;
  imageUrl: string;
};

const TYPE_LABEL: Record<string, string> = {
  circuit: "Multi-jours",
  excursion: "Journée",
  transfert: "Point à point",
  sejour: "Nuitées",
};

/**
 * Panneau latéral : aperçu catalogue en direct + toggle "visible à la vente"
 * + boutons de soumission. La source de vérité reste les champs réels du
 * formulaire : ce composant les OBSERVE (input/change + MutationObserver),
 * il ne duplique aucun état métier.
 */
export function CircuitPreviewPanel({
  mode,
  initial,
  initialActive,
}: {
  mode: "create" | "edit";
  initial: PreviewState;
  initialActive: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<PreviewState>(initial);
  const [active, setActive] = useState(initialActive);

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;

    const num = (v: string | undefined, fallback: number) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };

    const recompute = () => {
      const get = (name: string) =>
        (form.querySelector(`[name="${name}"]`) as HTMLInputElement | null)?.value;
      setPreview({
        title: get("title") ?? "",
        price: num(get("base_price_mad"), 0),
        max: num(get("max_participants"), 0),
        category: get("category") ?? "circuit",
        dayCount: form.querySelectorAll('[name="cf_itinerary_day"]').length,
        imageUrl: get("hero_image_url") ?? "",
      });
    };

    recompute();
    form.addEventListener("input", recompute);
    form.addEventListener("change", recompute);
    const mo = new MutationObserver(recompute);
    mo.observe(form, { childList: true, subtree: true });

    return () => {
      form.removeEventListener("input", recompute);
      form.removeEventListener("change", recompute);
      mo.disconnect();
    };
  }, []);

  const durationLabel =
    preview.category === "circuit"
      ? `${preview.dayCount || 1} jour${(preview.dayCount || 1) > 1 ? "s" : ""}`
      : TYPE_LABEL[preview.category] ?? "—";

  return (
    <div ref={rootRef} className="space-y-3 lg:sticky lg:top-4">
      {/* Aperçu catalogue */}
      <div className="bg-white border border-[#E5E0D7] rounded-xl overflow-hidden">
        <div className="h-[84px] w-full relative">
          {preview.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundImage: "linear-gradient(135deg,#2A4A5C,#C26B3D)" }}
            >
              <ImageIcon className="size-6 text-white/70" />
            </div>
          )}
        </div>
        <div className="p-4">
          <p className="text-[10px] tracking-[1.5px] uppercase text-[#968F84] font-medium">
            Aperçu catalogue
          </p>
          <p className="font-medium text-[13.5px] text-[#1A1F2E] mt-1.5 line-clamp-2">
            {preview.title.trim() || "Titre du produit"}
          </p>
          <p className="text-[11.5px] text-[#968F84] mt-0.5">
            {durationLabel} · max {preview.max || 0} pax
          </p>
          <p className="mt-2">
            <span className="font-display text-xl text-[#1A1F2E] tabular-nums">
              {formatMAD(preview.price || 0)}
            </span>
            <span className="text-[11px] text-[#968F84]"> / pers.</span>
          </p>
        </div>
        <div className="px-4 py-3 border-t border-[#EBE6DC] flex items-center justify-between">
          <span className="text-[12px] text-[#58524A]">Visible à la vente</span>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              name="is_active"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="peer sr-only"
            />
            <span
              className="h-[19px] w-[34px] rounded-full bg-[#D6D0C4] transition-colors peer-checked:bg-[#0F6E56] after:absolute after:left-[2px] after:top-[2px] after:size-[15px] after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-[15px]"
              aria-hidden
            />
          </label>
        </div>
      </div>

      {/* Boutons */}
      <button
        type="submit"
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#1A1F2E] py-2.5 text-white text-sm font-medium hover:bg-[#2A3142] transition-colors"
      >
        <Check className="size-4" />
        {mode === "create" ? "Créer le produit" : "Enregistrer"}
      </button>
      <Link
        href="/admin/circuits"
        className="w-full inline-flex items-center justify-center rounded-lg border border-[#E0DACF] bg-white py-2.5 text-sm font-medium text-[#1A1F2E] hover:bg-[#FAF5F0] transition-colors"
      >
        Annuler
      </Link>

      {mode === "create" && (
        <p className="text-[11px] text-[#968F84] leading-snug">
          L&apos;image et la galerie se règlent dans la section Médias ci-contre ;
          les saisons tarifaires s&apos;ajoutent après création.
        </p>
      )}
    </div>
  );
}
