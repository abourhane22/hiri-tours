// Sauvegarde des DONNÉES du schéma public en JSON — un fichier par table,
// pagination 1000 lignes, via PostgREST avec la clé service_role (bypass RLS).
// Alternative à pg_dump quand la connexion Postgres directe n'est pas possible.
//
//   node scripts/backup-json.mjs [dossier]      (défaut : backups/data-AAAA-MM-JJ/)
//
// Le schéma n'est PAS exporté ici : il est couvert par supabase/migrations/*
// + 20260926_schema_catchup.sql (voir le README écrit dans le dossier).
// La clé service_role est lue dans .env.local et n'est jamais affichée.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) { console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants dans .env.local"); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const today = new Date().toISOString().slice(0, 10);
const outDir = path.resolve(ROOT, process.argv[2] ?? path.join("backups", `data-${today}`));
fs.mkdirSync(outDir, { recursive: true });

// Vues connues (exportées aussi, mais signalées : elles se reconstruisent depuis les tables).
const VIEWS = new Set(["customers_with_stats"]);
const PAGE = 1000;

// 1. Liste des tables exposées (schéma public) depuis la description OpenAPI de PostgREST.
const root = await (await fetch(`${URL_}/rest/v1/`, { headers: H })).json();
const tables = Object.keys(root.paths ?? {})
  .filter((p) => p !== "/" && !p.startsWith("/rpc/"))
  .map((p) => p.slice(1))
  .sort();
const defs = root.definitions ?? {};

function orderColumn(table, sampleRow) {
  const props = Object.keys(defs[table]?.properties ?? sampleRow ?? {});
  if (props.includes("id")) return "id";
  return props[0] ?? null;
}

// 2. Export paginé.
const report = [];
let totalRows = 0;
for (const table of tables) {
  const rows = [];
  let from = 0;
  let total = null;
  let order = orderColumn(table);
  for (;;) {
    const q = `${URL_}/rest/v1/${table}?select=*${order ? `&order=${order}.asc` : ""}`;
    const r = await fetch(q, { headers: { ...H, Prefer: "count=exact", Range: `${from}-${from + PAGE - 1}`, "Range-Unit": "items" } });
    if (r.status === 416) break; // au-delà de la dernière page
    if (!r.ok) {
      const body = await r.text();
      // Colonne d'ordre inconnue (vue sans id) → on retente sans ordre une fois.
      if (order && /column .* does not exist|failed to parse order/i.test(body)) { order = null; continue; }
      report.push({ table, rows: null, error: `${r.status} ${body.slice(0, 120)}` });
      break;
    }
    const page = await r.json();
    rows.push(...page);
    const cr = r.headers.get("content-range"); // "0-999/2345" ou "*/0"
    if (cr) { const m = cr.match(/\/(\d+)$/); if (m) total = Number(m[1]); }
    if (page.length < PAGE || (total !== null && rows.length >= total)) break;
    from += PAGE;
  }
  if (report.some((x) => x.table === table)) continue;
  fs.writeFileSync(path.join(outDir, `${table}.json`), JSON.stringify(rows, null, 1), "utf8");
  report.push({ table, rows: rows.length, view: VIEWS.has(table) });
  totalRows += rows.length;
}

// 3. README + manifeste.
const unversioned = ["customers", "staff_members", "vehicles", "expenses", "cost_categories", "company_settings", "invoices"];
const lines = [
  `# Sauvegarde données — ${today}`,
  "",
  `Projet Supabase : ${URL_.replace(/^https?:\/\//, "")} · schéma public · export JSON paginé (${PAGE} lignes/page) via PostgREST (service_role).`,
  "",
  "## Contenu",
  "",
  "| Table | Lignes |",
  "|---|---|",
  ...report.map((r) => `| ${r.table}${r.view ? " *(vue — se reconstruit depuis les tables)*" : ""} | ${r.rows ?? `ERREUR : ${r.error}`} |`),
  "",
  `**${report.filter((r) => r.rows !== null).length} tables/vues exportées · ${totalRows} lignes au total.**`,
  "",
  "## Schéma",
  "",
  "Le schéma n'est pas dans ce dossier. Il est couvert par `supabase/migrations/*.sql` + `20260926_schema_catchup.sql`,",
  "**sauf** les objets suivants, jamais versionnés (créés à la main dans Supabase avant le versionnage) :",
  "",
  ...unversioned.map((t) => `- \`public.${t}\` — structure de base non créée par le dépôt${t === "invoices" ? " (seules les colonnes légales du lot facturation sont versionnées)" : ""}`),
  "- colonnes hors dépôt : `customers.phone_normalized / first_name / last_name`, `staff_members.documents`, `vehicles` (maintenance, assurances, vignette), `company_settings` (cible annuelle, RIB, WhatsApp)",
  "- la vue `customers_with_stats` et la table `keep_alive`",
  "",
  "Pour une restauration complète, il faut donc : (1) recréer ces objets (un `pg_dump --schema-only` reste à versionner comme « schéma de référence »),",
  "(2) rejouer les migrations, (3) réimporter ces JSON dans l'ordre des dépendances (référentiels → produits → clients → dossiers → paiements/factures/avoirs → tables de liaison).",
  "",
  "Les compteurs (`invoice_counters`, `credit_note_counters`) et les jetons (`reservation_access_tokens`, `payment_links`) sont inclus : ce dossier contient des données sensibles — jamais versionné (`backups/` est dans .gitignore).",
];
fs.writeFileSync(path.join(outDir, "README.md"), lines.join("\n") + "\n", "utf8");
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify({ date: today, project: URL_, tables: report, totalRows }, null, 1), "utf8");

// 4. Rapport console.
const w = Math.max(...report.map((r) => r.table.length));
for (const r of report) console.log(`${r.table.padEnd(w)}  ${r.rows === null ? "ERREUR " + r.error : String(r.rows).padStart(6)}${r.view ? "  (vue)" : ""}`);
console.log(`\n${report.filter((r) => r.rows !== null).length} tables/vues · ${totalRows} lignes → ${outDir}`);
const size = fs.readdirSync(outDir).reduce((s, f) => s + fs.statSync(path.join(outDir, f)).size, 0);
console.log(`taille du dossier : ${(size / 1024 / 1024).toFixed(2)} Mo`);
