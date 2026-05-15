import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientName: text("client_name").notNull(),
  industry: text("industry").notNull(),
  projectCode: text("project_code").notNull(),
  consultantOwner: text("consultant_owner").notNull(),
  /** ISO date preferred */
  projectDate: text("project_date").notNull(),
  createdAt: text("created_at").notNull(),
});

export const assets = sqliteTable("assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("analyzed"),
  score: integer("score").notNull(),
  effort: text("effort").notNull(),
  summaryJson: text("summary_json").notNull(),
  filesJson: text("files_json").notNull().default("[]"),
  provider: text("provider"),
  model: text("model"),
  executiveSummary: text("executive_summary"),
  keyFindingsJson: text("key_findings_json").notNull().default("[]"),
  recommendationsJson: text("recommendations_json").notNull().default("[]"),
  dataProductSuggestionsJson: text("data_product_suggestions_json").notNull().default("[]"),
  issuesJson: text("issues_json").notNull(),
  migrationPathJson: text("migration_path_json").notNull(),
  /** Low | Medium | High per workstream (deterministic engine) */
  effortBreakdownJson: text("effort_breakdown_json").notNull().default("{}"),
  ganttJson: text("gantt_json").notNull().default("[]"),
  enrichedFindingsJson: text("enriched_findings_json").notNull().default("[]"),
  enrichedRecommendationsJson: text("enriched_recommendations_json").notNull().default("[]"),
  reportLocale: text("report_locale").notNull().default("de"),
  llmPrompt: text("llm_prompt"),
  llmResponse: text("llm_response"),
  llmPromptTokens: integer("llm_prompt_tokens"),
  llmCompletionTokens: integer("llm_completion_tokens"),
  llmEstimatedCostUsd: text("llm_estimated_cost_usd"),
  blueprintJson: text("blueprint_json"),
  issueTriageJson: text("issue_triage_json").notNull().default("{}"),
  scoreBreakdownJson: text("score_breakdown_json").notNull().default("[]"),
  semanticTranslationLogJson: text("semantic_translation_log_json").notNull().default("[]"),
  parserEngineVersion: text("parser_engine_version"),
  llmUnavailable: integer("llm_unavailable").notNull().default(0),
  llmAuditEncrypted: integer("llm_audit_encrypted").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const llmSettings = sqliteTable("llm_settings", {
  id: integer("id").primaryKey(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  encryptedApiKey: text("encrypted_api_key").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** Key/value app preferences */
export const appKv = sqliteTable("app_kv", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type AssetRecord = typeof assets.$inferSelect;
export type ProjectRecord = typeof projects.$inferSelect;
