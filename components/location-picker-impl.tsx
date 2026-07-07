"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";

// Fix Leaflet's default marker icon paths (broken with webpack bundlers).
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const AGADIR_CENTER: [number, number] = [30.4278, -9.5981];
const AGADIR_ZOOM = 10;
const RESULT_ZOOM = 14;

export type LocationValue = {
  address: string;
  lat: number | null;
  lng: number | null;
};

export type LocationPickerProps = {
  label: string;
  required?: boolean;
  addressName: string;
  latName: string;
  lngName: string;
  defaultValue?: LocationValue;
};

export function LocationPickerImpl({
  label,
  required,
  addressName,
  latName,
  lngName,
  defaultValue,
}: LocationPickerProps) {
  const [address, setAddress] = useState(defaultValue?.address ?? "");
  const [lat, setLat] = useState<number | null>(defaultValue?.lat ?? null);
  const [lng, setLng] = useState<number | null>(defaultValue?.lng ?? null);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Init map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const initial: [number, number] =
      lat !== null && lng !== null ? [lat, lng] : AGADIR_CENTER;
    const initialZoom = lat !== null && lng !== null ? RESULT_ZOOM : AGADIR_ZOOM;

    const map = L.map(mapContainerRef.current).setView(initial, initialZoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    if (lat !== null && lng !== null) {
      const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const { lat: newLat, lng: newLng } = marker.getLatLng();
        setLat(newLat);
        setLng(newLng);
      });
      markerRef.current = marker;
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync marker + view when lat/lng change from geocoding
  useEffect(() => {
    if (!mapRef.current) return;
    if (lat === null || lng === null) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      const m = L.marker([lat, lng], { draggable: true }).addTo(mapRef.current);
      m.on("dragend", () => {
        const { lat: nLat, lng: nLng } = m.getLatLng();
        setLat(nLat);
        setLng(nLng);
      });
      markerRef.current = m;
    }
    mapRef.current.setView([lat, lng], RESULT_ZOOM);
  }, [lat, lng]);

  async function handleGeocode() {
    const q = address.trim();
    if (!q || geocoding) return;
    setGeocoding(true);
    setError(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error("Erreur du service de géocodage");
      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (!Array.isArray(data) || data.length === 0) {
        setError("Aucun résultat pour cette adresse");
        return;
      }
      const first = data[0];
      const nLat = Number(first.lat);
      const nLng = Number(first.lon);
      if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) {
        setError("Coordonnées invalides retournées");
        return;
      }
      setLat(nLat);
      setLng(nLng);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur de géocodage";
      setError(msg);
    } finally {
      setGeocoding(false);
    }
  }

  function handleAddressKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleGeocode();
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={addressName}>
        {label}
        {required && <span className="text-red-600"> *</span>}
      </Label>
      <div className="flex gap-2">
        <Input
          id={addressName}
          name={addressName}
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={handleAddressKeyDown}
          required={required}
          placeholder="Adresse, quartier, ville…"
        />
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={handleGeocode}
          disabled={geocoding || !address.trim()}
        >
          {geocoding ? (
            <>
              <Loader2 className="size-3.5 animate-spin" /> Recherche…
            </>
          ) : (
            <>
              <MapPin className="size-3.5" /> Localiser
            </>
          )}
        </Button>
      </div>
      {/* Hidden inputs carry lat/lng to FormData */}
      <input
        type="hidden"
        name={latName}
        value={lat !== null ? String(lat) : ""}
        readOnly
      />
      <input
        type="hidden"
        name={lngName}
        value={lng !== null ? String(lng) : ""}
        readOnly
      />
      <div
        ref={mapContainerRef}
        className="h-[180px] w-full rounded-lg border border-sand-200 overflow-hidden"
      />
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : lat !== null && lng !== null ? (
        <p className="text-xs text-sand-600">
          Position validée · {lat.toFixed(4)}, {lng.toFixed(4)}
        </p>
      ) : (
        <p className="text-xs text-sand-500 italic">
          Saisissez une adresse puis cliquez sur « Localiser », ou déplacez le
          marqueur.
        </p>
      )}
    </div>
  );
}
