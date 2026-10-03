import { DATABASE_CATALOG } from '../types/db-catalog.data';

export interface BloatAnalyzeRequest {
  engine: string;
  tableName?: string;
  totalTableSizeGb?: number;
  deadTuplePercentage?: number;
  avgDailyUpdates?: number;
}

export interface BloatFinding {
  objectName: string;
  objectType: 'table' | 'index';
  totalSizeBytes: number;
  bloatSizeBytes: number;
  bloatPercentage: number;
  wastedStorageFormatted: string;
  diskRandomSeekPenalty: string;
  remedyAction: string;
}

export interface BloatAnalyzeResult {
  engine: string;
  engineName: string;
  tableName: string;
  totalTableSizeFormatted: string;
  totalWastedStorageFormatted: string;
  averageBloatPercentage: number;
  findings: BloatFinding[];
  repackScript: string;
  autovacuumTuningDdl: string;
  hygieneCheckQuery: string;
  expertRecommendations: string[];
}

function getEngineMeta(engineId: string) {
  const found = DATABASE_CATALOG.find(db => db.id === engineId.toLowerCase());
  if (found) return found;
  return {
    id: engineId,
    name: engineId.charAt(0).toUpperCase() + engineId.slice(1),
    category: 'relational',
    categoryLabel: 'Relational (SQL)',
    icon: '🗄️',
    rank: 999,
    popularityScore: 10,
    commandHint: 'EXPLAIN <query>',
    description: 'Database Engine'
  };
}

export class BloatAnalyzer {
  public analyze(req: BloatAnalyzeRequest): BloatAnalyzeResult {
    const meta = getEngineMeta(req.engine);
    const table = req.tableName || 'orders';
    const sizeGb = Math.max(1, req.totalTableSizeGb || 120);
    const deadPct = Math.max(5, Math.min(90, req.deadTuplePercentage || 38));

    const totalSizeBytes = sizeGb * 1024 * 1024 * 1024;
    const tableBloatBytes = Math.floor(totalSizeBytes * (deadPct / 100));
    const indexBloatBytes = Math.floor((totalSizeBytes * 0.4) * ((deadPct + 12) / 100));

    const norm = req.engine.toLowerCase();

    let findings: BloatFinding[] = [];
    let repackScript = '';
    let autovacuumDdl = '';
    let hygieneQuery = '';

    if (norm === 'mysql' || norm === 'mariadb') {
      findings = [
        {
          objectName: `${table} (InnoDB Clustered Index)`,
          objectType: 'table',
          totalSizeBytes,
          bloatSizeBytes: tableBloatBytes,
          bloatPercentage: deadPct,
          wastedStorageFormatted: `${(tableBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: '2.4x higher I/O read amplification',
          remedyAction: 'Run OPTIMIZE TABLE with online DDL or gh-ost / pt-online-schema-change',
        },
        {
          objectName: `idx_${table}_cust_status (B-Tree)`,
          objectType: 'index',
          totalSizeBytes: Math.floor(totalSizeBytes * 0.3),
          bloatSizeBytes: indexBloatBytes,
          bloatPercentage: deadPct + 10,
          wastedStorageFormatted: `${(indexBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: 'Page splits causing fragmented leaf pages',
          remedyAction: 'ALTER TABLE orders DROP INDEX idx_orders_cust_status, ADD INDEX idx_orders_cust_status(customer_id, status), ALGORITHM=INPLACE, LOCK=NONE;',
        },
      ];

      repackScript = `-- MySQL Online Table Defragmentation & Page Rebuilding
-- 1. Rebuild clustered table space in-place without table locks (MySQL 8.0+)
ALTER TABLE ${table} ENGINE=InnoDB, ALGORITHM=INPLACE, LOCK=NONE;

-- 2. Alternatively use pt-online-schema-change for zero replication lag:
# pt-online-schema-change --alter "ENGINE=InnoDB" D=production_db,t=${table} --execute --max-lag=2
`;
      autovacuumDdl = `# MySQL Purge Threads & Undo Log Tuning (my.cnf)
innodb_purge_threads = 4
innodb_max_purge_lag = 1000000
innodb_max_purge_lag_delay = 50000
`;
      hygieneQuery = `SELECT 
    table_name, 
    round(((data_length + index_length) / 1024 / 1024), 2) AS total_mb,
    round((data_free / 1024 / 1024), 2) AS wasted_free_mb,
    round((data_free / (data_length + index_length)) * 100, 2) AS fragment_percentage
FROM information_schema.tables
WHERE table_schema = DATABASE() AND data_free > 100 * 1024 * 1024
ORDER BY data_free DESC;`;
    } else if (norm === 'clickhouse') {
      findings = [
        {
          objectName: `${table} (MergeTree Parts)`,
          objectType: 'table',
          totalSizeBytes,
          bloatSizeBytes: tableBloatBytes,
          bloatPercentage: deadPct,
          wastedStorageFormatted: `${(tableBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: 'Excess unmerged parts increasing mark cache lookup latency',
          remedyAction: 'OPTIMIZE TABLE ... FINAL DEDUPLICATE',
        },
      ];

      repackScript = `-- ClickHouse Synchronous Part Merging & Garbage Compaction
OPTIMIZE TABLE ${table} FINAL DEDUPLICATE;
`;
      autovacuumDdl = `-- Adjust Background Merge Pool in config.xml
<clickhouse>
    <background_pool_size>16</background_pool_size>
    <max_bytes_to_merge_at_min_space_in_pool>10737418240</max_bytes_to_merge_at_min_space_in_pool>
</clickhouse>`;
      hygieneQuery = `SELECT 
    table, 
    count() AS total_parts, 
    sum(bytes_on_disk) / 1024 / 1024 AS size_mb, 
    sum(rows) AS total_rows 
FROM system.parts 
WHERE active = 1 AND table = '${table}'
GROUP BY table;`;
    } else if (norm === 'mongodb') {
      findings = [
        {
          objectName: `${table} (WiredTiger Collection)`,
          objectType: 'table',
          totalSizeBytes,
          bloatSizeBytes: tableBloatBytes,
          bloatPercentage: deadPct,
          wastedStorageFormatted: `${(tableBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: 'Fragmented B-Tree disk blocks causing read cache evictions',
          remedyAction: 'Run compact command or resync secondary node',
        },
      ];

      repackScript = `// MongoDB Zero-Downtime Rolling Defragmentation
// Run on Secondary nodes first, then step down Primary and run on last node:
db.runCommand({ compact: "${table}", force: true });
`;
      autovacuumDdl = `// WiredTiger Cache Sweeper Settings in mongod.conf
storage:
  wiredTiger:
    engineConfig:
      cacheSizeGB: 16
    collectionConfig:
      blockCompressor: snappy
`;
      hygieneQuery = `db.${table}.stats().then(s => ({
  sizeMB: s.size / 1024 / 1024,
  storageSizeMB: s.storageSize / 1024 / 1024,
  freeStorageMB: s.freeStorageSize / 1024 / 1024,
  fragmentationPct: ((s.freeStorageSize / s.storageSize) * 100).toFixed(2)
}));`;
    } else {
      
      findings = [
        {
          objectName: `public.${table} (Heap Table Space)`,
          objectType: 'table',
          totalSizeBytes,
          bloatSizeBytes: tableBloatBytes,
          bloatPercentage: deadPct,
          wastedStorageFormatted: `${(tableBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: 'Sequential scans read empty dead pages, saturating shared_buffers',
          remedyAction: 'pg_repack --table=orders or VACUUM (VERBOSE, ANALYZE)',
        },
        {
          objectName: `idx_${table}_customer_id (B-Tree Index)`,
          objectType: 'index',
          totalSizeBytes: Math.floor(totalSizeBytes * 0.35),
          bloatSizeBytes: indexBloatBytes,
          bloatPercentage: deadPct + 8,
          wastedStorageFormatted: `${(indexBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: 'B-Tree depth increased from 3 to 5 levels (extra disk seeks per lookup)',
          remedyAction: 'REINDEX TABLE CONCURRENTLY orders;',
        },
      ];

      repackScript = `-- PostgreSQL Zero-Downtime Online Table & Index Repack
-- Method 1: Concurrent B-Tree Reindexing (Zero Lock Blocking, Postgres 12+)
REINDEX TABLE CONCURRENTLY ${table};

-- Method 2: Online Full Physical Table Repack using pg_repack extension (No Exclusive Locks)
# pg_repack --dbname=production_db --table=public.${table} --jobs=4
`;

      autovacuumDdl = `-- Aggressive Table-Specific Autovacuum Tuning to Prevent Future Bloat
ALTER TABLE ${table} SET (
    autovacuum_vacuum_scale_factor = 0.02,        -- Trigger vacuum on 2% row changes (default is 20%)
    autovacuum_analyze_scale_factor = 0.01,       -- Trigger analyze on 1% row changes
    autovacuum_vacuum_cost_limit = 2000,          -- Increase cost limit to prevent throttling
    autovacuum_vacuum_cost_delay = 2              -- Minimize sleep delay during cleanup
);
`;

      hygieneQuery = `-- PostgreSQL Dead Tuple & Bloat Diagnostic Query
SELECT 
    schemaname, 
    relname, 
    n_live_tup AS live_tuples, 
    n_dead_tup AS dead_tuples, 
    round((n_dead_tup::numeric / NULLIF(n_live_tup + n_dead_tup, 0)) * 100, 2) AS dead_tuple_pct,
    last_vacuum, 
    last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 10000
ORDER BY n_dead_tup DESC;`;
    }

    const totalWastedFormatted = `${((tableBloatBytes + indexBloatBytes) / (1024 * 1024 * 1024)).toFixed(1)} GB`;

    return {
      engine: meta.id,
      engineName: meta.name,
      tableName: table,
      totalTableSizeFormatted: `${sizeGb} GB`,
      totalWastedStorageFormatted: totalWastedFormatted,
      averageBloatPercentage: deadPct,
      findings,
      repackScript,
      autovacuumTuningDdl: autovacuumDdl,
      hygieneCheckQuery: hygieneQuery,
      expertRecommendations: [
        'Never run plain `VACUUM FULL` in production without scheduled maintenance downtime, as it acquires an ACCESS EXCLUSIVE lock blocking all reads and writes.',
        'Use `REINDEX CONCURRENTLY` in Postgres or `OPTIMIZE TABLE ... ALGORITHM=INPLACE` in MySQL to rebuild fragmented indexes in the background.',
        'Lower table-specific `autovacuum_vacuum_scale_factor` to 0.02 on high-write tables to ensure continuous background cleanup before bloat accumulates.',
      ],
    };
  }
}
