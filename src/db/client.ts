import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";

const sqlite = new Database("bdc-pulse.sqlite");

function tryExec(sql: string) {
  try {
    sqlite.exec(sql);
  } catch {
    /* already applied */
  }
}

sqlite.exec(`
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_name TEXT NOT NULL,
  industry TEXT NOT NULL,
  project_code TEXT NOT NULL,
  consultant_owner TEXT NOT NULL,
  project_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS llm_settings (
  id INTEGER PRIMARY KEY,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  encrypted_api_key TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'analyzed',
  score INTEGER NOT NULL,
  effort TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  files_json TEXT NOT NULL DEFAULT '[]',
  provider TEXT,
  model TEXT,
  executive_summary TEXT,
  key_findings_json TEXT NOT NULL DEFAULT '[]',
  recommendations_json TEXT NOT NULL DEFAULT '[]',
  data_product_suggestions_json TEXT NOT NULL DEFAULT '[]',
  issues_json TEXT NOT NULL,
  migration_path_json TEXT NOT NULL,
  effort_breakdown_json TEXT NOT NULL DEFAULT '{}',
  gantt_json TEXT NOT NULL DEFAULT '[]',
  enriched_findings_json TEXT NOT NULL DEFAULT '[]',
  enriched_recommendations_json TEXT NOT NULL DEFAULT '[]',
  report_locale TEXT NOT NULL DEFAULT 'de',
  llm_prompt TEXT,
  llm_response TEXT,
  llm_prompt_tokens INTEGER,
  llm_completion_tokens INTEGER,
  llm_estimated_cost_usd TEXT,
  blueprint_json TEXT,
  issue_triage_json TEXT NOT NULL DEFAULT '{}',
  score_breakdown_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
`);

/** Legacy installs: add columns one by one */
const legacyAlters = [
  `ALTER TABLE assets ADD COLUMN project_id INTEGER NOT NULL DEFAULT 1;`,
  `ALTER TABLE assets ADD COLUMN files_json TEXT NOT NULL DEFAULT '[]';`,
  `ALTER TABLE assets ADD COLUMN provider TEXT;`,
  `ALTER TABLE assets ADD COLUMN model TEXT;`,
  `ALTER TABLE assets ADD COLUMN executive_summary TEXT;`,
  `ALTER TABLE assets ADD COLUMN key_findings_json TEXT NOT NULL DEFAULT '[]';`,
  `ALTER TABLE assets ADD COLUMN recommendations_json TEXT NOT NULL DEFAULT '[]';`,
  `ALTER TABLE assets ADD COLUMN data_product_suggestions_json TEXT NOT NULL DEFAULT '[]';`,
  `ALTER TABLE assets ADD COLUMN effort_breakdown_json TEXT NOT NULL DEFAULT '{}';`,
  `ALTER TABLE assets ADD COLUMN gantt_json TEXT NOT NULL DEFAULT '[]';`,
  `ALTER TABLE assets ADD COLUMN enriched_findings_json TEXT NOT NULL DEFAULT '[]';`,
  `ALTER TABLE assets ADD COLUMN enriched_recommendations_json TEXT NOT NULL DEFAULT '[]';`,
  `ALTER TABLE assets ADD COLUMN report_locale TEXT NOT NULL DEFAULT 'de';`,
  `ALTER TABLE assets ADD COLUMN llm_prompt TEXT;`,
  `ALTER TABLE assets ADD COLUMN llm_response TEXT;`,
  `ALTER TABLE assets ADD COLUMN llm_prompt_tokens INTEGER;`,
  `ALTER TABLE assets ADD COLUMN llm_completion_tokens INTEGER;`,
  `ALTER TABLE assets ADD COLUMN llm_estimated_cost_usd TEXT;`,
  `ALTER TABLE assets ADD COLUMN blueprint_json TEXT;`,
  `ALTER TABLE assets ADD COLUMN issue_triage_json TEXT NOT NULL DEFAULT '{}';`,
  `ALTER TABLE assets ADD COLUMN score_breakdown_json TEXT NOT NULL DEFAULT '[]';`,
  `ALTER TABLE assets ADD COLUMN semantic_translation_log_json TEXT NOT NULL DEFAULT '[]';`,
  `ALTER TABLE assets ADD COLUMN parser_engine_version TEXT;`,
  `ALTER TABLE assets ADD COLUMN llm_unavailable INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE assets ADD COLUMN llm_audit_encrypted INTEGER NOT NULL DEFAULT 0;`,
];

for (const stmt of legacyAlters) tryExec(stmt);

const projectCount =
  sqlite.prepare("SELECT COUNT(*) as c FROM projects").get() as { c: number };
if (projectCount.c === 0) {
  sqlite.prepare(
    `INSERT INTO projects (client_name, industry, project_code, consultant_owner, project_date, created_at)
     VALUES ('Default Client', 'General', 'PRJ-DEFAULT', 'Consultant', date('now'), datetime('now'))`,
  ).run();
}

const kvDefaults = [
  ["store_llm_traces", "0"],
  ["store_llm_audit", "0"],
  ["encrypt_llm_audit_at_rest", "0"],
  ["default_locale", "de"],
  ["company_name", "BDC Pulse"],
  ["confidentiality_footer", ""],
  ["branding_logo_png_base64", ""],
];
const insertKv = sqlite.prepare("INSERT OR IGNORE INTO app_kv (key, value) VALUES (?, ?)");
for (const [key, value] of kvDefaults) insertKv.run(key, value);

/** Legacy key rename: logo was stored under `logo_base64` — copy into canonical key once. */
try {
  const oldRow = sqlite.prepare("SELECT value FROM app_kv WHERE key = ?").get("logo_base64") as
    | { value: string }
    | undefined;
  const newRow = sqlite.prepare("SELECT value FROM app_kv WHERE key = ?").get("branding_logo_png_base64") as
    | { value: string }
    | undefined;
  if (oldRow?.value && (!newRow?.value || newRow.value === "")) {
    sqlite
      .prepare("INSERT OR REPLACE INTO app_kv (key, value) VALUES ('branding_logo_png_base64', ?)")
      .run(oldRow.value);
  }
  sqlite.prepare("DELETE FROM app_kv WHERE key = 'logo_base64'").run();
} catch {
  /* ignore */
}

export const db = drizzle(sqlite, { schema });
