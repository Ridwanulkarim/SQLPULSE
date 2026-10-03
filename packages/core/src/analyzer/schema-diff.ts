import { DATABASE_CATALOG } from '../types/db-catalog.data';

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
  const engine = (options.engine || 'postgresql').toLowerCase();
  const sourceEnv = options.sourceEnv || 'Git / Staging (Source)';
  const targetEnv = options.targetEnv || 'Live Production (Target)';

  const changes: SchemaDiffChange[] = [
    {
      id: 'diff-1',
      type: 'COLUMN_ADDED',
      tableName: 'users',
      targetObject: 'users.two_factor_secret',
      sourceDef: 'two_factor_secret VARCHAR(128) NULL',
      targetDef: '<Missing in Target>',
      impactLevel: 'SAFE',
      safeForwardDdl: engine === 'mysql'
        ? 'ALTER TABLE users ADD COLUMN two_factor_secret VARCHAR(128) NULL, ALGORITHM=INPLACE, LOCK=NONE;'
        : 'ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(128) NULL;',
      rollbackDdl: engine === 'mysql'
        ? 'ALTER TABLE users DROP COLUMN two_factor_secret, ALGORITHM=INPLACE, LOCK=NONE;'
        : 'ALTER TABLE users DROP COLUMN IF EXISTS two_factor_secret;',
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
      safeForwardDdl: engine === 'mysql'
        ? 'CREATE INDEX idx_orders_customer_status_created ON orders (customer_id, status, created_at DESC) ALGORITHM=INPLACE, LOCK=NONE;'
        : engine === 'oracle'
        ? 'CREATE INDEX idx_orders_cust_stat ON orders (customer_id, status, created_at DESC) ONLINE;'
        : 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_customer_status_created ON orders (customer_id, status, created_at DESC);',
      rollbackDdl: engine === 'mysql'
        ? 'DROP INDEX idx_orders_customer_status_created ON orders;'
        : 'DROP INDEX CONCURRENTLY IF EXISTS idx_orders_customer_status_created;',
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
      safeForwardDdl: `-- STEP 1: Add new shadow column to avoid exclusive table lock
ALTER TABLE payments ADD COLUMN amount_v2 NUMERIC(14, 4);
-- STEP 2: Backfill data asynchronously in chunks
UPDATE payments SET amount_v2 = amount WHERE amount_v2 IS NULL;
-- STEP 3: Switch column pointers during off-peak maintenance window`,
      rollbackDdl: 'ALTER TABLE payments DROP COLUMN IF EXISTS amount_v2;',
      description: 'High risk: Expanding column precision directly requires a table rewrite or table lock. Shadow column pattern recommended.',
    },
    {
      id: 'diff-4',
      type: 'TABLE_ADDED',
      tableName: 'audit_event_logs',
      targetObject: 'TABLE audit_event_logs',
      sourceDef: 'CREATE TABLE audit_event_logs (id BIGSERIAL PRIMARY KEY, user_id BIGINT, action VARCHAR(64), payload JSONB, created_at TIMESTAMPTZ DEFAULT NOW())',
      targetDef: '<Table Not Found in Target>',
      impactLevel: 'SAFE',
      safeForwardDdl: `CREATE TABLE IF NOT EXISTS audit_event_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    action VARCHAR(64) NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_created ON audit_event_logs (user_id, created_at DESC);`,
      rollbackDdl: 'DROP TABLE IF EXISTS audit_event_logs CASCADE;',
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
      safeForwardDdl: `-- PostgreSQL zero-downtime foreign key validation
ALTER TABLE orders DROP CONSTRAINT IF EXISTS fk_orders_customer_id;
ALTER TABLE orders ADD CONSTRAINT fk_orders_customer_id FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE orders VALIDATE CONSTRAINT fk_orders_customer_id;`,
      rollbackDdl: `ALTER TABLE orders DROP CONSTRAINT IF EXISTS fk_orders_customer_id;
ALTER TABLE orders ADD CONSTRAINT fk_orders_customer_id FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;`,
      description: 'Foreign key cascade rule modified to restrict mode. Use NOT VALID + VALIDATE to avoid table lock.',
    }
  ];

  const breakingChangesCount = changes.filter(c => c.impactLevel === 'BREAKING').length;
  const safeChangesCount = changes.filter(c => c.impactLevel === 'SAFE').length;
  const driftScore = Math.min(100, Math.max(10, 100 - (breakingChangesCount * 25 + (changes.length - breakingChangesCount) * 8)));

  const forwardMigrationScript = `-- ==========================================================
-- SQLPulse Automated Zero-Downtime Forward Migration Script
-- Source: ${sourceEnv} ➔ Target: ${targetEnv}
-- Database Engine: ${engine.toUpperCase()}
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
-- Target Engine: ${engine.toUpperCase()}
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
    `Verify replica replication lag is < 500ms before running ALTER TABLE.`,
    `Ensure active lock_timeout is set to '3s' to prevent cascade queuing of application transactions.`,
    `Check free disk space: Table rewrites require at least 2.5x the table's total physical size.`,
    `Execute during lowest QPS maintenance window or blue/green staging environment.`
  ];

  return {
    engine,
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
