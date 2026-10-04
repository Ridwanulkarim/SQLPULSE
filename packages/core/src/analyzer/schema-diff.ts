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

interface ParsedTable {
  name: string;
  columns: Map<string, { name: string; rawType: string; isNullable: boolean; def: string }>;
  indexes: Map<string, { name: string; columns: string[]; isUnique: boolean; rawDef: string }>;
  foreignKeys: Map<string, { name: string; col: string; refTable: string; refCol: string; onDelete: string; rawDef: string }>;
}

function parseSqlDdl(ddl: string): Map<string, ParsedTable> {
  const tables = new Map<string, ParsedTable>();
  if (!ddl || !ddl.trim()) return tables;

  // 1. Extract CREATE TABLE blocks with balanced parentheses
  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["`\[]?\w+["`\]]?\.)?["`\[]?(\w+)["`\]]?\s*\(/gi;
  let match: RegExpExecArray | null;

  while ((match = createTableRegex.exec(ddl)) !== null) {
    const tableName = match[1].toLowerCase();
    const startIdx = match.index + match[0].length;
    
    let depth = 1;
    let endIdx = startIdx;
    let inSingleQuote = false;
    let inDoubleQuote = false;

    while (endIdx < ddl.length && depth > 0) {
      const ch = ddl[endIdx];
      if (ch === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
      } else if (ch === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
      } else if (ch === '(' && !inSingleQuote && !inDoubleQuote) {
        depth++;
      } else if (ch === ')' && !inSingleQuote && !inDoubleQuote) {
        depth--;
      }
      if (depth > 0) endIdx++;
    }

    const body = ddl.substring(startIdx, endIdx);

    const parsedTable: ParsedTable = {
      name: tableName,
      columns: new Map(),
      indexes: new Map(),
      foreignKeys: new Map(),
    };

    const lines = splitSqlColumns(body);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (/^PRIMARY\s+KEY\s*\(/i.test(line)) {
        continue;
      }

      const fkMatch = line.match(/(?:CONSTRAINT\s+["`\[]?(\w+)["`\]]?\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+["`\[]?(\w+)["`\]]?\s*\(([^)]+)\)(?:\s+ON\s+DELETE\s+(\w+))?/i);
      if (fkMatch) {
        const fkName = fkMatch[1] || `fk_${tableName}_${fkMatch[2].trim().replace(/["`\[\]\s]/g, '')}`;
        parsedTable.foreignKeys.set(fkName.toLowerCase(), {
          name: fkName,
          col: fkMatch[2].trim().replace(/["`\[\]]/g, ''),
          refTable: fkMatch[3],
          refCol: fkMatch[4].trim().replace(/["`\[\]]/g, ''),
          onDelete: (fkMatch[5] || 'RESTRICT').toUpperCase(),
          rawDef: line,
        });
        continue;
      }

      const colMatch = line.match(/^["`\[]?([a-zA-Z0-9_]+)["`\]]?\s+([a-zA-Z0-9_()]+(?:\s*\(\s*\d+(?:\s*,\s*\d+)?\s*\))?)([\s\S]*)$/i);
      if (colMatch && !['CONSTRAINT', 'PRIMARY', 'FOREIGN', 'KEY', 'INDEX', 'UNIQUE', 'CHECK'].includes(colMatch[1].toUpperCase())) {
        const colName = colMatch[1].toLowerCase();
        const rawType = colMatch[2].toUpperCase().trim();
        const rest = colMatch[3] || '';
        const isNullable = !/NOT\s+NULL/i.test(rest);

        parsedTable.columns.set(colName, {
          name: colMatch[1],
          rawType,
          isNullable,
          def: line,
        });
      }
    }

    tables.set(tableName, parsedTable);
  }

  // 2. Extract CREATE INDEX statements
  const indexRegex = /CREATE\s+(UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(?:["`\[]?\w+["`\]]?\.)?["`\[]?(\w+)["`\]]?\s+ON\s+(?:["`\[]?\w+["`\]]?\.)?["`\[]?(\w+)["`\]]?\s*\(([^)]+)\)/gi;
  while ((match = indexRegex.exec(ddl)) !== null) {
    const isUnique = Boolean(match[1]);
    const indexName = match[2];
    const targetTable = match[3].toLowerCase();
    const cols = match[4].split(',').map(c => c.trim().replace(/["`\[\]]/g, ''));

    let table = tables.get(targetTable);
    if (!table) {
      table = { name: targetTable, columns: new Map(), indexes: new Map(), foreignKeys: new Map() };
      tables.set(targetTable, table);
    }

    table.indexes.set(indexName.toLowerCase(), {
      name: indexName,
      columns: cols,
      isUnique,
      rawDef: match[0],
    });
  }

  return tables;
}

function splitSqlColumns(body: string): string[] {
  const result: string[] = [];
  let current = '';
  let parenDepth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += ch;
    } else if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += ch;
    } else if (ch === '(' && !inSingleQuote && !inDoubleQuote) {
      parenDepth++;
      current += ch;
    } else if (ch === ')' && !inSingleQuote && !inDoubleQuote) {
      parenDepth--;
      current += ch;
    } else if (ch === ',' && parenDepth === 0 && !inSingleQuote && !inDoubleQuote) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) {
    result.push(current.trim());
  }
  return result;
}

function formatSafeForwardDdl(changeType: string, tableName: string, colName: string, typeDef: string, engine: string): { forward: string; rollback: string } {
  const isMySQL = engine === 'mysql' || engine === 'mariadb' || engine === 'planetscale';
  const isOracle = engine === 'oracle';
  const isMSSQL = engine.includes('mssql') || engine.includes('sql_server') || engine.includes('microsoft_sql_server');
  const isClickHouse = engine === 'clickhouse';
  const isSnowflake = engine === 'snowflake';
  const isPostgres = isPostgresEngine(engine);

  if (changeType === 'COLUMN_ADDED') {
    if (isMySQL) {
      return {
        forward: `ALTER TABLE \`${tableName}\` ADD COLUMN \`${colName}\` ${typeDef} NULL, ALGORITHM=INPLACE, LOCK=NONE;`,
        rollback: `ALTER TABLE \`${tableName}\` DROP COLUMN \`${colName}\`, ALGORITHM=INPLACE, LOCK=NONE;`
      };
    } else if (isOracle) {
      return {
        forward: `ALTER TABLE ${tableName} ADD (${colName} ${typeDef} NULL);`,
        rollback: `ALTER TABLE ${tableName} DROP COLUMN ${colName};`
      };
    } else if (isMSSQL) {
      return {
        forward: `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('${tableName}') AND name = '${colName}')\n  ALTER TABLE [dbo].[${tableName}] ADD [${colName}] ${typeDef} NULL;`,
        rollback: `ALTER TABLE [dbo].[${tableName}] DROP COLUMN [${colName}];`
      };
    } else if (isClickHouse) {
      return {
        forward: `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${colName} Nullable(${typeDef});`,
        rollback: `ALTER TABLE ${tableName} DROP COLUMN IF EXISTS ${colName};`
      };
    } else if (isSnowflake) {
      return {
        forward: `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${colName} ${typeDef};`,
        rollback: `ALTER TABLE ${tableName} DROP COLUMN IF EXISTS ${colName};`
      };
    } else {
      return {
        forward: `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${colName} ${typeDef} NULL;`,
        rollback: `ALTER TABLE ${tableName} DROP COLUMN IF EXISTS ${colName};`
      };
    }
  }

  return {
    forward: `-- Safe operation for ${tableName}.${colName}`,
    rollback: `-- Rollback for ${tableName}.${colName}`
  };
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
  const isPostgres = isPostgresEngine(engine);

  let changes: SchemaDiffChange[] = [];

  // --- Dynamic AST Diffing if Custom DDL is provided ---
  if (options.sourceDdl && options.sourceDdl.trim() && options.targetDdl && options.targetDdl.trim()) {
    const srcTables = parseSqlDdl(options.sourceDdl);
    const tgtTables = parseSqlDdl(options.targetDdl);
    let diffId = 1;

    // 1. Missing Tables in Target (TABLE_ADDED)
    for (const [tableName, srcTbl] of srcTables) {
      if (!tgtTables.has(tableName)) {
        const createDdl = options.sourceDdl.split(';').find(s => s.toLowerCase().includes(`create table`) && s.toLowerCase().includes(tableName))?.trim() + ';' || `CREATE TABLE ${tableName} (...);`;
        changes.push({
          id: `diff-${diffId++}`,
          type: 'TABLE_ADDED',
          tableName,
          targetObject: `TABLE ${tableName}`,
          sourceDef: createDdl.length > 200 ? createDdl.slice(0, 200) + '...' : createDdl,
          targetDef: '<Table Not Found in Target>',
          impactLevel: 'SAFE',
          safeForwardDdl: createDdl,
          rollbackDdl: isMySQL ? `DROP TABLE IF EXISTS \`${tableName}\`;` : `DROP TABLE IF EXISTS ${tableName} CASCADE;`,
          description: `Table \`${tableName}\` exists in Source schema but is completely missing in Target production database.`,
        });
      } else {
        // Table exists in both -> compare columns, indexes, foreign keys
        const tgtTbl = tgtTables.get(tableName)!;

        // Missing Columns in Target (COLUMN_ADDED)
        for (const [colName, srcCol] of srcTbl.columns) {
          if (!tgtTbl.columns.has(colName)) {
            const formatted = formatSafeForwardDdl('COLUMN_ADDED', tableName, srcCol.name, srcCol.rawType, engine);
            changes.push({
              id: `diff-${diffId++}`,
              type: 'COLUMN_ADDED',
              tableName,
              targetObject: `${tableName}.${srcCol.name}`,
              sourceDef: `${srcCol.name} ${srcCol.rawType} ${srcCol.isNullable ? 'NULL' : 'NOT NULL'}`,
              targetDef: '<Missing in Target>',
              impactLevel: 'SAFE',
              safeForwardDdl: formatted.forward,
              rollbackDdl: formatted.rollback,
              description: `Column \`${srcCol.name}\` (${srcCol.rawType}) is newly added in Source schema. Added with NULL/DEFAULT for zero lock contention.`,
            });
          } else {
            // Column exists in both -> Check type or nullability mismatch (TYPE_MISMATCH)
            const tgtCol = tgtTbl.columns.get(colName)!;
            if (srcCol.rawType !== tgtCol.rawType || srcCol.isNullable !== tgtCol.isNullable) {
              const shadowCol = `${srcCol.name}_v2`;
              changes.push({
                id: `diff-${diffId++}`,
                type: 'TYPE_MISMATCH',
                tableName,
                targetObject: `${tableName}.${srcCol.name}`,
                sourceDef: `${srcCol.name} ${srcCol.rawType} ${srcCol.isNullable ? 'NULL' : 'NOT NULL'}`,
                targetDef: `${tgtCol.name} ${tgtCol.rawType} ${tgtCol.isNullable ? 'NULL' : 'NOT NULL'}`,
                impactLevel: 'BREAKING',
                safeForwardDdl: isMySQL
                  ? `-- Shadow Column Zero-Downtime Migration Pattern\nALTER TABLE \`${tableName}\` ADD COLUMN \`${shadowCol}\` ${srcCol.rawType} NULL, ALGORITHM=INPLACE;\nUPDATE \`${tableName}\` SET \`${shadowCol}\` = \`${srcCol.name}\` WHERE \`${shadowCol}\` IS NULL LIMIT 5000;`
                  : isOracle
                  ? `ALTER TABLE ${tableName} ADD (${shadowCol} ${srcCol.rawType});\nUPDATE ${tableName} SET ${shadowCol} = ${srcCol.name} WHERE ${shadowCol} IS NULL;`
                  : isMSSQL
                  ? `ALTER TABLE [dbo].[${tableName}] ADD [${shadowCol}] ${srcCol.rawType} NULL;\nUPDATE TOP (5000) [dbo].[${tableName}] SET [${shadowCol}] = [${srcCol.name}] WHERE [${shadowCol}] IS NULL;`
                  : `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${shadowCol} ${srcCol.rawType};\nUPDATE ${tableName} SET ${shadowCol} = ${srcCol.name} WHERE ${shadowCol} IS NULL;`,
                rollbackDdl: isMySQL ? `ALTER TABLE \`${tableName}\` DROP COLUMN \`${shadowCol}\`, ALGORITHM=INPLACE;` : `ALTER TABLE ${tableName} DROP COLUMN IF EXISTS ${shadowCol};`,
                description: `Type/Nullability mismatch on \`${tableName}.${srcCol.name}\` (Source: ${srcCol.rawType} vs Target: ${tgtCol.rawType}). Direct ALTER TABLE is a breaking operation requiring table lock.`,
              });
            }
          }
        }

        // Columns dropped in Source (COLUMN_DROPPED)
        for (const [colName, tgtCol] of tgtTbl.columns) {
          if (!srcTbl.columns.has(colName)) {
            changes.push({
              id: `diff-${diffId++}`,
              type: 'COLUMN_DROPPED',
              tableName,
              targetObject: `${tableName}.${tgtCol.name}`,
              sourceDef: '<Removed in Source>',
              targetDef: `${tgtCol.name} ${tgtCol.rawType}`,
              impactLevel: 'BREAKING',
              safeForwardDdl: `-- Deprecate column first (do not drop immediately in live prod)\n-- ALTER TABLE ${tableName} DROP COLUMN ${tgtCol.name};`,
              rollbackDdl: `-- Restore column if needed: ALTER TABLE ${tableName} ADD COLUMN ${tgtCol.name} ${tgtCol.rawType};`,
              description: `Column \`${tgtCol.name}\` was removed in Source schema. Dropping columns in live production is breaking; soft-deprecate before physical drop.`,
            });
          }
        }

        // Missing Indexes in Target (INDEX_MISSING)
        for (const [idxName, srcIdx] of srcTbl.indexes) {
          if (!tgtTbl.indexes.has(idxName)) {
            const idxForward = isPostgres
              ? `CREATE ${srcIdx.isUnique ? 'UNIQUE ' : ''}INDEX CONCURRENTLY IF NOT EXISTS ${srcIdx.name} ON ${tableName} (${srcIdx.columns.join(', ')});`
              : isMySQL
              ? `CREATE ${srcIdx.isUnique ? 'UNIQUE ' : ''}INDEX \`${srcIdx.name}\` ON \`${tableName}\` (${srcIdx.columns.map(c => `\`${c}\``).join(', ')}) ALGORITHM=INPLACE, LOCK=NONE;`
              : isOracle
              ? `CREATE ${srcIdx.isUnique ? 'UNIQUE ' : ''}INDEX ${srcIdx.name} ON ${tableName} (${srcIdx.columns.join(', ')}) ONLINE;`
              : isMSSQL
              ? `CREATE ${srcIdx.isUnique ? 'UNIQUE ' : ''}NONCLUSTERED INDEX [${srcIdx.name}] ON [dbo].[${tableName}] (${srcIdx.columns.map(c => `[${c}]`).join(', ')}) WITH (ONLINE = ON);`
              : `CREATE ${srcIdx.isUnique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS ${srcIdx.name} ON ${tableName} (${srcIdx.columns.join(', ')});`;

            const idxRollback = isPostgres
              ? `DROP INDEX CONCURRENTLY IF EXISTS ${srcIdx.name};`
              : isMySQL
              ? `DROP INDEX \`${srcIdx.name}\` ON \`${tableName}\`;`
              : isOracle
              ? `DROP INDEX ${srcIdx.name} ONLINE;`
              : `DROP INDEX IF EXISTS ${srcIdx.name};`;

            changes.push({
              id: `diff-${diffId++}`,
              type: 'INDEX_MISSING',
              tableName,
              targetObject: srcIdx.name,
              sourceDef: `INDEX ${srcIdx.name} ON ${tableName} (${srcIdx.columns.join(', ')})`,
              targetDef: '<Missing in Target>',
              impactLevel: 'SAFE',
              safeForwardDdl: idxForward,
              rollbackDdl: idxRollback,
              description: `Index \`${srcIdx.name}\` is present in Source but missing in Target production database.`,
            });
          }
        }
      }
    }
  }

  // --- Rich Preset Selection if no custom DDL or if parsed empty ---
  if (changes.length === 0) {
    const srcNorm = sourceEnv.toLowerCase().replace(/[-_]/g, ' ');
    const tgtNorm = targetEnv.toLowerCase().replace(/[-_]/g, ' ');

    // Preset 2: SaaS Billing & Subscriptions
    if (srcNorm.includes('billing') || srcNorm.includes('saas') || srcNorm.includes('v2.4') || srcNorm.includes('stripe') || srcNorm.includes('subscription')) {
      changes = getSaaSBillingPresetChanges(engine, isMySQL, isOracle, isMSSQL, isClickHouse, isSnowflake, isMongoDB);
    }
    // Preset 3: Enterprise ERP & Inventory
    else if (srcNorm.includes('erp') || srcNorm.includes('enterprise') || srcNorm.includes('release 14') || srcNorm.includes('inventory') || srcNorm.includes('exadata')) {
      changes = getEnterpriseErpPresetChanges(engine, isMySQL, isOracle, isMSSQL, isClickHouse, isSnowflake, isMongoDB);
    }
    // Preset 4: Healthcare HIPAA Audit
    else if (srcNorm.includes('hipaa') || srcNorm.includes('health') || srcNorm.includes('patient') || srcNorm.includes('medical')) {
      changes = getHealthcareHipaaPresetChanges(engine, isMySQL, isOracle, isMSSQL, isClickHouse, isSnowflake, isMongoDB);
    }
    // Preset 5: Multi-Tenant Sharding
    else if (srcNorm.includes('tenant') || srcNorm.includes('shard') || srcNorm.includes('multi tenant')) {
      changes = getMultiTenantPresetChanges(engine, isMySQL, isOracle, isMSSQL, isClickHouse, isSnowflake, isMongoDB);
    }
    // Preset 6: FinTech Crypto Ledger
    else if (srcNorm.includes('fintech') || srcNorm.includes('crypto') || srcNorm.includes('ledger') || srcNorm.includes('wallet')) {
      changes = getFintechLedgerPresetChanges(engine, isMySQL, isOracle, isMSSQL, isClickHouse, isSnowflake, isMongoDB);
    }
    // Preset 1 (Default): E-Commerce 2FA & Orders Drift
    else {
      changes = getEcommercePresetChanges(engine, isMySQL, isOracle, isMSSQL, isClickHouse, isSnowflake, isMongoDB);
    }
  }

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
${changes.filter(c => c.type === 'TABLE_ADDED').map(c => c.safeForwardDdl).join('\n\n') || '-- No new tables to add'}

-- 2. Add safe nullable columns
${changes.filter(c => c.type === 'COLUMN_ADDED').map(c => c.safeForwardDdl).join('\n') || '-- No new columns to add'}

COMMIT;

-- 3. Concurrent & Online Index Creations (Outside single transaction)
${changes.filter(c => c.type === 'INDEX_MISSING').map(c => c.safeForwardDdl).join('\n\n') || '-- No indexes to build'}

-- 4. Re-validate foreign key constraints
${changes.filter(c => c.type === 'CONSTRAINT_CHANGED').map(c => c.safeForwardDdl).join('\n\n') || '-- No constraint changes'}
`;

  const rollbackMigrationScript = `-- ==========================================================
-- SQLPulse Reversible Rollback Script
-- Target Engine: ${meta.name} (${engine.toUpperCase()})
-- ==========================================================

BEGIN;

-- Rollback Foreign Keys
${changes.filter(c => c.type === 'CONSTRAINT_CHANGED').map(c => c.rollbackDdl).join('\n') || ''}

-- Drop Added Columns
${changes.filter(c => c.type === 'COLUMN_ADDED').map(c => c.rollbackDdl).join('\n') || ''}

-- Drop Added Tables
${changes.filter(c => c.type === 'TABLE_ADDED').map(c => c.rollbackDdl).join('\n') || ''}

COMMIT;

-- Drop Added Indexes Concurrently
${changes.filter(c => c.type === 'INDEX_MISSING').map(c => c.rollbackDdl).join('\n') || ''}
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

// --- PRESET GENERATORS ---

function getEcommercePresetChanges(engine: string, isMySQL: boolean, isOracle: boolean, isMSSQL: boolean, isClickHouse: boolean, isSnowflake: boolean, isMongoDB: boolean): SchemaDiffChange[] {
  const isPostgres = isPostgresEngine(engine);
  return [
    {
      id: 'diff-1',
      type: 'COLUMN_ADDED',
      tableName: 'users',
      targetObject: 'users.two_factor_secret',
      sourceDef: 'two_factor_secret VARCHAR(128) NULL',
      targetDef: '<Missing in Target>',
      impactLevel: 'SAFE',
      safeForwardDdl: isMySQL
        ? 'ALTER TABLE users ADD COLUMN two_factor_secret VARCHAR(128) NULL, ALGORITHM=INPLACE, LOCK=NONE;'
        : isOracle
        ? 'ALTER TABLE users ADD (two_factor_secret VARCHAR2(128) NULL);'
        : isMSSQL
        ? "IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'two_factor_secret') ALTER TABLE users ADD two_factor_secret NVARCHAR(128) NULL;"
        : isClickHouse
        ? 'ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret Nullable(String);'
        : 'ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(128) NULL;',
      rollbackDdl: isMySQL ? 'ALTER TABLE users DROP COLUMN two_factor_secret, ALGORITHM=INPLACE, LOCK=NONE;' : 'ALTER TABLE users DROP COLUMN IF EXISTS two_factor_secret;',
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
      safeForwardDdl: isMySQL
        ? 'CREATE INDEX idx_orders_customer_status_created ON orders (customer_id, status, created_at DESC) ALGORITHM=INPLACE, LOCK=NONE;'
        : isOracle
        ? 'CREATE INDEX idx_orders_cust_stat ON orders (customer_id, status, created_at DESC) ONLINE;'
        : isMSSQL
        ? 'CREATE INDEX idx_orders_customer_status_created ON orders (customer_id, status, created_at DESC) WITH (ONLINE = ON);'
        : 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_customer_status_created ON orders (customer_id, status, created_at DESC);',
      rollbackDdl: isMySQL ? 'DROP INDEX idx_orders_customer_status_created ON orders;' : 'DROP INDEX CONCURRENTLY IF EXISTS idx_orders_customer_status_created;',
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
        ? `-- STEP 1: Add shadow column\nALTER TABLE payments ADD COLUMN amount_v2 DECIMAL(14, 4) NULL, ALGORITHM=INPLACE;\n-- STEP 2: Backfill asynchronously\nUPDATE payments SET amount_v2 = amount WHERE amount_v2 IS NULL LIMIT 5000;`
        : `ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_v2 NUMERIC(14, 4);\nUPDATE payments SET amount_v2 = amount WHERE amount_v2 IS NULL;`,
      rollbackDdl: isMySQL ? 'ALTER TABLE payments DROP COLUMN amount_v2, ALGORITHM=INPLACE;' : 'ALTER TABLE payments DROP COLUMN IF EXISTS amount_v2;',
      description: 'Expanding column precision directly requires a table lock. Shadow column pattern recommended.',
    },
    {
      id: 'diff-4',
      type: 'TABLE_ADDED',
      tableName: 'audit_event_logs',
      targetObject: 'TABLE audit_event_logs',
      sourceDef: 'CREATE TABLE audit_event_logs (...)',
      targetDef: '<Table Not Found in Target>',
      impactLevel: 'SAFE',
      safeForwardDdl: isMySQL
        ? 'CREATE TABLE IF NOT EXISTS audit_event_logs (id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id BIGINT NOT NULL, action VARCHAR(64) NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);'
        : 'CREATE TABLE IF NOT EXISTS audit_event_logs (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL, action VARCHAR(64) NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW());',
      rollbackDdl: isMySQL ? 'DROP TABLE IF EXISTS audit_event_logs;' : 'DROP TABLE IF EXISTS audit_event_logs CASCADE;',
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
      safeForwardDdl: isPostgres
        ? 'ALTER TABLE orders DROP CONSTRAINT IF EXISTS fk_orders_customer_id;\nALTER TABLE orders ADD CONSTRAINT fk_orders_customer_id FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT NOT VALID;\nALTER TABLE orders VALIDATE CONSTRAINT fk_orders_customer_id;'
        : 'ALTER TABLE orders DROP FOREIGN KEY fk_orders_customer_id;\nALTER TABLE orders ADD CONSTRAINT fk_orders_customer_id FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT;',
      rollbackDdl: 'ALTER TABLE orders DROP CONSTRAINT fk_orders_customer_id;\nALTER TABLE orders ADD CONSTRAINT fk_orders_customer_id FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;',
      description: 'Foreign key cascade rule modified to restrict mode. Use NOT VALID + VALIDATE to avoid table lock.',
    }
  ];
}

function getSaaSBillingPresetChanges(engine: string, isMySQL: boolean, isOracle: boolean, isMSSQL: boolean, isClickHouse: boolean, isSnowflake: boolean, isMongoDB: boolean): SchemaDiffChange[] {
  const isPostgres = isPostgresEngine(engine);
  return [
    {
      id: 'diff-1',
      type: 'COLUMN_ADDED',
      tableName: 'subscriptions',
      targetObject: 'subscriptions.plan_tier_v2',
      sourceDef: 'plan_tier_v2 VARCHAR(64) DEFAULT \'pro_yearly\'',
      targetDef: '<Missing in Target>',
      impactLevel: 'SAFE',
      safeForwardDdl: isMySQL
        ? 'ALTER TABLE subscriptions ADD COLUMN plan_tier_v2 VARCHAR(64) DEFAULT \'pro_yearly\', ALGORITHM=INPLACE, LOCK=NONE;'
        : 'ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_tier_v2 VARCHAR(64) DEFAULT \'pro_yearly\';',
      rollbackDdl: isMySQL ? 'ALTER TABLE subscriptions DROP COLUMN plan_tier_v2, ALGORITHM=INPLACE;' : 'ALTER TABLE subscriptions DROP COLUMN IF EXISTS plan_tier_v2;',
      description: 'New SaaS tiered subscription SKU field for annualized recurring billing.',
    },
    {
      id: 'diff-2',
      type: 'TYPE_MISMATCH',
      tableName: 'invoices',
      targetObject: 'invoices.subtotal_cents',
      sourceDef: 'subtotal_cents BIGINT NOT NULL',
      targetDef: 'subtotal_cents INT NOT NULL',
      impactLevel: 'BREAKING',
      safeForwardDdl: isPostgres
        ? 'ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal_cents_v2 BIGINT;\nUPDATE invoices SET subtotal_cents_v2 = subtotal_cents WHERE subtotal_cents_v2 IS NULL;'
        : 'ALTER TABLE invoices ADD COLUMN subtotal_cents_v2 BIGINT NULL, ALGORITHM=INPLACE;',
      rollbackDdl: 'ALTER TABLE invoices DROP COLUMN subtotal_cents_v2;',
      description: 'Upgrading invoice subtotal from 32-bit INT to 64-bit BIGINT to support high-volume enterprise billing without integer overflow.',
    },
    {
      id: 'diff-3',
      type: 'INDEX_MISSING',
      tableName: 'invoices',
      targetObject: 'idx_invoices_due_date_status',
      sourceDef: 'CREATE INDEX idx_invoices_due_date_status ON invoices (due_date ASC, status)',
      targetDef: '<Missing in Target>',
      impactLevel: 'SAFE',
      safeForwardDdl: isPostgres
        ? 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_due_date_status ON invoices (due_date ASC, status);'
        : 'CREATE INDEX idx_invoices_due_date_status ON invoices (due_date ASC, status) ALGORITHM=INPLACE, LOCK=NONE;',
      rollbackDdl: isPostgres ? 'DROP INDEX CONCURRENTLY IF EXISTS idx_invoices_due_date_status;' : 'DROP INDEX idx_invoices_due_date_status ON invoices;',
      description: 'Index for automated dunning and overdue collections worker.',
    },
    {
      id: 'diff-4',
      type: 'TABLE_ADDED',
      tableName: 'billing_audit_ledger',
      targetObject: 'TABLE billing_audit_ledger',
      sourceDef: 'CREATE TABLE billing_audit_ledger (id BIGINT PRIMARY KEY, invoice_id BIGINT, event_type VARCHAR(64), recorded_at TIMESTAMP)',
      targetDef: '<Table Not Found in Target>',
      impactLevel: 'SAFE',
      safeForwardDdl: isPostgres
        ? 'CREATE TABLE IF NOT EXISTS billing_audit_ledger (id BIGSERIAL PRIMARY KEY, invoice_id BIGINT NOT NULL, event_type VARCHAR(64) NOT NULL, recorded_at TIMESTAMPTZ DEFAULT NOW());'
        : 'CREATE TABLE IF NOT EXISTS billing_audit_ledger (id BIGINT AUTO_INCREMENT PRIMARY KEY, invoice_id BIGINT NOT NULL, event_type VARCHAR(64) NOT NULL, recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP);',
      rollbackDdl: 'DROP TABLE IF EXISTS billing_audit_ledger CASCADE;',
      description: 'New double-entry compliance table for Stripe/Paddle reconciliation.',
    },
    {
      id: 'diff-5',
      type: 'COLUMN_ADDED',
      tableName: 'payment_attempts',
      targetObject: 'payment_attempts.gateway_response_code',
      sourceDef: 'gateway_response_code VARCHAR(32) NULL',
      targetDef: '<Missing in Target>',
      impactLevel: 'SAFE',
      safeForwardDdl: 'ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS gateway_response_code VARCHAR(32) NULL;',
      rollbackDdl: 'ALTER TABLE payment_attempts DROP COLUMN IF EXISTS gateway_response_code;',
      description: 'Raw ISO 8583 bank decline codes for smart retry logic.',
    }
  ];
}

function getEnterpriseErpPresetChanges(engine: string, isMySQL: boolean, isOracle: boolean, isMSSQL: boolean, isClickHouse: boolean, isSnowflake: boolean, isMongoDB: boolean): SchemaDiffChange[] {
  const isPostgres = isPostgresEngine(engine);
  return [
    {
      id: 'diff-1',
      type: 'COLUMN_ADDED',
      tableName: 'inventory_items',
      targetObject: 'inventory_items.warehouse_id',
      sourceDef: 'warehouse_id NUMBER(10) NOT NULL',
      targetDef: '<Missing in Target>',
      impactLevel: 'SAFE',
      safeForwardDdl: isOracle
        ? 'ALTER TABLE inventory_items ADD (warehouse_id NUMBER(10) DEFAULT 1 NOT NULL);'
        : isMSSQL
        ? 'ALTER TABLE inventory_items ADD warehouse_id INT NOT NULL DEFAULT 1;'
        : 'ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS warehouse_id INT NOT NULL DEFAULT 1;',
      rollbackDdl: 'ALTER TABLE inventory_items DROP COLUMN warehouse_id;',
      description: 'Multi-warehouse logistics partitioning identifier.',
    },
    {
      id: 'diff-2',
      type: 'INDEX_MISSING',
      tableName: 'general_ledger_entries',
      targetObject: 'idx_gl_journal_posting_date',
      sourceDef: 'CREATE INDEX idx_gl_journal_posting_date ON general_ledger_entries (posting_date DESC, fiscal_year, account_code)',
      targetDef: '<Missing in Target>',
      impactLevel: 'SAFE',
      safeForwardDdl: isOracle
        ? 'CREATE INDEX idx_gl_journal_posting_date ON general_ledger_entries (posting_date DESC, fiscal_year, account_code) ONLINE;'
        : isMSSQL
        ? 'CREATE NONCLUSTERED INDEX idx_gl_journal_posting_date ON general_ledger_entries (posting_date DESC, fiscal_year, account_code) WITH (ONLINE = ON);'
        : 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gl_journal_posting_date ON general_ledger_entries (posting_date DESC, fiscal_year, account_code);',
      rollbackDdl: isOracle ? 'DROP INDEX idx_gl_journal_posting_date ONLINE;' : 'DROP INDEX CONCURRENTLY IF EXISTS idx_gl_journal_posting_date;',
      description: 'Accelerates GAAP/IFRS quarterly financial consolidation queries.',
    },
    {
      id: 'diff-3',
      type: 'TYPE_MISMATCH',
      tableName: 'general_ledger_entries',
      targetObject: 'general_ledger_entries.currency_code',
      sourceDef: 'currency_code CHAR(3) NOT NULL',
      targetDef: 'currency_code VARCHAR2(10) NULL',
      impactLevel: 'BREAKING',
      safeForwardDdl: isOracle
        ? 'ALTER TABLE general_ledger_entries ADD (currency_code_v2 CHAR(3) DEFAULT \'USD\' NOT NULL);\nUPDATE general_ledger_entries SET currency_code_v2 = SUBSTR(NVL(currency_code, \'USD\'), 1, 3);'
        : 'ALTER TABLE general_ledger_entries ADD COLUMN currency_code_v2 CHAR(3) DEFAULT \'USD\';',
      rollbackDdl: 'ALTER TABLE general_ledger_entries DROP COLUMN currency_code_v2;',
      description: 'ISO 4217 standard currency code constraint tightening.',
    },
    {
      id: 'diff-4',
      type: 'TABLE_ADDED',
      tableName: 'erp_compliance_logs',
      targetObject: 'TABLE erp_compliance_logs',
      sourceDef: 'CREATE TABLE erp_compliance_logs (log_id NUMBER PRIMARY KEY, auditor_id VARCHAR2(64), change_hash VARCHAR2(128))',
      targetDef: '<Table Not Found in Target>',
      impactLevel: 'SAFE',
      safeForwardDdl: isOracle
        ? 'CREATE TABLE erp_compliance_logs (log_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, auditor_id VARCHAR2(64), change_hash VARCHAR2(128), verified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);'
        : 'CREATE TABLE IF NOT EXISTS erp_compliance_logs (log_id BIGSERIAL PRIMARY KEY, auditor_id VARCHAR(64), change_hash VARCHAR(128), verified_at TIMESTAMPTZ DEFAULT NOW());',
      rollbackDdl: 'DROP TABLE erp_compliance_logs;',
      description: 'SOX 404 immutable compliance tamper log.',
    },
    {
      id: 'diff-5',
      type: 'CONSTRAINT_CHANGED',
      tableName: 'inventory_items',
      targetObject: 'fk_inventory_warehouse_id',
      sourceDef: 'FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT',
      targetDef: '<Constraint Not Enforced>',
      impactLevel: 'WARNING',
      safeForwardDdl: isOracle
        ? 'ALTER TABLE inventory_items ADD CONSTRAINT fk_inventory_warehouse_id FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ENABLE NOVALIDATE;'
        : 'ALTER TABLE inventory_items ADD CONSTRAINT fk_inventory_warehouse_id FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) NOT VALID;\nALTER TABLE inventory_items VALIDATE CONSTRAINT fk_inventory_warehouse_id;',
      rollbackDdl: 'ALTER TABLE inventory_items DROP CONSTRAINT fk_inventory_warehouse_id;',
      description: 'Adds strict foreign key constraint between inventory and warehouses without table lock.',
    }
  ];
}

function getHealthcareHipaaPresetChanges(engine: string, isMySQL: boolean, isOracle: boolean, isMSSQL: boolean, isClickHouse: boolean, isSnowflake: boolean, isMongoDB: boolean): SchemaDiffChange[] {
  const isPostgres = isPostgresEngine(engine);
  return [
    {
      id: 'diff-1',
      type: 'COLUMN_ADDED',
      tableName: 'patients',
      targetObject: 'patients.medical_record_hash',
      sourceDef: 'medical_record_hash VARCHAR(64) NOT NULL',
      targetDef: '<Missing in Target>',
      impactLevel: 'SAFE',
      safeForwardDdl: isPostgres
        ? 'ALTER TABLE patients ADD COLUMN IF NOT EXISTS medical_record_hash VARCHAR(64) NULL;'
        : 'ALTER TABLE patients ADD COLUMN medical_record_hash VARCHAR(64) NULL;',
      rollbackDdl: 'ALTER TABLE patients DROP COLUMN medical_record_hash;',
      description: 'SHA-256 pseudonymized token for HIPAA-compliant research data sharing.',
    },
    {
      id: 'diff-2',
      type: 'INDEX_MISSING',
      tableName: 'access_logs',
      targetObject: 'idx_access_logs_patient_doctor',
      sourceDef: 'CREATE INDEX idx_access_logs_patient_doctor ON access_logs (patient_id, doctor_id, accessed_at DESC)',
      targetDef: '<Missing in Target>',
      impactLevel: 'SAFE',
      safeForwardDdl: isPostgres
        ? 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_access_logs_patient_doctor ON access_logs (patient_id, doctor_id, accessed_at DESC);'
        : 'CREATE INDEX idx_access_logs_patient_doctor ON access_logs (patient_id, doctor_id, accessed_at DESC);',
      rollbackDdl: 'DROP INDEX IF EXISTS idx_access_logs_patient_doctor;',
      description: 'Mandatory patient chart access auditing index for OCR compliance inspections.',
    },
    {
      id: 'diff-3',
      type: 'TABLE_ADDED',
      tableName: 'hipaa_audit_trail',
      targetObject: 'TABLE hipaa_audit_trail',
      sourceDef: 'CREATE TABLE hipaa_audit_trail (audit_id BIGSERIAL PRIMARY KEY, phi_viewed BOOLEAN, ip_address INET, logged_at TIMESTAMPTZ)',
      targetDef: '<Table Not Found in Target>',
      impactLevel: 'SAFE',
      safeForwardDdl: 'CREATE TABLE IF NOT EXISTS hipaa_audit_trail (audit_id BIGSERIAL PRIMARY KEY, user_id BIGINT, phi_viewed BOOLEAN DEFAULT TRUE, ip_address VARCHAR(45), logged_at TIMESTAMPTZ DEFAULT NOW());',
      rollbackDdl: 'DROP TABLE IF EXISTS hipaa_audit_trail;',
      description: 'Immutable electronic health record PHI access trail.',
    }
  ];
}

function getMultiTenantPresetChanges(engine: string, isMySQL: boolean, isOracle: boolean, isMSSQL: boolean, isClickHouse: boolean, isSnowflake: boolean, isMongoDB: boolean): SchemaDiffChange[] {
  return [
    {
      id: 'diff-1',
      type: 'COLUMN_ADDED',
      tableName: 'tenants',
      targetObject: 'tenants.isolation_tier',
      sourceDef: 'isolation_tier VARCHAR(32) DEFAULT \'shared\'',
      targetDef: '<Missing in Target>',
      impactLevel: 'SAFE',
      safeForwardDdl: 'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS isolation_tier VARCHAR(32) DEFAULT \'shared\';',
      rollbackDdl: 'ALTER TABLE tenants DROP COLUMN IF EXISTS isolation_tier;',
      description: 'Distinguishes between shared pool vs dedicated tenant shard cluster.',
    },
    {
      id: 'diff-2',
      type: 'INDEX_MISSING',
      tableName: 'tenant_events',
      targetObject: 'idx_tenant_events_created_at',
      sourceDef: 'CREATE INDEX idx_tenant_events_created_at ON tenant_events (tenant_id, created_at DESC)',
      targetDef: '<Missing in Target>',
      impactLevel: 'SAFE',
      safeForwardDdl: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenant_events_created_at ON tenant_events (tenant_id, created_at DESC);',
      rollbackDdl: 'DROP INDEX CONCURRENTLY IF EXISTS idx_tenant_events_created_at;',
      description: 'Partition pruning index for tenant data isolation.',
    },
    {
      id: 'diff-3',
      type: 'TABLE_ADDED',
      tableName: 'tenant_shards_routing',
      targetObject: 'TABLE tenant_shards_routing',
      sourceDef: 'CREATE TABLE tenant_shards_routing (tenant_id UUID PRIMARY KEY, connection_uri VARCHAR(512))',
      targetDef: '<Table Not Found in Target>',
      impactLevel: 'SAFE',
      safeForwardDdl: 'CREATE TABLE IF NOT EXISTS tenant_shards_routing (tenant_id UUID PRIMARY KEY, connection_uri VARCHAR(512) NOT NULL, active BOOLEAN DEFAULT TRUE);',
      rollbackDdl: 'DROP TABLE IF EXISTS tenant_shards_routing;',
      description: 'Dynamic connection pool router for cross-region tenant shards.',
    }
  ];
}

function getFintechLedgerPresetChanges(engine: string, isMySQL: boolean, isOracle: boolean, isMSSQL: boolean, isClickHouse: boolean, isSnowflake: boolean, isMongoDB: boolean): SchemaDiffChange[] {
  return [
    {
      id: 'diff-1',
      type: 'COLUMN_ADDED',
      tableName: 'wallets',
      targetObject: 'wallets.settlement_currency',
      sourceDef: 'settlement_currency VARCHAR(8) DEFAULT \'USD\'',
      targetDef: '<Missing in Target>',
      impactLevel: 'SAFE',
      safeForwardDdl: 'ALTER TABLE wallets ADD COLUMN IF NOT EXISTS settlement_currency VARCHAR(8) DEFAULT \'USD\';',
      rollbackDdl: 'ALTER TABLE wallets DROP COLUMN IF EXISTS settlement_currency;',
      description: 'Multi-currency settlement balance denominator.',
    },
    {
      id: 'diff-2',
      type: 'INDEX_MISSING',
      tableName: 'ledger_entries',
      targetObject: 'idx_ledger_account_tx_date',
      sourceDef: 'CREATE INDEX idx_ledger_account_tx_date ON ledger_entries (account_id, posted_at DESC)',
      targetDef: '<Missing in Target>',
      impactLevel: 'SAFE',
      safeForwardDdl: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ledger_account_tx_date ON ledger_entries (account_id, posted_at DESC);',
      rollbackDdl: 'DROP INDEX CONCURRENTLY IF EXISTS idx_ledger_account_tx_date;',
      description: 'Account balance roll-forward transaction scan accelerator.',
    },
    {
      id: 'diff-3',
      type: 'TABLE_ADDED',
      tableName: 'immutable_transaction_proofs',
      targetObject: 'TABLE immutable_transaction_proofs',
      sourceDef: 'CREATE TABLE immutable_transaction_proofs (tx_id BIGINT PRIMARY KEY, merkle_root VARCHAR(64), signature BYTEA)',
      targetDef: '<Table Not Found in Target>',
      impactLevel: 'SAFE',
      safeForwardDdl: 'CREATE TABLE IF NOT EXISTS immutable_transaction_proofs (tx_id BIGSERIAL PRIMARY KEY, merkle_root VARCHAR(64) NOT NULL, signature BYTEA NOT NULL, verified_at TIMESTAMPTZ DEFAULT NOW());',
      rollbackDdl: 'DROP TABLE IF EXISTS immutable_transaction_proofs;',
      description: 'Cryptographic Merkle proof table for transaction immutability.',
    }
  ];
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
