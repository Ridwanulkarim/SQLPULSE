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
  <b>SQLPulse</b> is the universal, open-source database engineering workbench designed for high-velocity software teams, Site Reliability Engineers (SREs), Database Administrators (DBAs), and backend architects. It unifies <b>25 specialized engineering studios</b> and provides native performance profiling, zero-downtime migrations, Cloud FinOps cost modeling, and lock-free execution across <b>447 relational, NoSQL, Vector AI, Time-Series, and Graph database engines</b>.
</p>

---

## 🚀 Live Demo & 1-Click Deployments

| Platform | Deployment Target | Status | Quick Action |
| :--- | :--- | :--- | :--- |
| **Vercel** | Frontend Web Studio (`frontend/`) | ![Vercel](https://img.shields.io/badge/Vercel-Deploy-black?logo=vercel) | [Deploy with Vercel](#-deploying-frontend-to-vercel) |
| **Render / Railway** | Node.js Backend API Engine (`backend/`) | ![Render](https://img.shields.io/badge/Render-API%20Engine-46E3B7?logo=render) | [Deploy with Render](#-deploying-backend-api-to-render) |
| **Localhost** | Unified Single-Port (`http://localhost:4000`) | ![Localhost](https://img.shields.io/badge/Unified-Port%204000-blue) | `npm start` |

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Client["Frontend Architecture (React 18 + TypeScript + Vite)"]
        UI_Nav["Command Palette (⌘K) & Studio Switcher"]
        UI_Visualizer["Visual Execution Tree & Cost Graph"]
        UI_Studios["25 Enterprise Engineering Studios"]
        UI_Theme["Zero-Latency Light / Dark Theme Engine"]
    end

    subgraph CoreEngine["Heuristic & Analysis Engine (Node.js 20 + Express + TypeScript)"]
        Dispatcher["Universal Multi-Engine Dispatcher (447 DBMS)"]
        Parser["Query Plan & AST Normalizer"]
        RuleEngine["Heuristic Rule Engines (Seq Scan, I/O Spills, N+1, Lock Hazards)"]
        Linter["Zero-Downtime DDL Lock Linter"]
        FinOps["Cloud Multi-Region Pricing Sizer (AWS, GCP, Azure)"]
        Sanitizer["PII Anonymization & Synthetic Data Generator"]
    end

    subgraph CloudStorage["Persistence & Collaboration"]
        Permalinks[("Reports & Permalinks Storage (JSONB / PostgreSQL)")]
    end

    Client <-->|REST API / JSON / WebSockets| CoreEngine
    CoreEngine <-->|Store & Retrieve Analysis Snapshots| CloudStorage
```

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
│   └── Live SQL Sandbox
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

### Studio Feature Matrix

| # | Studio Name | Operational Domain | Key Capabilities |
| :---: | :--- | :--- | :--- |
| **01** | **Plan Visualizer** | Query Diagnostics | Visual execution tree graph, node cost breakdown, bottleneck alerts, I/O read vs hit ratio, and side-by-side regression diff studio. |
| **02** | **Query Advisor** | Query Diagnostics | AI anti-pattern analysis, compound index ESR rule suggestions, and missing index DDL generator with zero-downtime safety. |
| **03** | **SQL Rewriter** | Query Diagnostics | 10x–100x sargability optimizer, subquery-to-JOIN transformer, implicit type cast fixes, and `EXISTS` vs `IN` performance refactoring. |
| **04** | **ORM Profiler** | Query Diagnostics | Detects N+1 query loops, Cartesian join explosions, unbounded query scans, and generates optimized eager-loading fixes for Prisma, TypeORM, Hibernate, SQLAlchemy, and Django. |
| **05** | **Slow Log Inspector** | Query Diagnostics | Forensic log parser for Postgres, MySQL slow queries, and MongoDB profiler logs. Aggregates P95/P99 latency clusters and culprit queries. |
| **06** | **Live SQL Sandbox** | Query Diagnostics | In-browser query sandbox with live execution latency measurement, synthetic row generation, and real-time execution benchmarking. |
| **07** | **Schema Diff Studio** | Migrations & DDL | Computes online schema drift between Dev and Live databases. Generates zero-downtime, reversible DDL sync scripts with rollback plans. |
| **08** | **Safe Migration Linter** | Migrations & DDL | Static DDL analysis engine. Flags `EXCLUSIVE LOCK` hazards, non-concurrent index additions, blocking foreign keys, and unsafe column mutations. |
| **09** | **Partition Architect** | Migrations & DDL | Auto-generates range, list, and hash partitioning DDL with rolling monthly partition maintenance procedures and partition pruning validation. |
| **10** | **Polyglot Transpiler** | Migrations & DDL | Instant dialect conversion across Postgres, MySQL, Oracle, Snowflake, BigQuery, SQLite, and MongoDB aggregation pipelines. |
| **11** | **Bloat & Vacuum Repack** | Migrations & DDL | Dead tuple bloat estimator, table & index bloat percentage calculator, autovacuum aggressive tuning presets, and `pg_repack` zero-lock DDL commands. |
| **12** | **Production Readiness** | Architecture & HA | 7-vector pre-launch SLA/SLO audit (Grade A+ to F). Assesses connection pooling, statement timeouts, autovacuum, WAL archiving, backup retention, and generates 1-click hardening configs. |
| **13** | **Chaos Simulator** | Architecture & HA | State machine simulation for node crashes, network partition split-brain scenarios, connection starvation spikes, and step-by-step failover runbooks. |
| **14** | **Replication HA Studio** | Architecture & HA | Multi-region cluster topologies, synchronous vs asynchronous replication lag estimators, split-brain quorum calculation, and automated failover config generators. |
| **15** | **Hardware Config Tuner** | Architecture & HA | Mathematical hardware parameter auto-sizing for `shared_buffers`, `effective_cache_size`, `work_mem`, `max_connections`, `maintenance_work_mem`, and `max_wal_size`. |
| **16** | **Deadlock Simulator** | Architecture & HA | Interactive Wait-For graph visualizer. Analyzes concurrent transaction lock acquisition order and generates lock escalation mitigation strategies. |
| **17** | **Disaster Recovery (DR)** | Architecture & HA | RPO/RTO calculator, automated `pg_dump` / `pg_basebackup` / WAL archiving bash scripts, Point-in-Time Recovery (PITR) instructions, and AWS S3 offsite rotation schedules. |
| **18** | **Sizing & Pooler Studio** | Architecture & HA | Hardware capacity sizing estimator, IOPS requirement modeler, and PgBouncer / ProxySQL connection pool configuration generator. |
| **19** | **Cloud FinOps Studio** | FinOps & Security | Multi-cloud cost calculator comparing AWS RDS / Aurora vs GCP Cloud SQL / AlloyDB vs Azure Database. Identifies over-provisioned vCPU, idle storage, and provisioned IOPS savings. |
| **20** | **Index Doctor** | FinOps & Security | Audits database schemas for duplicate, redundant, left-prefix overlapping, and unused indexes. Emits drop statements with estimated storage reclaimed. |
| **21** | **PII Sanitizer Studio** | FinOps & Security | GDPR/HIPAA compliance masking studio. Replaces sensitive customer data (SSNs, emails, credit cards, phones) with cryptographically realistic synthetic mock data for staging. |
| **22** | **Security & RBAC Studio** | FinOps & Security | Least-privilege role-based access control (RBAC) generator, Row-Level Security (RLS) policies for multi-tenant SaaS, and SQL injection sanitization audits. |
| **23** | **CDC & Outbox Studio** | AI & Data Workloads | Zero-loss Transactional Outbox pattern generator, Debezium Kafka Connect configuration builder, and TypeScript idempotent consumer worker with retry and dead-letter queues. |
| **24** | **Vector RPM & RAG Tuner**| AI & Data Workloads | HNSW and IVFFlat vector index RAM sizer for `pgvector`, Pinecone, Milvus, and Qdrant. Generates Reciprocal Rank Fusion (RRF) hybrid dense+sparse BM25 queries. |
| **25** | **447 DBMS Matrix** | AI & Data Workloads | Complete comparative reference index for all 447 database engines categorized by paradigm, ACID compliance, storage model, and query language. |

---

## 🌐 447 Supported Database Engines

SQLPulse features an exhaustive dictionary and specialized dispatchers for **447 database engines** spanning 8 paradigms:

* **Relational SQL (140+ engines):** PostgreSQL, MySQL, MariaDB, SQLite, Oracle, Microsoft SQL Server, CockroachDB, TiDB, YugabyteDB, DuckDB, Amazon Aurora, Google AlloyDB, Azure Cosmos SQL, Percona Server, SingleStore, etc.
* **Vector & AI Databases (35+ engines):** pgvector, Pinecone, Milvus, Qdrant, Weaviate, ChromaDB, Vespa, Marqo, Deep Lake, LanceDB, Vald, etc.
* **NoSQL Document & Key-Value (80+ engines):** MongoDB, DynamoDB, Couchbase, Redis, KeyDB, Dragonfly, Cassandra, ScyllaDB, Apache HBase, CouchDB, RavenDB, etc.
* **Time-Series & Telemetry (40+ engines):** TimescaleDB, InfluxDB, Prometheus, QuestDB, VictoriaMetrics, ClickHouse, Kdb+, TDengine, etc.
* **Graph & Knowledge Graphs (30+ engines):** Neo4j, Memgraph, Amazon Neptune, Dgraph, ArangoDB, NebulaGraph, JanusGraph, TigerGraph, etc.
* **Cloud Data Warehouses & Columnar OLAP (50+ engines):** Snowflake, Google BigQuery, Amazon Redshift, ClickHouse, Databricks Lakehouse, Apache Pinot, Apache Druid, StarRocks, etc.
* **Embedded & Edge Databases (40+ engines):** SQLite, LibSQL/Turso, DuckDB, LMDB, RocksDB, LevelDB, PouchDB, etc.
* **Spatial, Multi-Model & Search Engines (32+ engines):** PostGIS, Elasticsearch, OpenSearch, Meilisearch, Apache Solr, Typesense, etc.

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
# Terminal 1: Start Backend API Engine (Port 4000 with nodemon)
npm --prefix backend run dev

# Terminal 2: Start Frontend Studio (Port 5173 with Vite HMR)
npm --prefix frontend run dev
```

---

## 🚢 Deployment Guide

### 📦 Deploying Frontend to Vercel

The repository includes a root `vercel.json` configured for zero-config Vite deployments:

1. Import the repository into **[Vercel Dashboard](https://vercel.com)**.
2. If deploying the root repository, Vercel will automatically detect `vercel.json`:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm --prefix frontend install && npm --prefix frontend run build`
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

## 🧪 Postman Collection & Automated API Tests

A production-ready **Postman Collection v2.1** with pre-configured request payloads and automated test assertions is included in [`backend/sqlpulse_postman_collection.json`](file:///Users/apple/.gemini/antigravity/scratch/sqlpulse/backend/sqlpulse_postman_collection.json).

### Running Automated Test Suite

```bash
npm --prefix backend test
```

Test coverage includes:
* `plan-analyzer.test.ts` — PostgreSQL sequential scan, disk sort spill, and I/O buffer calculation tests.
* `migration-linter.test.ts` — DDL lock hazard rules, table locks, and unsafe column mutations.
* `enterprise-features.test.ts` — MySQL, MongoDB, SQLite, FinOps, PII masking, and multi-engine routing tests.

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
