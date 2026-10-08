# ⚡ SQLPulse — Universal Database Engineering & Performance Optimization Studio

<p align="center">
  <img src="https://img.shields.io/badge/Databases-447%20Engines-cyan?style=for-the-badge&logo=databricks&logoColor=white" alt="447 Engines" />
  <img src="https://img.shields.io/badge/Specialized%20Studios-25%20Studios-indigo?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="25 Studios" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-blue?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Node.js-20%2B-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Vercel-Ready-black?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel Ready" />
  <img src="https://img.shields.io/badge/License-MIT-purple?style=for-the-badge" alt="License" />
</p>

<p align="center">
  <b>SQLPulse</b> is an open-source database engineering workbench designed for software developers, Site Reliability Engineers (SREs), Database Administrators (DBAs), and backend architects. It unifies <b>25 specialized engineering studios</b> offering query plan visualization, zero-downtime migration linting, hardware configuration auto-tuning, Cloud FinOps cost modeling, and schema diagnostics across <b>447 indexed database systems</b>.
</p>

---

## 🚀 Live Demo & Deployment Targets

| Platform | Target | Role | Quick Action |
| :--- | :--- | :--- | :--- |
| **Vercel** | Frontend Web Studio (`frontend/`) | Client-side React 18 SPA with offline fallback | [Deploy with Vercel](#-deploying-frontend-to-vercel) |
| **Render / Railway** | Node.js Backend API Engine (`backend/`) | REST API engine with PostgreSQL persistence | [Deploy with Render](#-deploying-backend-api-to-render) |
| **Localhost** | Unified Single-Port (`http://localhost:4000`) | Node.js static SPA server + REST endpoints | `npm start` |

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Client["Frontend Architecture (React 18 + TypeScript + Vite)"]
        UI_Nav["Command Palette (⌘K) & Studio Switcher"]
        UI_Visualizer["Visual Execution Tree & Cost Graph"]
        UI_Studios["25 Code-Split Studios (React.lazy)"]
        UI_Theme["Light / Dark / Lavender Theme Engine"]
    end

    subgraph CoreEngine["Heuristic & Analysis Engine (Node.js 20 + Express + Zod)"]
        Dispatcher["Multi-Engine Dispatcher (447 Database Catalog)"]
        Parser["Query Plan & JSON Normalizer"]
        RuleEngine["Deterministic Rule Engines (Seq Scan, I/O Spills, N+1, Lock Hazards)"]
        Linter["Zero-Downtime DDL Lock Linter"]
        FinOps["Cloud Multi-Region Pricing Sizer (AWS, GCP, Azure)"]
        Sanitizer["PII Anonymizer & Synthetic Data Generator"]
    end

    subgraph CloudStorage["Persistence & Bounded Cache"]
        Permalinks[("PostgreSQL DB / Bounded LRU Memory Map")]
    end

    Client <-->|REST API / JSON / Client Fallback| CoreEngine
    CoreEngine <-->|Store & Retrieve Analysis Snapshots| CloudStorage
```

---

## 🔍 Database Catalog & Engine Support

SQLPulse indexes **447 database engines** across 8 paradigms. Engine analysis is structured into three tiers:

1. **Dedicated Core Analyzers**:
   - **PostgreSQL**: Full JSON/Text `EXPLAIN (ANALYZE, BUFFERS)` execution plan tree parsing, cost percentage calculation, buffer cache hit metrics, and bottleneck diagnosis.
   - **MySQL / MariaDB**: `EXPLAIN FORMAT=JSON` and tabular explain analysis with index lookup evaluation (`ALL`, `index`, `range`, `ref`, `eq_ref`, `const`).
   - **SQLite / LibSQL**: `EXPLAIN QUERY PLAN` tree analysis with coverage checks.
   - **MongoDB**: Execution stats and winning plan inspection (`COLLSCAN`, `IXSCAN`, `FETCH`, `SORT`).

2. **Paradigm Heuristic Adapters**:
   - **Key-Value / In-Memory (Redis, KeyDB, Dragonfly)**: Big-O time complexity analysis, blocking command detection (`KEYS *`, `FLUSHALL`), and memory fragmentation checks.
   - **Vector & AI Search (pgvector, Pinecone, Milvus, Qdrant, Weaviate)**: HNSW M/efConstruction parameters, IVFFlat list tuning, and hybrid search RRF advice.
   - **Graph Databases (Neo4j, Memgraph, Dgraph)**: Relationship traversal depth, Cypher label indexing, and Cartesian expansion warnings.
   - **Time-Series & Telemetry (TimescaleDB, InfluxDB, ClickHouse)**: Chunk interval sizing, continuous aggregates, and downsampling policies.
   - **Wide-Column Stores (Cassandra, ScyllaDB)**: Partition key clustering, tombstone threshold warnings, and ALLOW FILTERING detection.

3. **Catalog & Dialect Metadata**:
   - Engines outside the specialized list utilize category-level heuristics and dialect-specific connection guidance, sizing models, and syntax transpilation.

---

## 🎛️ The 25 Specialized Engineering Studios

SQLPulse organizes comprehensive database engineering capabilities into **5 core operational domains**:

```
SQLPulse Platform
├── 1. Performance & Query Diagnostics (6 Studios)
│   ├── Plan Visualizer
│   ├── Query Advisor
│   ├── SQL Rewriter
│   ├── ORM Profiler
│   ├── Slow Log Inspector
│   └── Live SQL Sandbox (Simulation Demo)
├── 2. DDL, Schema & Safe Migrations (5 Studios)
│   ├── Schema Drift Diff Studio
│   ├── Safe Migration Linter
│   ├── Partition Architect
│   ├── Polyglot Transpiler
│   └── Bloat & Vacuum Repack
├── 3. Architecture, HA & Reliability (7 Studios)
│   ├── Production Readiness Scorecard
│   ├── Chaos & Split-Brain Simulator
│   ├── Replication Topology Studio
│   ├── Hardware Config Tuner
│   ├── Deadlock Wait-For Graph
│   ├── Disaster Recovery & RPO/RTO
│   └── Sizing & PgBouncer Pooler
├── 4. Cloud FinOps & Security (4 Studios)
│   ├── Cloud FinOps Cost Sizer
│   ├── Index Doctor
│   ├── PII Sanitizer & Masker
│   └── RBAC & Row-Level Security (RLS)
└── 5. AI, Event Streaming & Polyglot Data (3 Studios)
    ├── Transactional CDC & Outbox Studio
    ├── Vector RAM & HNSW/RAG Sizer
    └── 447 Universal DBMS Matrix
```

### Studio Overview

| # | Studio Name | Operational Domain | Description |
| :---: | :--- | :--- | :--- |
| **01** | **Plan Visualizer** | Query Diagnostics | Visual execution tree graph, node cost breakdown, bottleneck alerts, I/O read vs hit ratio, and side-by-side plan diff studio. |
| **02** | **Query Advisor** | Query Diagnostics | Rule-based anti-pattern detection, compound index ESR rule suggestions, and missing index DDL generator. |
| **03** | **SQL Rewriter** | Query Diagnostics | Sargability optimizer, subquery-to-JOIN transformer, implicit type cast fixes, and `EXISTS` vs `IN` performance refactoring. |
| **04** | **ORM Profiler** | Query Diagnostics | Detects N+1 query loops, Cartesian join explosions, unbounded scans, and generates eager-loading fixes for Prisma, TypeORM, Hibernate, SQLAlchemy, and Django. |
| **05** | **Slow Log Inspector** | Query Diagnostics | Forensic log parser for Postgres and MySQL slow query logs. Aggregates P95/P99 latency clusters and culprit queries. |
| **06** | **Live SQL Sandbox** | Query Diagnostics | *Interactive simulation demo* modeling B-Tree index traversal, full table scans, buffer cache hits, and latency deltas in-browser. |
| **07** | **Schema Diff Studio** | Migrations & DDL | Computes schema drift between Dev and Live databases. Generates reversible DDL sync scripts with rollback steps. |
| **08** | **Safe Migration Linter** | Migrations & DDL | Static DDL analysis engine. Flags `EXCLUSIVE LOCK` hazards, non-concurrent index additions, blocking foreign keys, and unsafe column mutations. |
| **09** | **Partition Architect** | Migrations & DDL | Generates range, list, and hash partitioning DDL with rolling monthly partition maintenance procedures. |
| **10** | **Polyglot Transpiler** | Migrations & DDL | Dialect conversion across Postgres, MySQL, Oracle, Snowflake, BigQuery, SQLite, and MongoDB aggregation pipelines. |
| **11** | **Bloat & Vacuum Repack** | Migrations & DDL | Dead tuple bloat estimator, table & index bloat percentage calculator, autovacuum tuning presets, and `pg_repack` commands. |
| **12** | **Production Readiness** | Architecture & HA | 7-vector pre-launch SLA/SLO audit. Assesses connection pooling, statement timeouts, autovacuum, WAL archiving, and backup retention. |
| **13** | **Chaos Simulator** | Architecture & HA | State machine simulation for node crashes, network partition split-brain scenarios, connection spikes, and failover runbooks. |
| **14** | **Replication HA Studio** | Architecture & HA | Multi-region cluster topologies, synchronous vs asynchronous replication lag estimators, split-brain quorum calculation, and failover configs. |
| **15** | **Hardware Config Tuner** | Architecture & HA | Hardware parameter auto-sizing for `shared_buffers`, `effective_cache_size`, `work_mem`, `max_connections`, `maintenance_work_mem`, and `max_wal_size`. |
| **16** | **Deadlock Simulator** | Architecture & HA | Interactive Wait-For graph visualizer. Analyzes concurrent transaction lock acquisition order and mitigation strategies. |
| **17** | **Disaster Recovery (DR)** | Architecture & HA | RPO/RTO calculator, automated `pg_dump` / `pg_basebackup` scripts, Point-in-Time Recovery (PITR) guides, and S3 rotation schedules. |
| **18** | **Sizing & Pooler Studio** | Architecture & HA | Hardware capacity sizing estimator, IOPS requirement modeler, and PgBouncer / ProxySQL connection pool configuration generator. |
| **19** | **Cloud FinOps Studio** | FinOps & Security | Multi-cloud cost calculator comparing AWS RDS / Aurora vs GCP Cloud SQL / AlloyDB vs Azure Database. Identifies over-provisioned vCPU and idle IOPS. |
| **20** | **Index Doctor** | FinOps & Security | Audits database schemas for duplicate, redundant, left-prefix overlapping, and unused indexes. Emits drop statements with estimated storage reclaimed. |
| **21** | **PII Sanitizer Studio** | FinOps & Security | GDPR/HIPAA compliance masking studio. Replaces sensitive customer data (SSNs, emails, credit cards, phones) with synthetic mock data. |
| **22** | **Security & RBAC Studio** | FinOps & Security | Role-based access control (RBAC) generator, Row-Level Security (RLS) policies for multi-tenant SaaS, and SQL injection sanitization audits. |
| **23** | **CDC & Outbox Studio** | AI & Data Workloads | Transactional Outbox pattern generator, Debezium Kafka Connect configuration builder, and TypeScript idempotent consumer worker. |
| **24** | **Vector RPM & RAG Tuner**| AI & Data Workloads | HNSW and IVFFlat vector index RAM sizer for `pgvector`, Pinecone, Milvus, and Qdrant. Generates Reciprocal Rank Fusion (RRF) hybrid queries. |
| **25** | **447 DBMS Matrix** | AI & Data Workloads | Comparative reference index for all 447 database engines categorized by paradigm, ACID compliance, storage model, and query language. |

> [!NOTE]
> **Pre-Execution Notice:** Generated DDL scripts (e.g., `CREATE INDEX CONCURRENTLY`, partition schemas, and RLS security policies) should always be verified and tested in a staging environment prior to execution on production databases.

---

## ⚡ Quickstart

### Prerequisites
* **Node.js**: v18.0.0 or higher (v20+ recommended)
* **npm**: v9.0.0 or higher

### 1. Unified Single-Port Execution (Frontend + Backend on Port 4000)

```bash
# Clone the repository
git clone https://github.com/Ridwanulkarim/SQLPULSE.git
cd SQLPULSE

# Install all dependencies (Frontend + Backend)
npm run install:all

# Build both Frontend and Backend
npm run build

# Start the unified production server
npm start
```

Open your browser at **`http://localhost:4000`** — the full React UI and REST API run together seamlessly.

---

### 2. Development Mode (Independent Fast-Refresh)

```bash
# Terminal 1: Start Backend API Engine (Port 4000 with hot reload)
npm --prefix backend run dev

# Terminal 2: Start Frontend Studio (Port 5173 with Vite HMR)
npm --prefix frontend run dev
```

---

## 🚢 Deployment Guide

### 📦 Deploying Frontend to Vercel

The repository includes a root `vercel.json` configured for zero-config Vite deployments:

1. Import the repository into **[Vercel Dashboard](https://vercel.com)**.
2. Vercel automatically detects `vercel.json`:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm install && npm --prefix frontend run build`
   - **Output Directory**: `frontend/dist`
3. (Optional) If deploying with an external backend API, set the Environment Variable:
   ```env
   VITE_API_URL=https://your-sqlpulse-api.onrender.com/api/v1
   ```
4. Click **Deploy**.

---

### 🛡️ Deploying Backend API to Render

1. Create a new **Web Service** on **[Render](https://render.com)** connected to your repository.
2. Configure settings:
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
3. Configure Environment Variables:
   ```env
   PORT=4000
   NODE_ENV=production
   DATABASE_URL=postgresql://user:password@host:5432/sqlpulse_db
   CORS_ORIGIN=https://your-sqlpulse-frontend.vercel.app
   ```
4. Click **Create Web Service**.

---

## 🧪 Automated Test Suite

Run the full automated test suite using Jest:

```bash
npm test
```

Test coverage includes:
* `backend/src/api-integration.test.ts` — API endpoint integration tests using direct controller execution and mock request/response harnesses (without Supertest network dependencies), Zod schema validation, unknown engine HTTP 400 rejection, UUID permalink format checks, constant-time `timingSafeEqual` admin key verification, malformed JSON 400 error handling, pagination capping (max 50), and bounded in-memory store eviction.
* `backend/src/all-engines-catalog.test.ts` — Comprehensive 447-engine catalog verification across all 25 studios (11,175 checks), verifying engine family profile routing and asserting 0 leaks of PostgreSQL-only tokens for non-Postgres engines.
* `packages/core/src/analyzer/plan-analyzer.test.ts` — PostgreSQL sequential scan, disk sort spill, I/O buffer calculation, multi-engine category routing, and dynamic engine metadata resolution.
* `packages/core/src/analyzer/migration-linter.test.ts` — Dialect-aware DDL lock hazard rules, safe online index and DDL generation across all database families.
* `packages/core/src/analyzer/transpiler.test.ts` — Cross-engine SQL transpilation across Oracle, MSSQL, MySQL, ClickHouse, Snowflake, MongoDB, Milvus, Pinecone, and Neo4j Cypher.
* `packages/core/src/analyzer/enterprise-features.test.ts` — Multi-engine routing, FinOps pricing calculators, PII masking, bloat space reclaim, and engineering studio tests.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>⌘</kbd> + <kbd>K</kbd> / <kbd>Ctrl</kbd> + <kbd>K</kbd> | Open Spotlight Studio & Engine Command Palette |
| <kbd>Esc</kbd> | Dismiss modals and overlays |
| <kbd>Tab</kbd> | Navigate between input fields and editors |

---

## 🤝 Contributing

Contributions from database engineers, SREs, and developers worldwide are welcome!

1. Fork the repository.
2. Create your feature branch (`git checkout -b feat/new-engine-analyzer`).
3. Commit your changes (`git commit -m 'feat: Add CockroachDB distributed execution analyzer'`).
4. Push to the branch (`git push origin feat/new-engine-analyzer`).
5. Open a Pull Request.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
