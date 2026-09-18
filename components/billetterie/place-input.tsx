"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Plane, X, Loader2 } from "lucide-react";
import { suggestPlacesAction } from "@/app/admin/billetterie/actions";
import type { DuffelPlace } from "@/lib/duffel";

const fieldCls =
  "h-10 w-full rounded-lg border border-[#E0DACF] bg-white px-3 text-sm text-[#1A1F2E] placeholder:text-sand-400 focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors";

export type PickedPlace = { iata: string; label: string };

/**
 * Autocomplétion aéroports / villes via Duffel Places, par server action
 * (le token reste serveur). Déclenchée par la frappe, ≥ 2 caractères,
 * debounce 300 ms — jamais au chargement. Le champ soumis est le code IATA.
 */
export function PlaceInput({
  name,
  label,
  placeholder,
  initial,
  onPick,
}: {
  name: string;
  label: string;
  placeholder: string;
  initial?: PickedPlace | null;
  onPick?: (p: PickedPlace | null) => void;
}) {
  const [text, setText] = useState(initial?.label ?? "");
  const [picked, setPicked] = useState<PickedPlace | null>(initial ?? null);
  const [items, setItems] = useState<DuffelPlace[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function schedule(q: string) {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      const mySeq = ++seq.current;
      setLoading(true);
      setError(null);
      const res = await suggestPlacesAction(q);
      if (mySeq !== seq.current) return; // réponse obsolète
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        setItems([]);
        return;
      }
      setItems(res.places.slice(0, 8));
      setActive(0);
      setOpen(true);
    }, 300);
  }

  function choose(p: DuffelPlace) {
    if (!p.iata_code) return;
    const label = `${p.iata_code} · ${p.name}${p.city_name && p.type === "airport" ? ` (${p.city_name})` : ""}`;
    const v = { iata: p.iata_code, label };
    setPicked(v);
    setText(label);
    setOpen(false);
    onPick?.(v);
  }

  function clear() {
    setPicked(null);
    setText("");
    setItems([]);
    setOpen(false);
    onPick?.(null);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(items[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <label htmlFor={`${name}_text`} className="block text-[12px] font-medium text-[#58524A] mb-1.5">
        {label} <span className="text-red-600">*</span>
      </label>
      {/* Valeur soumise : le code IATA choisi dans la liste. */}
      <input type="hidden" name={name} value={picked?.iata ?? ""} />
      <div className="relative">
        <MapPin className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#968F84] pointer-events-none" />
        <input
          id={`${name}_text`}
          type="text"
          autoComplete="off"
          value={text}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            if (picked) {
              setPicked(null);
              onPick?.(null);
            }
            schedule(e.target.value);
          }}
          onFocus={() => items.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          className={`${fieldCls} pl-9 pr-9 ${picked ? "font-medium" : ""}`}
          aria-autocomplete="list"
          aria-expanded={open}
        />
        {loading ? (
          <Loader2 className="size-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#968F84] animate-spin" />
        ) : text ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Effacer"
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-6 items-center justify-center rounded text-[#968F84] hover:text-[#1A1F2E]"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
      {error && <p className="mt-1 text-[11px] text-[#791F1F]">{error}</p>}
      {!picked && text.trim().length >= 2 && !loading && !error && !open && items.length === 0 && (
        <p className="mt-1 text-[11px] text-[#968F84]">Aucun lieu trouvé.</p>
      )}

      {open && items.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-[#E0DACF] bg-white shadow-lg py-1"
        >
          {items.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(p)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors ${
                  i === active ? "bg-[#F7F5F0]" : ""
                }`}
              >
                {p.type === "airport" ? (
                  <Plane className="size-3.5 shrink-0 text-[#968F84]" />
                ) : (
                  <MapPin className="size-3.5 shrink-0 text-[#968F84]" />
                )}
                <span className="font-mono text-[12px] font-medium text-[#1A1F2E] w-9 shrink-0">{p.iata_code}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[#1A1F2E]">{p.name}</span>
                  <span className="block truncate text-[11px] text-[#968F84]">
                    {[p.type === "city" ? "Ville" : p.city_name, p.iata_country_code].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
