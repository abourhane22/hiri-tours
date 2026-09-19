import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateShort } from "@/lib/utils";
import { VoucherPrintButton } from "@/components/voucher-print-button";
import { AutoPrint } from "@/components/auto-print";
import { TRAVELER_TYPE_SHORT } from "@/lib/travelers";
import { getDossierProfile, stayDates, MANIFEST_TRAVELER_COLUMNS, MEAL_PLAN_LABEL } from "@/lib/dossier-profile";
import type { TravelerType } from "@/lib/types";

// Document de bord : nom + type (+ date de naissance pour les occupants d'un
// hébergement) — JAMAIS de passeport ni de numéro de pièce.
type ManifestTraveler = { reservation_id: string; full_name: string; traveler_type: TravelerType; date_of_birth: string | null };

function hhmm(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default async function ManifestePage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string; circuitId: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { date, circuitId } = await params;
  const { print } = await searchParams;
  const supabase = await createClient();

  const { data: circuit } = await supabase.from("circuits").select("*").eq("id", circuitId).single();
  if (!circuit) notFound();

  // Le profil du produit pilote colonnes, équipage et signatures.
  const profile = getDossierProfile(circuit as any);
  const cols = profile.manifest.columns;

  const { data: reservations } = await supabase
    .from("reservations")
    .select("*, customers(full_name, email, phone, internal_notes, nationality), vehicles(registration, make, model, capacity), guide:staff_members!reservations_guide_id_fkey(full_name, phone), driver:staff_members!reservations_driver_id_fkey(full_name, phone)")
    .eq("circuit_id", circuitId)
    .eq("departure_date", date)
    .in("status", ["confirmed", "paid"])
    .order("created_at", { ascending: true });

  // Voyageurs nominatifs de tous les dossiers du départ (une requête, colonnes autorisées seulement).
  const reservationIds = (reservations || []).map((r: any) => r.id as string);
  const travelersByReservation = new Map<string, ManifestTraveler[]>();
  if (reservationIds.length > 0) {
    const { data: travelers } = await supabase
      .from("reservation_travelers")
      .select(MANIFEST_TRAVELER_COLUMNS)
      .in("reservation_id", reservationIds)
      .order("created_at", { ascending: true });
    for (const t of (travelers ?? []) as ManifestTraveler[]) {
      const list = travelersByReservation.get(t.reservation_id) ?? [];
      list.push(t);
      travelersByReservation.set(t.reservation_id, list);
    }
  }

  const rs = (reservations || []) as any[];
  const totalPax = rs.reduce((sum: number, r: any) => sum + r.adults + r.children, 0);
  const totalAdults = rs.reduce((sum: number, r: any) => sum + r.adults, 0);
  const totalChildren = rs.reduce((sum: number, r: any) => sum + r.children, 0);
  const colCount = 7 + (cols === "transfer" ? 1 : 0);
  const th = "text-left px-3 py-2 font-medium text-sand-800 border-r border-sand-200";

  return (
    <div className="bg-white min-h-screen">
      {print && <AutoPrint />}
      <div className="max-w-4xl mx-auto p-8 print:p-0">
        <div className="flex justify-between items-center mb-6 print:hidden">
          <p className="text-sm text-sand-700">Manifeste passagers — cliquez sur Imprimer pour télécharger en PDF.</p>
          <VoucherPrintButton />
        </div>

        <div className="bg-white border border-sand-200 rounded-lg p-10 print:border-0 print:p-0">
          <div className="pb-6 border-b border-sand-200 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-3xl text-navy-700">Hiri Tours</span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-terracotta-600 font-medium">
                    {cols === "stay" ? "Liste des occupants" : "Manifeste passagers"}
                  </span>
                </div>
              </div>
              <div className="text-right text-xs text-sand-700">
                <p>Document de bord</p>
                <p>Édité le {formatDate(new Date().toISOString())}</p>
                <p className="text-[10px] text-sand-500 mt-0.5">by Bright Strategy</p>
              </div>
            </div>
            <h2 className="font-display text-2xl text-ink mt-4">{circuit.title}</h2>
            <p className="text-sm text-sand-800 mt-1">{cols === "stay" ? "Arrivée" : "Départ"} le {formatDate(date)}</p>
            {circuit.meeting_point && <p className="text-sm text-sand-800 mt-1"><strong>{cols === "stay" ? "Établissement" : "Point de rendez-vous"} :</strong> {circuit.meeting_point}</p>}
          </div>

          {/* Logistique du jour — selon le profil (pas de guide sur un transfert, rien sur hébergement/billetterie) */}
          {profile.manifest.crew && rs.length > 0 && (() => {
            const first = rs[0];
            const v = first.vehicles;
            const g = profile.manifest.guide ? first.guide : null;
            const dr = first.driver;
            if (!v && !g && !dr) return null;
            return (
              <div className="mb-6 p-3 bg-sand-50 border border-sand-200 rounded">
                <p className="text-xs text-sand-600 uppercase tracking-wide font-medium mb-2">Logistique du jour</p>
                <div className="grid sm:grid-cols-3 gap-3 text-sm">
                  {v && <div><div className="text-xs text-sand-600">Véhicule</div><div className="text-ink font-medium">{v.registration}</div><div className="text-xs text-sand-700">{[v.make, v.model].filter(Boolean).join(" ")} · {v.capacity} pax</div></div>}
                  {g && <div><div className="text-xs text-sand-600">Guide</div><div className="text-ink font-medium">{g.full_name}</div>{g.phone && <div className="text-xs text-sand-700">{g.phone}</div>}</div>}
                  {dr && <div><div className="text-xs text-sand-600">Chauffeur</div><div className="text-ink font-medium">{dr.full_name}</div>{dr.phone && <div className="text-xs text-sand-700">{dr.phone}</div>}</div>}
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="border border-sand-200 rounded p-3">
              <div className="text-xs text-sand-600 uppercase tracking-wide">Réservations</div>
              <div className="font-display text-2xl text-ink">{rs.length}</div>
            </div>
            <div className="border border-sand-200 rounded p-3">
              <div className="text-xs text-sand-600 uppercase tracking-wide">{cols === "stay" ? "Total occupants" : "Total pax"}</div>
              <div className="font-display text-2xl text-terracotta-600">{totalPax}</div>
            </div>
            <div className="border border-sand-200 rounded p-3">
              <div className="text-xs text-sand-600 uppercase tracking-wide">Adultes / Enfants</div>
              <div className="font-display text-2xl text-ink">{totalAdults}<span className="text-base text-sand-600"> / {totalChildren}</span></div>
            </div>
          </div>

          <table className="w-full text-sm border border-sand-200">
            <thead className="bg-sand-100 border-b border-sand-200">
              <tr>
                <th className={th}>#</th>
                <th className={th}>Référence</th>
                <th className={th}>{cols === "stay" ? "Client & occupants" : "Passager principal"}</th>
                {cols === "transfer" && <th className={th}>Vol · arrivée</th>}
                <th className={th}>Contact</th>
                <th className={`${th} text-right`}>A</th>
                <th className={`${th} text-right`}>E</th>
                <th className="text-left px-3 py-2 font-medium text-sand-800">{cols === "stay" ? "Séjour · notes" : "Notes"}</th>
              </tr>
            </thead>
            <tbody>
              {rs.map((r: any, i: number) => {
                const list = travelersByReservation.get(r.id) ?? [];
                const expected = r.adults + r.children;
                const stay = cols === "stay" ? stayDates(r.departure_date, r.nights) : null;
                return (
                  <tr key={r.id} className="border-b border-sand-200 last:border-b-0">
                    <td className="px-3 py-2 border-r border-sand-200 text-sand-700">{i + 1}</td>
                    <td className="px-3 py-2 border-r border-sand-200 font-mono text-xs">{r.reference}</td>
                    <td className="px-3 py-2 border-r border-sand-200">
                      <div className="text-ink">{r.customers?.full_name ?? "—"}</div>
                      {r.customers?.nationality && <div className="text-xs text-sand-600">{r.customers.nationality}</div>}
                      {list.length > 0 && (
                        profile.manifest.occupants ? (
                          <ul className="mt-1 text-xs text-sand-800 space-y-0.5">
                            {list.map((t, k) => (
                              <li key={k}>
                                {t.full_name} <span className="text-sand-600">({TRAVELER_TYPE_SHORT[t.traveler_type]})</span>
                                {t.date_of_birth && <span className="text-sand-600"> · né(e) le {formatDateShort(t.date_of_birth)}</span>}
                              </li>
                            ))}
                            {list.length !== expected && <li className="text-amber-800">{list.length}/{expected} renseignés</li>}
                          </ul>
                        ) : (
                          <div className="mt-1 text-xs text-sand-800">
                            <span className="text-sand-600">Voyageurs : </span>
                            {list.map((t) => `${t.full_name} (${TRAVELER_TYPE_SHORT[t.traveler_type]})`).join(" · ")}
                            {list.length !== expected && <span className="text-amber-800"> · {list.length}/{expected} renseignés</span>}
                          </div>
                        )
                      )}
                    </td>
                    {cols === "transfer" && (
                      <td className="px-3 py-2 border-r border-sand-200">
                        {r.arrival_flight_number || r.arrival_flight_at ? (
                          <>
                            <div className="font-mono font-medium text-ink">{r.arrival_flight_number ?? "—"}</div>
                            {r.arrival_flight_at && (
                              <div className="text-xs text-sand-800">
                                {formatDateShort(r.arrival_flight_at)} · <span className="font-medium text-ink">{hhmm(r.arrival_flight_at)}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-amber-800">Vol non renseigné</span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2 border-r border-sand-200 text-xs">
                      {r.customers?.phone && <div>{r.customers.phone}</div>}
                      {r.customers?.email && <div className="text-sand-700">{r.customers.email}</div>}
                    </td>
                    <td className="px-3 py-2 border-r border-sand-200 text-right tabular-nums">{r.adults}</td>
                    <td className="px-3 py-2 border-r border-sand-200 text-right tabular-nums">{r.children}</td>
                    <td className="px-3 py-2 text-xs text-sand-800">
                      {stay && (
                        <div className="text-ink">
                          {formatDateShort(stay.checkIn)} → {formatDateShort(stay.checkOut)} · {stay.nights} nuit{stay.nights > 1 ? "s" : ""} · {Math.max(1, Number(r.rooms) || 1)} ch.
                          {r.meal_plan && <> · {MEAL_PLAN_LABEL[r.meal_plan] ?? r.meal_plan}</>}
                        </div>
                      )}
                      {r.special_requests && (
                        <div className="font-medium text-ink rounded px-1.5 py-0.5 mb-1 inline-block" style={{ backgroundColor: "#FAEEDA" }}>
                          ★ {r.special_requests}
                        </div>
                      )}
                      {r.group_language && <div className="text-sand-700">Langue : {r.group_language.toUpperCase()}</div>}
                      {r.notes && <div>{r.notes}</div>}
                      {r.customers?.internal_notes && <div className="text-sand-600 italic">{r.customers.internal_notes}</div>}
                    </td>
                  </tr>
                );
              })}
              {rs.length === 0 && (
                <tr><td colSpan={colCount} className="px-3 py-6 text-center text-sand-700">Aucun passager.</td></tr>
              )}
            </tbody>
            <tfoot className="bg-sand-50 border-t-2 border-sand-300">
              <tr>
                <td colSpan={colCount - 3} className="px-3 py-2 text-right font-medium text-sand-800">Totaux</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium border-r border-sand-200">{totalAdults}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium border-r border-sand-200">{totalChildren}</td>
                <td className="px-3 py-2 font-medium">{totalPax} pax</td>
              </tr>
            </tfoot>
          </table>

          {profile.manifest.signatures && (
            <div className={`mt-10 pt-4 border-t border-sand-300 text-xs text-sand-700 grid gap-8 ${profile.manifest.guide ? "grid-cols-2" : "grid-cols-1 max-w-sm"}`}>
              {profile.manifest.guide && (
                <div>
                  <p className="font-medium text-sand-800 mb-2">Signature guide {rs[0]?.guide ? `(${rs[0].guide.full_name})` : ""}</p>
                  <div className="h-16 border-b border-sand-300"></div>
                </div>
              )}
              <div>
                <p className="font-medium text-sand-800 mb-2">Signature chauffeur {rs[0]?.driver ? `(${rs[0].driver.full_name})` : ""}</p>
                <div className="h-16 border-b border-sand-300"></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
