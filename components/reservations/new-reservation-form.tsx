"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Minus,
  Plus,
  User,
  Package,
  ClipboardList,
  CreditCard,
  Loader2,
  AlertTriangle,
  Check,
  ExternalLink,
  Clock,
  MapPin,
  Timer,
  FileMinus,
  Info,
} from "lucide-react";
import { CustomerPicker } from "@/components/customer-picker";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { formatMAD, formatDateShort } from "@/lib/utils";
import { computeLineTotal, findSeasonForDate, SALE_UNIT_LABEL, SALE_UNIT_SUFFIX } from "@/lib/pricing";
import { CATEGORY_META } from "@/lib/category-fields";
import {
  BOOKING_CHANNELS,
  DISCOUNT_REASONS,
  GROUP_LANGUAGES,
  INTENDED_CHANNELS,
  DEPOSIT_METHODS,
  DEFAULT_QUANTITY,
  discountAmount,
  normalizeQuantity,
  paxOf,
  toLineQuantity,
  deducedStatus,
  type BookingChannel,
  type BookingQuantity,
  type DiscountMode,
  type DiscountReason,
  type DepositMethod,
  type IntendedChannel,
} from "@/lib/booking";
import type { Customer, CircuitCategory, SaleUnit } from "@/lib/types";
import { AvailabilityCalendar, dayInfo, type CalendarSeason } from "@/components/reservations/availability-calendar";
import { createReservation } from "@/app/admin/reservations/new/actions";
import { loadCustomerSummary, checkDuplicateDossier, type CustomerSummary, type DuplicateDossier, type MonthAvailability } from "@/app/admin/reservations/new/data-actions";
import { sendBookingConfirmationAction } from "@/app/admin/reservations/[id]/email-actions";

export type BookingProduct = {
  id: string;
  title: string;
  category: CircuitCategory;
  base_price_mad: number;
  child_price_mad: number | null;
  max_participants: number | null;
  sale_unit: SaleUnit;
  pricing_mode: "fixed" | "on_request";
  duration_days: number | null;
  duration_hours: number | null;
  meeting_point: string | null;
  category_fields: Record<string, unknown> | null;
  circuit_seasons: CalendarSeason[];
};

const TIER_STYLE: Record<string, { bg: string; color: string }> = {
  neutral: { bg: "#F1EFE8", color: "#5F5E5A" },
  terracotta: { bg: "#FBEBE6", color: "#C84B31" },
  sand: { bg: "#F1EFE8", color: "#7C5022" },
  amber: { bg: "#FAEEDA", color: "#B25F0B" },
};
const STATUS_PREVIEW: Record<"pending" | "confirmed" | "paid", { label: string; bg: string; color: string }> = {
  pending: { label: "En attente", bg: "#FAEEDA", color: "#633806" },
  confirmed: { label: "Confirmé", bg: "#E6F1FB", color: "#0C447C" },
  paid: { label: "Payé", bg: "#E1F5EE", color: "#085041" },
};

const card = "bg-white border border-[#E5E0D7] rounded-xl p-5";
const chipCls = (active: boolean) =>
  `inline-flex items-center gap-1.5 rounded-full border px-3 h-8 text-[12.5px] font-medium transition-colors ${
    active ? "bg-[#1A1F2E] text-white border-[#1A1F2E]" : "bg-white text-[#58524A] border-[#E0DACF] hover:bg-[#FBF9F5]"
  }`;

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}

function SectionTitle({ n, icon: Icon, title, hint }: { n: number; icon: typeof User; title: string; hint?: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[#1A1F2E] text-white text-[12px] font-semibold">{n}</span>
      <div>
        <h2 className="font-display text-[18px] text-[#1A1F2E] leading-tight flex items-center gap-2">
          <Icon className="size-4 text-[#968F84]" /> {title}
        </h2>
        {hint && <p className="text-[12px] text-[#6B6862] mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}

function Stepper({ label, value, min, max, onChange, hint }: { label: string; value: number; min: number; max?: number; onChange: (v: number) => void; hint?: string }) {
  const btn = "inline-flex size-9 items-center justify-center rounded-md border border-[#E0DACF] bg-white text-[#1A1F2E] hover:bg-[#FBF9F5] disabled:opacity-40 disabled:pointer-events-none";
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <button type="button" className={btn} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Moins — ${label}`}>
          <Minus className="size-4" />
        </button>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            const v = Math.floor(Number(e.target.value));
            if (Number.isFinite(v)) onChange(Math.max(min, max ? Math.min(max, v) : v));
          }}
          className="h-9 w-16 rounded-md border border-[#E0DACF] bg-white text-center text-sm tabular-nums text-[#1A1F2E] focus:border-[#1A1F2E] focus:outline-none"
        />
        <button type="button" className={btn} onClick={() => onChange(max ? Math.min(max, value + 1) : value + 1)} disabled={max !== undefined && value >= max} aria-label={`Plus — ${label}`}>
          <Plus className="size-4" />
        </button>
      </div>
      {hint && <p className="text-[11px] text-[#968F84] mt-1">{hint}</p>}
    </div>
  );
}

export function NewReservationForm({ products }: { products: BookingProduct[] }) {
  const router = useRouter();

  // 1. Client
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [summary, setSummary] = useState<CustomerSummary | null>(null);

  // 2. Prestation & date
  const [productId, setProductId] = useState<string>("");
  const product = products.find((p) => p.id === productId) ?? null;
  const saleUnit: SaleUnit = product?.sale_unit ?? "per_person";
  const [qty, setQty] = useState<BookingQuantity>(DEFAULT_QUANTITY);
  const [occupancy, setOccupancy] = useState(2); // per_night_room : personnes par chambre
  const [date, setDate] = useState<string>("");
  const [months, setMonths] = useState<Record<string, MonthAvailability>>({});
  const [duplicate, setDuplicate] = useState<DuplicateDossier>(null);

  // 3. Informations pratiques
  const [channel, setChannel] = useState<BookingChannel | "">("");
  const [language, setLanguage] = useState<string>("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [notes, setNotes] = useState("");

  // 4. Paiement
  const [intended, setIntended] = useState<IntendedChannel | "">("");
  const [depositOn, setDepositOn] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState<DepositMethod>("cash");
  const [depositRef, setDepositRef] = useState("");
  const [creditOn, setCreditOn] = useState(false);
  const [creditNoteId, setCreditNoteId] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [discountMode, setDiscountMode] = useState<DiscountMode>("mad");
  const [discountValue, setDiscountValue] = useState("");
  const [discountReason, setDiscountReason] = useState<DiscountReason | "">("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Effets de chargement (à l'action de l'utilisateur uniquement)
  useEffect(() => {
    setSummary(null);
    setCreditOn(false);
    setCreditNoteId("");
    if (!customer) return;
    let cancelled = false;
    loadCustomerSummary(customer.id).then((s) => {
      if (!cancelled) setSummary(s);
    });
    return () => {
      cancelled = true;
    };
  }, [customer]);

  useEffect(() => {
    setDuplicate(null);
    if (!customer || !productId || !date) return;
    let cancelled = false;
    checkDuplicateDossier(customer.id, productId, date).then((d) => {
      if (!cancelled) setDuplicate(d);
    });
    return () => {
      cancelled = true;
    };
  }, [customer, productId, date]);

  // Produit changé → quantités par défaut, date conservée si toujours valide.
  useEffect(() => {
    setQty(DEFAULT_QUANTITY);
    setOccupancy(2);
    setMonths({});
  }, [productId]);

  // per_night_room : adultes = chambres × occupation.
  useEffect(() => {
    if (saleUnit === "per_night_room") setQty((q) => ({ ...q, adults: Math.max(1, q.rooms * occupancy), children: 0 }));
  }, [saleUnit, occupancy, qty.rooms]);

  // --- Dérivés de prix
  const nq = useMemo(() => normalizeQuantity(saleUnit, qty), [saleUnit, qty]);
  const pax = paxOf(nq);
  const season = product && date ? findSeasonForDate(date, product.circuit_seasons) : null;
  const multiplier = season ? Number(season.price_multiplier) : 1;
  const unitAdult = product ? Number(product.base_price_mad) * multiplier : 0;
  const unitChild = product ? Number(product.child_price_mad ?? product.base_price_mad) * multiplier : 0;
  const gross = product
    ? Math.round(
        computeLineTotal({ saleUnit, basePriceMad: product.base_price_mad, childPriceMad: product.child_price_mad, multiplier, quantity: toLineQuantity(nq) }) * 100,
      ) / 100
    : 0;
  const discountMad = discountAmount(discountMode, Number(String(discountValue).replace(",", ".")), gross);
  const total = Math.round((gross - discountMad) * 100) / 100;

  const creditAvailable = summary?.creditAvailable ?? 0;
  const selectedNote = summary?.creditNotes.find((c) => c.id === creditNoteId) ?? null;
  const creditMax = selectedNote ? Math.min(selectedNote.remaining, total) : 0;
  const creditUsed = creditOn && selectedNote ? Math.min(creditMax, Math.max(0, Number(String(creditAmount).replace(",", ".")) || 0)) : 0;
  const depositNum = depositOn ? Math.max(0, Number(String(depositAmount).replace(",", ".")) || 0) : 0;
  const collected = Math.round((depositNum + creditUsed) * 100) / 100;
  const remaining = Math.max(0, Math.round((total - collected) * 100) / 100);
  const statusPreview = STATUS_PREVIEW[deducedStatus(total, collected)];

  // Avoir : montant proposé quand on l'active.
  useEffect(() => {
    if (creditOn && summary && summary.creditNotes.length > 0) {
      const id = creditNoteId || summary.creditNotes[0].id;
      if (!creditNoteId) setCreditNoteId(id);
      const note = summary.creditNotes.find((c) => c.id === id);
      if (note) setCreditAmount(Math.min(note.remaining, total).toFixed(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creditOn, creditNoteId, total]);

  // --- Disponibilité du jour choisi
  const monthKey = product && date ? `${product.id}:${date.slice(0, 7)}` : null;
  const info = product && date ? dayInfo(date, monthKey ? months[monthKey] : undefined, product.circuit_seasons) : null;
  const maxPax = product?.max_participants ?? 0;
  const remainingPlaces = info?.stock && !info.stock.released ? Math.max(0, info.stock.quota - info.stock.sold) : null;

  // --- Champs requis manquants
  const missing: string[] = [];
  if (!customer) missing.push("le client");
  if (!product) missing.push("le produit");
  if (!date) missing.push("la date de départ");
  if (!channel) missing.push("l'origine du dossier");
  if (discountMad > 0 && !discountReason) missing.push("le motif de la remise");
  if (depositOn && depositNum <= 0) missing.push("le montant de l'acompte");
  if (depositOn && depositMethod === "transfer" && !depositRef.trim()) missing.push("le numéro de virement de l'acompte");
  if (creditOn && creditUsed <= 0) missing.push("le montant d'avoir à utiliser");
  const blocking: string[] = [];
  if (product && maxPax > 0 && pax > maxPax) blocking.push(`Capacité dépassée : ${pax} pax pour ${maxPax} places.`);
  if (remainingPlaces !== null && pax > remainingPlaces) blocking.push(`Il ne reste que ${remainingPlaces} place${remainingPlaces > 1 ? "s" : ""} ce jour.`);
  if (product && discountMad >= gross && gross > 0) blocking.push("La remise doit rester inférieure au prix.");
  if (collected - total > 0.01) blocking.push("Acompte + avoir dépassent le total.");
  if (product?.pricing_mode === "on_request" && gross <= 0) blocking.push("Produit sur devis : fixez un prix sur la fiche produit.");
  const canSubmit = missing.length === 0 && blocking.length === 0 && !submitting;

  async function submit(sendLink: boolean) {
    if (!canSubmit || !customer || !product) return;
    setSubmitting(true);
    setError(null);
    const res = await createReservation({
      circuit_id: product.id,
      customer_id: customer.id,
      departure_date: date,
      adults: nq.adults,
      children: nq.children,
      trips: nq.trips,
      nights: nq.nights,
      rooms: nq.rooms,
      units: nq.units,
      total_amount_mad: total,
      notes,
      booking_channel: channel || null,
      group_language: language || null,
      special_requests: specialRequests,
      customer_note: customerNote,
      intended_payment_channel: intended || null,
      discount: discountMad > 0 ? { mode: discountMode, value: Number(String(discountValue).replace(",", ".")), reason: discountReason || null } : null,
      deposit: depositOn && depositNum > 0 ? { amount: depositNum, method: depositMethod, external_ref: depositRef.trim() || null } : null,
      credit_note: creditOn && selectedNote && creditUsed > 0 ? { id: selectedNote.id, amount: creditUsed } : null,
      send_link: sendLink,
    });
    if (!res.ok) {
      setError(res.error);
      setSubmitting(false);
      return;
    }
    // Email de confirmation (comportement existant, non bloquant).
    sendBookingConfirmationAction(res.id).catch(() => {});
    try {
      sessionStorage.setItem(`hiri.created.${res.id}`, JSON.stringify({ followups: res.followups, linkUrl: res.linkUrl, onRequest: res.onRequest }));
    } catch {}
    router.push(`/admin/reservations/${res.id}?created=1`);
  }

  const meta = product ? CATEGORY_META[product.category] : null;
  const cf = (product?.category_fields ?? {}) as Record<string, unknown>;
  const helpBits: { icon: typeof Clock; text: string }[] = [];
  if (product) {
    if (product.duration_days && product.duration_days > 1) helpBits.push({ icon: Timer, text: `${product.duration_days} jours` });
    else if (product.duration_hours) helpBits.push({ icon: Timer, text: `${product.duration_hours} h` });
    if (typeof cf.departure_time === "string" && cf.departure_time) helpBits.push({ icon: Clock, text: `Départ ${cf.departure_time}` });
    if (product.meeting_point) helpBits.push({ icon: MapPin, text: product.meeting_point });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px] items-start">
      {/* ------------------------------------------------------------ SAISIE */}
      <div className="space-y-5 min-w-0">
        {/* 1. CLIENT */}
        <section className={card}>
          <SectionTitle n={1} icon={User} title="Client" hint="Recherche par téléphone, nom ou email — anti-doublons. Création possible sans quitter l'écran." />
          {!customer ? (
            <CustomerPicker selectedCustomer={customer} onSelect={setCustomer} />
          ) : (
            <div className="rounded-lg border border-[#EEE9E0] bg-[#FBF9F5] p-4">
              <div className="flex items-start gap-3">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[#1A1F2E] text-white text-[14px] font-semibold">{initials(customer.full_name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-[17px] text-[#1A1F2E]">{customer.full_name}</span>
                    {summary && summary.tier.name !== "Aucun" && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium" style={TIER_STYLE[summary.tier.color]}>
                        {summary.tier.name}
                      </span>
                    )}
                  </div>
                  <div className="text-[12.5px] text-[#6B6862] mt-0.5">
                    {[customer.phone, customer.country].filter(Boolean).join(" · ") || "—"}
                  </div>
                  <div className="text-[12px] text-[#6B6862] mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    {summary ? (
                      <>
                        <span>{summary.nbReservations} réservation{summary.nbReservations > 1 ? "s" : ""}</span>
                        {summary.lastDeparture && (
                          <span>
                            Dernier départ : {summary.lastDeparture.title ?? "—"} · {formatDateShort(summary.lastDeparture.date)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> synthèse…</span>
                    )}
                  </div>
                  {summary && creditAvailable > 0 && (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium" style={{ backgroundColor: "#E1F5EE", color: "#085041" }}>
                      <FileMinus className="size-3.5" /> Avoir disponible : {formatMAD(creditAvailable)}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-[12.5px]">
                <button type="button" onClick={() => setCustomer(null)} className="text-[#6B6862] hover:text-[#1A1F2E] underline-offset-2 hover:underline">
                  Changer de client
                </button>
                <Link href={`/admin/clients/${customer.id}`} target="_blank" className="inline-flex items-center gap-1 text-[#0C6B8A] hover:underline underline-offset-2">
                  Ouvrir sa fiche <ExternalLink className="size-3" />
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* 2. PRESTATION & DATE */}
        <section className={card}>
          <SectionTitle n={2} icon={Package} title="Prestation & date" hint="Produits actifs du catalogue. Le prix suit l'unité de vente et la saison." />
          <div className="space-y-4">
            <div>
              <Label htmlFor="product">Produit</Label>
              <Select id="product" value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">— Choisir un produit —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} · {formatMAD(p.base_price_mad)} {SALE_UNIT_SUFFIX[p.sale_unit].replace("/ personne", "/ adulte")}
                  </option>
                ))}
              </Select>
              {product && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide" style={meta?.badgeStyle}>
                    {meta?.label} · {SALE_UNIT_LABEL[saleUnit]}
                  </span>
                  {helpBits.map((b, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[12px] text-[#6B6862]">
                      <b.icon className="size-3.5 text-[#968F84]" /> {b.text}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {product && (
              <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
                {/* Quantités selon l'unité */}
                <div className="space-y-3">
                  {saleUnit === "per_person" && (
                    <>
                      <Stepper label="Adultes" value={qty.adults} min={1} max={maxPax || undefined} onChange={(v) => setQty({ ...qty, adults: v })} hint={`${formatMAD(unitAdult)} / adulte`} />
                      <Stepper
                        label="Enfants"
                        value={qty.children}
                        min={0}
                        max={maxPax ? Math.max(0, maxPax - qty.adults) : undefined}
                        onChange={(v) => setQty({ ...qty, children: v })}
                        hint={product.child_price_mad !== null ? `${formatMAD(unitChild)} / enfant` : "Tarif adulte (pas de prix enfant)"}
                      />
                    </>
                  )}
                  {saleUnit === "per_trip" && (
                    <>
                      <Stepper label="Trajets" value={qty.trips} min={1} onChange={(v) => setQty({ ...qty, trips: v })} hint={`${formatMAD(unitAdult)} / trajet`} />
                      <Stepper label="Passagers" value={qty.adults} min={1} max={maxPax || undefined} onChange={(v) => setQty({ ...qty, adults: v, children: 0 })} hint={maxPax ? `≤ ${maxPax} places par trajet` : undefined} />
                    </>
                  )}
                  {saleUnit === "per_night_room" && (
                    <>
                      <Stepper label="Nuits" value={qty.nights} min={1} onChange={(v) => setQty({ ...qty, nights: v })} hint={`${formatMAD(unitAdult)} / nuit / chambre`} />
                      <Stepper label="Chambres" value={qty.rooms} min={1} onChange={(v) => setQty({ ...qty, rooms: v })} />
                      <Stepper label="Occupation par chambre" value={occupancy} min={1} max={6} onChange={setOccupancy} hint={`${qty.rooms * occupancy} personne${qty.rooms * occupancy > 1 ? "s" : ""} au total`} />
                    </>
                  )}
                  {saleUnit === "per_unit" && (
                    <Stepper label="Quantité" value={qty.units} min={1} onChange={(v) => setQty({ ...qty, units: v })} hint={`${formatMAD(unitAdult)} / unité`} />
                  )}

                  <p className="text-[11.5px] text-[#6B6862] flex items-start gap-1.5 pt-1">
                    <Info className="size-3.5 shrink-0 mt-px text-[#968F84]" />
                    <span>
                      {maxPax > 0 ? `Capacité ${maxPax}` : "Capacité non limitée"}
                      {remainingPlaces !== null && date && <> · {remainingPlaces} place{remainingPlaces > 1 ? "s" : ""} restante{remainingPlaces > 1 ? "s" : ""} le {formatDateShort(date)}</>}
                      {info?.stock?.released && date && <> · stock libéré le {formatDateShort(date)}</>}
                      {" · "}ce dossier : {pax} pax
                    </span>
                  </p>
                </div>

                {/* Calendrier */}
                <div>
                  <Label>Date de départ</Label>
                  <AvailabilityCalendar
                    productId={product.id}
                    seasons={product.circuit_seasons}
                    value={date}
                    onChange={setDate}
                    onMonthData={(k, d) => setMonths((m) => ({ ...m, [k]: d }))}
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 3. INFORMATIONS PRATIQUES */}
        <section className={card}>
          <SectionTitle n={3} icon={ClipboardList} title="Informations pratiques" hint="Origine du dossier pour le reporting ; demandes reprises sur le manifeste ; note reprise sur le voucher." />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="channel">Origine du dossier *</Label>
              <Select id="channel" value={channel} onChange={(e) => setChannel(e.target.value as BookingChannel | "")}>
                <option value="">— Choisir —</option>
                {BOOKING_CHANNELS.filter((c) => c.value !== "site_web").map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="language">Langue du groupe</Label>
              <Select id="language" value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="">— Non précisée —</option>
                {GROUP_LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="special_requests">Demandes spéciales <span className="text-[#968F84] font-normal">(manifeste)</span></Label>
              <Input id="special_requests" value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} placeholder="Régime végétarien, siège bébé, mobilité réduite…" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="customer_note">Note pour le client <span className="text-[#968F84] font-normal">(voucher)</span></Label>
              <Input id="customer_note" value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} placeholder="Rendez-vous 15 min avant le départ devant l'hôtel…" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="notes">Notes internes <span className="text-[#968F84] font-normal">(optionnel)</span></Label>
              <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Visible uniquement par l'équipe." className="text-[13px]" />
            </div>
          </div>
        </section>

        {/* 4. PAIEMENT */}
        <section className={card}>
          <SectionTitle n={4} icon={CreditCard} title="Paiement" hint="Canal prévu, encaissement immédiat, avoir, remise. Le prix catalogue n'est jamais modifié." />
          <div className="space-y-5">
            <div>
              <Label>Canal de règlement prévu</Label>
              <div className="flex flex-wrap gap-2">
                {INTENDED_CHANNELS.map((c) => (
                  <button key={c.value} type="button" onClick={() => setIntended(intended === c.value ? "" : c.value)} className={chipCls(intended === c.value)} aria-pressed={intended === c.value}>
                    {c.label}
                  </button>
                ))}
              </div>
              {intended && <p className="text-[11.5px] text-[#6B6862] mt-1.5">{INTENDED_CHANNELS.find((c) => c.value === intended)?.hint}</p>}
            </div>

            {/* Acompte */}
            <div className="rounded-lg border border-[#EEE9E0] p-3">
              <label className="flex items-center gap-2 text-[13px] font-medium text-[#1A1F2E]">
                <input type="checkbox" checked={depositOn} onChange={(e) => setDepositOn(e.target.checked)} className="size-4 accent-[#1A1F2E]" />
                Acompte encaissé maintenant
              </label>
              {depositOn && (
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr]">
                  <div>
                    <Label htmlFor="deposit_amount">Montant (MAD)</Label>
                    <Input id="deposit_amount" type="number" min="0.01" step="0.01" max={Math.max(0, total - creditUsed)} value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder={total > 0 ? (total / 2).toFixed(0) : "0"} />
                  </div>
                  <div>
                    <Label htmlFor="deposit_method">Mode</Label>
                    <Select id="deposit_method" value={depositMethod} onChange={(e) => setDepositMethod(e.target.value as DepositMethod)}>
                      {DEPOSIT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </Select>
                  </div>
                  {depositMethod === "transfer" && (
                    <div className="sm:col-span-2">
                      <Label htmlFor="deposit_ref">Numéro de virement *</Label>
                      <Input id="deposit_ref" value={depositRef} onChange={(e) => setDepositRef(e.target.value)} placeholder="Référence visible sur le relevé (ex. VIR-2026-078456)" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Avoir */}
            {summary && summary.creditNotes.length > 0 && (
              <div className="rounded-lg border border-[#A9DFCC] p-3" style={{ backgroundColor: "#F3FBF8" }}>
                <label className="flex items-center gap-2 text-[13px] font-medium text-[#1A1F2E]">
                  <input type="checkbox" checked={creditOn} onChange={(e) => setCreditOn(e.target.checked)} className="size-4 accent-[#0F6E56]" />
                  Utiliser l&apos;avoir du client <span className="text-[#085041] font-normal">· {formatMAD(creditAvailable)} disponible</span>
                </label>
                {creditOn && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr]">
                    <div>
                      <Label htmlFor="credit_note">Avoir</Label>
                      <Select id="credit_note" value={creditNoteId} onChange={(e) => setCreditNoteId(e.target.value)}>
                        {summary.creditNotes.map((c) => (
                          <option key={c.id} value={c.id}>{c.number} · solde {formatMAD(c.remaining)}</option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="credit_amount">Montant imputé (MAD) <span className="text-[#968F84] font-normal">≤ {formatMAD(creditMax)}</span></Label>
                      <Input id="credit_amount" type="number" min="0.01" step="0.01" max={creditMax} value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Remise */}
            <div className="rounded-lg border border-[#EEE9E0] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-[#1A1F2E]">Remise commerciale</span>
                <div className="inline-flex gap-0.5 bg-[#F1EFE8] p-0.5 rounded-md">
                  {(["mad", "pct"] as DiscountMode[]).map((m) => (
                    <button key={m} type="button" onClick={() => setDiscountMode(m)} className={`px-3 py-1 text-[12px] rounded transition ${discountMode === m ? "bg-white shadow-sm font-medium text-[#1A1F2E]" : "text-[#6B6862] hover:text-[#1A1F2E]"}`}>
                      {m === "mad" ? "Montant" : "Pourcentage"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr]">
                <div>
                  <Label htmlFor="discount_value">{discountMode === "mad" ? "Remise (MAD)" : "Remise (%)"}</Label>
                  <Input id="discount_value" type="number" min="0" step={discountMode === "mad" ? "1" : "0.5"} max={discountMode === "pct" ? 100 : gross} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <Label htmlFor="discount_reason">Motif {discountMad > 0 && <span className="text-red-600">*</span>}</Label>
                  <Select id="discount_reason" value={discountReason} onChange={(e) => setDiscountReason(e.target.value as DiscountReason | "")} disabled={discountMad <= 0}>
                    <option value="">— Choisir —</option>
                    {DISCOUNT_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </Select>
                </div>
              </div>
              {discountMad > 0 && (
                <p className="text-[11.5px] text-[#6B6862] mt-2">
                  − {formatMAD(discountMad)} sur {formatMAD(gross)} · stockée sur le dossier, ligne séparée sur la facture.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ------------------------------------------------------------ RÉCAPITULATIF */}
      <aside className="lg:sticky lg:top-[72px] space-y-3">
        <div className={card}>
          <p className="text-[10px] tracking-[2px] uppercase text-[#C84B31] font-medium mb-3">Récapitulatif</p>

          {product ? (
            <>
              <div className="font-display text-[17px] text-[#1A1F2E] leading-snug">{product.title}</div>
              <div className="text-[12.5px] text-[#6B6862] mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                {date ? (
                  <span>
                    {formatDateShort(date)}
                    {typeof cf.departure_time === "string" && cf.departure_time ? ` · ${cf.departure_time}` : ""}
                  </span>
                ) : (
                  <span className="italic">Date à choisir</span>
                )}
                {season && (
                  <span className="inline-flex items-center rounded px-1.5 py-px text-[10.5px] font-medium" style={{ backgroundColor: "#FBEBE6", color: "#C84B31" }}>
                    {season.name} ×{Number(season.price_multiplier)}
                  </span>
                )}
              </div>
              {date && (
                <div className="text-[12px] mt-1.5" style={{ color: remainingPlaces !== null && pax > remainingPlaces ? "#B42318" : "#0F6E56" }}>
                  {info?.noDeparture
                    ? "Pas de départ ce jour"
                    : info?.stock?.released
                      ? "Stock libéré — sur demande"
                      : remainingPlaces !== null
                        ? `${remainingPlaces} place${remainingPlaces > 1 ? "s" : ""} restante${remainingPlaces > 1 ? "s" : ""}`
                        : maxPax > 0
                          ? `Capacité ${maxPax} · pas d'allotement ce jour`
                          : "Disponible"}
                </div>
              )}

              <div className="mt-4 space-y-1.5 text-[13px] border-t border-[#EEE9E0] pt-3">
                {saleUnit === "per_person" && (
                  <>
                    <Row label={`${nq.adults} adulte${nq.adults > 1 ? "s" : ""} × ${formatMAD(unitAdult)}`} value={formatMAD(nq.adults * unitAdult)} />
                    {nq.children > 0 && <Row label={`${nq.children} enfant${nq.children > 1 ? "s" : ""} × ${formatMAD(unitChild)}`} value={formatMAD(nq.children * unitChild)} />}
                  </>
                )}
                {saleUnit === "per_trip" && <Row label={`${nq.trips} trajet${nq.trips > 1 ? "s" : ""} × ${formatMAD(unitAdult)} · ${pax} pax`} value={formatMAD(gross)} />}
                {saleUnit === "per_night_room" && <Row label={`${nq.nights} nuit${nq.nights > 1 ? "s" : ""} × ${nq.rooms} chambre${nq.rooms > 1 ? "s" : ""} × ${formatMAD(unitAdult)}`} value={formatMAD(gross)} />}
                {saleUnit === "per_unit" && <Row label={`${nq.units} × ${formatMAD(unitAdult)}`} value={formatMAD(gross)} />}
                {discountMad > 0 && (
                  <Row label={`Remise${discountReason ? ` · ${DISCOUNT_REASONS.find((r) => r.value === discountReason)?.label}` : ""}`} value={`− ${formatMAD(discountMad)}`} tone="#B25F0B" />
                )}
                <div className="flex items-baseline justify-between pt-2 border-t border-[#EEE9E0]">
                  <span className="text-[12px] uppercase tracking-wide text-[#6B6862]">Total</span>
                  <span className="font-display text-[24px] text-[#C84B31] tabular-nums">{formatMAD(total)}</span>
                </div>
                {creditUsed > 0 && <Row label="Avoir utilisé" value={`− ${formatMAD(creditUsed)}`} tone="#085041" />}
                {depositNum > 0 && <Row label={`Acompte · ${DEPOSIT_METHODS.find((m) => m.value === depositMethod)?.label}`} value={`− ${formatMAD(depositNum)}`} tone="#085041" />}
                {collected > 0 && (
                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-[12.5px] font-medium text-[#1A1F2E]">Reste à payer</span>
                    <span className="font-medium tabular-nums text-[#1A1F2E]">{formatMAD(remaining)}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 text-[12.5px]">
                <span className="text-[#6B6862]">Statut à la création</span>
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-medium" style={{ backgroundColor: statusPreview.bg, color: statusPreview.color }}>
                  {statusPreview.label}
                </span>
              </div>
            </>
          ) : (
            <p className="text-[13px] text-[#968F84] italic">Choisissez un produit pour voir le prix.</p>
          )}

          {duplicate && (
            <p className="mt-3 flex items-start gap-1.5 rounded-lg px-3 py-2 text-[12px]" style={{ backgroundColor: "#FAEEDA", color: "#633806", border: "1px solid #F3D9A4" }}>
              <AlertTriangle className="size-3.5 shrink-0 mt-px" />
              <span>
                Ce client a déjà un dossier sur ce produit à cette date :{" "}
                <Link href={`/admin/reservations/${duplicate.id}`} target="_blank" className="font-mono underline underline-offset-2">{duplicate.reference}</Link>.
              </span>
            </p>
          )}

          {(missing.length > 0 || blocking.length > 0) && (
            <div className="mt-3 rounded-lg px-3 py-2 text-[12px]" style={{ backgroundColor: "#FBF9F5", border: "1px solid #EEE9E0", color: "#58524A" }}>
              {missing.length > 0 && (
                <p>
                  <span className="font-medium text-[#1A1F2E]">Il manque :</span> {missing.join(", ")}.
                </p>
              )}
              {blocking.map((b) => (
                <p key={b} className="flex items-start gap-1.5 mt-1" style={{ color: "#B42318" }}>
                  <AlertTriangle className="size-3.5 shrink-0 mt-px" /> {b}
                </p>
              ))}
            </div>
          )}

          {error && (
            <p className="mt-3 text-[12px] rounded-lg px-3 py-2" style={{ backgroundColor: "#FCEBEB", border: "1px solid #F7C1C1", color: "#791F1F" }}>
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={() => submit(false)}
            disabled={!canSubmit}
            aria-busy={submitting}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#1A1F2E] text-[14px] font-medium text-white hover:bg-[#2A3142] disabled:opacity-50 disabled:pointer-events-none transition-colors"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {submitting ? "Création…" : "Créer le dossier"}
          </button>
          {intended === "carte" && remaining > 0 && (
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={!canSubmit}
              className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#E0DACF] bg-white text-[13px] font-medium text-[#1A1F2E] hover:bg-[#FBF9F5] disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              <CreditCard className="size-4" /> Créer et envoyer le lien de paiement ({formatMAD(remaining)})
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[#6B6862] min-w-0">{label}</span>
      <span className="tabular-nums shrink-0" style={{ color: tone ?? "#1A1F2E" }}>{value}</span>
    </div>
  );
}
