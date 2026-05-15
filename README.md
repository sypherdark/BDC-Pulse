# BDC Pulse — SAC to SAP Business Data Cloud Migration Accelerator

**Built for SAP Analytics Consultants & Startups**

BDC Pulse is a consultant-grade, locally runnable web application that accelerates **SAP Analytics Cloud (SAC) → SAP Business Data Cloud (BDC)** and **SAP Datasphere** migration engagements. Upload SAC export JSON, receive a **deterministic Migration Readiness Score**, a **semantic translation log**, and **client-ready deliverables** — without depending on an LLM for core analysis.

---

## Why SAP consultants use BDC Pulse

| Challenge | How BDC Pulse helps |
|-----------|---------------------|
| Slow, inconsistent SAC assessments | Versioned parser + rule engine — same export → same score, every time |
| SAC semantics lost in migration workshops | Semantic translation log maps SAC patterns → recommended BDC/Datasphere artifacts |
| Stakeholders need executive-ready output | Premium PDF report + **Export for Consulting** ZIP (PDF, pillars, blueprints, README) |
| Solution architects need a starting blueprint | Data product generator: fact/dimension views, hierarchies, associations, Datasphere JSON |
| LLM outages or data residency concerns | Full rule-based path; LLM is optional polish only |

---

## Key features

- **Deterministic readiness scoring** — Five weighted pillars (Semantic 25%, Calculation 25%, Planning 20%, Performance 15%, Governance 15%)
- **Advanced SAC semantic parser** — 20+ pattern types, complexity tiering, per-file scans
- **Semantic translation log** — Auditable SAC → BDC mappings with justification and recommendations
- **Export for Consulting** — One ZIP: executive PDF, translation log, score pillars, data product blueprint, client README
- **SAC asset import** — Drag & drop JSON/ZIP (25 MB JSON / 100 MB ZIP limits) with ingest summary
- **BDC / Datasphere data product generator** — Architecture view + exportable blueprint JSON
- **Portfolio & projects** — Multi-client tracking, history, CSV export
- **Optional LLM narrative** — OpenAI, Anthropic, Grok, or Gemini when configured; graceful degradation if unavailable

---

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo SAC files

Use samples in `demo/`:

- `demo/sac_story_sample.json`
- `demo/sac_model_sample.json`
- `demo/sac_planning_model_sample.json`

### Typical workflow

1. **Projects** — Create a client engagement.
2. **Import & analyze** — Upload SAC exports; review readiness score and pillars.
3. **Export for Consulting** — Download the ZIP for workshops and client handoff.
4. **Data product generator** — Refine and export Datasphere-oriented blueprints.

---

## Deployment

### Docker

```bash
docker compose build
docker compose up -d
```

Stop:

```bash
docker compose down
```

### Production build

```bash
npm run build
npm start
```

---

## API endpoints (selected)

| Endpoint | Description |
|----------|-------------|
| `POST /api/import/analyze` | Parse SAC files, score, persist asset |
| `POST /api/import/preview` | Parse-only preview + ingest report |
| `GET /api/assets/:id/report` | Executive PDF (`?rulesOnly=1` for rules-only variant) |
| `GET /api/assets/:id/export-consulting` | Full consulting deliverable ZIP |
| `POST /api/assets/:id/generate` | Generate / refresh data product blueprint |

---

## Stack

- Next.js 15 App Router · TypeScript · Tailwind CSS
- SQLite + Drizzle ORM (local-first; swap for Postgres in enterprise deployments)
- pdf-lib · Recharts · adm-zip

---

## Configuration

- **Settings** — Company name, logo (base64 PNG/JPEG), confidentiality footer, default locale
- **LLM (optional)** — Provider, model, API key for narrative enrichment
- Database file: `bdc-pulse.sqlite` (auto-created on first run)

---

## For startups in the SAP ecosystem

BDC Pulse is designed as an **accelerator**, not a replacement for SAP implementation methodology. Use it to win assessments faster, standardize deliverable quality across engagements, and give technical teams a repeatable starting point for BDC solution design — then validate everything in customer workshops and against official SAP documentation.

---

## Deutsch (Kurz)

BDC Pulse beschleunigt SAC-zu-BDC-Migrationsprojekte mit deterministischem Readiness-Scoring, Semantic Translation Log und professionellen Beratungs-Exports — lokal betreibbar, LLM optional.

```bash
npm install && npm run dev
```
