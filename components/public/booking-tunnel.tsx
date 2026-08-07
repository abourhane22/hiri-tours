"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Minus,
  Plus,
  CreditCard,
  Landmark,
  Building2,
  CircleCheck,
  Copy,
  Check,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { formatMAD } from "@/lib/utils";
import { seasonMultiplier, computeReservationTotal } from "@/lib/pricing";
import {
  createPublicReservation,
  type PaymentChannel,
  type PublicReservationResult,
} from "@/app/reserver/actions";

type Season = { starts_on: string; ends_on: string; price_multiplier: number };

type Circuit = {
  id: string;
  title: string;
  categoryLabel: string;
  description: string;
  heroImageUrl: string | null;
  basePrice: number;
  childPrice: number | null;
  maxParticipants: number;
  infoItems: { label: string; value: string }[];
  seasons: Season[];
};

type Bank = { rib: string | null; name: string | null; holder: string | null };

const STEPS = ["Prestation", "Coordonnées", "Paiement", "Confirmé"];

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}
function frDay(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function BookingTunnel({ circuit, bank }: { circuit: Circuit; bank: Bank }) {
  const router = useRouter();
  const tomorrow = useMemo(() => isoDay(new Date(Date.now() + 86400000)), []);

  const [step, setStep] = useState(1);
  const [date, setDate] = useState("");
  const [pax, setPax] = useState(1);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot

  const [channel, setChannel] = useState<PaymentChannel>("carte");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicReservationResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const maxPax = circuit.maxParticipants;
  const overCapacity = maxPax > 0 && pax > maxPax;

  const multiplier = date ? seasonMultiplier(date, circuit.seasons) : 1;
  const total = computeReservationTotal({
    basePriceMad: circuit.basePrice,
    childPriceMad: circuit.childPrice,
    adults: pax,
    children: 0,
    multiplier,
  });
  const isHighSeason = multiplier > 1;

  // Règle J-7 (canal agence).
  const departureIn7 = date ? new Date(date + "T00:00:00").getTime() - Date.now() < 7 * 86400000 : false;
  const agenceDeadline = date ? isoDay(new Date(new Date(date + "T00:00:00").getTime() - 7 * 86400000)) : "";

  const step1Valid = !!date && date >= tomorrow && pax >= 1 && !overCapacity;
  const step2Valid =
    firstName.trim() && lastName.trim() && phone.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function submit() {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const res = await createPublicReservation({
      circuitId: circuit.id,
      date,
      pax,
      firstName,
      lastName,
      phone,
      email,
      channel,
      website,
    });
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    // Carte : le parcours /payer existant prend le relais.
    if (channel === "carte" && res.id) {
      router.push(`/payer/${res.id}`);
      return;
    }
    setResult(res);
    setStep(4);
  }

  const finalLabel =
    channel === "carte"
      ? `Payer ${formatMAD(total)} par carte`
      : channel === "virement"
        ? "Confirmer — je règle par virement"
        : "Confirmer — je règle à l'agence";

  return (
    <div>
      <StepBar current={step} />

      {/* ÉTAPE 1 — Prestation */}
      {step === 1 && (
        <div className="mt-5">
          <div className="overflow-hidden rounded-xl border border-[#E5E0D7] bg-white">
            <div className="relative aspect-[16/9] w-full bg-gradient-to-br from-[#0C6B8A] to-[#1A1F2E]">
              {circuit.heroImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={circuit.heroImageUrl}
                  alt={circuit.title}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              <span className="absolute top-3 left-3 inline-flex items-center rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-medium text-[#1A1F2E]">
                {circuit.categoryLabel}
              </span>
            </div>
            <div className="p-4">
              <h1 className="font-display text-xl text-[#1A1F2E]">{circuit.title}</h1>
              {circuit.description && (
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#6B6862] whitespace-pre-line line-clamp-4">
                  {circuit.description}
                </p>
              )}
              {circuit.infoItems.length > 0 && (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                  {circuit.infoItems.map((it) => (
                    <div key={it.label}>
                      <dt className="text-[11px] uppercase tracking-wide text-[#968F84]">
                        {it.label}
                      </dt>
                      <dd className="text-[13px] text-[#1A1F2E]">{it.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[#E5E0D7] bg-white p-4 space-y-4">
            <div>
              <label htmlFor="date" className={labelCls}>
                Date de départ <span className="text-red-600">*</span>
              </label>
              <input
                id="date"
                type="date"
                min={tomorrow}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={fieldCls}
              />
            </div>

            <div>
              <span className={labelCls}>
                Passagers <span className="text-red-600">*</span>
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPax((p) => Math.max(1, p - 1))}
                  disabled={pax <= 1}
                  className="inline-flex size-9 items-center justify-center rounded-lg border border-[#E0DACF] text-[#1A1F2E] disabled:opacity-40 hover:bg-sand-50"
                  aria-label="Retirer un passager"
                >
                  <Minus className="size-4" />
                </button>
                <span className="min-w-8 text-center font-display text-lg tabular-nums text-[#1A1F2E]">
                  {pax}
                </span>
                <button
                  type="button"
                  onClick={() => setPax((p) => p + 1)}
                  disabled={maxPax > 0 && pax >= maxPax}
                  className="inline-flex size-9 items-center justify-center rounded-lg border border-[#E0DACF] text-[#1A1F2E] disabled:opacity-40 hover:bg-sand-50"
                  aria-label="Ajouter un passager"
                >
                  <Plus className="size-4" />
                </button>
                {maxPax > 0 && (
                  <span className="text-[12px] text-[#968F84]">max. {maxPax}</span>
                )}
              </div>
              {overCapacity && (
                <p className="mt-1.5 text-[12px] text-red-600">
                  Cette prestation accepte au maximum {maxPax} passagers.
                </p>
              )}
            </div>

            {/* Total live */}
            <div className="flex items-end justify-between border-t border-[#F1EFE8] pt-3">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-[#968F84]">Total</div>
                {isHighSeason && (
                  <div className="text-[11px] text-[#C84B31]">Tarif haute saison appliqué</div>
                )}
              </div>
              <div className="font-display text-2xl text-[#0F6E56] tabular-nums">
                {formatMAD(total)}
              </div>
            </div>
          </div>

          <NavButtons
            onNext={() => setStep(2)}
            nextDisabled={!step1Valid}
            nextLabel="Continuer"
            back={
              <Link href="/reserver" className={backBtnCls}>
                Retour
              </Link>
            }
          />
        </div>
      )}

      {/* ÉTAPE 2 — Coordonnées */}
      {step === 2 && (
        <div className="mt-5">
          <div className="rounded-xl border border-[#E5E0D7] bg-white p-4">
            <h2 className="font-display text-lg text-[#1A1F2E] mb-3">Vos coordonnées</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="lastName" className={labelCls}>
                  Nom <span className="text-red-600">*</span>
                </label>
                <input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label htmlFor="firstName" className={labelCls}>
                  Prénom <span className="text-red-600">*</span>
                </label>
                <input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label htmlFor="phone" className={labelCls}>
                  Téléphone <span className="text-red-600">*</span>
                </label>
                <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label htmlFor="email" className={labelCls}>
                  Email <span className="text-red-600">*</span>
                </label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldCls} />
              </div>
            </div>

            {/* Honeypot anti-bot (masqué, non annoncé) */}
            <div aria-hidden className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden">
              <label htmlFor="website">Ne pas remplir</label>
              <input
                id="website"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            <p className="mt-3 flex items-start gap-1.5 text-[12px] text-[#6B6862]">
              <ShieldCheck className="size-3.5 shrink-0 mt-px text-[#0F6E56]" />
              Si vous avez déjà voyagé avec nous, votre dossier sera automatiquement rattaché à
              votre compte.
            </p>
          </div>

          <NavButtons
            onNext={() => setStep(3)}
            nextDisabled={!step2Valid}
            nextLabel="Continuer"
            back={
              <button type="button" onClick={() => setStep(1)} className={backBtnCls}>
                Retour
              </button>
            }
          />
        </div>
      )}

      {/* ÉTAPE 3 — Paiement */}
      {step === 3 && (
        <div className="mt-5">
          <div className="rounded-xl border border-[#E5E0D7] bg-white p-4">
            <h2 className="font-display text-lg text-[#1A1F2E] mb-1">Comment souhaitez-vous régler ?</h2>
            <p className="text-[13px] text-[#6B6862] mb-4">
              Montant total : <span className="font-medium text-[#1A1F2E]">{formatMAD(total)}</span>
            </p>

            <div className="space-y-3">
              <PayCard
                active={channel === "carte"}
                onClick={() => setChannel("carte")}
                icon={CreditCard}
                title="Carte bancaire"
                desc="Cartes marocaines (Attijari Payment) et internationales (Visa · Mastercard) · 3D Secure"
              />
              <PayCard
                active={channel === "virement"}
                onClick={() => setChannel("virement")}
                icon={Landmark}
                title="Virement bancaire"
                desc="Réglez par virement — votre réservation sera confirmée à réception."
              />
              <PayCard
                active={channel === "agence"}
                onClick={() => setChannel("agence")}
                icon={Building2}
                title="Règlement à l'agence"
                desc={
                  departureIn7
                    ? "Départ proche — règlement attendu sous 24 h."
                    : date
                      ? `Espèces ou carte, au plus tard le ${frDay(agenceDeadline)}.`
                      : "Espèces ou carte, avant le départ."
                }
              />
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </div>

          <NavButtons
            onNext={submit}
            nextDisabled={submitting}
            nextLabel={
              submitting ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="size-4 animate-spin" /> Traitement…
                </span>
              ) : (
                finalLabel
              )
            }
            back={
              <button type="button" onClick={() => setStep(2)} disabled={submitting} className={backBtnCls}>
                Retour
              </button>
            }
          />
        </div>
      )}

      {/* ÉTAPE 4 — Confirmé */}
      {step === 4 && result?.ok && (
        <div className="mt-5">
          <div className="rounded-xl border border-[#E5E0D7] bg-white p-6 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-[#E1F5EE]">
              <CircleCheck className="size-8 text-[#0F6E56]" />
            </div>
            <h2 className="font-display text-xl text-[#1A1F2E]">Demande enregistrée !</h2>
            <p className="mt-1 text-[13px] text-[#6B6862]">
              Votre dossier de réservation
            </p>
            {result.reference && (
              <p className="mt-1 font-mono text-lg text-[#1A1F2E]">{result.reference}</p>
            )}
            {result.reference && result.id && (
              <p className="mt-1 text-[12px] text-[#968F84]">
                Conservez votre référence{" "}
                <span className="font-mono">{result.reference}</span> : elle permet de retrouver
                votre dossier à tout moment.
              </p>
            )}

            {/* Virement : bloc RIB */}
            {channel === "virement" && (
              <div className="mt-5 text-left">
                <div className="rounded-lg bg-[#1A1F2E] p-4 text-white">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] uppercase tracking-wide text-[#9FB0C4]">RIB</span>
                    {bank.rib && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(bank.rib!);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1500);
                        }}
                        className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[12px] hover:bg-white/20"
                      >
                        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                        {copied ? "Copié" : "Copier"}
                      </button>
                    )}
                  </div>
                  <div className="mt-1.5 font-mono text-sm break-all">{bank.rib ?? "—"}</div>
                  {bank.holder && (
                    <div className="mt-2 text-[12px] text-[#C7D2DE]">Titulaire : {bank.holder}</div>
                  )}
                  {bank.name && (
                    <div className="text-[12px] text-[#C7D2DE]">Banque : {bank.name}</div>
                  )}
                </div>
                <p className="mt-3 text-[13px] text-[#6B6862]">
                  Indiquez la référence{" "}
                  <span className="font-mono font-medium text-[#1A1F2E]">{result.reference}</span>{" "}
                  dans le motif du virement. Votre réservation sera confirmée à réception.
                </p>
              </div>
            )}

            {/* Agence : consigne J-7 */}
            {channel === "agence" && (
              <p className="mt-5 text-left text-[13px] text-[#6B6862]">
                {departureIn7 ? (
                  <>
                    Votre départ étant proche, merci de régler à l&apos;agence (espèces ou carte){" "}
                    <span className="font-medium text-[#1A1F2E]">sous 24 h</span>. Au-delà, la
                    réservation pourra être libérée.
                  </>
                ) : (
                  <>
                    Réglez à l&apos;agence (espèces ou carte) au plus tard le{" "}
                    <span className="font-medium text-[#1A1F2E]">{frDay(agenceDeadline)}</span>. Au-delà,
                    la réservation pourra être libérée.
                  </>
                )}
              </p>
            )}

            {/* Lien de suivi longue durée */}
            {result.suiviUrl && (
              <div className="mt-5 rounded-lg border border-[#E5E0D7] bg-[#FBF9F5] p-3 text-left">
                <p className="text-[12px] text-[#6B6862] mb-1.5">
                  Suivez votre dossier à tout moment :
                </p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={result.suiviUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    className="min-w-0 flex-1 rounded-md border border-[#E0DACF] bg-white px-2.5 py-1.5 text-[12px] font-mono text-[#1A1F2E]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(result.suiviUrl!);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 1500);
                    }}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#1A1F2E] px-2.5 py-1.5 text-[12px] font-medium text-white hover:bg-[#2A3142]"
                  >
                    {copiedLink ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copiedLink ? "Copié" : "Copier"}
                  </button>
                </div>
              </div>
            )}

            {result.emailSent && (
              <p className="mt-4 text-[12px] text-[#968F84]">
                Un récapitulatif vient de vous être envoyé par email.
              </p>
            )}

            <Link
              href="/reserver"
              className="mt-6 inline-flex h-10 items-center justify-center rounded-lg border border-[#E0DACF] bg-white px-4 text-sm font-medium text-[#1A1F2E] hover:bg-sand-50"
            >
              Retour au catalogue
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

const labelCls = "block text-[12px] font-medium text-[#58524A] mb-1.5";
const fieldCls =
  "h-10 w-full rounded-lg border border-[#E0DACF] bg-white px-3 text-sm text-[#1A1F2E] placeholder:text-sand-400 focus:border-[#1A1F2E] focus:outline-none focus:ring-2 focus:ring-[#1A1F2E]/10 transition-colors";
const backBtnCls =
  "inline-flex h-11 items-center justify-center rounded-lg border border-[#E0DACF] bg-white px-4 text-sm font-medium text-[#1A1F2E] hover:bg-sand-50 transition-colors";

function StepBar({ current }: { current: number }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        const color = done ? "#0F6E56" : active ? "#C84B31" : "#E0DACF";
        return (
          <div key={label} className="pb-2" style={{ borderBottom: `2px solid ${color}` }}>
            <div className="text-[11px] tabular-nums" style={{ color: done || active ? color : "#968F84" }}>
              {n}
            </div>
            <div
              className="text-[12px] font-medium truncate"
              style={{ color: done || active ? "#1A1F2E" : "#968F84" }}
            >
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NavButtons({
  onNext,
  nextDisabled,
  nextLabel,
  back,
}: {
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel: React.ReactNode;
  back: React.ReactNode;
}) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      {back}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-[#0F6E56] px-4 text-sm font-medium text-white transition-colors hover:bg-[#085041] disabled:opacity-50 disabled:pointer-events-none"
      >
        {nextLabel}
      </button>
    </div>
  );
}

function PayCard({
  active,
  onClick,
  icon: Icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof CreditCard;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full items-start gap-3 rounded-xl border-2 p-3.5 text-left transition-colors ${
        active ? "border-[#0F6E56] bg-[#F7FCFA]" : "border-[#E5E0D7] bg-white hover:border-[#C9C0AE]"
      }`}
    >
      <span
        className={`mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${
          active ? "bg-[#0F6E56] text-white" : "bg-[#F1EFE8] text-[#6B6862]"
        }`}
      >
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="font-medium text-[#1A1F2E]">{title}</span>
          {active && <CircleCheck className="size-4 text-[#0F6E56] shrink-0" />}
        </span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-[#6B6862]">{desc}</span>
      </span>
    </button>
  );
}
