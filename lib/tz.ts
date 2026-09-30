// Dates « métier » au fuseau de l'agence (Africa/Casablanca). Le serveur (Vercel)
// tourne en UTC et le Maroc en UTC+1 (UTC+0 pendant le Ramadan) : « aujourd'hui »,
// les écarts en jours (J-2, J-7…) et « demain 08:00 » se calculent ICI, jamais
// avec toISOString().slice(0, 10). Client-safe (Intl uniquement).

export const AGENCY_TZ = "Africa/Casablanca";

const ymdFmt = new Intl.DateTimeFormat("en-CA", { timeZone: AGENCY_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: AGENCY_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Jour civil à Casablanca d'un instant : « 2026-09-30 ». */
export function agencyDate(at: Date | number | string = Date.now()): string {
  return ymdFmt.format(new Date(at));
}

/** Décale un jour civil « AAAA-MM-JJ » de n jours (arithmétique de calendrier, sans fuseau). */
export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Écart en jours civils entre aujourd'hui (Casablanca) et un jour « AAAA-MM-JJ » : départ demain → 1. */
export function daysFromToday(ymd: string, now: Date | number = Date.now()): number {
  const [y1, m1, d1] = agencyDate(now).split("-").map(Number);
  const [y2, m2, d2] = ymd.slice(0, 10).split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** Décalage (ms) de Casablanca par rapport à UTC à un instant donné. */
function offsetAt(utcMs: number): number {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Instant UTC correspondant à « jour AAAA-MM-JJ, hh:mm » heure de Casablanca. */
export function agencyInstant(ymd: string, hour = 0, minute = 0): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  // Deux passes : exact même autour d'un changement d'heure.
  let t = guess - offsetAt(guess);
  t = guess - offsetAt(t);
  return new Date(t);
}

/** Début de la journée en cours à Casablanca (instant UTC). */
export function startOfAgencyToday(now: Date | number = Date.now()): Date {
  return agencyInstant(agencyDate(now), 0, 0);
}

/** Échéance par défaut d'un report « Plus tard » : demain 08:00, heure de Casablanca. */
export function tomorrowAt8(now: Date | number = Date.now()): Date {
  return agencyInstant(addDays(agencyDate(now), 1), 8, 0);
}

/** « 14:20 » à Casablanca. */
export function agencyTime(at: Date | number | string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: AGENCY_TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(at));
}

/** « jeudi 24/09 » pour un jour civil. */
export function weekdayShort(ymd: string): string {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const wd = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "UTC" }).format(dt);
  return `${wd} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}
