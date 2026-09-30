"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Check, X, Mail, Phone, AlertTriangle } from "lucide-react";
import { customerDuplicateMessage, normalizePhone } from "@/lib/customers";
import { findPotentialDuplicates, type DuplicateMatch } from "@/app/admin/clients/actions";
import type { Customer } from "@/lib/types";
import { useToast } from "@/components/ui/toaster";

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
  // Anti-doublons : correspondance EXACTE téléphone/email (création impossible, index unique)
  // et ressemblances de nom (création libre conservée).
  const [phoneMatch, setPhoneMatch] = useState<DuplicateMatch | null>(null);
  const [emailMatch, setEmailMatch] = useState<DuplicateMatch | null>(null);
  const [nameMatches, setNameMatches] = useState<DuplicateMatch[]>([]);
  const [using, setUsing] = useState(false);
  const toast = useToast();

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

  function resetCreate() {
    setMode("search");
    setNewName(""); setNewEmail(""); setNewPhone("");
    setPhoneMatch(null); setEmailMatch(null); setNameMatches([]); setError(null);
  }

  async function checkPhone() {
    const v = newPhone.trim();
    setPhoneMatch(v ? (await findPotentialDuplicates({ phone: v })).phoneMatch : null);
  }
  async function checkEmail() {
    const v = newEmail.trim();
    setEmailMatch(v ? (await findPotentialDuplicates({ email: v })).emailMatch : null);
  }
  async function checkName() {
    const v = newName.trim();
    setNameMatches(v.length >= 2 ? (await findPotentialDuplicates({ name: v })).nameMatches : []);
  }

  /** « Utiliser ce client » : sélectionne la fiche existante et revient au formulaire appelant. */
  async function selectExisting(id: string) {
    setUsing(true); setError(null);
    const { data, error: readError } = await supabase.from("customers").select("*").eq("id", id).single();
    setUsing(false);
    if (readError || !data) { setError("Impossible de charger ce client."); return; }
    onSelect(data as Customer);
    resetCreate();
  }

  const exactMatch = phoneMatch ?? emailMatch;

  async function handleCreate() {
    if (!newName.trim() || exactMatch) return;
    setCreating(true); setError(null);
    const phone = newPhone.trim() || null;
    const { data, error: insertError } = await supabase.from("customers")
      .insert({ full_name: newName.trim(), email: newEmail.trim() || null, phone, phone_normalized: normalizePhone(phone) })
      .select("*").single();
    if (insertError) {
      const msg = customerDuplicateMessage(insertError) ?? `Client non créé : ${insertError.message}`;
      setError(msg);
      toast.error(msg);
      setCreating(false);
      // Course : créé entre-temps → on relance la détection pour proposer « Utiliser ce client ».
      if (insertError.code === "23505") await Promise.all([checkPhone(), checkEmail()]);
      return;
    }
    onSelect(data as Customer);
    toast.success(`Client créé — ${(data as Customer).full_name}`);
    setCreating(false);
    resetCreate();
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
          <button type="button" onClick={resetCreate} className="text-xs text-sand-700 hover:text-ink flex items-center gap-1">
            <X className="size-3" /> Annuler
          </button>
        </div>
        {error && <div className="p-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded">{error}</div>}
        <div><Label htmlFor="new-name">Nom complet *</Label><Input id="new-name" value={newName} onChange={(e) => setNewName(e.target.value)} onBlur={checkName} required /></div>
        {nameMatches.length > 0 && !exactMatch && (
          <div className="text-xs text-sand-700 -mt-1 space-y-1">
            <p>Client{nameMatches.length > 1 ? "s" : ""} au nom proche — création libre si ce n&apos;est pas la même personne :</p>
            <ul className="space-y-1">
              {nameMatches.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    <span className="font-medium text-ink">{m.fullName}</span>
                    {m.maskedPhone && <> · {m.maskedPhone}</>} · {m.reservationCount} rés.
                  </span>
                  <button type="button" onClick={() => selectExisting(m.id)} disabled={using} className="shrink-0 text-terracotta-600 hover:underline disabled:opacity-50">
                    Utiliser
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="new-email">Email</Label><Input id="new-email" type="email" value={newEmail} onChange={(e) => { setNewEmail(e.target.value); setEmailMatch(null); }} onBlur={checkEmail} /></div>
          <div><Label htmlFor="new-phone">Téléphone</Label><Input id="new-phone" type="tel" value={newPhone} onChange={(e) => { setNewPhone(e.target.value); setPhoneMatch(null); }} onBlur={checkPhone} /></div>
        </div>
        {exactMatch && (
          <div className="rounded-md p-3" style={{ backgroundColor: "#FFF4E0", border: "1px solid #EF9F27" }}>
            <p className="flex items-start gap-2 text-[12.5px] text-[#7A4B00]">
              <AlertTriangle className="size-4 shrink-0 mt-px" />
              <span>
                Un client existe avec ce {phoneMatch ? "téléphone" : "email"} : <span className="font-medium">{exactMatch.fullName}</span>
                {exactMatch.maskedPhone && <> · {exactMatch.maskedPhone}</>} · {exactMatch.reservationCount} réservation{exactMatch.reservationCount > 1 ? "s" : ""}
              </span>
            </p>
            <div className="flex flex-wrap gap-2 mt-2 pl-6">
              <button
                type="button"
                onClick={() => selectExisting(exactMatch.id)}
                disabled={using}
                className="inline-flex h-8 items-center rounded-md bg-[#1A1F2E] px-3 text-[12.5px] font-medium text-white hover:bg-[#2A3142] disabled:opacity-60 transition-colors"
              >
                {using ? "Chargement…" : "Utiliser ce client"}
              </button>
              <a
                href={`/admin/clients/${exactMatch.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center rounded-md border border-[#E0DACF] bg-white px-3 text-[12.5px] font-medium text-[#1A1F2E] hover:bg-sand-50 transition-colors"
              >
                Ouvrir sa fiche
              </a>
            </div>
          </div>
        )}
        <p className="text-xs text-sand-600">Vous pourrez compléter le profil plus tard depuis la fiche client.</p>
        <Button type="button" size="sm" onClick={handleCreate} disabled={!newName.trim() || creating || Boolean(exactMatch)}>
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
