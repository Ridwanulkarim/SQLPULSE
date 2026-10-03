# 🚀 SQLPulse — PostgreSQL Query Performance Analyzer & Zero-Downtime Migration Advisor

<p align="center">
  <img src="https://img.shields.io/badge/PostgreSQL-14%2B-blue?logo=postgresql&logoColor=white" alt="Postgres" />
  <img src="https://img.shields.io/badge/Node.js-20%2B-green?logo=node.js&logoColor=white" alt="Node" />
  <img src="https://img.shields.io/badge/React-18-blue?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Postman-v2.1-orange?logo=postman&logoColor=white" alt="Postman" />
  <img src="https://img.shields.io/badge/License-MIT-purple" alt="License" />
</p>

**SQLPulse** is an industry-grade database performance visualizer and DDL migration safety linter. It parses cryptic PostgreSQL `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` execution plans into interactive visual execution trees, identifies severe I/O bottlenecks and sequential scans, and generates copyable, zero-downtime SQL index recommendations.

---

## 🏗️ Architecture & Data Flow

```mermaid
flowchart TD
    subgraph Client["Frontend (React 18 + TypeScript / Vercel)"]
        Monaco["Plan & Query Input"]
        Metrics["Performance Score & Buffer Gauge"]
        TreeGraph["Interactive Execution Tree & Node Inspector"]
        LinterUI["Zero-Downtime DDL Linter"]
    end

    subgraph Backend["API & Heuristic Engine (Node.js/Express + TS / Render)"]
        Parser["Postgres Plan Normalizer"]
        RuleEngine["Heuristic Analyzer (Seq Scan, I/O Spikes, Spill Sorts)"]
        DDLLinter["DDL Lock Hazard Detector"]
    end

    subgraph Storage["PostgreSQL (Render)"]
        ReportsDB[("Analysis Reports & Permalinks (JSONB)")]
    end

    Monaco -->|Postgres JSON Plan| Parser
    Parser --> RuleEngine
    RuleEngine --> Metrics
    RuleEngine --> TreeGraph
    LinterUI <-->|Raw DDL Script| DDLLinter
    Backend <-->|Save / Share Analysis via UUID| ReportsDB
```

---

## ✨ Core Features & Heuristics

### 1. 🔍 Automated Bottleneck Detection
* **High-Impact Sequential Scans:** Detects when PostgreSQL scans unindexed tables and discards thousands of rows via filter predicates.
* **WorkMem Disk Sort Spills:** Flags sort operations that exceed `work_mem` and spill temporary blocks to disk.
* **Planner Estimation Drift:** Identifies stale query planner statistics where `Plan Rows` diverges significantly from `Actual Rows` (suggests `ANALYZE`).
* **Heavy Disk I/O Reads:** Measures `Shared Hit Blocks` (RAM cache) vs `Shared Read Blocks` (Physical disk) to compute cache hit ratios.

### 2. 🛡️ Zero-Downtime DDL Migration Linter
* **Non-concurrent Index Creation:** Flags `CREATE INDEX` taking `SHARE` locks, automatically proposing `CREATE INDEX CONCURRENTLY`.
* **Blocking Foreign Keys:** Flags `ADD CONSTRAINT ... FOREIGN KEY` without `NOT VALID`.
* **Unsafe Column Alterations:** Flags `ADD COLUMN ... NOT NULL` on populated tables without defaults.

### 3. 📊 Interactive Execution Tree & Deep Inspector
* Node-level breakdown of **cost percentage**, **actual time percentage**, and **buffer hit/read metrics**.
* Color-coded severity indicators (`CRITICAL`, `WARNING`, `INFO`, `OPTIMAL`).

### 4. 🔗 Shareable Analysis Permalinks
* Save any query plan and generate unique permalinks to collaborate with database administrators and team members.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 18, TypeScript, Tailwind CSS, Lucide Icons | Responsive modern UI & execution tree |
| **Backend** | Node.js, Express, TypeScript, Zod | Heuristic analysis engine & DDL AST linter |
| **Database** | PostgreSQL on Render (with JSONB support) | Persisting analysis reports & metrics |
| **Deployment** | Vercel (Frontend) + Render (Backend & DB) | Production-ready cloud hosting |
| **Testing** | Jest, Postman Collection v2.1 | Automated API test assertions |

---

## 🚦 Single-Server Quickstart

You can run both Frontend and Backend together on a **single port (4000)** with one command:

```bash
# 1. Build Frontend & Backend
npm run build

# 2. Start Unified Server
npm start
```

🎉 Open your browser at **`http://localhost:4000`** — both the React Web UI and the API backend run together seamlessly from this single URL!

---

## 🧪 Postman API Collection

A complete Postman Collection v2.1 with automated test assertions is included in `backend/sqlpulse_postman_collection.json`.

### Endpoints:
* `GET /health` — Service health check
* `POST /api/v1/analyze/plan` — Analyzes raw Postgres JSON execution plans
* `POST /api/v1/analyze/migration` — Lints DDL migrations for lock hazards
* `POST /api/v1/reports` — Generates a shareable permalink report
* `GET /api/v1/reports/:id` — Fetches a saved analysis report

---

## 🚀 Deployment Instructions

### Deploy Frontend to Vercel
1. Set Root Directory to `frontend`.
2. Configure Environment Variable:
   ```env
   VITE_API_URL=https://your-sqlpulse-api.onrender.com/api/v1
   ```

### Deploy Backend to Render
1. Create a new **Web Service** pointing to the `backend` directory.
2. Build Command: `npm install && npm run build`
3. Start Command: `npm start`
4. Set Environment Variables:
   ```env
   PORT=4000
   NODE_ENV=production
   DATABASE_URL=postgresql://user:password@hostname:5432/sqlpulse_db
   ```

---

## 📄 License
MIT License. Created for high-performance engineering portfolios.
