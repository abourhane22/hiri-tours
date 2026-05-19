"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Check, X, Mail, Phone } from "lucide-react";
import type { Customer } from "@/lib/types";

type Props = { selectedCustomer: Customer | null; onSelect: (c: Customer | null) => void };

export function CustomerPicker({ selectedCustomer, onSelect }: Props) {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [mode, setMode] = useState<"search" | "create">("search");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCustomer || mode === "create") return;
    if (query.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    const timer = setTimeout(async () => {
      const q = query.trim().replace(/[%,]/g, "");
      const { data } = await supabase.from("customers").select("*")
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`).limit(8);
      setResults((data as Customer[]) || []);
      setSearching(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, mode, selectedCustomer]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true); setError(null);
    const { data, error: insertError } = await supabase.from("customers")
      .insert({ full_name: newName.trim(), email: newEmail.trim() || null, phone: newPhone.trim() || null })
      .select("*").single();
    if (insertError) { setError(insertError.message); setCreating(false); return; }
    onSelect(data as Customer);
    setCreating(false); setMode("search");
    setNewName(""); setNewEmail(""); setNewPhone("");
  }

  if (selectedCustomer) {
    return (
      <div className="p-4 rounded-md bg-emerald-50 border border-emerald-200">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Check className="size-4 text-emerald-700 shrink-0" />
              <span className="font-medium text-ink truncate">{selectedCustomer.full_name}</span>
            </div>
            {selectedCustomer.email && (<div className="text-xs text-sand-700 flex items-center gap-1.5"><Mail className="size-3" /> {selectedCustomer.email}</div>)}
            {selectedCustomer.phone && (<div className="text-xs text-sand-700 flex items-center gap-1.5"><Phone className="size-3" /> {selectedCustomer.phone}</div>)}
          </div>
          <button type="button" onClick={() => onSelect(null)} className="text-xs text-sand-700 hover:text-ink shrink-0">Changer</button>
        </div>
      </div>
    );
  }

  if (mode === "create") {
    return (
      <div className="space-y-3 p-4 rounded-md bg-sand-100 border border-sand-200">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink">Nouveau client</p>
          <button type="button" onClick={() => setMode("search")} className="text-xs text-sand-700 hover:text-ink flex items-center gap-1">
            <X className="size-3" /> Annuler
          </button>
        </div>
        {error && <div className="p-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded">{error}</div>}
        <div><Label htmlFor="new-name">Nom complet *</Label><Input id="new-name" value={newName} onChange={(e) => setNewName(e.target.value)} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="new-email">Email</Label><Input id="new-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
          <div><Label htmlFor="new-phone">Téléphone</Label><Input id="new-phone" type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} /></div>
        </div>
        <p className="text-xs text-sand-600">Vous pourrez compléter le profil plus tard depuis la fiche client.</p>
        <Button type="button" size="sm" onClick={handleCreate} disabled={!newName.trim() || creating}>
          {creating ? "Création..." : "Créer ce client"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-sand-500" />
        <Input placeholder="Rechercher par nom, email ou téléphone..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
      </div>
      {query.trim().length >= 2 && (
        <div className="border border-sand-200 rounded-md max-h-64 overflow-y-auto bg-white">
          {searching && <div className="px-3 py-2 text-xs text-sand-600">Recherche...</div>}
          {!searching && results.length === 0 && <div className="px-3 py-3 text-sm text-sand-700">Aucun client trouvé pour « {query} »</div>}
          {results.map((c) => (
            <button key={c.id} type="button" onClick={() => onSelect(c)} className="w-full text-left px-3 py-2 hover:bg-sand-50 border-b border-sand-100 last:border-b-0">
              <div className="text-sm text-ink font-medium">{c.full_name}</div>
              <div className="text-xs text-sand-600">{c.email}{c.email && c.phone && " · "}{c.phone}</div>
            </button>
          ))}
        </div>
      )}
      <button type="button" onClick={() => setMode("create")} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-terracotta-600 hover:bg-sand-100 rounded-md border border-dashed border-sand-300">
        <Plus className="size-4" />
        Créer un nouveau client
      </button>
    </div>
  );
}
