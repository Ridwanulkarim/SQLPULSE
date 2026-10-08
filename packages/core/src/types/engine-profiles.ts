import { DATABASE_CATALOG, getEngineMetadata } from './db-catalog.data';
import {
  EngineProfile,
  EngineFamily,
  EngineDialect,
  StudioId,
  StudioCapability,
} from './engine-profile';

// Canonical list of all 25 studio IDs
export const ALL_STUDIO_IDS: StudioId[] = [
  'plan',
  'migration',
  'query-advise',
  'transpile',
  'config-tuner',
  'deadlock-simulate',
  'disaster-recovery',
  'synthesize-query',
  'connect-hub',
  'partition-plan',
  'inspect-logs',
  'bloat',
  'replication',
  'security-rbac',
  'mock-data',
  'finops',
  'index-doctor',
  'pii-sanitizer',
  'query-rewriter',
  'schema-diff',
  'orm-profile',
  'production-readiness',
  'chaos-simulate',
  'cdc-outbox',
  'vector-tune',
];

// Well-known aliases mapped to canonical catalog IDs
export const ENGINE_ALIASES: Record<string, string> = {
  postgres: 'postgresql',
  aurora: 'amazon_aurora',
  aurora_postgres: 'amazon_aurora',
  timescale: 'timescaledb',
  yugabyte: 'yugabytedb',
  mssql: 'microsoft_sql_server',
  sqlserver: 'microsoft_sql_server',
  sql_server: 'microsoft_sql_server',
  dynamodb: 'amazon_dynamodb',
  cassandra: 'apache_cassandra',
  hbase: 'apache_hbase',
  scylla: 'scylladb',
  bigquery: 'google_bigquery',
  redshift: 'amazon_redshift',
  neon: 'postgresql',
  alloydb: 'postgresql',
};

// Set of all recognized engine IDs and aliases
const VALID_ENGINE_SET = new Set<string>();
for (const item of DATABASE_CATALOG) {
  VALID_ENGINE_SET.add(item.id.toLowerCase());
  VALID_ENGINE_SET.add(item.name.toLowerCase());
}
for (const alias of Object.keys(ENGINE_ALIASES)) {
  VALID_ENGINE_SET.add(alias.toLowerCase());
}

export function isValidEngine(engineId?: string): boolean {
  if (!engineId || typeof engineId !== 'string') return false;
  const norm = engineId.toLowerCase().trim();
  return VALID_ENGINE_SET.has(norm);
}

export function resolveCanonicalEngineId(engineId?: string): string {
  if (!engineId) return 'postgresql';
  const norm = engineId.toLowerCase().trim();
  if (ENGINE_ALIASES[norm]) return ENGINE_ALIASES[norm];
  const item = DATABASE_CATALOG.find((d) => d.id === norm || d.name.toLowerCase() === norm);
  if (item) return item.id;
  return norm;
}

// Check if engine is in PostgreSQL family
export function isPostgresFamilyEngine(engineId?: string): boolean {
  if (!engineId) return true;
  const norm = engineId.toLowerCase().trim();
  const canonical = resolveCanonicalEngineId(norm);

  const pgIds = new Set([
    'postgresql',
    'postgres',
    'timescaledb',
    'greenplum',
    'cockroachdb',
    'yugabytedb',
    'citus',
    'edb_postgres',
    'alibaba_cloud_analyticdb_for_postgresql',
    'postgres_xl',
    'fujitsu_enterprise_postgres',
    'supabase',
    'amazon_aurora', // Aurora PostgreSQL variant
    'neon',
    'alloydb',
    'postgis',
  ]);

  if (pgIds.has(canonical) || pgIds.has(norm)) return true;
  return norm.includes('postgres') || norm.includes('postgis');
}

// Helper to build full capability records
function createCapabilities(
  overrides: Partial<Record<StudioId, StudioCapability>> = {},
  defaultCap: StudioCapability = 'adapted'
): Record<StudioId, StudioCapability> {
  const caps = {} as Record<StudioId, StudioCapability>;
  for (const id of ALL_STUDIO_IDS) {
    caps[id] = overrides[id] ?? defaultCap;
  }
  return caps;
}

// -------------------------------------------------------------
// Base Prototype Profiles
// -------------------------------------------------------------

const POSTGRES_FAMILY_BASE: Omit<EngineProfile, 'engineId' | 'name' | 'description'> = {
  family: 'postgresql',
  dialect: 'postgresql',
  isPostgresFamily: true,
  capabilities: createCapabilities({
    plan: 'native',
    migration: 'native',
    'query-advise': 'native',
    transpile: 'native',
    'config-tuner': 'native',
    'deadlock-simulate': 'native',
    'disaster-recovery': 'native',
    'synthesize-query': 'native',
    'connect-hub': 'native',
    'partition-plan': 'native',
    'inspect-logs': 'native',
    bloat: 'native',
    replication: 'native',
    'security-rbac': 'native',
    'mock-data': 'native',
    finops: 'native',
    'index-doctor': 'native',
    'pii-sanitizer': 'native',
    'query-rewriter': 'native',
    'schema-diff': 'native',
    'orm-profile': 'native',
    'production-readiness': 'native',
    'chaos-simulate': 'native',
    'cdc-outbox': 'native',
    'vector-tune': 'native',
  }, 'native'),
  memoryParams: {
    sharedBufferParam: 'shared_buffers',
    workMemParam: 'work_mem',
    cacheParam: 'effective_cache_size',
    configFile: 'postgresql.conf',
  },
  maintenance: {
    statsCommand: 'ANALYZE {table};',
    spaceReclaimCommand: 'VACUUM (ANALYZE, VERBOSE) {table};',
    spaceReclaimConcept: 'VACUUM & Autovacuum Dead Tuple Reclaim',
    tuningDdlTemplate: (table, sizeGb = 100) =>
      `-- PostgreSQL Autovacuum Optimization for ${table} (${sizeGb} GB)\n` +
      `ALTER TABLE ${table} SET (\n` +
      `  autovacuum_vacuum_scale_factor = 0.05,\n` +
      `  autovacuum_vacuum_threshold = 500,\n` +
      `  autovacuum_vacuum_cost_limit = 2000,\n` +
      `  autovacuum_vacuum_cost_delay = 2\n` +
      `);`,
  },
  planCommand: 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) <QUERY>;',
  onlineDdl: {
    createIndexSql: (idx, tbl, cols) => `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${idx} ON ${tbl}(${cols});`,
    dropIndexSql: (idx) => `DROP INDEX CONCURRENTLY IF EXISTS ${idx};`,
    rollbackDropIndexSql: (idx, tbl, cols) => `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${idx} ON ${tbl}(${cols});`,
    supportsConcurrent: true,
    onlineClause: 'CONCURRENTLY',
  },
  systemViews: {
    slowQueries: 'pg_stat_statements',
    activeSessions: 'pg_stat_activity',
    locks: 'pg_locks',
  },
  backup: {
    tool: 'pgBackRest / pg_basebackup',
    walOrLogName: 'Write-Ahead Log (WAL)',
    commandTemplate: (db, path) => `pgbackrest --stanza=${db} backup --type=full --repo1-path=${path}`,
  },
  replication: {
    mechanism: 'Physical Streaming Replication (walreceiver / walsender)',
    failoverManager: 'Patroni with DCS (etcd/Consul)',
    syncReplicaConfig: "synchronous_commit = 'on'\nsynchronous_standby_names = 'FIRST 1 (node2, node3)'",
  },
  syntax: {
    identityColumn: 'BIGINT GENERATED ALWAYS AS IDENTITY',
    rowLimit: (n, offset = 0) => (offset > 0 ? `LIMIT ${n} OFFSET ${offset}` : `LIMIT ${n}`),
    jsonType: 'JSONB',
    quoteIdentifier: (id) => `"${id}"`,
  },
  auth: {
    model: 'Role-Based Access Control (RBAC) with Row-Level Security (RLS)',
    createUserSql: (user) => `CREATE ROLE ${user} WITH LOGIN PASSWORD 'CHANGE_ME_IN_VAULT';`,
    grantPermissionsSql: (user, tbl) => `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ${tbl} TO ${user};`,
  },
  vector: {
    guidance: 'pgvector extension with HNSW or IVFFlat index',
    supportedIndexTypes: ['HNSW', 'IVFFlat'],
    sampleIndexDdl: (idx, tbl, col, dim) =>
      `CREATE EXTENSION IF NOT EXISTS vector;\n` +
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${idx} ON ${tbl} USING hnsw (${col} vector_cosine_ops) WITH (m = 16, ef_construction = 64);`,
  },
  connection: {
    scheme: 'postgresql://',
    defaultPort: 5432,
    sampleUri: 'postgresql://app_user:password@db-host.internal:5432/production_db?sslmode=verify-full',
  },
  ormAdvice: {
    batchSizeRecommendation: 1000,
    bulkInsertSyntax: 'INSERT INTO {table} ({cols}) VALUES ... ON CONFLICT DO UPDATE',
    connectionPoolingGuidance: 'Use PgBouncer in transaction pooling mode (port 6432) with keepalives enabled.',
  },
};

const MYSQL_FAMILY_BASE: Omit<EngineProfile, 'engineId' | 'name' | 'description'> = {
  family: 'mysql',
  dialect: 'mysql',
  isPostgresFamily: false,
  capabilities: createCapabilities({
    plan: 'native',
    migration: 'native',
    'query-advise': 'native',
    transpile: 'native',
    'config-tuner': 'native',
    'deadlock-simulate': 'native',
    'disaster-recovery': 'native',
    'synthesize-query': 'native',
    'connect-hub': 'native',
    'partition-plan': 'native',
    'inspect-logs': 'native',
    bloat: 'native',
    replication: 'native',
    'security-rbac': 'native',
    'mock-data': 'native',
    finops: 'native',
    'index-doctor': 'native',
    'pii-sanitizer': 'native',
    'query-rewriter': 'native',
    'schema-diff': 'native',
    'orm-profile': 'native',
    'production-readiness': 'native',
    'chaos-simulate': 'native',
    'cdc-outbox': 'native',
    'vector-tune': 'adapted',
  }),
  memoryParams: {
    sharedBufferParam: 'innodb_buffer_pool_size',
    workMemParam: 'sort_buffer_size',
    cacheParam: 'innodb_buffer_pool_instances',
    configFile: 'my.cnf',
  },
  maintenance: {
    statsCommand: 'ANALYZE TABLE {table};',
    spaceReclaimCommand: 'OPTIMIZE TABLE {table};',
    spaceReclaimConcept: 'InnoDB Clustered Index Rebuild & Defragmentation',
    tuningDdlTemplate: (table) =>
      `-- MySQL InnoDB Storage Maintenance for ${table}\n` +
      `ALTER TABLE ${table} ENGINE=InnoDB, ALGORITHM=INPLACE, LOCK=NONE;\n` +
      `ANALYZE TABLE ${table};`,
  },
  planCommand: 'EXPLAIN FORMAT=JSON <QUERY>;',
  onlineDdl: {
    createIndexSql: (idx, tbl, cols) => `ALTER TABLE ${tbl} ADD INDEX ${idx} (${cols}), ALGORITHM=INPLACE, LOCK=NONE;`,
    dropIndexSql: (idx, tbl = '{table}') => `ALTER TABLE ${tbl} DROP INDEX ${idx}, ALGORITHM=INPLACE, LOCK=NONE;`,
    rollbackDropIndexSql: (idx, tbl, cols) => `ALTER TABLE ${tbl} ADD INDEX ${idx} (${cols}), ALGORITHM=INPLACE, LOCK=NONE;`,
    supportsConcurrent: false,
    onlineClause: 'ALGORITHM=INPLACE, LOCK=NONE',
  },
  systemViews: {
    slowQueries: 'performance_schema.events_statements_summary_by_digest',
    activeSessions: 'information_schema.processlist',
    locks: 'sys.innodb_lock_waits',
  },
  backup: {
    tool: 'Percona XtraBackup / mysqldump',
    walOrLogName: 'Binary Log (binlog) & InnoDB Redo Log',
    commandTemplate: (db, path) => `xtrabackup --backup --target-dir=${path} --databases=${db}`,
  },
  replication: {
    mechanism: 'GTID-based Group Replication / Semi-Synchronous Replication',
    failoverManager: 'MySQL Orchestrator / ProxySQL',
    syncReplicaConfig: "rpl_semi_sync_master_enabled = 1\nrpl_semi_sync_master_timeout = 2000",
  },
  syntax: {
    identityColumn: 'BIGINT AUTO_INCREMENT PRIMARY KEY',
    rowLimit: (n, offset = 0) => (offset > 0 ? `LIMIT ${offset}, ${n}` : `LIMIT ${n}`),
    jsonType: 'JSON',
    quoteIdentifier: (id) => `\`${id}\``,
  },
  auth: {
    model: 'Grant Table Privilege Model (User @ Host with SSL)',
    createUserSql: (user) => `CREATE USER '${user}'@'%' IDENTIFIED BY 'CHANGE_ME_IN_VAULT' REQUIRE SSL;`,
    grantPermissionsSql: (user, tbl) => `GRANT SELECT, INSERT, UPDATE, DELETE ON ${tbl} TO '${user}'@'%';`,
  },
  vector: {
    guidance: 'MySQL 9.0+ VECTOR type with VECTOR_DISTANCE or TiDB vector search',
    supportedIndexTypes: ['FLAT', 'HNSW'],
    sampleIndexDdl: (idx, tbl, col) =>
      `-- MySQL Vector Indexing\nALTER TABLE ${tbl} ADD VECTOR INDEX ${idx} (${col});`,
  },
  connection: {
    scheme: 'mysql://',
    defaultPort: 3306,
    sampleUri: 'mysql://app_user:password@db-host.internal:3306/production_db?ssl-mode=REQUIRED',
  },
  ormAdvice: {
    batchSizeRecommendation: 500,
    bulkInsertSyntax: 'INSERT INTO {table} ({cols}) VALUES ... ON DUPLICATE KEY UPDATE',
    connectionPoolingGuidance: 'Configure HikariCP or ProxySQL with maxLifetime < wait_timeout (e.g. 30 minutes).',
  },
};

const ORACLE_BASE: Omit<EngineProfile, 'engineId' | 'name' | 'description'> = {
  family: 'oracle',
  dialect: 'oracle',
  isPostgresFamily: false,
  capabilities: createCapabilities({
    plan: 'native',
    migration: 'native',
    'query-advise': 'native',
    transpile: 'native',
    'config-tuner': 'native',
    'deadlock-simulate': 'native',
    'disaster-recovery': 'native',
    'synthesize-query': 'native',
    'connect-hub': 'native',
    'partition-plan': 'native',
    'inspect-logs': 'native',
    bloat: 'native',
    replication: 'native',
    'security-rbac': 'native',
    'mock-data': 'native',
    finops: 'native',
    'index-doctor': 'native',
    'pii-sanitizer': 'native',
    'query-rewriter': 'native',
    'schema-diff': 'native',
    'orm-profile': 'native',
    'production-readiness': 'native',
    'chaos-simulate': 'native',
    'cdc-outbox': 'native',
    'vector-tune': 'native',
  }),
  memoryParams: {
    sharedBufferParam: 'SGA_TARGET',
    workMemParam: 'PGA_AGGREGATE_TARGET',
    cacheParam: 'DB_CACHE_SIZE',
    configFile: 'spfile / init.ora',
  },
  maintenance: {
    statsCommand: "BEGIN DBMS_STATS.GATHER_TABLE_STATS(ownname => USER, tabname => '{table}', estimate_percent => DBMS_STATS.AUTO_SAMPLE_SIZE, cascade => TRUE); END;",
    spaceReclaimCommand: 'ALTER TABLE {table} ENABLE ROW MOVEMENT; ALTER TABLE {table} SHRINK SPACE CASCADE;',
    spaceReclaimConcept: 'Segment Advisor & Online Table Shrink Space',
    tuningDdlTemplate: (table) =>
      `-- Oracle Segment Space Shrink & Statistics Refresh\n` +
      `ALTER TABLE ${table} ENABLE ROW MOVEMENT;\n` +
      `ALTER TABLE ${table} SHRINK SPACE COMPACT;\n` +
      `ALTER TABLE ${table} SHRINK SPACE CASCADE;\n` +
      `BEGIN\n` +
      `  DBMS_STATS.GATHER_TABLE_STATS(ownname => USER, tabname => '${table}', cascade => TRUE);\n` +
      `END;\n/`,
  },
  planCommand: 'EXPLAIN PLAN FOR <QUERY>; SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);',
  onlineDdl: {
    createIndexSql: (idx, tbl, cols) => `CREATE INDEX ${idx} ON ${tbl}(${cols}) ONLINE;`,
    dropIndexSql: (idx) => `DROP INDEX ${idx};`,
    rollbackDropIndexSql: (idx, tbl, cols) => `CREATE INDEX ${idx} ON ${tbl}(${cols}) ONLINE;`,
    supportsConcurrent: false,
    onlineClause: 'ONLINE',
  },
  systemViews: {
    slowQueries: 'V$SQL / V$SQLAREA (AWR DBA_HIST_SQLSTAT)',
    activeSessions: 'V$SESSION',
    locks: 'V$LOCKED_OBJECT / DBA_BLOCKERS',
  },
  backup: {
    tool: 'Oracle Recovery Manager (RMAN) / Data Pump (expdp)',
    walOrLogName: 'Archived Redo Logs',
    commandTemplate: (db, path) => `rman target / cmdfile="BACKUP DATABASE PLUS ARCHIVELOG FORMAT '${path}/%U.bkp';"`,
  },
  replication: {
    mechanism: 'Oracle Data Guard / Active Data Guard / Oracle GoldenGate',
    failoverManager: 'Data Guard Fast-Start Failover (FSFO)',
    syncReplicaConfig: "ALTER SYSTEM SET LOG_ARCHIVE_DEST_2='SERVICE=standby_db ASYNC VALID_FOR=(ONLINE_LOGFILES,PRIMARY_ROLE) DB_UNIQUE_NAME=standby_db';",
  },
  syntax: {
    identityColumn: 'NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY',
    rowLimit: (n, offset = 0) => (offset > 0 ? `OFFSET ${offset} ROWS FETCH NEXT ${n} ROWS ONLY` : `FETCH FIRST ${n} ROWS ONLY`),
    jsonType: 'JSON',
    quoteIdentifier: (id) => `"${id.toUpperCase()}"`,
  },
  auth: {
    model: 'Enterprise User Profiles & Virtual Private Database (VPD)',
    createUserSql: (user) => `CREATE USER ${user} IDENTIFIED BY "CHANGE_ME_IN_VAULT" DEFAULT TABLESPACE USERS QUOTA UNLIMITED ON USERS;`,
    grantPermissionsSql: (user, tbl) => `GRANT SELECT, INSERT, UPDATE, DELETE ON ${tbl} TO ${user};`,
  },
  vector: {
    guidance: 'Oracle AI Vector Search (VECTOR data type with HNSW/IVF index)',
    supportedIndexTypes: ['HNSW', 'IVF'],
    sampleIndexDdl: (idx, tbl, col, dim) =>
      `-- Oracle AI Vector Search Index\n` +
      `CREATE VECTOR INDEX ${idx} ON ${tbl}(${col}) ORGANIZATION INMEMORY NEIGHBOR GRAPH DISTANCE COSINE WITH TARGET ACCURACY 95;`,
  },
  connection: {
    scheme: 'oracle://',
    defaultPort: 1521,
    sampleUri: 'oracle://app_user:password@db-host.internal:1521/ORCLPDB1',
  },
  ormAdvice: {
    batchSizeRecommendation: 200,
    bulkInsertSyntax: 'MERGE INTO {table} USING ... ON ... WHEN MATCHED THEN UPDATE WHEN NOT MATCHED THEN INSERT',
    connectionPoolingGuidance: 'Use Universal Connection Pool (UCP) with Fast Connection Failover (FCF) enabled.',
  },
};

const SQL_SERVER_BASE: Omit<EngineProfile, 'engineId' | 'name' | 'description'> = {
  family: 'sqlserver',
  dialect: 'sqlserver',
  isPostgresFamily: false,
  capabilities: createCapabilities({
    plan: 'native',
    migration: 'native',
    'query-advise': 'native',
    transpile: 'native',
    'config-tuner': 'native',
    'deadlock-simulate': 'native',
    'disaster-recovery': 'native',
    'synthesize-query': 'native',
    'connect-hub': 'native',
    'partition-plan': 'native',
    'inspect-logs': 'native',
    bloat: 'native',
    replication: 'native',
    'security-rbac': 'native',
    'mock-data': 'native',
    finops: 'native',
    'index-doctor': 'native',
    'pii-sanitizer': 'native',
    'query-rewriter': 'native',
    'schema-diff': 'native',
    'orm-profile': 'native',
    'production-readiness': 'native',
    'chaos-simulate': 'native',
    'cdc-outbox': 'native',
    'vector-tune': 'adapted',
  }),
  memoryParams: {
    sharedBufferParam: 'max server memory (MB)',
    workMemParam: 'min server memory (MB)',
    cacheParam: 'cost threshold for parallelism',
    configFile: 'sp_configure',
  },
  maintenance: {
    statsCommand: 'UPDATE STATISTICS {table} WITH FULLSCAN;',
    spaceReclaimCommand: 'ALTER INDEX ALL ON {table} REBUILD WITH (ONLINE = ON);',
    spaceReclaimConcept: 'Index Defragmentation, Reorganize & Online Rebuild',
    tuningDdlTemplate: (table) =>
      `-- SQL Server Index Maintenance & Statistics Refresh\n` +
      `ALTER INDEX ALL ON ${table} REORGANIZE;\n` +
      `UPDATE STATISTICS ${table} WITH FULLSCAN;\n` +
      `GO`,
  },
  planCommand: 'SET SHOWPLAN_XML ON; <QUERY>;',
  onlineDdl: {
    createIndexSql: (idx, tbl, cols) => `CREATE NONCLUSTERED INDEX ${idx} ON ${tbl}(${cols}) WITH (ONLINE = ON);`,
    dropIndexSql: (idx, tbl = '{table}') => `DROP INDEX ${idx} ON ${tbl} WITH (ONLINE = ON);`,
    rollbackDropIndexSql: (idx, tbl, cols) => `CREATE NONCLUSTERED INDEX ${idx} ON ${tbl}(${cols}) WITH (ONLINE = ON);`,
    supportsConcurrent: false,
    onlineClause: 'WITH (ONLINE = ON)',
  },
  systemViews: {
    slowQueries: 'sys.dm_exec_query_stats (sys.dm_exec_sql_text)',
    activeSessions: 'sys.dm_exec_requests',
    locks: 'sys.dm_tran_locks',
  },
  backup: {
    tool: 'SQL Server Native BACKUP / Azure Blob Backup',
    walOrLogName: 'Transaction Log (LDF)',
    commandTemplate: (db, path) => `BACKUP DATABASE [${db}] TO DISK = N'${path}' WITH COMPRESSION, CHECKSUM, STATS = 10;`,
  },
  replication: {
    mechanism: 'Always On Availability Groups (AG) / Transactional Replication',
    failoverManager: 'Windows Server Failover Cluster (WSFC) / Pacemaker',
    syncReplicaConfig: "ALTER AVAILABILITY GROUP [AG1] MODIFY REPLICA ON N'NODE2' WITH (AVAILABILITY_MODE = SYNCHRONOUS_COMMIT, FAILOVER_MODE = AUTOMATIC);",
  },
  syntax: {
    identityColumn: 'BIGINT IDENTITY(1,1) PRIMARY KEY',
    rowLimit: (n, offset = 0) => (offset > 0 ? `OFFSET ${offset} ROWS FETCH NEXT ${n} ROWS ONLY` : `SELECT TOP (${n})`),
    jsonType: 'NVARCHAR(MAX)',
    quoteIdentifier: (id) => `[${id}]`,
  },
  auth: {
    model: 'SQL Logins, Database Users, and Database Roles',
    createUserSql: (user) => `CREATE LOGIN [${user}] WITH PASSWORD = 'CHANGE_ME_IN_VAULT';\nCREATE USER [${user}] FOR LOGIN [${user}];`,
    grantPermissionsSql: (user, tbl) => `GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::[${tbl}] TO [${user}];`,
  },
  vector: {
    guidance: 'SQL Server DiskANN Vector Search / VECTOR data type (2025 preview) or native vector functions',
    supportedIndexTypes: ['DiskANN', 'FLAT'],
    sampleIndexDdl: (idx, tbl, col) =>
      `-- SQL Server Vector Index\nCREATE VECTOR INDEX ${idx} ON ${tbl}(${col});`,
  },
  connection: {
    scheme: 'sqlserver://',
    defaultPort: 1433,
    sampleUri: 'sqlserver://db-host.internal:1433;databaseName=production_db;user=app_user;password=secret;encrypt=true;trustServerCertificate=false',
  },
  ormAdvice: {
    batchSizeRecommendation: 500,
    bulkInsertSyntax: 'MERGE INTO {table} WITH (HOLDLOCK) AS target USING ... ON ... WHEN MATCHED THEN UPDATE WHEN NOT MATCHED THEN INSERT;',
    connectionPoolingGuidance: 'Use Microsoft SqlClient Connection Pooling with Encrypt=Mandatory and MultipleActiveResultSets=false.',
  },
};

const DB2_BASE: Omit<EngineProfile, 'engineId' | 'name' | 'description'> = {
  family: 'db2',
  dialect: 'db2',
  isPostgresFamily: false,
  capabilities: createCapabilities({
    plan: 'native',
    migration: 'native',
    'query-advise': 'native',
    transpile: 'native',
    'config-tuner': 'native',
    'deadlock-simulate': 'native',
    'disaster-recovery': 'native',
    'synthesize-query': 'native',
    'connect-hub': 'native',
    'partition-plan': 'native',
    'inspect-logs': 'native',
    bloat: 'native',
    replication: 'native',
    'security-rbac': 'native',
    'mock-data': 'native',
    finops: 'native',
    'index-doctor': 'native',
    'pii-sanitizer': 'native',
    'query-rewriter': 'native',
    'schema-diff': 'native',
    'orm-profile': 'native',
    'production-readiness': 'native',
    'chaos-simulate': 'native',
    'cdc-outbox': 'native',
    'vector-tune': 'adapted',
  }),
  memoryParams: {
    sharedBufferParam: 'INSTANCE_MEMORY',
    workMemParam: 'SORTHEAP',
    cacheParam: 'DATABASE_MEMORY',
    configFile: 'db2 get/update db cfg',
  },
  maintenance: {
    statsCommand: 'RUNSTATS ON TABLE {table} WITH DISTRIBUTION AND DETAILED INDEXES ALL;',
    spaceReclaimCommand: 'REORG TABLE {table};',
    spaceReclaimConcept: 'Offline / Online Table & Index Reorganization (REORG)',
    tuningDdlTemplate: (table) =>
      `-- IBM DB2 Table Reorganization and Statistics Collection\n` +
      `CALL SYSPROC.ADMIN_CMD('REORG TABLE ${table}');\n` +
      `CALL SYSPROC.ADMIN_CMD('RUNSTATS ON TABLE ${table} WITH DISTRIBUTION AND DETAILED INDEXES ALL');`,
  },
  planCommand: 'EXPLAIN ALL FOR <QUERY>; db2exfmt -d <DB> -e <SCHEMA> -w -1 -o explain.out',
  onlineDdl: {
    createIndexSql: (idx, tbl, cols) => `CREATE INDEX ${idx} ON ${tbl}(${cols});`,
    dropIndexSql: (idx) => `DROP INDEX ${idx};`,
    rollbackDropIndexSql: (idx, tbl, cols) => `CREATE INDEX ${idx} ON ${tbl}(${cols});`,
    supportsConcurrent: false,
    onlineClause: 'ONLINE',
  },
  systemViews: {
    slowQueries: 'SYSIBMADM.MON_GET_PKG_CACHE_STMT',
    activeSessions: 'SYSIBMADM.MON_CURRENT_SQL',
    locks: 'SYSIBMADM.MON_GET_LOCKS',
  },
  backup: {
    tool: 'IBM DB2 Native BACKUP / HADR',
    walOrLogName: 'Active and Archived Transaction Logs',
    commandTemplate: (db, path) => `db2 BACKUP DATABASE ${db} ONLINE TO ${path} WITH 4 BUFFERS BUFFER 1024 PARALLELISM 2 COMPRESS;`,
  },
  replication: {
    mechanism: 'High Availability Disaster Recovery (HADR) / Q Replication',
    failoverManager: 'Tivoli System Automation (TSA) / Pacemaker',
    syncReplicaConfig: "UPDATE DB CFG FOR db USING HADR_SYNCMODE NEARSYNC;",
  },
  syntax: {
    identityColumn: 'BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY',
    rowLimit: (n) => `FETCH FIRST ${n} ROWS ONLY`,
    jsonType: 'BLOB / JSON_TABLE',
    quoteIdentifier: (id) => `"${id.toUpperCase()}"`,
  },
  auth: {
    model: 'DB2 Authorities, Privileges, and Label-Based Access Control (LBAC)',
    createUserSql: (user) => `-- DB2 manages users at OS/LDAP level; grant schema authorization:\nGRANT CONNECT ON DATABASE TO USER ${user};`,
    grantPermissionsSql: (user, tbl) => `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ${tbl} TO USER ${user};`,
  },
  vector: {
    guidance: 'IBM DB2 external vector store connector or in-database extension',
    supportedIndexTypes: ['FLAT'],
  },
  connection: {
    scheme: 'db2://',
    defaultPort: 50000,
    sampleUri: 'db2://app_user:password@db-host.internal:50000/SAMPLE_DB',
  },
  ormAdvice: {
    batchSizeRecommendation: 250,
    bulkInsertSyntax: 'INSERT INTO {table} ({cols}) VALUES ...',
    connectionPoolingGuidance: 'Configure IBM Data Server Driver with connection pooling and affinity failover list.',
  },
};

const SAP_HANA_BASE: Omit<EngineProfile, 'engineId' | 'name' | 'description'> = {
  family: 'sap_hana',
  dialect: 'hana',
  isPostgresFamily: false,
  capabilities: createCapabilities({
    plan: 'native',
    migration: 'native',
    'query-advise': 'native',
    transpile: 'native',
    'config-tuner': 'native',
    'deadlock-simulate': 'native',
    'disaster-recovery': 'native',
    'synthesize-query': 'native',
    'connect-hub': 'native',
    'partition-plan': 'native',
    'inspect-logs': 'native',
    bloat: 'native',
    replication: 'native',
    'security-rbac': 'native',
    'mock-data': 'native',
    finops: 'native',
    'index-doctor': 'native',
    'pii-sanitizer': 'native',
    'query-rewriter': 'native',
    'schema-diff': 'native',
    'orm-profile': 'native',
    'production-readiness': 'native',
    'chaos-simulate': 'native',
    'cdc-outbox': 'native',
    'vector-tune': 'native',
  }),
  memoryParams: {
    sharedBufferParam: 'global_allocation_limit',
    workMemParam: 'statement_memory_limit',
    cacheParam: 'table_unload_policy',
    configFile: 'global.ini',
  },
  maintenance: {
    statsCommand: 'CREATE STATISTICS ON {table}; REFRESH STATISTICS ON {table};',
    spaceReclaimCommand: 'ALTER TABLE {table} MERGE DELTA INDEX;',
    spaceReclaimConcept: 'Column Store In-Memory Delta Merge & Optimization',
    tuningDdlTemplate: (table) =>
      `-- SAP HANA Column Store Delta Merge and Statistics Refresh\n` +
      `ALTER TABLE ${table} MERGE DELTA INDEX;\n` +
      `REFRESH STATISTICS ON ${table};`,
  },
  planCommand: 'EXPLAIN PLAN FOR <QUERY>; SELECT * FROM EXPLAIN_PLAN_TABLE;',
  onlineDdl: {
    createIndexSql: (idx, tbl, cols) => `CREATE INDEX ${idx} ON ${tbl}(${cols}) ONLINE;`,
    dropIndexSql: (idx) => `DROP INDEX ${idx};`,
    rollbackDropIndexSql: (idx, tbl, cols) => `CREATE INDEX ${idx} ON ${tbl}(${cols}) ONLINE;`,
    supportsConcurrent: false,
    onlineClause: 'ONLINE',
  },
  systemViews: {
    slowQueries: 'M_EXPENSIVE_STATEMENTS / M_SQL_PLAN_CACHE',
    activeSessions: 'M_CONNECTIONS',
    locks: 'M_BLOCKED_TRANSACTIONS',
  },
  backup: {
    tool: 'SAP HANA Studio / hdbsql BACKUP DATA',
    walOrLogName: 'HANA Redo Log Segments',
    commandTemplate: (db, path) => `BACKUP DATA FOR ${db} USING FILE ('${path}/hana_full') ASYNCHRONOUS;`,
  },
  replication: {
    mechanism: 'HANA System Replication (HSR)',
    failoverManager: 'Host Auto-Failover / SUSE Linux Enterprise HA Cluster',
    syncReplicaConfig: "hdbnsutil -sr_enable --name=PRIMARY_SITE\nhdbnsutil -sr_register --remoteHost=host1 --remoteInstance=00 --replicationMode=sync --operationMode=logreplay",
  },
  syntax: {
    identityColumn: 'BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY',
    rowLimit: (n, offset = 0) => (offset > 0 ? `LIMIT ${n} OFFSET ${offset}` : `LIMIT ${n}`),
    jsonType: 'DOCSTORE JSON',
    quoteIdentifier: (id) => `"${id.toUpperCase()}"`,
  },
  auth: {
    model: 'SAP HANA Roles, Analytic Privileges, and Structured Privileges',
    createUserSql: (user) => `CREATE USER ${user} PASSWORD "CHANGE_ME_IN_VAULT" NO FORCE_FIRST_PASSWORD_CHANGE;`,
    grantPermissionsSql: (user, tbl) => `GRANT SELECT, INSERT, UPDATE, DELETE ON ${tbl} TO ${user};`,
  },
  vector: {
    guidance: 'SAP HANA Vector Engine (REAL_VECTOR data type with COSINE_SIMILARITY)',
    supportedIndexTypes: ['HNSW', 'FLAT'],
    sampleIndexDdl: (idx, tbl, col) =>
      `-- SAP HANA Vector Engine Index\nCREATE INDEX ${idx} ON ${tbl}(${col});`,
  },
  connection: {
    scheme: 'sap://',
    defaultPort: 39015,
    sampleUri: 'hdb://app_user:password@hana-host.internal:39015?currentSchema=PROD',
  },
  ormAdvice: {
    batchSizeRecommendation: 500,
    bulkInsertSyntax: 'INSERT INTO {table} ({cols}) VALUES ...',
    connectionPoolingGuidance: 'Use SAP HANA JDBC client-side connection pool with reconnect enabled.',
  },
};

const EMBEDDED_BASE: Omit<EngineProfile, 'engineId' | 'name' | 'description'> = {
  family: 'embedded',
  dialect: 'sqlite',
  isPostgresFamily: false,
  capabilities: createCapabilities({
    plan: 'native',
    migration: 'native',
    'query-advise': 'native',
    transpile: 'native',
    'config-tuner': 'native',
    'deadlock-simulate': 'adapted',
    'disaster-recovery': 'adapted',
    'synthesize-query': 'native',
    'connect-hub': 'native',
    'partition-plan': 'unsupported',
    'inspect-logs': 'adapted',
    bloat: 'native',
    replication: 'unsupported',
    'security-rbac': 'unsupported',
    'mock-data': 'native',
    finops: 'adapted',
    'index-doctor': 'native',
    'pii-sanitizer': 'adapted',
    'query-rewriter': 'native',
    'schema-diff': 'native',
    'orm-profile': 'native',
    'production-readiness': 'adapted',
    'chaos-simulate': 'unsupported',
    'cdc-outbox': 'unsupported',
    'vector-tune': 'adapted',
  }),
  unsupportedReason: {
    'partition-plan': 'Embedded SQLite/DuckDB databases do not support native declarative table partitioning. Use application-level database file sharding or ATTACH DATABASE.',
    replication: 'Embedded single-process databases do not provide native multi-node network replication daemons. Consider Litestream or LiteFS for WAL streaming.',
    'security-rbac': 'Embedded databases operate within the process memory space and enforce security via file system access permissions rather than SQL user/role grants.',
    'chaos-simulate': 'Embedded databases are in-process libraries without distributed cluster topologies or network partition failovers.',
    'cdc-outbox': 'Embedded databases do not have transaction log streaming services for CDC. Use SQLite Session Extension or application-level event dispatching.',
  },
  memoryParams: {
    sharedBufferParam: 'PRAGMA cache_size',
    workMemParam: 'PRAGMA mmap_size',
    cacheParam: 'PRAGMA page_size',
    configFile: 'PRAGMA statements',
  },
  maintenance: {
    statsCommand: 'ANALYZE {table};',
    spaceReclaimCommand: 'VACUUM;',
    spaceReclaimConcept: 'SQLite VACUUM & Free-Page Truncation',
    tuningDdlTemplate: (table) =>
      `-- SQLite / DuckDB Maintenance\n` +
      `PRAGMA optimize;\n` +
      `VACUUM;\n` +
      `ANALYZE ${table};`,
  },
  planCommand: 'EXPLAIN QUERY PLAN <QUERY>;',
  onlineDdl: {
    createIndexSql: (idx, tbl, cols) => `CREATE INDEX IF NOT EXISTS ${idx} ON ${tbl}(${cols});`,
    dropIndexSql: (idx) => `DROP INDEX IF EXISTS ${idx};`,
    rollbackDropIndexSql: (idx, tbl, cols) => `CREATE INDEX IF NOT EXISTS ${idx} ON ${tbl}(${cols});`,
    supportsConcurrent: false,
    onlineClause: 'IMMEDIATE',
  },
  systemViews: {
    slowQueries: 'dbstat / query logs',
    activeSessions: 'N/A (in-process connection)',
    locks: 'PRAGMA lock_status',
  },
  backup: {
    tool: 'sqlite3 Online Backup API / VACUUM INTO',
    walOrLogName: 'Write-Ahead Log (.db-wal)',
    commandTemplate: (db, path) => `VACUUM INTO '${path}/backup.db';`,
  },
  replication: {
    mechanism: 'Litestream / LiteFS streaming replication',
    failoverManager: 'File system replication failover',
    syncReplicaConfig: "PRAGMA journal_mode = WAL;\nPRAGMA synchronous = NORMAL;",
  },
  syntax: {
    identityColumn: 'INTEGER PRIMARY KEY AUTOINCREMENT',
    rowLimit: (n, offset = 0) => (offset > 0 ? `LIMIT ${n} OFFSET ${offset}` : `LIMIT ${n}`),
    jsonType: 'TEXT (JSON1 extension)',
    quoteIdentifier: (id) => `"${id}"`,
  },
  auth: {
    model: 'OS File System Permissions (POSIX file modes)',
    createUserSql: () => `-- SQLite is an embedded database. Authentication is managed via operating system file permissions.`,
    grantPermissionsSql: () => `-- Grant file-level read/write permissions via chmod/chown on the .db file.`,
  },
  vector: {
    guidance: 'sqlite-vss or DuckDB vss extension for vector similarity search',
    supportedIndexTypes: ['HNSW', 'FLAT'],
  },
  connection: {
    scheme: 'sqlite://',
    defaultPort: 0,
    sampleUri: 'sqlite:///var/data/app_production.db?mode=rwc&cache=shared',
  },
  ormAdvice: {
    batchSizeRecommendation: 200,
    bulkInsertSyntax: 'INSERT INTO {table} ({cols}) VALUES ...',
    connectionPoolingGuidance: 'Configure single-writer connection with WAL mode enabled to avoid SQLITE_BUSY locks.',
  },
};

const COLUMNAR_OLAP_BASE: Omit<EngineProfile, 'engineId' | 'name' | 'description'> = {
  family: 'columnar_olap',
  dialect: 'columnar_olap',
  isPostgresFamily: false,
  capabilities: createCapabilities({
    plan: 'native',
    migration: 'adapted',
    'query-advise': 'native',
    transpile: 'native',
    'config-tuner': 'native',
    'deadlock-simulate': 'unsupported',
    'disaster-recovery': 'native',
    'synthesize-query': 'native',
    'connect-hub': 'native',
    'partition-plan': 'native',
    'inspect-logs': 'native',
    bloat: 'native',
    replication: 'native',
    'security-rbac': 'native',
    'mock-data': 'native',
    finops: 'native',
    'index-doctor': 'adapted',
    'pii-sanitizer': 'native',
    'query-rewriter': 'native',
    'schema-diff': 'native',
    'orm-profile': 'adapted',
    'production-readiness': 'native',
    'chaos-simulate': 'adapted',
    'cdc-outbox': 'adapted',
    'vector-tune': 'adapted',
  }),
  unsupportedReason: {
    'deadlock-simulate': 'Columnar OLAP data warehouses use multi-version snapshot isolation or append-only columnar blocks; transactional row lock deadlocks do not apply.',
  },
  memoryParams: {
    sharedBufferParam: 'max_memory_usage (or Warehouse Size)',
    workMemParam: 'max_threads / slot reservations',
    cacheParam: 'mark_cache_size',
    configFile: 'config.xml / Snowflake Warehouse config',
  },
  maintenance: {
    statsCommand: 'OPTIMIZE TABLE {table} FINAL;',
    spaceReclaimCommand: 'OPTIMIZE TABLE {table} FINAL CLEANUP;',
    spaceReclaimConcept: 'Columnar Parts Compaction & Tombstone De-duplication',
    tuningDdlTemplate: (table) =>
      `-- Columnar Storage Compaction for ${table}\n` +
      `OPTIMIZE TABLE ${table} FINAL;\n`,
  },
  planCommand: 'EXPLAIN <QUERY>;',
  onlineDdl: {
    createIndexSql: (idx, tbl, cols) => `-- Columnar systems use sort keys / clustering keys:\nALTER TABLE ${tbl} ADD PROJECTION ${idx} (SELECT ${cols} ORDER BY ${cols});`,
    dropIndexSql: (idx, tbl = '{table}') => `ALTER TABLE ${tbl} DROP PROJECTION ${idx};`,
    rollbackDropIndexSql: (idx, tbl, cols) => `ALTER TABLE ${tbl} ADD PROJECTION ${idx} (SELECT ${cols} ORDER BY ${cols});`,
    supportsConcurrent: false,
    onlineClause: 'METADATA_ONLY',
  },
  systemViews: {
    slowQueries: 'system.query_log / SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY',
    activeSessions: 'system.processes',
    locks: 'system.part_log',
  },
  backup: {
    tool: 'Cloud Managed Snapshots / Time Travel / S3 Export',
    walOrLogName: 'Commit Log / Append Parts',
    commandTemplate: (db, path) => `BACKUP TABLE ${db} TO S3('${path}');`,
  },
  replication: {
    mechanism: 'ReplicatedMergeTree with ClickHouse Keeper / Cloud Cross-Region Replication',
    failoverManager: 'ClickHouse Keeper / Cloud Managed Control Plane',
    syncReplicaConfig: "ReplicatedMergeTree('/clickhouse/tables/{shard}/{database}/{table}', '{replica}')",
  },
  syntax: {
    identityColumn: 'BIGINT AUTO_INCREMENT',
    rowLimit: (n) => `LIMIT ${n}`,
    jsonType: 'VARIANT / JSON',
    quoteIdentifier: (id) => `"${id}"`,
  },
  auth: {
    model: 'Role-Based Access Control with Masking Policies',
    createUserSql: (user) => `CREATE USER ${user} IDENTIFIED BY 'CHANGE_ME_IN_VAULT';`,
    grantPermissionsSql: (user, tbl) => `GRANT SELECT ON ${tbl} TO ${user};`,
  },
  vector: {
    guidance: 'Vector search via VectorCosineDistance or specialized Vector index types',
    supportedIndexTypes: ['HNSW', 'FLAT'],
  },
  connection: {
    scheme: 'clickhouse://',
    defaultPort: 8123,
    sampleUri: 'clickhouse://app_user:password@olap-cluster.internal:8123/analytics_db',
  },
  ormAdvice: {
    batchSizeRecommendation: 10000,
    bulkInsertSyntax: 'INSERT INTO {table} FORMAT TabSeparated ...',
    connectionPoolingGuidance: 'Batch inserts in micro-batches (min 1,000 to 10,000 rows) rather than singleton writes.',
  },
};

const WIDE_COLUMN_BASE: Omit<EngineProfile, 'engineId' | 'name' | 'description'> = {
  family: 'wide_column',
  dialect: 'cql',
  isPostgresFamily: false,
  capabilities: createCapabilities({
    plan: 'native',
    migration: 'adapted',
    'query-advise': 'native',
    transpile: 'native',
    'config-tuner': 'native',
    'deadlock-simulate': 'unsupported',
    'disaster-recovery': 'native',
    'synthesize-query': 'native',
    'connect-hub': 'native',
    'partition-plan': 'native',
    'inspect-logs': 'native',
    bloat: 'native',
    replication: 'native',
    'security-rbac': 'native',
    'mock-data': 'native',
    finops: 'native',
    'index-doctor': 'adapted',
    'pii-sanitizer': 'adapted',
    'query-rewriter': 'native',
    'schema-diff': 'adapted',
    'orm-profile': 'adapted',
    'production-readiness': 'native',
    'chaos-simulate': 'native',
    'cdc-outbox': 'native',
    'vector-tune': 'adapted',
  }),
  unsupportedReason: {
    'deadlock-simulate': 'Wide-column stores (Cassandra/ScyllaDB) use lock-free peer-to-peer eventual consistency (LWW); relational transaction row lock deadlocks do not exist.',
  },
  memoryParams: {
    sharedBufferParam: 'concurrent_reads',
    workMemParam: 'concurrent_writes',
    cacheParam: 'file_cache_size_in_mb',
    configFile: 'cassandra.yaml / scylla.yaml',
  },
  maintenance: {
    statsCommand: 'nodetool tablestats {table};',
    spaceReclaimCommand: 'nodetool compact {table};',
    spaceReclaimConcept: 'SSTable Major Compaction & Tombstone Purge',
    tuningDdlTemplate: (table) =>
      `-- Cassandra SSTable Compaction Strategy Tuning\n` +
      `ALTER TABLE ${table} WITH compaction = {\n` +
      `  'class': 'TimeWindowCompactionStrategy',\n` +
      `  'compaction_window_unit': 'DAYS',\n` +
      `  'compaction_window_size': 1\n` +
      `} AND gc_grace_seconds = 86400;`,
  },
  planCommand: 'TRACING ON; <QUERY>;',
  onlineDdl: {
    createIndexSql: (idx, tbl, cols) => `CREATE CUSTOM INDEX ${idx} ON ${tbl} (${cols}) USING 'org.apache.cassandra.index.sasi.SASIIndex';`,
    dropIndexSql: (idx) => `DROP INDEX ${idx};`,
    rollbackDropIndexSql: (idx, tbl, cols) => `CREATE CUSTOM INDEX ${idx} ON ${tbl} (${cols}) USING 'org.apache.cassandra.index.sasi.SASIIndex';`,
    supportsConcurrent: false,
    onlineClause: 'CUSTOM',
  },
  systemViews: {
    slowQueries: 'system_views.queries',
    activeSessions: 'system_views.clients',
    locks: 'nodetool tpstats',
  },
  backup: {
    tool: 'nodetool snapshot / Medusa',
    walOrLogName: 'CommitLog',
    commandTemplate: (db, path) => `nodetool snapshot -t backup_${Date.now()} ${db}`,
  },
  replication: {
    mechanism: 'Peer-to-Peer NetworkTopologyStrategy with Tunable Consistency',
    failoverManager: 'Gossip protocol & Hinted Handoff',
    syncReplicaConfig: "WITH replication = {'class': 'NetworkTopologyStrategy', 'dc1': 3, 'dc2': 3}",
  },
  syntax: {
    identityColumn: 'TIMEUUID / UUID PRIMARY KEY',
    rowLimit: (n) => `LIMIT ${n}`,
    jsonType: 'MAP / UDT / TEXT',
    quoteIdentifier: (id) => `"${id}"`,
  },
  auth: {
    model: 'Cassandra Internal Authenticator with Keyspace Grants',
    createUserSql: (user) => `CREATE ROLE ${user} WITH PASSWORD = 'CHANGE_ME_IN_VAULT' AND LOGIN = true;`,
    grantPermissionsSql: (user, tbl) => `GRANT MODIFY ON ${tbl} TO ${user};`,
  },
  vector: {
    guidance: 'Cassandra 5.0+ Vector Search (vector<float, dim> with SAI index)',
    supportedIndexTypes: ['SAI', 'HNSW'],
  },
  connection: {
    scheme: 'cassandra://',
    defaultPort: 9042,
    sampleUri: 'cassandra://app_user:password@seed1.internal:9042,seed2.internal:9042/production_keyspace',
  },
  ormAdvice: {
    batchSizeRecommendation: 50,
    bulkInsertSyntax: 'BEGIN UNLOGGED BATCH ... APPLY BATCH;',
    connectionPoolingGuidance: 'Configure TokenAwarePolicy with RoundRobin fallback and DCAwareRoundRobinPolicy.',
  },
};

const DOCUMENT_BASE: Omit<EngineProfile, 'engineId' | 'name' | 'description'> = {
  family: 'document',
  dialect: 'nosql_document',
  isPostgresFamily: false,
  capabilities: createCapabilities({
    plan: 'native',
    migration: 'adapted',
    'query-advise': 'native',
    transpile: 'native',
    'config-tuner': 'native',
    'deadlock-simulate': 'unsupported',
    'disaster-recovery': 'native',
    'synthesize-query': 'native',
    'connect-hub': 'native',
    'partition-plan': 'native',
    'inspect-logs': 'native',
    bloat: 'native',
    replication: 'native',
    'security-rbac': 'native',
    'mock-data': 'native',
    finops: 'native',
    'index-doctor': 'adapted',
    'pii-sanitizer': 'adapted',
    'query-rewriter': 'native',
    'schema-diff': 'adapted',
    'orm-profile': 'native',
    'production-readiness': 'native',
    'chaos-simulate': 'native',
    'cdc-outbox': 'native',
    'vector-tune': 'adapted',
  }),
  unsupportedReason: {
    'deadlock-simulate': 'Document databases use document-level locking with short multi-document transactions; deadlocks are resolved via statement abort/retry timeouts.',
  },
  memoryParams: {
    sharedBufferParam: 'wiredTiger.engineConfig.cacheSizeGB',
    workMemParam: 'net.maxIncomingConnections',
    cacheParam: 'wiredTiger.collectionConfig.blockCompressor',
    configFile: 'mongod.conf',
  },
  maintenance: {
    statsCommand: 'db.{table}.stats();',
    spaceReclaimCommand: 'db.runCommand({ compact: "{table}" });',
    spaceReclaimConcept: 'WiredTiger Collection Compaction & Storage Reclamation',
    tuningDdlTemplate: (table) =>
      `// MongoDB WiredTiger Compaction\n` +
      `db.runCommand({ compact: "${table}", force: true });\n` +
      `db.${table}.reIndex();`,
  },
  planCommand: 'db.{table}.find(...).explain("executionStats");',
  onlineDdl: {
    createIndexSql: (idx, tbl, cols) => `db.${tbl}.createIndex({ ${cols}: 1 }, { background: true, name: "${idx}" });`,
    dropIndexSql: (idx, tbl = '{table}') => `db.${tbl}.dropIndex("${idx}");`,
    rollbackDropIndexSql: (idx, tbl, cols) => `db.${tbl}.createIndex({ ${cols}: 1 }, { background: true, name: "${idx}" });`,
    supportsConcurrent: false,
    onlineClause: 'background: true',
  },
  systemViews: {
    slowQueries: 'system.profile',
    activeSessions: 'db.currentOp()',
    locks: 'serverStatus().locks',
  },
  backup: {
    tool: 'mongodump / MongoDB Ops Manager Snapshots',
    walOrLogName: 'Oplog (local.oplog.rs)',
    commandTemplate: (db, path) => `mongodump --db=${db} --out=${path} --oplog`,
  },
  replication: {
    mechanism: 'MongoDB Replica Set (Primary-Secondary-Arbiter)',
    failoverManager: 'Raft-like Replica Set Election Protocol',
    syncReplicaConfig: "rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: 'node1:27017' }, { _id: 1, host: 'node2:27017' }] })",
  },
  syntax: {
    identityColumn: '_id: ObjectId()',
    rowLimit: (n) => `.limit(${n})`,
    jsonType: 'BSON',
    quoteIdentifier: (id) => `"${id}"`,
  },
  auth: {
    model: 'Role-Based Access Control (SCRAM-SHA-256)',
    createUserSql: (user) => `db.createUser({ user: "${user}", pwd: "CHANGE_ME_IN_VAULT", roles: [{ role: "readWrite", db: "production_db" }] });`,
    grantPermissionsSql: (user, tbl) => `db.grantRolesToUser("${user}", [{ role: "readWrite", db: "${tbl}" }]);`,
  },
  vector: {
    guidance: 'MongoDB Atlas Vector Search (vectorSearch index definition)',
    supportedIndexTypes: ['vectorSearch', 'HNSW'],
  },
  connection: {
    scheme: 'mongodb://',
    defaultPort: 27017,
    sampleUri: 'mongodb://app_user:password@cluster-primary.internal:27017/production_db?replicaSet=rs0&authSource=admin',
  },
  ormAdvice: {
    batchSizeRecommendation: 1000,
    bulkInsertSyntax: 'db.{table}.bulkWrite([...], { ordered: false });',
    connectionPoolingGuidance: 'Set maxPoolSize=100, minPoolSize=10, maxIdleTimeMS=60000 on MongoClient.',
  },
};

const KEYVALUE_BASE: Omit<EngineProfile, 'engineId' | 'name' | 'description'> = {
  family: 'keyvalue',
  dialect: 'keyvalue',
  isPostgresFamily: false,
  capabilities: createCapabilities({
    plan: 'native',
    migration: 'unsupported',
    'query-advise': 'native',
    transpile: 'unsupported',
    'config-tuner': 'native',
    'deadlock-simulate': 'unsupported',
    'disaster-recovery': 'native',
    'synthesize-query': 'native',
    'connect-hub': 'native',
    'partition-plan': 'unsupported',
    'inspect-logs': 'native',
    bloat: 'native',
    replication: 'native',
    'security-rbac': 'adapted',
    'mock-data': 'native',
    finops: 'native',
    'index-doctor': 'unsupported',
    'pii-sanitizer': 'adapted',
    'query-rewriter': 'adapted',
    'schema-diff': 'unsupported',
    'orm-profile': 'native',
    'production-readiness': 'native',
    'chaos-simulate': 'native',
    'cdc-outbox': 'native',
    'vector-tune': 'adapted',
  }),
  unsupportedReason: {
    'deadlock-simulate': 'Redis operates on a single-threaded in-memory event loop per shard; transactional row lock deadlocks do not exist.',
    'partition-plan': 'Redis does not have relational table partitioning; sharding is handled via Redis Cluster hash slots (16,384 slots) or client-side partitioning.',
    migration: 'Redis is an in-memory key-value data structure store without relational DDL migration scripts.',
    'schema-diff': 'Redis keys and data structures (Strings, Hashes, Sets) do not adhere to static relational DDL schemas.',
    'index-doctor': 'Redis manages keys directly in memory hash tables; relational B-tree index deduplication does not apply.',
    transpile: 'Key-value commands (GET/SET/HGETALL) are distinct from relational SQL dialect transpilation.',
  },
  memoryParams: {
    sharedBufferParam: 'maxmemory',
    workMemParam: 'maxmemory-policy',
    cacheParam: 'active-defrag yes',
    configFile: 'redis.conf',
  },
  maintenance: {
    statsCommand: 'INFO memory;',
    spaceReclaimCommand: 'MEMORY PURGE;',
    spaceReclaimConcept: 'Active Background Defragmentation & Jemalloc Dirty Page Purge',
    tuningDdlTemplate: () =>
      `# Redis Memory Tuning & Active Defragmentation\n` +
      `CONFIG SET active-defrag yes\n` +
      `CONFIG SET active-defrag-cycle-min 10\n` +
      `CONFIG SET active-defrag-cycle-max 50\n` +
      `MEMORY PURGE`,
  },
  planCommand: 'SLOWLOG GET 25; / MEMORY USAGE <key>;',
  onlineDdl: {
    createIndexSql: (idx, tbl, cols) => `FT.CREATE ${idx} ON HASH PREFIX 1 ${tbl}: SCHEMA ${cols} TEXT;`,
    dropIndexSql: (idx) => `FT.DROPINDEX ${idx};`,
    rollbackDropIndexSql: (idx, tbl, cols) => `FT.CREATE ${idx} ON HASH PREFIX 1 ${tbl}: SCHEMA ${cols} TEXT;`,
    supportsConcurrent: false,
    onlineClause: 'ASYNC',
  },
  systemViews: {
    slowQueries: 'SLOWLOG GET 50',
    activeSessions: 'CLIENT LIST',
    locks: 'INFO stats',
  },
  backup: {
    tool: 'BGSAVE (RDB) / BGREWRITEAOF (AOF)',
    walOrLogName: 'Append-Only File (appendonly.aof)',
    commandTemplate: () => `BGSAVE`,
  },
  replication: {
    mechanism: 'Redis Sentinel (HA) / Redis Cluster (16,384 Hash Slots)',
    failoverManager: 'Redis Sentinel Quorum Failover',
    syncReplicaConfig: "replicaof redis-primary.internal 6379\nmasterauth CHANGE_ME_IN_VAULT",
  },
  syntax: {
    identityColumn: 'INCR id_counter',
    rowLimit: (n) => `SCAN 0 COUNT ${n}`,
    jsonType: 'ReJSON / RedisJSON',
    quoteIdentifier: (id) => `"${id}"`,
  },
  auth: {
    model: 'Redis 6+ ACL (Access Control Lists)',
    createUserSql: (user) => `ACL SETUSER ${user} on >CHANGE_ME_IN_VAULT ~* +@all`,
    grantPermissionsSql: (user, tbl) => `ACL SETUSER ${user} ~${tbl}:* +@read +@write`,
  },
  vector: {
    guidance: 'RediSearch Vector Search (FT.CREATE ... SCHEMA ... VECTOR HNSW/FLAT)',
    supportedIndexTypes: ['HNSW', 'FLAT'],
  },
  connection: {
    scheme: 'redis://',
    defaultPort: 6379,
    sampleUri: 'redis://:password@redis-master.internal:6379/0?ssl=true',
  },
  ormAdvice: {
    batchSizeRecommendation: 500,
    bulkInsertSyntax: 'PIPELINE / MSET',
    connectionPoolingGuidance: 'Use Redis client pipelining and connection pooling with maxConnections=128.',
  },
};

const GRAPH_BASE: Omit<EngineProfile, 'engineId' | 'name' | 'description'> = {
  family: 'graph',
  dialect: 'cypher',
  isPostgresFamily: false,
  capabilities: createCapabilities({
    plan: 'native',
    migration: 'adapted',
    'query-advise': 'native',
    transpile: 'unsupported',
    'config-tuner': 'native',
    'deadlock-simulate': 'unsupported',
    'disaster-recovery': 'native',
    'synthesize-query': 'native',
    'connect-hub': 'native',
    'partition-plan': 'unsupported',
    'inspect-logs': 'native',
    bloat: 'native',
    replication: 'native',
    'security-rbac': 'native',
    'mock-data': 'native',
    finops: 'native',
    'index-doctor': 'adapted',
    'pii-sanitizer': 'adapted',
    'query-rewriter': 'native',
    'schema-diff': 'adapted',
    'orm-profile': 'native',
    'production-readiness': 'native',
    'chaos-simulate': 'native',
    'cdc-outbox': 'native',
    'vector-tune': 'adapted',
  }),
  unsupportedReason: {
    'partition-plan': 'Graph databases operate on connected graphs where cross-partition traversal incurs severe hop overhead; graph partitioning uses Neo4j Fabric or sub-graph sharding.',
    'deadlock-simulate': 'Graph databases manage node/relationship locking during Cypher transactions; relational table deadlocks do not apply.',
    transpile: 'Cypher graph pattern queries (MATCH / RETURN) cannot be transpiled through standard SQL transpilation pipelines.',
  },
  memoryParams: {
    sharedBufferParam: 'server.memory.heap.max_size',
    workMemParam: 'server.memory.pagecache.size',
    cacheParam: 'server.memory.heap.initial_size',
    configFile: 'neo4j.conf',
  },
  maintenance: {
    statsCommand: 'SHOW INDEXES YIELD *;',
    spaceReclaimCommand: 'CALL dbms.compact();',
    spaceReclaimConcept: 'Offline Store Compaction & Neo4j Admin Store Defragmentation',
    tuningDdlTemplate: () =>
      `// Neo4j Database Compaction & Cache Priming\n` +
      `CALL dbms.compact();`,
  },
  planCommand: 'EXPLAIN MATCH ... / PROFILE MATCH ...;',
  onlineDdl: {
    createIndexSql: (idx, tbl, cols) => `CREATE INDEX ${idx} IF NOT EXISTS FOR (n:${tbl}) ON (n.${cols});`,
    dropIndexSql: (idx) => `DROP INDEX ${idx} IF EXISTS;`,
    rollbackDropIndexSql: (idx, tbl, cols) => `CREATE INDEX ${idx} IF NOT EXISTS FOR (n:${tbl}) ON (n.${cols});`,
    supportsConcurrent: false,
    onlineClause: 'ONLINE',
  },
  systemViews: {
    slowQueries: 'SHOW TRANSACTIONS / query.log',
    activeSessions: 'SHOW SESSIONS',
    locks: 'SHOW TRANSACTIONS YIELD currentQueryId, allocatedBytes, pageHits',
  },
  backup: {
    tool: 'neo4j-admin database backup',
    walOrLogName: 'Neo4j Transaction Log',
    commandTemplate: (db, path) => `neo4j-admin database backup --database=${db} --to-path=${path}`,
  },
  replication: {
    mechanism: 'Autonomous Clustering / Causal Clustering (Raft Protocol)',
    failoverManager: 'Raft consensus core server election',
    syncReplicaConfig: "initial.dbms.default_primaries_count = 3\ninitial.dbms.default_secondaries_count = 2",
  },
  syntax: {
    identityColumn: 'elementId(n)',
    rowLimit: (n) => `LIMIT ${n}`,
    jsonType: 'MAP / PROPERTIES',
    quoteIdentifier: (id) => `\`${id}\``,
  },
  auth: {
    model: 'Native Graph RBAC with Subgraph Fine-Grained Security',
    createUserSql: (user) => `CREATE USER ${user} SET PASSWORD 'CHANGE_ME_IN_VAULT' CHANGE NOT REQUIRED;`,
    grantPermissionsSql: (user, tbl) => `GRANT MATCH {${tbl}} ON GRAPH * TO ${user};`,
  },
  vector: {
    guidance: 'Neo4j Vector Index (CREATE VECTOR INDEX ... FOR (n:Node) ON (n.embedding))',
    supportedIndexTypes: ['HNSW'],
  },
  connection: {
    scheme: 'bolt://',
    defaultPort: 7687,
    sampleUri: 'bolt://app_user:password@neo4j-cluster.internal:7687',
  },
  ormAdvice: {
    batchSizeRecommendation: 500,
    bulkInsertSyntax: 'UNWIND $batch AS row CREATE (n:Label) SET n = row',
    connectionPoolingGuidance: 'Configure Neo4j Java/TypeScript driver with connection pool size = 50.',
  },
};

const VECTOR_BASE: Omit<EngineProfile, 'engineId' | 'name' | 'description'> = {
  family: 'vector',
  dialect: 'vector',
  isPostgresFamily: false,
  capabilities: createCapabilities({
    plan: 'native',
    migration: 'unsupported',
    'query-advise': 'native',
    transpile: 'unsupported',
    'config-tuner': 'native',
    'deadlock-simulate': 'unsupported',
    'disaster-recovery': 'native',
    'synthesize-query': 'native',
    'connect-hub': 'native',
    'partition-plan': 'unsupported',
    'inspect-logs': 'native',
    bloat: 'native',
    replication: 'native',
    'security-rbac': 'adapted',
    'mock-data': 'native',
    finops: 'native',
    'index-doctor': 'adapted',
    'pii-sanitizer': 'adapted',
    'query-rewriter': 'adapted',
    'schema-diff': 'unsupported',
    'orm-profile': 'native',
    'production-readiness': 'native',
    'chaos-simulate': 'native',
    'cdc-outbox': 'native',
    'vector-tune': 'native',
  }),
  unsupportedReason: {
    'deadlock-simulate': 'Vector database engines do not support relational row lock deadlocks.',
    migration: 'Dedicated vector databases (Pinecone, Milvus, Qdrant) use collection schemas and API calls rather than SQL migration DDL.',
    transpile: 'Vector embeddings and search APIs do not map to relational SQL dialect transpilation.',
    'schema-diff': 'Vector collection schemas are schema-light or dynamic JSON metadata definitions.',
    'partition-plan': 'Vector databases organize high-dimensional vectors across index segments and namespaces rather than declarative SQL table partitions.',
  },
  memoryParams: {
    sharedBufferParam: 'queryNode.memory.limit',
    workMemParam: 'indexNode.build.threads',
    cacheParam: 'segment.cache.size',
    configFile: 'milvus.yaml / Pinecone Pod Config',
  },
  maintenance: {
    statsCommand: 'collection.describe();',
    spaceReclaimCommand: 'collection.compact();',
    spaceReclaimConcept: 'Vector Segment Merge & Compaction',
    tuningDdlTemplate: (table) =>
      `// Milvus / Vector Collection Segment Compaction\n` +
      `pymilvus.utility.compact("${table}");`,
  },
  planCommand: 'Vector ANN Query Profiling / Query node latency breakdown',
  onlineDdl: {
    createIndexSql: (idx, tbl, cols) => `collection.create_index(field_name="${cols}", index_params={"metric_type": "COSINE", "index_type": "HNSW", "params": {"M": 16, "efConstruction": 64}});`,
    dropIndexSql: (idx, tbl = '{table}') => `collection.drop_index(index_name="${idx}");`,
    rollbackDropIndexSql: (idx, tbl, cols) => `collection.create_index(field_name="${cols}", index_params={"metric_type": "COSINE", "index_type": "HNSW"});`,
    supportsConcurrent: false,
    onlineClause: 'ASYNC',
  },
  systemViews: {
    slowQueries: 'Prometheus / Grafana latency metrics (search_latency_ms)',
    activeSessions: 'Query node concurrent requests',
    locks: 'N/A',
  },
  backup: {
    tool: 'milvus-backup / Cloud Snapshot API',
    walOrLogName: 'Vector WAL / Segment logs',
    commandTemplate: (db, path) => `milvus-backup create --backup_name=bkp_${Date.now()} --collection_names=${db}`,
  },
  replication: {
    mechanism: 'QueryNode / DataNode Raft-based sharding and multi-AZ replication',
    failoverManager: 'Coordinator auto-recovery & etcd lease',
    syncReplicaConfig: "replica_number: 2\nconsistency_level: Bounded",
  },
  syntax: {
    identityColumn: 'id: INT64 auto_id=True',
    rowLimit: (n) => `limit=${n}`,
    jsonType: 'JSON Metadata',
    quoteIdentifier: (id) => `"${id}"`,
  },
  auth: {
    model: 'API Keys / Collection-level RBAC',
    createUserSql: (user) => `milvus_client.create_user(user="${user}", password="CHANGE_ME_IN_VAULT")`,
    grantPermissionsSql: (user, tbl) => `milvus_client.grant_role(user="${user}", role="readWrite")`,
  },
  vector: {
    guidance: 'Dedicated Vector Index (HNSW, IVF_FLAT, SCaNN) with cosine or L2 metric',
    supportedIndexTypes: ['HNSW', 'IVF_FLAT', 'SCaNN'],
  },
  connection: {
    scheme: 'https://',
    defaultPort: 19530,
    sampleUri: 'https://vector-index-project.svc.us-east-1.pinecone.io (or milvus://host:19530)',
  },
  ormAdvice: {
    batchSizeRecommendation: 256,
    bulkInsertSyntax: 'collection.insert([vectors, metadata])',
    connectionPoolingGuidance: 'Reuse GRPC client channel connections across worker threads.',
  },
};

const SEARCH_BASE: Omit<EngineProfile, 'engineId' | 'name' | 'description'> = {
  family: 'search',
  dialect: 'search',
  isPostgresFamily: false,
  capabilities: createCapabilities({
    plan: 'native',
    migration: 'adapted',
    'query-advise': 'native',
    transpile: 'unsupported',
    'config-tuner': 'native',
    'deadlock-simulate': 'unsupported',
    'disaster-recovery': 'native',
    'synthesize-query': 'native',
    'connect-hub': 'native',
    'partition-plan': 'native',
    'inspect-logs': 'native',
    bloat: 'native',
    replication: 'native',
    'security-rbac': 'native',
    'mock-data': 'native',
    finops: 'native',
    'index-doctor': 'adapted',
    'pii-sanitizer': 'adapted',
    'query-rewriter': 'native',
    'schema-diff': 'adapted',
    'orm-profile': 'native',
    'production-readiness': 'native',
    'chaos-simulate': 'native',
    'cdc-outbox': 'native',
    'vector-tune': 'native',
  }),
  unsupportedReason: {
    'deadlock-simulate': 'Search engines use Lucene immutable segment architecture; relational row lock deadlocks do not apply.',
    transpile: 'Search queries (JSON Query DSL) cannot be transpiled via standard SQL transpilation.',
  },
  memoryParams: {
    sharedBufferParam: 'indices.memory.index_buffer_size',
    workMemParam: 'indices.queries.cache.size',
    cacheParam: 'indices.fielddata.cache.size',
    configFile: 'elasticsearch.yml / opensearch.yml',
  },
  maintenance: {
    statsCommand: 'GET /{table}/_stats',
    spaceReclaimCommand: 'POST /{table}/_forcemerge?max_num_segments=1',
    spaceReclaimConcept: 'Lucene Segment Force-Merge & Deleted Tombstone Purge',
    tuningDdlTemplate: (table) =>
      `// Elasticsearch / OpenSearch Segment Force-Merge\n` +
      `POST /${table}/_forcemerge?max_num_segments=1&only_expunge_deletes=true`,
  },
  planCommand: 'GET /{table}/_explain/<id> / GET /{table}/_search { "profile": true }',
  onlineDdl: {
    createIndexSql: (idx, tbl, cols) => `PUT /${tbl}/_mapping { "properties": { "${cols}": { "type": "keyword" } } }`,
    dropIndexSql: (idx) => `DELETE /${idx}`,
    rollbackDropIndexSql: (idx) => `PUT /${idx}`,
    supportsConcurrent: false,
    onlineClause: 'ONLINE',
  },
  systemViews: {
    slowQueries: 'GET /_nodes/stats/indices/search',
    activeSessions: 'GET /_tasks?detailed=true',
    locks: 'GET /_cluster/pending_tasks',
  },
  backup: {
    tool: 'Snapshot & Restore API to S3/GCS repository',
    walOrLogName: 'Translog (transaction log)',
    commandTemplate: (db, path) => `PUT /_snapshot/backup_repo/snapshot_${Date.now()}?wait_for_completion=true`,
  },
  replication: {
    mechanism: 'Primary-Replica Shard Allocation Protocol',
    failoverManager: 'Master-eligible Node Zen / 7.x+ Election',
    syncReplicaConfig: 'PUT /{table}/_settings { "index": { "number_of_replicas": 2 } }',
  },
  syntax: {
    identityColumn: '_id string',
    rowLimit: (n) => `"size": ${n}`,
    jsonType: 'JSON Document',
    quoteIdentifier: (id) => `"${id}"`,
  },
  auth: {
    model: 'Elasticsearch Security Roles & Document-Level Security (DLS)',
    createUserSql: (user) => `POST /_security/user/${user} { "password": "CHANGE_ME_IN_VAULT", "roles": ["read_write"] }`,
    grantPermissionsSql: (user, tbl) => `POST /_security/role/${user}_role { "indices": [{ "names": ["${tbl}"], "privileges": ["read", "write"] }] }`,
  },
  vector: {
    guidance: 'Dense vector search with HNSW index (dense_vector type with cosine similarity)',
    supportedIndexTypes: ['HNSW', 'FLAT'],
  },
  connection: {
    scheme: 'http://',
    defaultPort: 9200,
    sampleUri: 'https://elastic:password@search-cluster.internal:9200',
  },
  ormAdvice: {
    batchSizeRecommendation: 500,
    bulkInsertSyntax: 'POST /_bulk',
    connectionPoolingGuidance: 'Configure connection keepalives and sniff-on-connection in Elastic client.',
  },
};

const TIMESERIES_BASE: Omit<EngineProfile, 'engineId' | 'name' | 'description'> = {
  family: 'timeseries',
  dialect: 'timeseries',
  isPostgresFamily: false,
  capabilities: createCapabilities({
    plan: 'native',
    migration: 'adapted',
    'query-advise': 'native',
    transpile: 'adapted',
    'config-tuner': 'native',
    'deadlock-simulate': 'unsupported',
    'disaster-recovery': 'native',
    'synthesize-query': 'native',
    'connect-hub': 'native',
    'partition-plan': 'native',
    'inspect-logs': 'native',
    bloat: 'native',
    replication: 'native',
    'security-rbac': 'adapted',
    'mock-data': 'native',
    finops: 'native',
    'index-doctor': 'adapted',
    'pii-sanitizer': 'adapted',
    'query-rewriter': 'native',
    'schema-diff': 'adapted',
    'orm-profile': 'adapted',
    'production-readiness': 'native',
    'chaos-simulate': 'native',
    'cdc-outbox': 'native',
    'vector-tune': 'unsupported',
  }),
  unsupportedReason: {
    'deadlock-simulate': 'Time-series databases use append-only WAL and immutable columnar blocks; row-lock deadlocks do not exist.',
    'vector-tune': 'Time-series metrics stores do not support vector embeddings or similarity indexing.',
  },
  memoryParams: {
    sharedBufferParam: 'query.max-memory-bytes',
    workMemParam: 'write.max-batch-size',
    cacheParam: 'storage.cache-max-memory-size',
    configFile: 'influxdb.conf / questdb.conf',
  },
  maintenance: {
    statsCommand: 'SHOW STATS',
    spaceReclaimCommand: 'ALTER TABLE {table} DROP PARTITION ...',
    spaceReclaimConcept: 'Retention Policy Shard Dropping & TSM Compaction',
    tuningDdlTemplate: (table) =>
      `-- Time-Series Retention Policy Maintenance\n` +
      `ALTER RETENTION POLICY "autogen" ON "db" DURATION 30d REPLICATION 1 DEFAULT;`,
  },
  planCommand: 'EXPLAIN <QUERY>;',
  onlineDdl: {
    createIndexSql: (idx, tbl, cols) => `-- Time-series engines index tags automatically:\nALTER TABLE ${tbl} ALTER COLUMN ${cols} ADD INDEX;`,
    dropIndexSql: (idx) => `-- Drop index on tag`,
    rollbackDropIndexSql: (idx) => `-- Re-add index on tag`,
    supportsConcurrent: false,
    onlineClause: 'ONLINE',
  },
  systemViews: {
    slowQueries: 'SHOW RUNNING QUERIES',
    activeSessions: 'SHOW CONNECTIONS',
    locks: 'SHOW RUNTIME_INFO',
  },
  backup: {
    tool: 'influx backup / file snapshot',
    walOrLogName: 'Time-Series WAL',
    commandTemplate: (db, path) => `influx backup --db ${db} ${path}`,
  },
  replication: {
    mechanism: 'Multi-node InfluxDB Enterprise / Raft consensus shard replication',
    failoverManager: 'Meta node consensus election',
    syncReplicaConfig: "ALTER RETENTION POLICY default ON metrics REPLICATION 2",
  },
  syntax: {
    identityColumn: 'time TIMESTAMP PRIMARY KEY',
    rowLimit: (n) => `LIMIT ${n}`,
    jsonType: 'FIELD / TAG',
    quoteIdentifier: (id) => `"${id}"`,
  },
  auth: {
    model: 'Token-Based / User Privileges',
    createUserSql: (user) => `CREATE USER ${user} WITH PASSWORD 'CHANGE_ME_IN_VAULT'`,
    grantPermissionsSql: (user, tbl) => `GRANT READ, WRITE ON ${tbl} TO ${user}`,
  },
  vector: {
    guidance: 'Not applicable for dedicated time-series metrics engines',
    supportedIndexTypes: [],
  },
  connection: {
    scheme: 'http://',
    defaultPort: 8086,
    sampleUri: 'http://timeseries-host.internal:8086',
  },
  ormAdvice: {
    batchSizeRecommendation: 5000,
    bulkInsertSyntax: 'Line Protocol write stream',
    connectionPoolingGuidance: 'Stream line-protocol writes in bulk batches with GZIP compression.',
  },
};

const GENERIC_BASE: Omit<EngineProfile, 'engineId' | 'name' | 'description'> = {
  family: 'generic',
  dialect: 'generic_sql',
  isPostgresFamily: false,
  capabilities: createCapabilities({
    plan: 'adapted',
    migration: 'adapted',
    'query-advise': 'adapted',
    transpile: 'adapted',
    'config-tuner': 'adapted',
    'deadlock-simulate': 'adapted',
    'disaster-recovery': 'adapted',
    'synthesize-query': 'adapted',
    'connect-hub': 'adapted',
    'partition-plan': 'adapted',
    'inspect-logs': 'adapted',
    bloat: 'adapted',
    replication: 'adapted',
    'security-rbac': 'adapted',
    'mock-data': 'adapted',
    finops: 'adapted',
    'index-doctor': 'adapted',
    'pii-sanitizer': 'adapted',
    'query-rewriter': 'adapted',
    'schema-diff': 'adapted',
    'orm-profile': 'adapted',
    'production-readiness': 'adapted',
    'chaos-simulate': 'adapted',
    'cdc-outbox': 'adapted',
    'vector-tune': 'adapted',
  }),
  memoryParams: {
    sharedBufferParam: 'buffer_pool_size',
    workMemParam: 'sort_buffer_size',
    cacheParam: 'cache_size',
    configFile: 'database.conf',
  },
  maintenance: {
    statsCommand: 'ANALYZE TABLE {table};',
    spaceReclaimCommand: 'OPTIMIZE TABLE {table};',
    spaceReclaimConcept: 'Engine Storage Compaction & Space Reclamation',
    tuningDdlTemplate: (table) =>
      `-- Generic Database Engine Space Reclamation & Statistics\n` +
      `/* Check your database documentation for native vacuum or rebuild commands */\n` +
      `ANALYZE TABLE ${table};`,
  },
  planCommand: 'EXPLAIN <QUERY>;',
  onlineDdl: {
    createIndexSql: (idx, tbl, cols) => `CREATE INDEX ${idx} ON ${tbl}(${cols});`,
    dropIndexSql: (idx) => `DROP INDEX ${idx};`,
    rollbackDropIndexSql: (idx, tbl, cols) => `CREATE INDEX ${idx} ON ${tbl}(${cols});`,
    supportsConcurrent: false,
    onlineClause: 'ONLINE',
  },
  systemViews: {
    slowQueries: 'query_log / statement_history',
    activeSessions: 'active_sessions',
    locks: 'database_locks',
  },
  backup: {
    tool: 'Native Database Backup Utility or Storage Volume Snapshot',
    walOrLogName: 'Transaction / Redo / Journal Log',
    commandTemplate: (db, path) => `backup_tool --database=${db} --target=${path}`,
  },
  replication: {
    mechanism: 'Primary-Secondary Replication / Distributed Consensus',
    failoverManager: 'Database Cluster Coordinator / Orchestrator',
    syncReplicaConfig: "replication_mode = synchronous",
  },
  syntax: {
    identityColumn: 'BIGINT AUTO_INCREMENT PRIMARY KEY',
    rowLimit: (n, offset = 0) => (offset > 0 ? `LIMIT ${n} OFFSET ${offset}` : `LIMIT ${n}`),
    jsonType: 'JSON',
    quoteIdentifier: (id) => `"${id}"`,
  },
  auth: {
    model: 'Role-Based Access Control (RBAC)',
    createUserSql: (user) => `CREATE USER ${user} IDENTIFIED BY 'CHANGE_ME_IN_VAULT';`,
    grantPermissionsSql: (user, tbl) => `GRANT SELECT, INSERT, UPDATE, DELETE ON ${tbl} TO ${user};`,
  },
  vector: {
    guidance: 'Verify vector index support with your database documentation or use a dedicated vector index.',
    supportedIndexTypes: ['FLAT', 'HNSW'],
  },
  connection: {
    scheme: 'db://',
    defaultPort: 5000,
    sampleUri: 'db://app_user:password@db-host.internal:5000/production_db',
  },
  ormAdvice: {
    batchSizeRecommendation: 500,
    bulkInsertSyntax: 'INSERT INTO {table} ({cols}) VALUES ...',
    connectionPoolingGuidance: 'Configure connection pooling with standard health checks and statement caching.',
  },
};

// -------------------------------------------------------------
// Engine Profile Registry & Family Detection
// -------------------------------------------------------------

export function resolveEngineFamily(engineId?: string): EngineFamily {
  if (!engineId) return 'postgresql';
  const norm = engineId.toLowerCase().trim();
  const canonical = resolveCanonicalEngineId(norm);

  // 1. PostgreSQL Family
  if (isPostgresFamilyEngine(canonical)) {
    return 'postgresql';
  }

  // 2. Oracle Family
  if (
    canonical === 'oracle' ||
    canonical.includes('oracle') ||
    canonical.includes('exadata')
  ) {
    return 'oracle';
  }

  // 3. SQL Server Family
  if (
    canonical === 'microsoft_sql_server' ||
    canonical === 'mssql' ||
    canonical === 'sqlserver' ||
    canonical.includes('sql_server') ||
    canonical.includes('azure_sql')
  ) {
    return 'sqlserver';
  }

  // 4. MySQL Family
  if (
    canonical === 'mysql' ||
    canonical === 'mariadb' ||
    canonical === 'tidb' ||
    canonical === 'percona' ||
    canonical === 'single_store' ||
    canonical === 'singlestore' ||
    canonical.includes('mysql') ||
    canonical.includes('mariadb')
  ) {
    return 'mysql';
  }

  // 5. DB2 Family
  if (canonical === 'ibm_db2' || canonical.includes('db2')) {
    return 'db2';
  }

  // 6. SAP HANA Family
  if (canonical === 'sap_hana' || canonical.includes('hana')) {
    return 'sap_hana';
  }

  // 7. Embedded Family (SQLite, DuckDB)
  if (
    canonical === 'sqlite' ||
    canonical === 'duckdb' ||
    canonical === 'turso' ||
    canonical === 'spatialite' ||
    canonical.includes('sqlite') ||
    canonical.includes('duckdb')
  ) {
    return 'embedded';
  }

  // 8. Columnar OLAP Family
  if (
    canonical === 'snowflake' ||
    canonical === 'google_bigquery' ||
    canonical === 'amazon_redshift' ||
    canonical === 'clickhouse' ||
    canonical === 'apache_doris' ||
    canonical === 'starrocks' ||
    canonical === 'vertica' ||
    canonical === 'teradata' ||
    canonical.includes('clickhouse') ||
    canonical.includes('snowflake') ||
    canonical.includes('bigquery') ||
    canonical.includes('redshift')
  ) {
    return 'columnar_olap';
  }

  // 9. Wide Column Family
  if (
    canonical === 'apache_cassandra' ||
    canonical === 'scylladb' ||
    canonical === 'apache_hbase' ||
    canonical === 'apache_accumulo' ||
    canonical.includes('cassandra') ||
    canonical.includes('scylla') ||
    canonical.includes('hbase')
  ) {
    return 'wide_column';
  }

  // 10. Document Family
  if (
    canonical === 'mongodb' ||
    canonical === 'amazon_dynamodb' ||
    canonical === 'couchbase' ||
    canonical === 'couchdb' ||
    canonical === 'ravendb' ||
    canonical.includes('mongo') ||
    canonical.includes('dynamodb') ||
    canonical.includes('couch') ||
    canonical.includes('cosmos')
  ) {
    return 'document';
  }

  // 11. Key-Value Family
  if (
    canonical === 'redis' ||
    canonical === 'keydb' ||
    canonical === 'valkey' ||
    canonical === 'memcached' ||
    canonical === 'aerospike' ||
    canonical === 'hazelcast' ||
    canonical.includes('redis') ||
    canonical.includes('valkey') ||
    canonical.includes('keydb')
  ) {
    return 'keyvalue';
  }

  // 12. Graph Family
  if (
    canonical === 'neo4j' ||
    canonical === 'amazon_neptune' ||
    canonical === 'janusgraph' ||
    canonical === 'dgraph' ||
    canonical === 'tigergraph' ||
    canonical === 'arangodb' ||
    canonical.includes('neo4j') ||
    canonical.includes('graph')
  ) {
    return 'graph';
  }

  // 13. Vector Family
  if (
    canonical === 'pinecone' ||
    canonical === 'milvus' ||
    canonical === 'qdrant' ||
    canonical === 'chroma' ||
    canonical === 'weaviate' ||
    canonical === 'vespa' ||
    canonical.includes('pinecone') ||
    canonical.includes('milvus') ||
    canonical.includes('qdrant') ||
    canonical.includes('weaviate')
  ) {
    return 'vector';
  }

  // 14. Search Family
  if (
    canonical === 'elasticsearch' ||
    canonical === 'opensearch' ||
    canonical === 'apache_solr' ||
    canonical === 'meilisearch' ||
    canonical === 'typesense' ||
    canonical.includes('elastic') ||
    canonical.includes('opensearch') ||
    canonical.includes('solr') ||
    canonical.includes('meili')
  ) {
    return 'search';
  }

  // 15. Time-Series Family
  if (
    canonical === 'influxdb' ||
    canonical === 'questdb' ||
    canonical === 'prometheus' ||
    canonical === 'victoriametrics' ||
    canonical === 'tdengine' ||
    canonical.includes('influx') ||
    canonical.includes('prometheus') ||
    canonical.includes('questdb')
  ) {
    return 'timeseries';
  }

  // Metadata category fallback
  const metadata = getEngineMetadata(engineId);
  if (metadata) {
    switch (metadata.category) {
      case 'document':
        return 'document';
      case 'keyvalue':
        return 'keyvalue';
      case 'wide_column':
        return 'wide_column';
      case 'graph':
        return 'graph';
      case 'search':
        return 'search';
      case 'timeseries':
        return 'timeseries';
      case 'vector':
        return 'vector';
      case 'olap':
        return 'columnar_olap';
    }
  }

  return 'generic';
}

export function getEngineProfile(engineId?: string): EngineProfile {
  const norm = (engineId || 'postgresql').toLowerCase().trim();
  const canonical = resolveCanonicalEngineId(norm);
  const metadata = getEngineMetadata(canonical);
  const family = resolveEngineFamily(canonical);

  let base: Omit<EngineProfile, 'engineId' | 'name' | 'description'>;

  switch (family) {
    case 'postgresql':
      base = POSTGRES_FAMILY_BASE;
      break;
    case 'mysql':
      base = MYSQL_FAMILY_BASE;
      break;
    case 'oracle':
      base = ORACLE_BASE;
      break;
    case 'sqlserver':
      base = SQL_SERVER_BASE;
      break;
    case 'db2':
      base = DB2_BASE;
      break;
    case 'sap_hana':
      base = SAP_HANA_BASE;
      break;
    case 'embedded':
      base = EMBEDDED_BASE;
      break;
    case 'columnar_olap':
      base = COLUMNAR_OLAP_BASE;
      break;
    case 'wide_column':
      base = WIDE_COLUMN_BASE;
      break;
    case 'document':
      base = DOCUMENT_BASE;
      break;
    case 'keyvalue':
      base = KEYVALUE_BASE;
      break;
    case 'graph':
      base = GRAPH_BASE;
      break;
    case 'vector':
      base = VECTOR_BASE;
      break;
    case 'search':
      base = SEARCH_BASE;
      break;
    case 'timeseries':
      base = TIMESERIES_BASE;
      break;
    case 'generic':
    default:
      base = GENERIC_BASE;
      break;
  }

  const capabilities = { ...base.capabilities };
  const unsupportedReason = { ...(base.unsupportedReason || {}) };

  if (metadata?.category === 'baas_embedded' || canonical === 'microsoft_access') {
    capabilities['partition-plan'] = 'unsupported';
    unsupportedReason['partition-plan'] = `${metadata?.name || canonical} is an embedded/desktop database that does not support declarative table partitioning.`;
  } else if (metadata?.category === 'streaming_ledger') {
    capabilities['partition-plan'] = 'unsupported';
    unsupportedReason['partition-plan'] = `${metadata?.name || canonical} partitions event log streams and topics rather than relational tables.`;
  }

  return {
    ...base,
    capabilities,
    unsupportedReason,
    engineId: canonical,
    name: metadata?.name || canonical,
    description: metadata?.description || `${metadata?.name || canonical} Engine Profile`,
  };
}
