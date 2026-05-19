"use client";

import { useState } from "react";
import { Label } from "@/components/ui/input";

const AVAILABLE_LANGUAGES = [
  "Français", "Anglais", "Arabe", "Berbère",
  "Espagnol", "Allemand", "Italien", "Portugais",
  "Néerlandais", "Russe", "Chinois", "Japonais",
];

type Props = { name: string; defaultValue?: string[] | null; label?: string };

export function LanguageSelector({ name, defaultValue, label = "Langues parlées" }: Props) {
  const [selected, setSelected] = useState<string[]>(defaultValue || []);

  function toggle(lang: string) {
    setSelected((prev) => prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]);
  }

  return (
    <div>
      <Label>{label}</Label>
      <input type="hidden" name={name} value={JSON.stringify(selected)} />
      <div className="flex flex-wrap gap-2 mt-1">
        {AVAILABLE_LANGUAGES.map((lang) => {
          const isSelected = selected.includes(lang);
          return (
            <button
              key={lang}
              type="button"
              onClick={() => toggle(lang)}
              className={isSelected
                ? "px-3 py-1.5 rounded-full text-sm bg-terracotta-600 text-white border border-terracotta-700 transition-colors"
                : "px-3 py-1.5 rounded-full text-sm bg-white text-sand-700 border border-sand-300 hover:border-sand-500 transition-colors"}
            >
              {lang}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-sand-600 mt-2">
        {selected.length === 0
          ? "Aucune langue sélectionnée — cliquez sur une langue pour l'ajouter"
          : `${selected.length} langue${selected.length > 1 ? "s" : ""} sélectionnée${selected.length > 1 ? "s" : ""}`}
      </p>
    </div>
  );
}
