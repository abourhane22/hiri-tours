"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { Search, Loader2, ArrowLeftRight, Users, X, AlertTriangle, Info, FileText, Lock, RefreshCw } from "lucide-react";
import { formatDateShort } from "@/lib/utils";
import { searchOffersAction, getOfferAction, type SearchState, type OfferDetailResult } from "@/app/admin/billetterie/actions";
import { CABIN_CLASSES, formatMoney, offerTotalMinutes, amountNumber, formatMinutes, type DuffelOffer, type DuffelMode } from "@/lib/duffel";
import { PlaceInput } from "@/components/billetterie/place-input";
import { OfferCard, SliceRow, ConditionChips, AirlineBadge, countdownLabel } from "@/components/billetterie/offer-card";

const labelCls = "block text-[12px] font-medium text-[#58524A] mb-1.5";
const fieldCls =
  "h-10 w-full rounded-lg border border-[#E0DACF] bg-white px-3 text-sm text-[#1A1F2E] placeholder:text-sand-400 focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors";

type Sort = "price" | "duration";

export function FlightSearch({ mode }: { mode: DuffelMode }) {
  const [state, formAction, isPending] = useActionState<SearchState, FormData>(searchOffersAction, { ok: null });
  const [withReturn, setWithReturn] = useState(false);
  const [children, setChildren] = useState(0);
  const [sort, setSort] = useState<Sort>("price");
  const [now, setNow] = useState(() => Date.now());

  // Sélection / détail
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OfferDetailResult | null>(null);
  const [loadingDetail, startDetail] = useTransition();

  // Horloge d'expiration : 1 s, uniquement quand des résultats sont affichés.
  const hasResults = state.ok === true && state.result.offers.length > 0;
  useEffect(() => {
    if (!hasResults) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [hasResults]);

  // Nouvelle recherche ⇒ on ferme le détail.
  useEffect(() => {
    setSelectedId(null);
    setDetail(null);
  }, [state]);

  const offers = useMemo(() => {
    if (state.ok !== true) return [];
    const list = [...state.result.offers];
    list.sort((a, b) =>
      sort === "price"
        ? amountNumber(a.total_amount) - amountNumber(b.total_amount)
        : offerTotalMinutes(a) - offerTotalMinutes(b),
    );
    return list;
  }, [state, sort]);

  function openDetail(offer: DuffelOffer) {
    setSelectedId(offer.id);
    setDetail(null);
    startDetail(async () => {
      // Re-lecture : prix et expiration à jour — jamais d'engagement sur la valeur de la liste.
      const res = await getOfferAction(offer.id, offer.total_amount);
      setDetail(res);
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      {/* Recherche */}
      <form action={formAction} className="bg-white border border-[#E5E0D7] rounded-xl p-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <PlaceInput name="origin" label="Départ" placeholder="Ville ou aéroport (ex. Agadir, LHR)" />
          <PlaceInput name="destination" label="Arrivée" placeholder="Ville ou aéroport" />

          <div>
            <label htmlFor="departure_date" className={labelCls}>
              Date aller <span className="text-red-600">*</span>
            </label>
            <input id="departure_date" name="departure_date" type="date" required min={today} className={fieldCls} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="return_date" className="text-[12px] font-medium text-[#58524A]">Date retour</label>
              <label className="inline-flex items-center gap-1.5 text-[11px] text-[#6B6862] cursor-pointer">
                <input type="checkbox" checked={withReturn} onChange={(e) => setWithReturn(e.target.checked)} className="size-3.5" />
                <ArrowLeftRight className="size-3" /> aller-retour
              </label>
            </div>
            <input
              id="return_date"
              name="return_date"
              type="date"
              min={today}
              disabled={!withReturn}
              className={`${fieldCls} disabled:bg-[#FBF9F5] disabled:text-[#C9C4BA]`}
            />
          </div>

          <div className="sm:col-span-2 grid sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="adults" className={labelCls}>Adultes <span className="text-red-600">*</span></label>
              <input id="adults" name="adults" type="number" min="1" max="9" defaultValue="1" required className={fieldCls} />
            </div>
            <div>
              <label htmlFor="children_count" className={labelCls}>Enfants (moins de 18 ans)</label>
              <input
                id="children_count"
                type="number"
                min="0"
                max="8"
                value={children}
                onChange={(e) => setChildren(Math.max(0, Math.min(8, Number(e.target.value) || 0)))}
                className={fieldCls}
              />
            </div>
            <div>
              <label htmlFor="cabin_class" className={labelCls}>Cabine</label>
              <select id="cabin_class" name="cabin_class" defaultValue="economy" className={fieldCls}>
                {CABIN_CLASSES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {children > 0 && (
            <div className="sm:col-span-2">
              <span className={labelCls}>
                Âge de chaque enfant <span className="text-red-600">*</span>
                <span className="ml-1 font-normal text-[#968F84]">— Duffel l'exige pour tarifer les mineurs</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: children }).map((_, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="text-[11px] text-[#6B6862]">Enfant {i + 1}</span>
                    <input name={`child_age_${i}`} type="number" min="0" max="17" required defaultValue="8" className={`${fieldCls} w-20`} aria-label={`Âge de l'enfant ${i + 1}`} />
                    <span className="text-[11px] text-[#6B6862]">ans</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-[#F1EDE5]">
          <p className="flex items-start gap-1.5 text-[11px] text-[#968F84]">
            <Info className="size-3.5 shrink-0 mt-px" />
            La recherche ne part qu&apos;à votre demande. Les offres expirent en quelques minutes : le prix est relu avant tout engagement.
          </p>
          <button
            type="submit"
            disabled={isPending}
            aria-busy={isPending}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1A1F2E] px-4 text-sm font-medium text-white hover:bg-[#2A3142] disabled:opacity-60 transition-colors"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            {isPending ? "Recherche en cours…" : "Rechercher les vols"}
          </button>
        </div>
      </form>

      {/* Erreur */}
      {state.ok === false && (
        <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-[13px]" style={{ backgroundColor: "#FCEBEB", border: "1px solid #F7C1C1", color: "#791F1F" }}>
          <AlertTriangle className="size-4 shrink-0 mt-px" />
          {state.error}
        </div>
      )}

      {/* Résultats */}
      {state.ok === true && (
        <div className="grid lg:grid-cols-[1fr_380px] gap-4 items-start">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-[18px] text-[#1A1F2E]">
                  {offers.length} offre{offers.length > 1 ? "s" : ""}
                  <span className="text-[#968F84] font-sans text-[13px]">
                    {" "}· {state.input.origin} → {state.input.destination} · {formatDateShort(state.input.departureDate)}
                    {state.input.returnDate && <> · retour {formatDateShort(state.input.returnDate)}</>}
                  </span>
                </h2>
                <p className="text-[11.5px] text-[#6B6862] mt-0.5 inline-flex items-center gap-1.5">
                  <Users className="size-3.5" />
                  {state.input.adults} adulte{state.input.adults > 1 ? "s" : ""}
                  {state.input.childAges.length > 0 && <> · {state.input.childAges.length} enfant{state.input.childAges.length > 1 ? "s" : ""} ({state.input.childAges.join(", ")} ans)</>}
                  {" · "}{CABIN_CLASSES.find((c) => c.value === state.input.cabinClass)?.label}
                  {" · "}
                  <span style={{ color: state.result.liveMode ? "#791F1F" : "#7A4B00" }} className="font-medium">
                    {state.result.liveMode ? "LIVE" : "TEST"}
                  </span>
                </p>
              </div>
              <div className="inline-flex gap-0.5 rounded-lg bg-[#F1EFE8] p-[3px]">
                {(["price", "duration"] as Sort[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSort(s)}
                    className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
                      sort === s ? "bg-white text-[#1A1F2E] shadow-sm" : "text-[#6B6862] hover:text-[#1A1F2E]"
                    }`}
                  >
                    {s === "price" ? "Prix" : "Durée"}
                  </button>
                ))}
              </div>
            </div>

            {!state.result.liveMode && offers.length > 0 && (
              <p className="flex items-start gap-1.5 text-[11.5px]" style={{ color: "#7A4B00" }}>
                <Info className="size-3.5 shrink-0 mt-px" />
                Mode test : les offres des autres compagnies sont des bacs à sable non contractuels. Pour une émission
                d&apos;ordre en démonstration, choisissez une offre <span className="font-medium">Duffel Airways (ZZ)</span>.
              </p>
            )}
            {offers.length === 0 ? (
              <div className="bg-white border border-[#E5E0D7] rounded-xl p-10 text-center">
                <p className="text-[14px] text-[#1A1F2E]">Aucune offre pour cette recherche.</p>
                <p className="text-[12px] text-[#968F84] mt-1">Essayez une autre date, une autre cabine, ou des aéroports voisins.</p>
              </div>
            ) : (
              offers.map((o) => (
                <OfferCard key={o.id} offer={o} now={now} onSelect={openDetail} selected={o.id === selectedId} />
              ))
            )}
          </div>

          {/* Détail */}
          <div className="bg-white border border-[#E5E0D7] rounded-xl p-4 lg:sticky lg:top-20">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="flex items-center gap-1.5 text-[10.5px] tracking-[1.4px] uppercase text-[#968F84] font-medium">
                <FileText className="size-3.5" /> Détail de l&apos;offre
              </span>
              {selectedId && (
                <button type="button" onClick={() => { setSelectedId(null); setDetail(null); }} aria-label="Fermer" className="text-[#968F84] hover:text-[#1A1F2E]">
                  <X className="size-4" />
                </button>
              )}
            </div>

            {!selectedId ? (
              <p className="text-[13px] text-[#968F84]">Sélectionnez une offre pour relire son prix à jour et voir le détail des vols.</p>
            ) : loadingDetail || !detail ? (
              <p className="inline-flex items-center gap-2 text-[13px] text-[#6B6862]"><Loader2 className="size-4 animate-spin" /> Relecture du prix à jour…</p>
            ) : detail.ok === false ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-[12.5px]" style={{ backgroundColor: "#FCEBEB", border: "1px solid #F7C1C1", color: "#791F1F" }}>
                  <AlertTriangle className="size-4 shrink-0 mt-px" />
                  {detail.error}
                </div>
                {detail.expired && (
                  <p className="text-[12px] text-[#6B6862] inline-flex items-center gap-1.5">
                    <RefreshCw className="size-3.5" /> Relancez la recherche ci-dessus pour obtenir de nouvelles offres.
                  </p>
                )}
              </div>
            ) : (
              <OfferDetail detail={detail} now={now} mode={mode} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OfferDetail({ detail, now, mode }: { detail: Extract<OfferDetailResult, { ok: true }>; now: number; mode: DuffelMode }) {
  const { offer, expired, priceChanged } = detail;
  const pr = offer.payment_requirements ?? {};
  const liveOffer = offer.live_mode === true;

  return (
    <div className="space-y-3">
      {expired && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-[12.5px]" style={{ backgroundColor: "#FCEBEB", border: "1px solid #F7C1C1", color: "#791F1F" }}>
          <AlertTriangle className="size-4 shrink-0 mt-px" /> Cette offre a expiré — relancez la recherche.
        </div>
      )}
      {priceChanged && !expired && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-[12.5px]" style={{ backgroundColor: "#FFF4E0", border: "1px solid #EF9F27", color: "#7A4B00" }}>
          <AlertTriangle className="size-4 shrink-0 mt-px" /> Le prix a changé depuis la liste : {formatMoney(offer.total_amount, offer.total_currency)} à jour.
        </div>
      )}
      {(liveOffer || mode === "live") && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-[12.5px]" style={{ backgroundColor: "#FCEBEB", border: "1px solid #F7C1C1", color: "#791F1F" }}>
          <Lock className="size-4 shrink-0 mt-px" /> Offre LIVE : ce démonstrateur n&apos;émet pas de vrais billets. Lecture seule.
        </div>
      )}

      <AirlineBadge name={offer.owner.name} iata={offer.owner.iata_code} logo={offer.owner.logo_symbol_url} />

      <div className="rounded-lg p-3" style={{ backgroundColor: "#FBF9F5", border: "1px solid #EEE9E0" }}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[11px] uppercase tracking-wide text-[#968F84]">Total à jour</span>
          <span className="font-display text-[24px] text-[#1A1F2E] tabular-nums">{formatMoney(offer.total_amount, offer.total_currency)}</span>
        </div>
        {(offer.base_amount || offer.tax_amount) && (
          <div className="text-[11.5px] text-[#6B6862] mt-1 tabular-nums">
            {offer.base_amount && <>Base {formatMoney(offer.base_amount, offer.total_currency)}</>}
            {offer.tax_amount && <> · Taxes {formatMoney(offer.tax_amount, offer.total_currency)}</>}
          </div>
        )}
        <div className="text-[11px] text-[#968F84] mt-1">Conversion en MAD au taux figé : lot D1b.</div>
        <div className="text-[11px] mt-1.5 tabular-nums" style={{ color: expired ? "#791F1F" : "#B25F0B" }}>{countdownLabel(offer.expires_at, now)}</div>
      </div>

      <div className="space-y-2">
        {offer.slices.map((sl, i) => (
          <div key={sl.id}>
            <div className="text-[10.5px] uppercase tracking-wide text-[#968F84] font-medium mb-1">
              {offer.slices.length > 1 ? (i === 0 ? "Aller" : "Retour") : "Trajet"} · {sl.origin.city_name ?? sl.origin.name} → {sl.destination.city_name ?? sl.destination.name} · {formatMinutes(offerTotalMinutes({ ...offer, slices: [sl] }))}
            </div>
            <SliceRow slice={sl} />
          </div>
        ))}
      </div>

      <ConditionChips offer={offer} />

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11.5px]">
        <dt className="text-[#968F84]">Paiement</dt>
        <dd className="text-[#1A1F2E]">{pr.requires_instant_payment === false ? "Réservation en attente possible (hold)" : "Immédiat"}</dd>
        {pr.price_guarantee_expires_at && (
          <>
            <dt className="text-[#968F84]">Prix garanti jusqu&apos;au</dt>
            <dd className="text-[#1A1F2E] tabular-nums">{new Date(pr.price_guarantee_expires_at).toLocaleString("fr-FR")}</dd>
          </>
        )}
        {pr.payment_required_by && (
          <>
            <dt className="text-[#968F84]">Paiement requis avant</dt>
            <dd className="text-[#1A1F2E] tabular-nums">{new Date(pr.payment_required_by).toLocaleString("fr-FR")}</dd>
          </>
        )}
        <dt className="text-[#968F84]">Passagers</dt>
        <dd className="text-[#1A1F2E]">
          {offer.passengers.map((p) => (p.type ?? (p.age !== null && p.age !== undefined ? `${p.age} ans` : "?"))).join(", ")}
        </dd>
        <dt className="text-[#968F84]">Identifiant</dt>
        <dd className="font-mono text-[11px] text-[#6B6862] break-all">{offer.id}</dd>
      </dl>

      {/* Lot D1a : lecture seule. Le bouton montre l'étape suivante sans l'exécuter. */}
      <button
        type="button"
        disabled
        title="Disponible au lot D1b : création du produit, du dossier et des voyageurs depuis l'offre."
        className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[#1A1F2E] px-3 text-[13px] font-medium text-white opacity-50 cursor-not-allowed"
      >
        <Lock className="size-4" /> Créer le dossier — lot D1b
      </button>
    </div>
  );
}
