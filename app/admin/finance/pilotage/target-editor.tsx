"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { updateAnnualRevenueTarget } from "./actions";

export function TargetEditor({ currentTarget }: { currentTarget: number }) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(String(currentTarget));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.append("target", value);
    startTransition(async () => {
      const result = await updateAnnualRevenueTarget(formData);
      if (result?.error) setError(result.error);
      else setIsEditing(false);
    });
  };

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="flex items-center gap-1.5 text-xs text-stone-600 px-3 py-1.5 border border-stone-200 rounded-md hover:bg-stone-50 transition"
      >
        <Pencil className="w-3.5 h-3.5" />
        Modifier
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="number"
        step="1000"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
        className="w-40 px-3 py-1.5 text-sm border border-stone-300 rounded-md focus:outline-none focus:border-stone-500"
      />
      <button
        type="submit"
        disabled={isPending}
        className="text-xs px-3 py-1.5 bg-navy-900 text-white rounded-md hover:opacity-90 transition disabled:opacity-50"
      >
        {isPending ? "Enregistrement…" : "Enregistrer"}
      </button>
      <button
        type="button"
        onClick={() => {
          setIsEditing(false);
          setValue(String(currentTarget));
          setError(null);
        }}
        className="text-xs px-3 py-1.5 text-stone-600 hover:bg-stone-50 rounded-md transition"
      >
        Annuler
      </button>
      {error && <p className="text-xs text-red-600 ml-2">{error}</p>}
    </form>
  );
}
