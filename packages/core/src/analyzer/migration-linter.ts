import { MigrationAnalysisResult, MigrationSafetyCheck, DatabaseEngine } from '../types/plan.types';
import { getEngineMetadata } from '../types/db-catalog.data';

export class MigrationLinter {
  
  public lint(sqlScript: string, engine: DatabaseEngine = 'postgres'): MigrationAnalysisResult {
    const metadata = getEngineMetadata(engine);
    const category = metadata.category || 'relational';
    const statements = this.splitStatements(sqlScript);
    const findings: MigrationSafetyCheck[] = [];

    for (const stmt of statements) {
      const cleanStmt = this.stripComments(stmt).trim();
      if (!cleanStmt) continue;

      if (category === 'relational') {
        if (engine === 'mysql' || engine === 'mariadb' || engine === 'planetscale' || engine === 'percona') {
          this.checkMySQLDDL(cleanStmt, findings);
        } else if (engine === 'sqlite' || engine === 'turso' || engine === 'spatialite') {
          this.checkSQLiteDDL(cleanStmt, findings);
        } else if (engine === 'mssql' || engine === 'sqlserver') {
          this.checkMSSQLDDL(cleanStmt, findings);
        } else if (engine === 'oracle') {
          this.checkOracleDDL(cleanStmt, findings);
        } else {
          this.checkPostgresDDL(cleanStmt, findings);
        }
      }
      // 2. Analytics & OLAP Engines
      else if (category === 'olap') {
        this.checkOLAPDDL(cleanStmt, findings, metadata.name);
      }
      // 3. Document / NoSQL
      else if (category === 'document') {
        this.checkDocumentDDL(cleanStmt, findings, metadata.name);
      }
      // 4. Key-Value & In-Memory
      else if (category === 'keyvalue') {
        this.checkKeyValueDDL(cleanStmt, findings, metadata.name);
      }
      // 5. Vector AI & Search
      else if (category === 'vector' || category === 'search') {
        this.checkVectorSearchDDL(cleanStmt, findings, metadata.name);
      }
      // 6. Graph Databases
      else if (category === 'graph') {
        this.checkGraphDDL(cleanStmt, findings, metadata.name);
      }
      // 7. Time-Series
      else if (category === 'timeseries') {
        this.checkTimeSeriesDDL(cleanStmt, findings, metadata.name);
      }
      // 8. Wide-Column
      else if (category === 'wide_column') {
        this.checkWideColumnDDL(cleanStmt, findings, metadata.name);
      }
      // 9. BaaS & Embedded
      else if (category === 'baas_embedded') {
        this.checkBaaSEmbeddedDDL(cleanStmt, findings, metadata.name);
      }
      // 10. Spatial & Streaming / Ledgers
      else {
        this.checkGenericCategoryDDL(cleanStmt, findings, metadata.name);
      }
    }

    let riskScore = 100;
    for (const f of findings) {
      if (f.severity === 'CRITICAL') riskScore -= 35;
      else if (f.severity === 'WARNING') riskScore -= 15;
      else if (f.severity === 'INFO') riskScore -= 5;
    }
    riskScore = Math.max(0, Math.min(100, riskScore));

    return {
      engine,
      isSafeForProduction: findings.filter((f) => f.severity === 'CRITICAL').length === 0,
      totalStatements: Math.max(1, statements.length),
      riskScore,
      findings,
    };
  }

  private stripComments(sql: string): string {
    return sql
      .split('\n')
      .map((line) => line.replace(/--.*$/, ''))
      .join('\n')
      .trim();
  }

  private splitStatements(sqlScript: string): string[] {
    return sqlScript
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && this.stripComments(s).length > 0);
  }

  private checkPostgresDDL(stmt: string, findings: MigrationSafetyCheck[]) {
    if (/^CREATE\s+(UNIQUE\s+)?INDEX\s+/i.test(stmt) && !/CONCURRENTLY/i.test(stmt)) {
      const safeSql = stmt.replace(/CREATE\s+(UNIQUE\s+)?INDEX/i, (m) =>
        m.includes('UNIQUE') ? 'CREATE UNIQUE INDEX CONCURRENTLY' : 'CREATE INDEX CONCURRENTLY'
      );
      findings.push({
        id: `pg_idx_${Math.random().toString(36).substring(2, 7)}`,
        severity: 'CRITICAL',
        title: 'PostgreSQL: Non-concurrent Index Creation',
        reason: 'Takes a SHARE lock blocking all concurrent INSERT, UPDATE, and DELETE operations.',
        unsafeSql: stmt,
        safeAlternativeSql: `${safeSql};\n-- Run outside transaction block.`,
        lockLevel: 'SHARE LOCK (Blocks Writes)',
      });
    }

    if (/ALTER\s+TABLE\s+([a-zA-Z0-9_]+)\s+ADD\s+CONSTRAINT\s+([a-zA-Z0-9_]+)\s+FOREIGN\s+KEY/i.test(stmt) && !/NOT\s+VALID/i.test(stmt)) {
      findings.push({
        id: `pg_fk_${Math.random().toString(36).substring(2, 7)}`,
        severity: 'CRITICAL',
        title: 'PostgreSQL: Blocking Foreign Key Validation',
        reason: 'Performs a full table scan of both tables under SHARE ROW EXCLUSIVE lock, blocking writes.',
        unsafeSql: stmt,
        safeAlternativeSql: `${stmt} NOT VALID;\n-- Then validate asynchronously:\nALTER TABLE ... VALIDATE CONSTRAINT ...;`,
        lockLevel: 'SHARE ROW EXCLUSIVE',
      });
    }

    if (/ALTER\s+TABLE\s+([a-zA-Z0-9_]+)\s+ADD\s+COLUMN\s+([a-zA-Z0-9_]+).*\s+NOT\s+NULL/i.test(stmt) && !/DEFAULT/i.test(stmt)) {
      findings.push({
        id: `pg_not_null_${Math.random().toString(36).substring(2, 7)}`,
        severity: 'CRITICAL',
        title: 'PostgreSQL: Adding NOT NULL Column without Default',
        reason: 'Fails immediately on populated tables and holds ACCESS EXCLUSIVE lock.',
        unsafeSql: stmt,
        safeAlternativeSql: `-- Step 1: Add column as nullable\n${stmt.replace(/\s+NOT\s+NULL/i, '')};\n-- Step 2: Backfill data\n-- Step 3: Add CHECK constraint (NOT VALID)`,
        lockLevel: 'ACCESS EXCLUSIVE',
      });
    }

    if (/ALTER\s+TABLE\s+([a-zA-Z0-9_]+)\s+ALTER\s+COLUMN\s+([a-zA-Z0-9_]+)\s+TYPE/i.test(stmt)) {
      findings.push({
        id: `pg_alter_type_${Math.random().toString(36).substring(2, 7)}`,
        severity: 'CRITICAL',
        title: 'PostgreSQL: Column Type Alteration (Full Table Rewrite)',
        reason: 'Rewrites every page of the table on disk holding an ACCESS EXCLUSIVE lock.',
        unsafeSql: stmt,
        safeAlternativeSql: `-- Use Expand & Contract:\n-- 1. ADD COLUMN new_col TYPE\n-- 2. Dual-write via trigger/app\n-- 3. Backfill\n-- 4. Swap names`,
        lockLevel: 'ACCESS EXCLUSIVE (Table Rewrite)',
      });
    }

    if (/^(DROP\s+TABLE|TRUNCATE)/i.test(stmt)) {
      findings.push({
        id: `pg_drop_${Math.random().toString(36).substring(2, 7)}`,
        severity: 'CRITICAL',
        title: 'Destructive DDL Operation',
        reason: 'Dropping or truncating tables destroys data and takes exclusive locks.',
        unsafeSql: stmt,
        safeAlternativeSql: `-- Rename table first to verify zero active consumers:\nALTER TABLE table_name RENAME TO table_name_deprecated;`,
        lockLevel: 'ACCESS EXCLUSIVE',
      });
    }
  }

  private checkMySQLDDL(stmt: string, findings: MigrationSafetyCheck[]) {
    if ((/^CREATE\s+(UNIQUE\s+)?INDEX/i.test(stmt) || /ALTER\s+TABLE\s+([a-zA-Z0-9_]+)\s+ADD\s+INDEX/i.test(stmt)) && !/ALGORITHM/i.test(stmt)) {
      findings.push({
        id: `mysql_idx_${Math.random().toString(36).substring(2, 7)}`,
        severity: 'CRITICAL',
        title: 'MySQL / InnoDB: Missing ALGORITHM=INPLACE, LOCK=NONE',
        reason: 'Risks falling back to legacy COPY algorithm, copying table and blocking concurrent writes.',
        unsafeSql: stmt,
        safeAlternativeSql: `${stmt.replace(';', '')}, ALGORITHM=INPLACE, LOCK=NONE;`,
        lockLevel: 'METADATA LOCK (Table Copy Risk)',
      });
    }

    if (/ALTER\s+TABLE\s+([a-zA-Z0-9_]+)\s+MODIFY\s+COLUMN\s+([a-zA-Z0-9_]+).*(LONGTEXT|LONGBLOB|TEXT)/i.test(stmt)) {
      findings.push({
        id: `mysql_blob_${Math.random().toString(36).substring(2, 7)}`,
        severity: 'CRITICAL',
        title: 'MySQL: Column Type Expansion Rebuild',
        reason: 'Altering column types to LONGTEXT requires a full table rebuild in MySQL InnoDB.',
        unsafeSql: stmt,
        safeAlternativeSql: `-- Use gh-ost or pt-online-schema-change:\n-- pt-online-schema-change --alter "MODIFY COLUMN col LONGTEXT" D=db,t=tbl --execute`,
        lockLevel: 'EXCLUSIVE METADATA LOCK',
      });
    }
  }

  private checkSQLiteDDL(stmt: string, findings: MigrationSafetyCheck[]) {
    if (/ALTER\s+TABLE\s+([a-zA-Z0-9_]+)\s+(DROP\s+COLUMN|ALTER\s+COLUMN|ADD\s+CONSTRAINT)/i.test(stmt)) {
      findings.push({
        id: `sqlite_rebuild_${Math.random().toString(36).substring(2, 7)}`,
        severity: 'WARNING',
        title: 'SQLite / Turso: Schema Rebuild Required',
        reason: 'SQLite does not support direct column drops or constraint additions. Requires 12-step table rebuild pattern.',
        unsafeSql: stmt,
        safeAlternativeSql: `PRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;\nCREATE TABLE new_tbl (...);\nINSERT INTO new_tbl SELECT ... FROM old_tbl;\nDROP TABLE old_tbl;\nALTER TABLE new_tbl RENAME TO old_tbl;\nCOMMIT;\nPRAGMA foreign_keys=ON;`,
        lockLevel: 'EXCLUSIVE DB LOCK',
      });
    }
  }

  private checkMSSQLDDL(stmt: string, findings: MigrationSafetyCheck[]) {
    if (/CREATE\s+(UNIQUE\s+)?(CLUSTERED|NONCLUSTERED\s+)?INDEX/i.test(stmt) && !/ONLINE\s*=\s*ON/i.test(stmt)) {
      findings.push({
        id: `mssql_idx_${Math.random().toString(36).substring(2, 7)}`,
        severity: 'CRITICAL',
        title: 'SQL Server: Missing WITH (ONLINE = ON)',
        reason: 'Creating index without ONLINE = ON takes a Schema Modification (Sch-M) lock blocking all user queries.',
        unsafeSql: stmt,
        safeAlternativeSql: `${stmt} WITH (ONLINE = ON (WAIT_AT_LOW_PRIORITY (MAX_DURATION = 1 MINUTES, AFTER_WAIT_PHASE = BLOCKERS)), RESUMABLE = ON);`,
        lockLevel: 'SCH-M (Schema Modification Lock)',
      });
    }
  }

  private checkOracleDDL(stmt: string, findings: MigrationSafetyCheck[]) {
    if (/CREATE\s+INDEX/i.test(stmt) && !/ONLINE/i.test(stmt)) {
      findings.push({
        id: `oracle_idx_${Math.random().toString(36).substring(2, 7)}`,
        severity: 'CRITICAL',
        title: 'Oracle Database: Missing ONLINE Clause',
        reason: 'Creating an index in Oracle without ONLINE locks the table against DML.',
        unsafeSql: stmt,
        safeAlternativeSql: `${stmt} ONLINE;`,
        lockLevel: 'DDL EXCLUSIVE LOCK',
      });
    }
  }

  private checkOLAPDDL(stmt: string, findings: MigrationSafetyCheck[], engineName: string) {
    if (/ALTER\s+TABLE\s+([a-zA-Z0-9_]+)\s+(UPDATE|DELETE)/i.test(stmt)) {
      findings.push({
        id: `olap_mutation_${Math.random().toString(36).substring(2, 7)}`,
        severity: 'CRITICAL',
        title: `${engineName}: Heavy Asynchronous Mutation Detected`,
        reason: 'In OLAP engines (ClickHouse/Snowflake), mutations rewrite all data parts on disk, consuming extreme background I/O and CPU.',
        unsafeSql: stmt,
        safeAlternativeSql: `-- Instead of direct ALTER UPDATE, use Partition Swapping or CollapsingMergeTree / ReplacingMergeTree engines.`,
        lockLevel: 'ASYNC DATA PART REWRITE',
      });
    }

    if (/CLUSTER\s+BY|ORDER\s+BY/i.test(stmt) && /ALTER\s+TABLE/i.test(stmt)) {
      findings.push({
        id: `olap_recluster_${Math.random().toString(36).substring(2, 7)}`,
        severity: 'WARNING',
        title: `${engineName}: Table Re-clustering / Sorting Key Mutation`,
        reason: 'Modifying clustering keys triggers full micro-partition reclustering across warehouse compute.',
        unsafeSql: stmt,
        safeAlternativeSql: `-- Schedule automatic background clustering or create a CTAS (Create Table As Select) with the new ordering key.`,
        lockLevel: 'BACKGROUND RE-CLUSTERING',
      });
    }
  }

  private checkDocumentDDL(stmt: string, findings: MigrationSafetyCheck[], engineName: string) {
    if (/createIndex/i.test(stmt) && !/background/i.test(stmt)) {
      findings.push({
        id: `doc_index_${Math.random().toString(36).substring(2, 7)}`,
        severity: 'CRITICAL',
        title: `${engineName}: Foreground Index Creation Hazard`,
        reason: 'Foreground index build blocks all reads and writes on the database collection until completion.',
        unsafeSql: stmt,
        safeAlternativeSql: `// Build index as rolling build on secondary replicas or with background option:\ndb.collection.createIndex({ field: 1 }, { background: true });`,
        lockLevel: 'COLLECTION WRITE LOCK',
      });
    }

    if (/dropIndex|drop/i.test(stmt)) {
      findings.push({
        id: `doc_drop_${Math.random().toString(36).substring(2, 7)}`,
        severity: 'WARNING',
        title: `${engineName}: Drop Index / Collection Operation`,
        reason: 'Dropping index immediately terminates running queries utilizing this index.',
        unsafeSql: stmt,
        safeAlternativeSql: `// First hide the index in MongoDB 4.4+ to verify query plan stability:\ndb.collection.hideIndex("index_name");`,
        lockLevel: 'METADATA LOCK',
      });
    }
  }

  private checkKeyValueDDL(stmt: string, findings: MigrationSafetyCheck[], engineName: string) {
    if (/KEYS\s+\*|FLUSHALL|FLUSHDB/i.test(stmt)) {
      findings.push({
        id: `kv_keys_${Math.random().toString(36).substring(2, 7)}`,
        severity: 'CRITICAL',
        title: `${engineName}: Single-Thread Blocking Command Detected`,
        reason: 'Executing KEYS * or synchronous FLUSHDB locks the single-threaded event loop, blocking all API requests and causing timeout outages.',
        unsafeSql: stmt,
        safeAlternativeSql: `// Use non-blocking cursor iteration:\nSCAN 0 MATCH pattern:* COUNT 100\n// For flushing:\nFLUSHDB ASYNC;`,
        lockLevel: 'EVENT LOOP HARD LOCK',
      });
    }
  }

  private checkVectorSearchDDL(stmt: string, findings: MigrationSafetyCheck[], engineName: string) {
    if (/reindex|_mapping|create_index/i.test(stmt)) {
      findings.push({
        id: `vec_reindex_${Math.random().toString(36).substring(2, 7)}`,
        severity: 'WARNING',
        title: `${engineName}: Vector Graph Re-indexing / Mapping Update`,
        reason: 'Building HNSW graphs or search inverted indexes is CPU and RAM intensive. Reindexing in-place creates latency spikes.',
        unsafeSql: stmt,
        safeAlternativeSql: `// Use Zero-Downtime Index Alias Swapping Pattern:\n// 1. Create index_v2\n// 2. Ingest/Reindex vectors to index_v2\n// 3. Atomically point alias 'prod_search' -> 'index_v2'`,
        lockLevel: 'INDEX BUILD I/O LOAD',
      });
    }
  }

  private checkGraphDDL(stmt: string, findings: MigrationSafetyCheck[], engineName: string) {
    if (/CREATE\s+CONSTRAINT/i.test(stmt)) {
      findings.push({
        id: `graph_constraint_${Math.random().toString(36).substring(2, 7)}`,
        severity: 'WARNING',
        title: `${engineName}: Graph Schema Constraint Build`,
        reason: 'Validating uniqueness across millions of graph nodes scans the entire node store.',
        unsafeSql: stmt,
        safeAlternativeSql: `CREATE CONSTRAINT constraint_name IF NOT EXISTS FOR (n:Label) REQUIRE n.prop IS UNIQUE;`,
        lockLevel: 'LABEL SCAN LOCK',
      });
    }
  }

  private checkTimeSeriesDDL(stmt: string, findings: MigrationSafetyCheck[], engineName: string) {
    if (/DROP\s+RETENTION|compress_chunk/i.test(stmt)) {
      findings.push({
        id: `ts_retention_${Math.random().toString(36).substring(2, 7)}`,
        severity: 'WARNING',
        title: `${engineName}: Time-Series Retention / Compression Mutation`,
        reason: 'Dropping retention policies or compressing active chunks locks hypertable metadata.',
        unsafeSql: stmt,
        safeAlternativeSql: `-- Ensure compression policy runs off-peak:\nSELECT add_compression_policy('hypertable_name', INTERVAL '7 days');`,
        lockLevel: 'CHUNK EXCLUSIVE LOCK',
      });
    }
  }

  private checkWideColumnDDL(stmt: string, findings: MigrationSafetyCheck[], engineName: string) {
    if (/ALTER\s+TABLE\s+([a-zA-Z0-9_]+)\s+DROP/i.test(stmt)) {
      findings.push({
        id: `cql_drop_${Math.random().toString(36).substring(2, 7)}`,
        severity: 'CRITICAL',
        title: `${engineName}: Column Drop Tombstone Generation Hazard`,
        reason: 'Dropping columns in Cassandra/Scylla generates tombstones and can cause read latency spikes until full compaction.',
        unsafeSql: stmt,
        safeAlternativeSql: `-- Instead of dropping column, stop writing to it in application code and allow TTL/compaction to reclaim.`,
        lockLevel: 'SSTABLE TOMBSTONE CHURN',
      });
    }
  }

  private checkBaaSEmbeddedDDL(stmt: string, findings: MigrationSafetyCheck[], engineName: string) {
    if (/DROP|ALTER/i.test(stmt)) {
      findings.push({
        id: `baas_alter_${Math.random().toString(36).substring(2, 7)}`,
        severity: 'INFO',
        title: `${engineName}: Schema Migration Synchronization`,
        reason: 'Schema modifications trigger client cache invalidations and real-time subscription resets.',
        unsafeSql: stmt,
        safeAlternativeSql: `-- Perform schema migration in a test branch before promoting to production environment.`,
        lockLevel: 'REALTIME SYNC LOCK',
      });
    }
  }

  private checkGenericCategoryDDL(stmt: string, findings: MigrationSafetyCheck[], engineName: string) {
    if (/DROP|TRUNCATE/i.test(stmt)) {
      findings.push({
        id: `generic_drop_${Math.random().toString(36).substring(2, 7)}`,
        severity: 'CRITICAL',
        title: `${engineName}: Destructive DDL Hazard`,
        reason: 'Destructive DDL removes data and blocks concurrent connections.',
        unsafeSql: stmt,
        safeAlternativeSql: `-- Verify with backup before proceeding.`,
        lockLevel: 'EXCLUSIVE LOCK',
      });
    }
  }
}
