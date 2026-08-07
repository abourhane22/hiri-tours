"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Users,
  BedDouble,
  Clock,
  Car,
  Repeat,
  Utensils,
  Tag,
} from "lucide-react";
import { formatMAD } from "@/lib/utils";

export type CatalogItem = {
  id: string;
  title: string;
  category: string;
  heroImageUrl: string | null;
  price: number;
  durationDays: number | null;
  durationHours: number | null;
  maxParticipants: number | null;
  lodgingIncluded: boolean;
  departureTime: string | null;
  vehicleType: string | null;
  tripType: string | null;
  nights: number | null;
  boardType: string | null;
  highSeason: boolean;
};

const CATEGORY_LABEL: Record<string, string> = {
  circuit: "Circuit",
  excursion: "Excursion",
  transfert: "Transfert",
  sejour: "Séjour",
};

const CHIP_LABEL: Record<string, string> = {
  circuit: "Circuits",
  excursion: "Excursions",
  transfert: "Transferts",
  sejour: "Séjours",
};

const CHIP_ORDER = ["circuit", "excursion", "transfert", "sejour"];

const PLACEHOLDER: Record<string, string> = {
  circuit: "linear-gradient(135deg, #B0653A, #7A4A28)",
  excursion: "linear-gradient(135deg, #2A6A6C, #1A4548)",
  transfert: "linear-gradient(135deg, #33506B, #1F3247)",
  sejour: "linear-gradient(135deg, #C89B3A, #8A6A1E)",
};

const BADGE_COLOR: Record<string, string> = {
  circuit: "#3C3489",
  excursion: "#085041",
  transfert: "#0C447C",
  sejour: "#633806",
};

const VEHICLE_LABEL: Record<string, string> = {
  berline: "Berline",
  van: "Van",
  minibus: "Minibus",
};

const BOARD_LABEL: Record<string, string> = {
  petit_dejeuner: "Petit-déjeuner",
  demi_pension: "Demi-pension",
  pension_complete: "Pension complète",
};

type Meta = { Icon: typeof Calendar; text: string };

function buildMeta(c: CatalogItem): Meta[] {
  const meta: Meta[] = [];

  if (c.category === "circuit") {
    if (c.durationDays) meta.push({ Icon: Calendar, text: `${c.durationDays} jours` });
    if (c.maxParticipants) meta.push({ Icon: Users, text: `jusqu'à ${c.maxParticipants} pers.` });
    if (c.lodgingIncluded) meta.push({ Icon: BedDouble, text: "hébergement inclus" });
  } else if (c.category === "excursion") {
    if (c.durationHours) {
      meta.push({
        Icon: Clock,
        text: `${c.durationHours} h${c.departureTime ? ` · départ ${c.departureTime}` : ""}`,
      });
    } else if (c.departureTime) {
      meta.push({ Icon: Clock, text: `départ ${c.departureTime}` });
    }
    if (c.maxParticipants) meta.push({ Icon: Users, text: `jusqu'à ${c.maxParticipants} pers.` });
  } else if (c.category === "transfert") {
    if (c.vehicleType && VEHICLE_LABEL[c.vehicleType]) {
      meta.push({ Icon: Car, text: VEHICLE_LABEL[c.vehicleType] });
    }
    if (c.tripType === "aller_retour") meta.push({ Icon: Repeat, text: "aller-retour" });
  } else if (c.category === "sejour") {
    if (c.nights) meta.push({ Icon: BedDouble, text: `${c.nights} nuits` });
    if (c.boardType && BOARD_LABEL[c.boardType]) {
      meta.push({ Icon: Utensils, text: BOARD_LABEL[c.boardType] });
    }
  }

  return meta.slice(0, 3);
}

export function CatalogGrid({ items }: { items: CatalogItem[] }) {
  const present = CHIP_ORDER.filter((cat) => items.some((c) => c.category === cat));
  const [active, setActive] = useState<string>("all");

  const filtered = active === "all" ? items : items.filter((c) => c.category === active);

  if (items.length === 0) {
    return (
      <p className="text-sm text-[#968F84] py-10 text-center">
        Aucune prestation disponible pour le moment.
      </p>
    );
  }

  return (
    <div>
      {/* Filtres par catégorie */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <Chip label="Tout" active={active === "all"} onClick={() => setActive("all")} />
        {present.map((cat) => (
          <Chip
            key={cat}
            label={CHIP_LABEL[cat]}
            active={active === cat}
            onClick={() => setActive(cat)}
          />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => {
          const meta = buildMeta(c);
          return (
            <Link
              key={c.id}
              href={`/reserver/${c.id}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-[#E5E0D7] bg-white transition-shadow hover:shadow-md"
            >
              {/* Visuel 108 px */}
              <div
                className="relative w-full overflow-hidden"
                style={{ height: 108, background: PLACEHOLDER[c.category] ?? PLACEHOLDER.circuit }}
              >
                {c.heroImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.heroImageUrl}
                    alt={c.title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                )}
                <span
                  className="absolute top-2 left-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{ backgroundColor: "rgba(255,255,255,0.92)", color: BADGE_COLOR[c.category] ?? "#1A1F2E" }}
                >
                  {CATEGORY_LABEL[c.category] ?? c.category}
                </span>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-3 pt-8 pb-2.5">
                  <h2 className="font-display text-[15px] leading-tight text-white line-clamp-2">
                    {c.title}
                  </h2>
                </div>
              </div>

              {/* Corps */}
              <div className="flex flex-1 flex-col p-4">
                {meta.length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {meta.map((m, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-[11px] text-[#968F84]">
                        <m.Icon className="size-3" />
                        {m.text}
                      </span>
                    ))}
                  </div>
                )}

                {c.highSeason && (
                  <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-[#C84B31]">
                    <Tag className="size-3" />
                    tarif haute saison en ce moment
                  </span>
                )}

                <div className="mt-3 flex items-end justify-between pt-2">
                  <div>
                    <div className="text-[11px] text-[#968F84]">à partir de</div>
                    <div className="font-display text-lg text-[#0F6E56] tabular-nums">
                      {formatMAD(c.price)}
                      <span className="text-[11px] font-normal text-[#968F84]"> / pers.</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-lg bg-[#C84B31] px-3.5 py-2 text-[13px] font-medium text-white transition-colors group-hover:bg-[#B03D26]">
                    Réserver
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
        active
          ? "bg-[#1A1F2E] text-white"
          : "border border-[#E0DACF] bg-white text-[#6B6862] hover:border-[#C9C0AE]"
      }`}
    >
      {label}
    </button>
  );
}
