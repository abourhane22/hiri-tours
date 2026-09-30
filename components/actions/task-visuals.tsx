import { Truck, Banknote, CalendarCheck, Boxes, PlaneTakeoff, BadgeCheck, PackageOpen } from "lucide-react";
import type { InfoKind, TaskFamily } from "@/lib/tasks";

// Icônes du centre d'actions (cloche + page). Carré teinté côté appelant, jamais de liseré.

const FAMILY_ICON: Record<TaskFamily, typeof Truck> = {
  logistique: Truck,
  paiements: Banknote,
  reservations: CalendarCheck,
  stock: Boxes,
};

const INFO_ICON: Record<InfoKind, typeof Truck> = {
  departures: PlaneTakeoff,
  payment: BadgeCheck,
  stock: PackageOpen,
};

export function FamilyIcon({ family, className }: { family: TaskFamily; className?: string }) {
  const Icon = FAMILY_ICON[family];
  return <Icon className={className} />;
}

export function InfoIcon({ kind, className }: { kind: InfoKind; className?: string }) {
  const Icon = INFO_ICON[kind];
  return <Icon className={className} />;
}
