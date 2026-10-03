import { getEngineMetadata } from '../types/db-catalog.data';

export interface SchemaDiffChange {
  id: string;
  type: 'TABLE_ADDED' | 'TABLE_DROPPED' | 'COLUMN_ADDED' | 'COLUMN_DROPPED' | 'TYPE_MISMATCH' | 'INDEX_MISSING' | 'CONSTRAINT_CHANGED';
  tableName: string;
  targetObject: string;
  sourceDef: string;
  targetDef: string;
  impactLevel: 'BREAKING' | 'SAFE' | 'WARNING';
  safeForwardDdl: string;
  rollbackDdl: string;
  description: string;
}

export interface SchemaDiffResult {
  engine: string;
  engineName: string;
  sourceEnvironment: string;
  targetEnvironment: string;
  totalDriftCount: number;
  breakingChangesCount: number;
  safeChangesCount: number;
  driftScore: number;
  changes: SchemaDiffChange[];
  forwardMigrationScript: string;
  rollbackMigrationScript: string;
  preflightChecks: string[];
}

export function analyzeSchemaDiff(options: {
  engine?: string;
  sourceEnv?: string;
  targetEnv?: string;
  sourceDdl?: string;
  targetDdl?: string;
}): SchemaDiffResult {
  const meta = getEngineMetadata(options.engine);
  const engine = (meta.id || 'postgresql').toLowerCase();
  const sourceEnv = options.sourceEnv || 'Git / Staging (Source)';
  const targetEnv = options.targetEnv || 'Live Production (Target)';

  const isMySQL = engine === 'mysql' || engine === 'mariadb' || engine === 'planetscale' || engine === 'percona';
  const isOracle = engine === 'oracle';
  const isMSSQL = engine.includes('mssql') || engine.includes('sql_server') || engine.includes('microsoft_sql_server') || engine.includes('sqlserver');
  const isSQLite = engine === 'sqlite' || engine === 'turso';
  const isClickHouse = engine === 'clickhouse';
  const isSnowflake = engine === 'snowflake';
  const isMongoDB = engine === 'mongodb' || engine === 'documentdb';

  // 1. Column Added DDL
  const columnForwardDdl = isMySQL
    ? 'ALTER TABLE users ADD COLUMN two_factor_secret VARCHAR(128) NULL, ALGORITHM=INPLACE, LOCK=NONE;'
    : isOracle
    ? 'ALTER TABLE users ADD (two_factor_secret VARCHAR2(128) NULL);'
    : isMSSQL
    ? "IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'two_factor_secret') ALTER TABLE users ADD two_factor_secret NVARCHAR(128) NULL;"
    : isSQLite
    ? 'ALTER TABLE users ADD COLUMN two_factor_secret TEXT NULL;'
    : isClickHouse
    ? 'ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret Nullable(String);'
    : isSnowflake
    ? 'ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(128);'
    : isMongoDB
    ? '// MongoDB Schema Validation Update\ndb.runCommand({ collMod: "users", validator: { $jsonSchema: { properties: { two_factor_secret: { bsonType: ["string", "null"] } } } } });'
    : 'ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(128) NULL;';

  const columnRollbackDdl = isMySQL
    ? 'ALTER TABLE users DROP COLUMN two_factor_secret, ALGORITHM=INPLACE, LOCK=NONE;'
    : isOracle
    ? 'ALTER TABLE users DROP COLUMN two_factor_secret;'
    : isMSSQL
    ? 'ALTER TABLE users DROP COLUMN two_factor_secret;'
    : isSQLite
    ? '-- SQLite requires table rebuild to drop columns in legacy versions'
    : isClickHouse
    ? 'ALTER TABLE users DROP COLUMN IF EXISTS two_factor_secret;'
    : isSnowflake
    ? 'ALTER TABLE users DROP COLUMN IF EXISTS two_factor_secret;'
    : isMongoDB
    ? '// Remove field validation\ndb.runCommand({ collMod: "users", validationLevel: "off" });'
    : 'ALTER TABLE users DROP COLUMN IF EXISTS two_factor_secret;';

  // 2. Index Missing DDL
  const indexForwardDdl = isMySQL
    ? 'CREATE INDEX idx_orders_customer_status_created ON orders (customer_id, status, created_at DESC) ALGORITHM=INPLACE, LOCK=NONE;'
    : isOracle
    ? 'CREATE INDEX idx_orders_cust_stat ON orders (customer_id, status, created_at DESC) ONLINE;'
    : isMSSQL
    ? 'CREATE INDEX idx_orders_customer_status_created ON orders (customer_id, status, created_at DESC) WITH (ONLINE = ON);'
    : isSQLite
    ? 'CREATE INDEX IF NOT EXISTS idx_orders_customer_status_created ON orders (customer_id, status, created_at DESC);'
    : isClickHouse
    ? 'ALTER TABLE orders ADD INDEX idx_orders_cust (customer_id, status) TYPE minmax GRANULARITY 4;'
    : isSnowflake
    ? 'ALTER TABLE orders CLUSTER BY (customer_id, status, created_at);'
    : isMongoDB
    ? 'db.orders.createIndex({ customer_id: 1, status: 1, created_at: -1 }, { background: true });'
    : 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_customer_status_created ON orders (customer_id, status, created_at DESC);';

  const indexRollbackDdl = isMySQL
    ? 'DROP INDEX idx_orders_customer_status_created ON orders;'
    : isOracle
    ? 'DROP INDEX idx_orders_cust_stat ONLINE;'
    : isMSSQL
    ? 'DROP INDEX idx_orders_customer_status_created ON orders;'
    : isSQLite
    ? 'DROP INDEX IF EXISTS idx_orders_customer_status_created;'
    : isClickHouse
    ? 'ALTER TABLE orders DROP INDEX idx_orders_cust;'
    : isSnowflake
    ? 'ALTER TABLE orders DROP CLUSTERING KEY;'
    : isMongoDB
    ? 'db.orders.dropIndex("customer_id_1_status_1_created_at_-1");'
    : 'DROP INDEX CONCURRENTLY IF EXISTS idx_orders_customer_status_created;';

  // 3. Table Added DDL
  const tableForwardDdl = isMySQL
    ? `CREATE TABLE IF NOT EXISTS audit_event_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    action VARCHAR(64) NOT NULL,
    payload JSON,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_audit_logs_user_created ON audit_event_logs (user_id, created_at DESC) ALGORITHM=INPLACE, LOCK=NONE;`
    : isClickHouse
    ? `CREATE TABLE IF NOT EXISTS audit_event_logs (
    id UInt64,
    user_id UInt64,
    action LowCardinality(String),
    payload String,
    created_at DateTime64(3, 'UTC') DEFAULT now64()
) ENGINE = MergeTree()
ORDER BY (user_id, created_at, id);`
    : isSnowflake
    ? `CREATE TABLE IF NOT EXISTS audit_event_logs (
    id NUMBER AUTOINCREMENT PRIMARY KEY,
    user_id NUMBER NOT NULL,
    action VARCHAR(64) NOT NULL,
    payload VARIANT,
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);`
    : isMongoDB
    ? `db.createCollection("audit_event_logs");\ndb.audit_event_logs.createIndex({ user_id: 1, created_at: -1 });`
    : isOracle
    ? `CREATE TABLE audit_event_logs (
    id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id NUMBER NOT NULL,
    action VARCHAR2(64) NOT NULL,
    payload CLOB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX idx_audit_logs_user_created ON audit_event_logs (user_id, created_at DESC) ONLINE;`
    : isMSSQL
    ? `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='audit_event_logs' AND xtype='U')
CREATE TABLE audit_event_logs (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id BIGINT NOT NULL,
    action NVARCHAR(64) NOT NULL,
    payload NVARCHAR(MAX),
    created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX idx_audit_logs_user_created ON audit_event_logs (user_id, created_at DESC) WITH (ONLINE = ON);`
    : isSQLite
    ? `CREATE TABLE IF NOT EXISTS audit_event_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    payload TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_event_logs (user_id, created_at DESC);`
    : `CREATE TABLE IF NOT EXISTS audit_event_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    action VARCHAR(64) NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_created ON audit_event_logs (user_id, created_at DESC);`;

  // 4. Constraint Changed DDL
  const constraintForwardDdl = isMySQL
    ? `ALTER TABLE orders DROP FOREIGN KEY fk_orders_customer_id;
ALTER TABLE orders ADD CONSTRAINT fk_orders_customer_id FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT;`
    : isOracle
    ? `ALTER TABLE orders DROP CONSTRAINT fk_orders_customer_id;
ALTER TABLE orders ADD CONSTRAINT fk_orders_customer_id FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT ENABLE NOVALIDATE;`
    : isMSSQL
    ? `ALTER TABLE orders DROP CONSTRAINT fk_orders_customer_id;
ALTER TABLE orders WITH NOCHECK ADD CONSTRAINT fk_orders_customer_id FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE NO ACTION;`
    : `-- PostgreSQL zero-downtime foreign key validation
ALTER TABLE orders DROP CONSTRAINT IF EXISTS fk_orders_customer_id;
ALTER TABLE orders ADD CONSTRAINT fk_orders_customer_id FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE orders VALIDATE CONSTRAINT fk_orders_customer_id;`;

  const constraintRollbackDdl = isMySQL
    ? `ALTER TABLE orders DROP FOREIGN KEY fk_orders_customer_id;
ALTER TABLE orders ADD CONSTRAINT fk_orders_customer_id FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;`
    : isOracle
    ? `ALTER TABLE orders DROP CONSTRAINT fk_orders_customer_id;
ALTER TABLE orders ADD CONSTRAINT fk_orders_customer_id FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;`
    : isMSSQL
    ? `ALTER TABLE orders DROP CONSTRAINT fk_orders_customer_id;
ALTER TABLE orders ADD CONSTRAINT fk_orders_customer_id FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;`
    : `ALTER TABLE orders DROP CONSTRAINT IF EXISTS fk_orders_customer_id;
ALTER TABLE orders ADD CONSTRAINT fk_orders_customer_id FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;`;

  const changes: SchemaDiffChange[] = [
    {
      id: 'diff-1',
      type: 'COLUMN_ADDED',
      tableName: 'users',
      targetObject: 'users.two_factor_secret',
      sourceDef: 'two_factor_secret VARCHAR(128) NULL',
      targetDef: '<Missing in Target>',
      impactLevel: 'SAFE',
      safeForwardDdl: columnForwardDdl,
      rollbackDdl: columnRollbackDdl,
      description: 'New 2FA secret column present in development schema but missing in production.',
    },
    {
      id: 'diff-2',
      type: 'INDEX_MISSING',
      tableName: 'orders',
      targetObject: 'idx_orders_customer_status_created',
      sourceDef: 'CREATE INDEX idx_orders_customer_status_created ON orders (customer_id, status, created_at DESC)',
      targetDef: '<Missing in Target>',
      impactLevel: 'SAFE',
      safeForwardDdl: indexForwardDdl,
      rollbackDdl: indexRollbackDdl,
      description: 'Critical composite B-Tree index missing in production, causing full table scans on customer dashboard queries.',
    },
    {
      id: 'diff-3',
      type: 'TYPE_MISMATCH',
      tableName: 'payments',
      targetObject: 'payments.amount',
      sourceDef: 'amount NUMERIC(14, 4) NOT NULL',
      targetDef: 'amount NUMERIC(10, 2) NOT NULL',
      impactLevel: 'BREAKING',
      safeForwardDdl: isMySQL
        ? `-- STEP 1: Add new shadow column (ALGORITHM=INPLACE)
ALTER TABLE payments ADD COLUMN amount_v2 DECIMAL(14, 4) NULL;
-- STEP 2: Backfill asynchronously in batches of 5000 rows
UPDATE payments SET amount_v2 = amount WHERE amount_v2 IS NULL LIMIT 5000;
-- STEP 3: Rename during scheduled maintenance`
        : isOracle
        ? `-- STEP 1: Add shadow column
ALTER TABLE payments ADD (amount_v2 NUMBER(14, 4));
-- STEP 2: Backfill data in chunks
UPDATE payments SET amount_v2 = amount WHERE amount_v2 IS NULL;`
        : `-- STEP 1: Add new shadow column to avoid exclusive table lock
ALTER TABLE payments ADD COLUMN amount_v2 NUMERIC(14, 4);
-- STEP 2: Backfill data asynchronously in chunks
UPDATE payments SET amount_v2 = amount WHERE amount_v2 IS NULL;
-- STEP 3: Switch column pointers during off-peak maintenance window`,
      rollbackDdl: isMySQL
        ? 'ALTER TABLE payments DROP COLUMN amount_v2, ALGORITHM=INPLACE;'
        : 'ALTER TABLE payments DROP COLUMN IF EXISTS amount_v2;',
      description: 'High risk: Expanding column precision directly requires a table rewrite or table lock. Shadow column pattern recommended.',
    },
    {
      id: 'diff-4',
      type: 'TABLE_ADDED',
      tableName: 'audit_event_logs',
      targetObject: 'TABLE audit_event_logs',
      sourceDef: 'CREATE TABLE audit_event_logs (...)',
      targetDef: '<Table Not Found in Target>',
      impactLevel: 'SAFE',
      safeForwardDdl: tableForwardDdl,
      rollbackDdl: isMySQL
        ? 'DROP TABLE IF EXISTS audit_event_logs;'
        : 'DROP TABLE IF EXISTS audit_event_logs CASCADE;',
      description: 'New audit event logging table added in migration branch.',
    },
    {
      id: 'diff-5',
      type: 'CONSTRAINT_CHANGED',
      tableName: 'orders',
      targetObject: 'fk_orders_customer_id',
      sourceDef: 'FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT',
      targetDef: 'FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE',
      impactLevel: 'WARNING',
      safeForwardDdl: constraintForwardDdl,
      rollbackDdl: constraintRollbackDdl,
      description: 'Foreign key cascade rule modified to restrict mode. Use NOT VALID + VALIDATE to avoid table lock.',
    }
  ];

  const breakingChangesCount = changes.filter(c => c.impactLevel === 'BREAKING').length;
  const safeChangesCount = changes.filter(c => c.impactLevel === 'SAFE').length;
  const driftScore = Math.min(100, Math.max(10, 100 - (breakingChangesCount * 25 + (changes.length - breakingChangesCount) * 8)));

  const forwardMigrationScript = `-- ==========================================================
-- SQLPulse Automated Zero-Downtime Forward Migration Script
-- Source: ${sourceEnv} ➔ Target: ${targetEnv}
-- Database Engine: ${meta.name} (${engine.toUpperCase()})
-- Generated at: ${new Date().toISOString()}
-- ==========================================================

BEGIN;

-- 1. Create missing tables
${changes.find(c => c.type === 'TABLE_ADDED')?.safeForwardDdl || '-- No new tables'}

-- 2. Add safe nullable columns
${changes.find(c => c.type === 'COLUMN_ADDED')?.safeForwardDdl || '-- No new columns'}

COMMIT;

-- 3. Concurrent & Online Index Creations (Outside single transaction)
${changes.find(c => c.type === 'INDEX_MISSING')?.safeForwardDdl || '-- No indexes to build'}

-- 4. Re-validate foreign key constraints
${changes.find(c => c.type === 'CONSTRAINT_CHANGED')?.safeForwardDdl || '-- No constraint changes'}
`;

  const rollbackMigrationScript = `-- ==========================================================
-- SQLPulse Reversible Rollback Script
-- Target Engine: ${meta.name} (${engine.toUpperCase()})
-- ==========================================================

BEGIN;

-- Rollback Foreign Keys
${changes.find(c => c.type === 'CONSTRAINT_CHANGED')?.rollbackDdl || ''}

-- Drop Added Columns
${changes.find(c => c.type === 'COLUMN_ADDED')?.rollbackDdl || ''}

-- Drop Added Tables
${changes.find(c => c.type === 'TABLE_ADDED')?.rollbackDdl || ''}

COMMIT;

-- Drop Added Indexes Concurrently
${changes.find(c => c.type === 'INDEX_MISSING')?.rollbackDdl || ''}
`;

  const preflightChecks = [
    `Verify replica replication lag is < 500ms before running ALTER TABLE on ${meta.name}.`,
    isPostgresEngine(engine)
      ? `Ensure active lock_timeout is set to '3s' to prevent cascade queuing of application transactions.`
      : isMySQL
      ? `Verify innodb_online_alter_log_max_size is large enough for active DML workloads.`
      : `Ensure transaction log space is sufficient to prevent rollback exhaustion.`,
    `Check free disk space: Table rewrites require at least 2.5x the table's total physical size.`,
    `Execute during lowest QPS maintenance window or blue/green staging environment.`
  ];

  return {
    engine,
    engineName: meta.name,
    sourceEnvironment: sourceEnv,
    targetEnvironment: targetEnv,
    totalDriftCount: changes.length,
    breakingChangesCount,
    safeChangesCount,
    driftScore,
    changes,
    forwardMigrationScript,
    rollbackMigrationScript,
    preflightChecks,
  };
}

function isPostgresEngine(engine: string): boolean {
  return [
    'postgres',
    'postgresql',
    'cockroachdb',
    'timescaledb',
    'yugabytedb',
    'amazon_aurora',
    'supabase',
    'neon',
  ].includes(engine.toLowerCase());
}
