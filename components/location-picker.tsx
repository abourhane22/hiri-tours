"use client";

import dynamic from "next/dynamic";
import type { LocationPickerProps } from "./location-picker-impl";

const LocationPickerImpl = dynamic(
  () => import("./location-picker-impl").then((m) => m.LocationPickerImpl),
  {
    ssr: false,
    loading: () => (
      <div className="h-[240px] w-full rounded-lg border border-sand-200 bg-sand-50 flex items-center justify-center text-sm text-sand-600">
        Chargement de la carte…
      </div>
    ),
  },
);

export function LocationPicker(props: LocationPickerProps) {
  return <LocationPickerImpl {...props} />;
}

export type { LocationPickerProps };
