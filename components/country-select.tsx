"use client";

import "flag-icons/css/flag-icons.min.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Globe, ChevronDown, Check } from "lucide-react";

// 30 pays (ordre imposé) + « Autre ». `name` = valeur stockée dans
// customers.country (nom français, format déjà utilisé par l'app).
// `code` = ISO 3166-1 alpha-2 pour flag-icons ; null pour « Autre » (globe).
type Country = { name: string; code: string | null };

const COUNTRIES: Country[] = [
  { name: "Maroc", code: "ma" },
  { name: "France", code: "fr" },
  { name: "Espagne", code: "es" },
  { name: "Allemagne", code: "de" },
  { name: "Royaume-Uni", code: "gb" },
  { name: "Italie", code: "it" },
  { name: "Belgique", code: "be" },
  { name: "Pays-Bas", code: "nl" },
  { name: "Suisse", code: "ch" },
  { name: "Portugal", code: "pt" },
  { name: "États-Unis", code: "us" },
  { name: "Canada", code: "ca" },
  { name: "Japon", code: "jp" },
  { name: "Chine", code: "cn" },
  { name: "Corée du Sud", code: "kr" },
  { name: "Australie", code: "au" },
  { name: "Brésil", code: "br" },
  { name: "Argentine", code: "ar" },
  { name: "Pologne", code: "pl" },
  { name: "Suède", code: "se" },
  { name: "Norvège", code: "no" },
  { name: "Danemark", code: "dk" },
  { name: "Autriche", code: "at" },
  { name: "Irlande", code: "ie" },
  { name: "Émirats arabes unis", code: "ae" },
  { name: "Arabie saoudite", code: "sa" },
  { name: "Qatar", code: "qa" },
  { name: "Turquie", code: "tr" },
  { name: "Tunisie", code: "tn" },
  { name: "Sénégal", code: "sn" },
  { name: "Autre", code: null },
];

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Flag({ code }: { code: string | null }) {
  if (!code) return <Globe className="size-4 text-[#968F84] shrink-0" />;
  return <span className={`fi fi-${code} shrink-0`} style={{ width: 20, height: 15 }} />;
}

const fieldCls =
  "h-10 w-full rounded-lg border border-[#E0DACF] bg-white px-3 text-sm text-[#1A1F2E] placeholder:text-sand-400 focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors";

export function CountrySelect({
  name,
  defaultValue = "",
  required,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => COUNTRIES.find((c) => c.name === value) ?? null,
    [value],
  );

  const filtered = useMemo(() => {
    const q = norm(query);
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => norm(c.name).includes(q));
  }, [query]);

  // Fermeture au clic extérieur.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function choose(c: Country) {
    setValue(c.name);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) choose(filtered[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      {/* Valeur soumise avec le formulaire */}
      <input type="hidden" name={name} value={value} required={required} />

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={`${fieldCls} flex items-center justify-between gap-2 text-left`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 min-w-0">
          {selected ? (
            <>
              <Flag code={selected.code} />
              <span className="truncate">{selected.name}</span>
            </>
          ) : (
            <span className="text-sand-400">Sélectionner un pays…</span>
          )}
        </span>
        <ChevronDown className="size-4 text-[#968F84] shrink-0" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-[#E0DACF] bg-white shadow-lg">
          <div className="p-2 border-b border-[#F1EFE8]">
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Rechercher un pays…"
              className="h-9 w-full rounded-md border border-[#E0DACF] bg-white px-3 text-sm focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10"
            />
          </div>
          <ul className="max-h-60 overflow-y-auto py-1" role="listbox">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-[#968F84]">Aucun pays trouvé.</li>
            )}
            {filtered.map((c, i) => {
              const isSel = c.name === value;
              return (
                <li key={c.name} role="option" aria-selected={isSel}>
                  <button
                    type="button"
                    onClick={() => choose(c)}
                    onMouseEnter={() => setActive(i)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                      i === active ? "bg-[#F7F5F0]" : ""
                    } ${isSel ? "text-[#1A1F2E] font-medium" : "text-[#58524A]"}`}
                  >
                    <Flag code={c.code} />
                    <span className="truncate flex-1">{c.name}</span>
                    {isSel && <Check className="size-4 text-[#0F6E56] shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
