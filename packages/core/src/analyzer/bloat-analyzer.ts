import { DATABASE_CATALOG, getEngineMetadata } from '../types/db-catalog.data';

export interface BloatAnalyzeRequest {
  engine: string;
  tableName?: string;
  totalTableSizeGb?: number;
  deadTuplePercentage?: number;
  avgDailyUpdates?: number;
  targetIoSpeedMbSec?: number;
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

export interface VacuumExecutionPlan {
  estimatedDurationMinutes: number;
  estimatedDiskFreedGb: number;
  postVacuumTableSizeGb: number;
  lockLevel: string;
  recommendedCommand: string;
  autovacuumUrgency: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  dailyBloatGrowthMb: number;
  triggerThresholdDeadTuples: number;
  ioThroughputAssumedMbSec: number;
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
  vacuumMetrics: VacuumExecutionPlan;
}

export class BloatAnalyzer {
  public analyze(req: BloatAnalyzeRequest): BloatAnalyzeResult {
    const raw = (req.engine || 'postgresql').toLowerCase();
    const meta = getEngineMetadata(req.engine);
    const table = req.tableName?.trim() || 'orders';
    const sizeGb = Math.max(0.1, req.totalTableSizeGb !== undefined ? req.totalTableSizeGb : 120);
    const deadPct = Math.max(1, Math.min(95, req.deadTuplePercentage !== undefined ? req.deadTuplePercentage : 38));
    const dailyUpdates = Math.max(100, req.avgDailyUpdates !== undefined ? req.avgDailyUpdates : 500000);
    const ioSpeed = Math.max(10, req.targetIoSpeedMbSec || 75);

    const totalSizeBytes = Math.round(sizeGb * 1024 * 1024 * 1024);
    const tableBloatBytes = Math.round(totalSizeBytes * (deadPct / 100));
    const indexBloatBytes = Math.round((totalSizeBytes * 0.35) * (Math.min(95, deadPct + 8) / 100));
    const totalWastedBytes = tableBloatBytes + indexBloatBytes;

    const estimatedDiskFreedGb = parseFloat((totalWastedBytes / (1024 * 1024 * 1024)).toFixed(2));
    const postVacuumSizeGb = parseFloat(Math.max(0.05, sizeGb - (tableBloatBytes / (1024 * 1024 * 1024))).toFixed(2));
    const estimatedDurationMinutes = Math.max(1, Math.round((sizeGb * 1024) / (ioSpeed * 60)));
    const dailyBloatGrowthMb = parseFloat(((dailyUpdates * 320) / (1024 * 1024)).toFixed(1));

    const autovacuumUrgency: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' =
      deadPct >= 40 ? 'CRITICAL' : deadPct >= 25 ? 'HIGH' : deadPct >= 15 ? 'MODERATE' : 'LOW';

    let engineFamily = 'postgres';
    let engineName = meta.name;
    if (meta.category === 'search' || raw.includes('elastic') || raw.includes('opensearch') || raw.includes('solr') || raw.includes('meili')) {
      engineFamily = 'search';
    } else if (meta.category === 'graph' || raw.includes('neo4j') || raw.includes('memgraph') || raw.includes('tiger') || raw.includes('neptune')) {
      engineFamily = 'graph';
    } else if (meta.category === 'timeseries' || raw.includes('timescale') || raw.includes('influx') || raw.includes('quest') || raw.includes('tdengine')) {
      engineFamily = 'timeseries';
    } else if (meta.category === 'vector' || raw.includes('milvus') || raw.includes('pinecone') || raw.includes('qdrant') || raw.includes('chroma') || raw.includes('weaviate')) {
      engineFamily = 'vector';
    } else if (raw.includes('cockroach') || raw.includes('yugabyte') || raw.includes('spanner')) {
      engineFamily = 'cockroach';
    } else if (meta.category === 'streaming_ledger' || raw.includes('kafka') || raw.includes('redpanda') || raw.includes('pulsar') || raw.includes('immudb')) {
      engineFamily = 'streaming_ledger';
    } else if (meta.category === 'geo_spatial' || raw.includes('tile38') || raw.includes('postgis')) {
      engineFamily = 'geo_spatial';
    } else if (raw.includes('mysql') || raw.includes('maria') || raw.includes('tidb') || raw.includes('percona') || raw.includes('planetscale')) {
      engineFamily = 'mysql';
    } else if (raw.includes('oracle') || raw.includes('db2')) {
      engineFamily = 'oracle';
    } else if (raw.includes('sqlserver') || raw.includes('mssql') || raw.includes('azure_sql')) {
      engineFamily = 'mssql';
    } else if (raw.includes('sqlite') || raw.includes('turso') || raw.includes('libsql') || raw.includes('d1')) {
      engineFamily = 'sqlite';
    } else if (raw.includes('click') || raw.includes('duck') || raw.includes('starrocks') || raw.includes('trino') || meta.category === 'olap') {
      engineFamily = 'clickhouse';
    } else if (raw.includes('mongo') || raw.includes('document') || raw.includes('couch') || meta.category === 'document') {
      engineFamily = 'mongodb';
    } else if (raw.includes('cassandra') || raw.includes('scylla') || raw.includes('hbase') || meta.category === 'wide_column') {
      engineFamily = 'cassandra';
    } else if (raw.includes('redis') || raw.includes('keydb') || raw.includes('dragonfly') || raw.includes('valkey') || raw.includes('memcached') || meta.category === 'keyvalue') {
      engineFamily = 'redis';
    } else if (raw.includes('snow') || raw.includes('bigquery') || raw.includes('redshift') || raw.includes('databricks')) {
      engineFamily = 'snowflake';
    }

    let findings: BloatFinding[] = [];
    let repackScript = '';
    let autovacuumDdl = '';
    let hygieneQuery = '';
    let lockLevel = 'NONE (Online Non-Blocking)';
    let recommendedCommand = '';
    let triggerThresholdDeadTuples = Math.round(50 + 0.10 * (sizeGb * 1000000));
    let expertRecommendations: string[] = [];

    // --- 1. MySQL / MariaDB / TiDB ---
    if (engineFamily === 'mysql') {
      lockLevel = 'NONE (ALGORITHM=INPLACE, LOCK=NONE)';
      recommendedCommand = `ALTER TABLE ${table} ENGINE=InnoDB, ALGORITHM=INPLACE, LOCK=NONE;`;
      findings = [
        {
          objectName: `${table} (InnoDB Clustered Index ibd)`,
          objectType: 'table',
          totalSizeBytes,
          bloatSizeBytes: tableBloatBytes,
          bloatPercentage: deadPct,
          wastedStorageFormatted: `${(tableBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: 'Page splits causing fragmented 16KB leaf extents & read amplification',
          remedyAction: 'Run OPTIMIZE TABLE with ALGORITHM=INPLACE or pt-online-schema-change',
        },
        {
          objectName: `idx_${table}_cust_status (Secondary B+Tree)`,
          objectType: 'index',
          totalSizeBytes: Math.floor(totalSizeBytes * 0.35),
          bloatSizeBytes: indexBloatBytes,
          bloatPercentage: Math.min(95, deadPct + 10),
          wastedStorageFormatted: `${(indexBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: 'Unordered secondary leaf page splits increase buffer pool cache misses',
          remedyAction: `ALTER TABLE ${table} DROP INDEX idx_${table}_cust_status, ADD INDEX idx_${table}_cust_status(customer_id, status), ALGORITHM=INPLACE, LOCK=NONE;`,
        },
      ];

      repackScript = `-- MySQL / MariaDB Zero-Downtime Online Table Defragmentation
-- 1. Rebuild clustered table space in-place without table locks (MySQL 8.0+ / InnoDB)
ALTER TABLE ${table} ENGINE=InnoDB, ALGORITHM=INPLACE, LOCK=NONE;

-- 2. Optimize secondary indexes and free unused extents:
OPTIMIZE TABLE ${table};

-- 3. For zero-replication-lag environments, use Percona Toolkit:
# pt-online-schema-change --alter "ENGINE=InnoDB" D=production_db,t=${table} --execute --max-lag=1
`;

      autovacuumDdl = `# MySQL Master Purge Threads & Undo Log Tuning (my.cnf)
[mysqld]
innodb_purge_threads = 4
innodb_max_purge_lag = 1000000
innodb_max_purge_lag_delay = 50000
innodb_online_alter_log_max_size = 1073741824 # 1GB online buffer for concurrent writes
innodb_stats_auto_recalc = ON
`;

      hygieneQuery = `SELECT 
    table_name, 
    round(((data_length + index_length) / 1024 / 1024), 2) AS total_mb,
    round((data_free / 1024 / 1024), 2) AS wasted_free_mb,
    round((data_free / NULLIF(data_length + index_length, 0)) * 100, 2) AS fragment_percentage
FROM information_schema.tables
WHERE table_schema = DATABASE() AND table_name = '${table}'
ORDER BY data_free DESC;`;

      expertRecommendations = [
        'Always ensure `innodb_file_per_table = ON` so freed space is reclaimed by the operating system after defragmentation.',
        'Execute table rebuilds with `ALGORITHM=INPLACE, LOCK=NONE` to prevent blocking concurrent SELECT, INSERT, and UPDATE queries.',
        'Monitor `data_free` in `information_schema.tables`. If `data_free` exceeds 20% of `data_length`, schedule an online optimize run.',
      ];

    // --- 2. Oracle Database / DB2 ---
    } else if (engineFamily === 'oracle') {
      lockLevel = 'NONE (SHRINK SPACE COMPACT / REBUILD ONLINE)';
      recommendedCommand = `ALTER TABLE ${table} SHRINK SPACE CASCADE;`;
      findings = [
        {
          objectName: `${table} (Heap Segment below High Water Mark)`,
          objectType: 'table',
          totalSizeBytes,
          bloatSizeBytes: tableBloatBytes,
          bloatPercentage: deadPct,
          wastedStorageFormatted: `${(tableBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: 'Full table scans read empty blocks up to High Water Mark (HWM)',
          remedyAction: 'ALTER TABLE SHRINK SPACE CASCADE (resets HWM and releases space to tablespace)',
        },
        {
          objectName: `IDX_${table.toUpperCase()}_PK (Oracle B*Tree)`,
          objectType: 'index',
          totalSizeBytes: Math.floor(totalSizeBytes * 0.35),
          bloatSizeBytes: indexBloatBytes,
          bloatPercentage: Math.min(95, deadPct + 6),
          wastedStorageFormatted: `${(indexBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: 'Unbalanced B*Tree leaf blocks require additional branch traversals',
          remedyAction: `ALTER INDEX IDX_${table.toUpperCase()}_PK REBUILD ONLINE;`,
        },
      ];

      repackScript = `-- Oracle Online Segment Space Defragmentation & High Water Mark (HWM) Reset
-- Step 1: Enable row movement (Required for segment shrink)
ALTER TABLE ${table} ENABLE ROW MOVEMENT;

-- Step 2: Compact contiguous blocks in the background (No lock, zero blocking)
ALTER TABLE ${table} SHRINK SPACE COMPACT;

-- Step 3: Reset High Water Mark and release free extents to tablespace
ALTER TABLE ${table} SHRINK SPACE CASCADE;

-- Step 4: Rebuild indexes online without exclusive lock
ALTER INDEX IDX_${table.toUpperCase()}_PK REBUILD ONLINE;
`;

      autovacuumDdl = `-- Oracle Automatic Segment Space Management (ASSM) & PCTFREE Tuning
ALTER TABLE ${table} PCTFREE 10 PCTUSED 40;

-- Schedule Automatic Space Advisor Job
BEGIN
  DBMS_AUTO_TASK_ADMIN.ENABLE(
    client_name => 'auto space advisor job',
    operation   => NULL,
    window_name => NULL
  );
END;
/
`;

      hygieneQuery = `SELECT 
    table_name, 
    num_rows, 
    blocks AS total_blocks, 
    empty_blocks, 
    avg_space AS avg_free_bytes_per_block, 
    chain_cnt AS migrated_chained_rows
FROM user_tables 
WHERE table_name = UPPER('${table}');`;

      expertRecommendations = [
        'Oracle `TABLE ACCESS FULL` scans all blocks up to the High Water Mark (HWM). Running `SHRINK SPACE CASCADE` lowers the HWM, speeding up full table scans dramatically.',
        'Always rebuild Oracle indexes with the `ONLINE` keyword to avoid acquiring exclusive DDL table locks.',
        'Ensure the tablespace is managed with Automatic Segment Space Management (ASSM) using bitmaps rather than legacy freelists.',
      ];

    // --- 3. Microsoft SQL Server / Azure SQL ---
    } else if (engineFamily === 'mssql') {
      lockLevel = 'NONE (REBUILD WITH ONLINE=ON)';
      recommendedCommand = `ALTER INDEX ALL ON ${table} REBUILD WITH (ONLINE = ON, MAXDOP = 4);`;
      findings = [
        {
          objectName: `${table} (Clustered Index Fragmentation)`,
          objectType: 'table',
          totalSizeBytes,
          bloatSizeBytes: tableBloatBytes,
          bloatPercentage: deadPct,
          wastedStorageFormatted: `${(tableBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: 'Internal fragmentation leaves 8KB data pages 40% empty',
          remedyAction: 'ALTER INDEX ALL ON table REBUILD WITH (ONLINE = ON, MAXDOP = 4)',
        },
        {
          objectName: `IX_${table}_Lookup (Nonclustered B-Tree)`,
          objectType: 'index',
          totalSizeBytes: Math.floor(totalSizeBytes * 0.35),
          bloatSizeBytes: indexBloatBytes,
          bloatPercentage: Math.min(95, deadPct + 12),
          wastedStorageFormatted: `${(indexBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: 'External fragmentation causes out-of-order disk reads',
          remedyAction: `ALTER INDEX IX_${table}_Lookup ON ${table} REORGANIZE;`,
        },
      ];

      repackScript = `-- Microsoft SQL Server Online Index Defragmentation & Reorganization
-- If fragmentation > 30%: Online Rebuild (Zero exclusive locks in Enterprise / Azure SQL)
ALTER INDEX ALL ON ${table} REBUILD WITH (
    ONLINE = ON, 
    MAXDOP = 4, 
    SORT_IN_TEMPDB = ON, 
    RESUMABLE = ON, 
    MAX_DURATION = 120 MINUTES
);

-- If fragmentation is between 10% and 30%: Online Reorganize
-- ALTER INDEX ALL ON ${table} REORGANIZE;
`;

      autovacuumDdl = `-- SQL Server Fill Factor & Auto-Statistics Tuning
-- Set Fill Factor to 85% to reserve space for future updates without page splits
ALTER INDEX ALL ON ${table} REBUILD WITH (FILLFACTOR = 85, ONLINE = ON);

-- Enable asynchronous statistics update so queries never wait for stats recalculation
ALTER DATABASE CURRENT SET AUTO_UPDATE_STATISTICS_ASYNC ON;
`;

      hygieneQuery = `SELECT 
    object_name(ips.object_id) AS table_name,
    i.name AS index_name,
    ips.index_type_desc,
    round(ips.avg_fragmentation_in_percent, 2) AS fragmentation_pct,
    round(ips.avg_page_space_used_in_percent, 2) AS page_density_pct,
    ips.page_count,
    round((ips.page_count * 8.0 / 1024), 2) AS total_mb
FROM sys.dm_db_index_physical_stats(DB_ID(), OBJECT_ID('${table}'), NULL, NULL, 'LIMITED') ips
JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id;`;

      expertRecommendations = [
        'Use `RESUMABLE = ON` (SQL Server 2017+) for multi-hundred GB tables so index rebuilds can pause during peak business hours and resume overnight.',
        'Never run `DBCC SHRINKFILE` regularly; it creates severe 99% index fragmentation immediately after completion.',
        'Set `FILLFACTOR = 80-85%` on tables experiencing high random `INSERT`/`UPDATE` rates to prevent immediate re-fragmentation.',
      ];

    // --- 4. SQLite / LibSQL / Turso ---
    } else if (engineFamily === 'sqlite') {
      lockLevel = 'LOW (VACUUM INTO creates non-blocking clone)';
      recommendedCommand = `VACUUM INTO '${table}_compacted.db';`;
      findings = [
        {
          objectName: `${table} (B-Tree Freelist Pages)`,
          objectType: 'table',
          totalSizeBytes,
          bloatSizeBytes: tableBloatBytes,
          bloatPercentage: deadPct,
          wastedStorageFormatted: `${(tableBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: 'Freelist pages increase file size and cause OS cache thrashing',
          remedyAction: 'Run VACUUM INTO for non-blocking compaction, or PRAGMA incremental_vacuum',
        },
      ];

      repackScript = `-- SQLite Zero-Downtime Vacuum & Freelist Compaction
-- Method 1: VACUUM INTO creates a brand new, defragmented database file without write locks:
VACUUM INTO '${table}_compacted.db';

-- Method 2: Standard VACUUM with in-memory temporary store:
PRAGMA temp_store = MEMORY;
VACUUM;
`;

      autovacuumDdl = `-- SQLite Incremental Vacuum Configuration
-- Configure incremental auto-vacuum mode (Must be set before initial table creation or via VACUUM)
PRAGMA auto_vacuum = INCREMENTAL;

-- Schedule periodic partial freelist cleanup (Purges 1000 pages per cycle):
PRAGMA incremental_vacuum(1000);
PRAGMA wal_autocheckpoint = 1000;
`;

      hygieneQuery = `-- SQLite Freelist & Fragmentation Inspection
PRAGMA page_count;
PRAGMA freelist_count;
PRAGMA page_size;
SELECT 
    freelist_count AS dead_pages,
    page_count AS total_pages,
    round((freelist_count * 100.0 / NULLIF(page_count, 0)), 2) AS bloat_percentage
FROM (SELECT 1)
LEFT JOIN (SELECT * FROM pragma_freelist_count()) ON 1=1
LEFT JOIN (SELECT * FROM pragma_page_count()) ON 1=1;`;

      expertRecommendations = [
        'SQLite stores deleted rows on an internal "freelist" and does NOT return disk space to the OS automatically.',
        'Use `VACUUM INTO` in production because standard `VACUUM` requires an exclusive lock and temporary disk space equal to the entire database size.',
        'Enable `PRAGMA auto_vacuum = INCREMENTAL` and run `PRAGMA incremental_vacuum(500)` during off-peak intervals.',
      ];

    // --- 5. ClickHouse / Columnar OLAP ---
    } else if (engineFamily === 'clickhouse') {
      lockLevel = 'NONE (Asynchronous Background Merge)';
      recommendedCommand = `OPTIMIZE TABLE ${table} FINAL DEDUPLICATE;`;
      findings = [
        {
          objectName: `${table} (Unmerged MergeTree Part Directories)`,
          objectType: 'table',
          totalSizeBytes,
          bloatSizeBytes: tableBloatBytes,
          bloatPercentage: deadPct,
          wastedStorageFormatted: `${(tableBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: 'Excess unmerged parts increase mark cache lookup latency and thread count',
          remedyAction: 'OPTIMIZE TABLE ... FINAL DEDUPLICATE',
        },
      ];

      repackScript = `-- ClickHouse Synchronous Part Deduplication & Tombstone Purge
-- Force final background merge of all unmerged parts and tombstoned rows:
OPTIMIZE TABLE ${table} FINAL DEDUPLICATE;
`;

      autovacuumDdl = `<!-- ClickHouse Background Merge Pool Tuning (/etc/clickhouse-server/config.d/merge.xml) -->
<clickhouse>
    <background_pool_size>16</background_pool_size>
    <background_merges_mutations_concurrency_ratio>2</background_merges_mutations_concurrency_ratio>
    <max_bytes_to_merge_at_min_space_in_pool>10737418240</max_bytes_to_merge_at_min_space_in_pool>
</clickhouse>
`;

      hygieneQuery = `SELECT 
    table, 
    count() AS total_parts, 
    sum(bytes_on_disk) / 1024 / 1024 AS size_mb, 
    sum(rows) AS total_rows,
    countIf(active = 0) AS inactive_tombstoned_parts
FROM system.parts 
WHERE table = '${table}'
GROUP BY table;`;

      expertRecommendations = [
        'Avoid frequent small single-row mutations (`ALTER TABLE UPDATE/DELETE`) in ClickHouse, as each mutation creates an entirely new generation of part files.',
        'Batch writes into chunks of 10,000+ rows to minimize part proliferation.',
        'Run `OPTIMIZE TABLE ... FINAL` only during scheduled maintenance or micro-batch completion, as it initiates high disk I/O.',
      ];

    // --- 6. MongoDB / Document Stores ---
    } else if (engineFamily === 'mongodb') {
      lockLevel = 'NONE (Secondary-First Rolling Compact)';
      recommendedCommand = `db.runCommand({ compact: "${table}", force: true });`;
      findings = [
        {
          objectName: `${table} (WiredTiger Extent Fragmentation)`,
          objectType: 'table',
          totalSizeBytes,
          bloatSizeBytes: tableBloatBytes,
          bloatPercentage: deadPct,
          wastedStorageFormatted: `${(tableBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: 'Fragmented WiredTiger B-Tree blocks cause RAM cache churn',
          remedyAction: 'Run db.runCommand({ compact: table }) on secondary replica members',
        },
        {
          objectName: `${table}._id_ + Secondary B-Trees`,
          objectType: 'index',
          totalSizeBytes: Math.floor(totalSizeBytes * 0.35),
          bloatSizeBytes: indexBloatBytes,
          bloatPercentage: Math.min(95, deadPct + 8),
          wastedStorageFormatted: `${(indexBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: 'Deleted index entries leave empty internal B-Tree pages',
          remedyAction: `db.${table}.reIndex();`,
        },
      ];

      repackScript = `// MongoDB Zero-Downtime Rolling Defragmentation
// Run on Secondary replica members one by one, then step down Primary:
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
  sizeMB: (s.size / 1024 / 1024).toFixed(2),
  storageSizeMB: (s.storageSize / 1024 / 1024).toFixed(2),
  freeStorageMB: (s.freeStorageSize / 1024 / 1024).toFixed(2),
  fragmentationPct: ((s.freeStorageSize / s.storageSize) * 100).toFixed(2)
}));`;

      expertRecommendations = [
        'WiredTiger preserves deleted document space in `freeStorageSize` for future writes, but does not release space back to the operating system without `compact`.',
        'Always execute `compact` on Secondary replica members first, then step down the Primary node to achieve zero downtime.',
        'Use `blockCompressor: snappy` or `zstd` to minimize physical disk footprint.',
      ];

    // --- 7. Apache Cassandra / ScyllaDB ---
    } else if (engineFamily === 'cassandra') {
      lockLevel = 'NONE (Non-Blocking Background Compaction)';
      recommendedCommand = `nodetool garbagecollect production_keyspace ${table}`;
      findings = [
        {
          objectName: `${table} (SSTables with Accumulated Tombstones)`,
          objectType: 'table',
          totalSizeBytes,
          bloatSizeBytes: tableBloatBytes,
          bloatPercentage: deadPct,
          wastedStorageFormatted: `${(tableBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: 'Scans reading thousands of tombstones trigger TombstoneOverwhelmingException',
          remedyAction: 'Run nodetool garbagecollect or nodetool compact',
        },
      ];

      repackScript = `# Apache Cassandra / ScyllaDB Tombstone Purge & Compaction
# 1. Run nodetool garbagecollect to evict expired tombstones without full compaction:
nodetool garbagecollect production_keyspace ${table}

# 2. Or trigger major compaction across all SSTable tiers:
nodetool compact production_keyspace ${table}
`;

      autovacuumDdl = `-- Cassandra LeveledCompactionStrategy & Tombstone Threshold Tuning
ALTER TABLE production_keyspace.${table} WITH gc_grace_seconds = 86400
AND compaction = {
    'class': 'LeveledCompactionStrategy',
    'tombstone_threshold': '0.15',
    'tombstone_compaction_interval': '86400',
    'unchecked_tombstone_compaction': 'true'
};
`;

      hygieneQuery = `# Inspect Tombstone Density & SSTable Count
nodetool tablestats production_keyspace.${table} | grep -E "SSTable count|Tombstone|Space used|Compacted"`;

      expertRecommendations = [
        'When data is deleted in Cassandra, a tombstone is created. Data is only physically removed after `gc_grace_seconds` expires.',
        'Switch to `LeveledCompactionStrategy` (LCS) on read-heavy or delete-heavy workloads to purge tombstones much faster than SizeTiered.',
        'Run `nodetool garbagecollect` periodically to drop tombstones without triggering massive I/O compaction spikes.',
      ];

    // --- 8. Redis / Key-Value In-Memory ---
    } else if (engineFamily === 'redis') {
      lockLevel = 'NONE (Jemalloc Arena Background Defrag)';
      recommendedCommand = `redis-cli CONFIG SET activedefrag yes`;
      findings = [
        {
          objectName: `Key Space (Jemalloc Arena Fragmentation)`,
          objectType: 'table',
          totalSizeBytes,
          bloatSizeBytes: tableBloatBytes,
          bloatPercentage: deadPct,
          wastedStorageFormatted: `${(tableBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: 'Memory fragmentation ratio > 1.5 consumes host RAM even with expired keys',
          remedyAction: 'Enable Redis Active Defragmentation (activedefrag yes)',
        },
      ];

      repackScript = `#!/usr/bin/env bash
# Redis Online Active Memory Defragmentation
redis-cli CONFIG SET activedefrag yes
redis-cli CONFIG SET active-defrag-ignore-bytes 104857600   # 100MB threshold
redis-cli CONFIG SET active-defrag-threshold-lower 10       # Start defrag at 10% fragmentation
redis-cli CONFIG SET active-defrag-cycle-min 25
redis-cli CONFIG SET active-defrag-cycle-max 75
redis-cli CONFIG REWRITE
`;

      autovacuumDdl = `# Add to redis.conf for persistent memory defragmentation:
activedefrag yes
active-defrag-ignore-bytes 104857600
active-defrag-threshold-lower 10
active-defrag-threshold-upper 30
active-defrag-cycle-min 20
active-defrag-cycle-max 70
`;

      hygieneQuery = `redis-cli INFO memory | grep -E "used_memory_human|used_memory_rss_human|mem_fragmentation_ratio"`;

      expertRecommendations = [
        'Redis `mem_fragmentation_ratio` over 1.4 means 40%+ of RAM used by the Redis process is wasted in OS allocator fragmentation.',
        'Active defragmentation moves allocations in memory while the server is running without blocking client commands.',
        'Avoid variable-sized key modifications in the same arena to keep jemalloc slab allocation smooth.',
      ];

    // --- 9. Snowflake / Cloud Data Warehouse ---
    } else if (engineFamily === 'snowflake') {
      lockLevel = 'NONE (Serverless Background Re-clustering)';
      recommendedCommand = `ALTER TABLE ${table} RECLUSTER;`;
      findings = [
        {
          objectName: `${table} (Overlapping Micro-Partitions & Time Travel)`,
          objectType: 'table',
          totalSizeBytes,
          bloatSizeBytes: tableBloatBytes,
          bloatPercentage: deadPct,
          wastedStorageFormatted: `${(tableBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: 'Partition overlap forces queries to scan excessive micro-partitions',
          remedyAction: 'Define clustering key and run ALTER TABLE ... RECLUSTER',
        },
      ];

      repackScript = `-- Snowflake Micro-Partition Optimization & Clustering Rebuild
-- Define clustering keys to group correlated rows into cohesive micro-partitions:
ALTER TABLE ${table} CLUSTER BY (DATE_TRUNC('month', created_at), status);

-- Trigger explicit re-clustering of unmerged partitions:
ALTER TABLE ${table} RECLUSTER;
`;

      autovacuumDdl = `-- Snowflake Time Travel & Storage Cost Optimization
-- Reduce Time Travel retention on high-churn staging tables from 90 days to 1 day:
ALTER TABLE ${table} SET DATA_RETENTION_TIME_IN_DAYS = 1;
`;

      hygieneQuery = `-- Inspect Snowflake Micro-Partition Clustering Depth
SELECT SYSTEM$CLUSTERING_DEPTH('${table}');
SELECT 
    table_name, 
    active_bytes / (1024*1024*1024) AS active_gb,
    time_travel_bytes / (1024*1024*1024) AS time_travel_gb,
    failsafe_bytes / (1024*1024*1024) AS failsafe_gb
FROM snowflake.account_usage.table_storage_metrics
WHERE table_name = UPPER('${table}');`;

      expertRecommendations = [
        'Every `UPDATE` or `DELETE` in Snowflake creates brand new immutable micro-partitions, retaining old versions in Time Travel storage fees.',
        'Keep `DATA_RETENTION_TIME_IN_DAYS = 1` on high-churn ELT staging tables to avoid paying storage for dead partition history.',
        'Cluster on low-cardinality date/status keys so partition pruning skips 90%+ of micro-partitions during analytical queries.',
      ];

    // --- 10. Search Engines (Elasticsearch / OpenSearch / Solr) ---
    } else if (engineFamily === 'search') {
      lockLevel = 'NONE (Online Background Segment Merge)';
      recommendedCommand = `POST /${table}/_forcemerge?max_num_segments=1&only_expunge_deletes=true`;
      findings = [
        {
          objectName: `${table} (Lucene Deleted Document Bitsets & Segments)`,
          objectType: 'table',
          totalSizeBytes,
          bloatSizeBytes: tableBloatBytes,
          bloatPercentage: deadPct,
          wastedStorageFormatted: `${(tableBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: 'Deleted documents remain on disk in immutable segments until segment merge executes',
          remedyAction: `Trigger background force-merge: POST /${table}/_forcemerge?max_num_segments=1`,
        },
        {
          objectName: `${table} (FST Inverted Index Dictionary)`,
          objectType: 'index',
          totalSizeBytes: Math.floor(totalSizeBytes * 0.40),
          bloatSizeBytes: indexBloatBytes,
          bloatPercentage: Math.min(95, deadPct + 5),
          wastedStorageFormatted: `${(indexBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: 'Segment count amplification causes excessive filesystem descriptor churn',
          remedyAction: 'Consolidate Lucene shard segments via Index Lifecycle Management (ILM)',
        },
      ];

      repackScript = `#!/usr/bin/env bash
# Elasticsearch / OpenSearch Zero-Downtime Segment Defragmentation
# 1. Expunge soft-deleted documents from immutable Lucene segments:
curl -X POST "http://localhost:9200/${table}/_forcemerge?only_expunge_deletes=true"

# 2. Force-merge segments into single optimized segment per shard:
curl -X POST "http://localhost:9200/${table}/_forcemerge?max_num_segments=1"

# 3. Flush transaction log to disk:
curl -X POST "http://localhost:9200/${table}/_flush/synced"
`;

      autovacuumDdl = `PUT /_ilm/policy/${table}_retention_policy
{
  "policy": {
    "phases": {
      "warm": {
        "actions": {
          "forcemerge": { "max_num_segments": 1 },
          "shrink": { "number_of_shards": 1 }
        }
      },
      "delete": {
        "min_age": "30d",
        "actions": { "delete": {} }
      }
    }
  }
}
`;

      hygieneQuery = `GET /_cat/indices/${table}?v&h=index,docs.count,docs.deleted,pri.store.size,segments.count`;

      expertRecommendations = [
        'Lucene segments are write-once; deleting a document merely flips a bit in a tombstone bitset until a merge occurs.',
        'Always run `_forcemerge` only on read-only or rolled-over indices; merging active write indices can trigger severe I/O throttling.',
        'Configure Index Lifecycle Management (ILM) to automatically force-merge older indices during off-peak hours.',
      ];

    // --- 11. Graph Databases (Neo4j / Memgraph / TigerGraph) ---
    } else if (engineFamily === 'graph') {
      lockLevel = 'ONLINE (Transactional Node & Relationship Compaction)';
      recommendedCommand = `CALL dbms.compactDatabase('${table}');`;
      findings = [
        {
          objectName: `${table} (Dead Node & Relationship Store Records)`,
          objectType: 'table',
          totalSizeBytes,
          bloatSizeBytes: tableBloatBytes,
          bloatPercentage: deadPct,
          wastedStorageFormatted: `${(tableBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: 'Deleted nodes leave vacant pointer slots in double-linked relationship chains',
          remedyAction: 'Execute Neo4j store compaction and drop dangling property store blocks',
        },
      ];

      repackScript = `#!/usr/bin/env bash
# Neo4j Store File Compaction & Free Block Reallocation
neo4j-admin database copy --from-database=neo4j --to-database=compacted_neo4j --compact-node-store
neo4j-admin database copy --from-database=neo4j --to-database=compacted_neo4j --compact-relationship-store
`;

      autovacuumDdl = `# neo4j.conf Storage Optimization Settings
dbms.transaction.log.rotation.retention_policy=2 days
dbms.jvm.additional=-XX:+UseG1GC
dbms.memory.pagecache.size=${Math.round(sizeGb * 0.6)}g
`;

      hygieneQuery = `CALL apoc.monitor.store() YIELD nodeStoreSize, relationshipStoreSize, propertyStoreSize;`;

      expertRecommendations = [
        'Neo4j node and relationship records use fixed-size disk blocks. When entities are deleted, pointer reuse can cause fragmentation.',
        'Use `neo4j-admin database copy --compact-node-store` during scheduled maintenance to repack pointers and reclaim contiguous disk extents.',
        'Prune transactional write-ahead logs (`dbms.transaction.log.rotation.retention_policy`) to avoid disk bloat from Cypher batch mutations.',
      ];

    // --- 12. Time-Series (TimescaleDB / InfluxDB / QuestDB) ---
    } else if (engineFamily === 'timeseries') {
      lockLevel = 'NONE (Background Columnar Chunk Compression)';
      recommendedCommand = `SELECT compress_chunk(c) FROM show_chunks('${table}') c;`;
      findings = [
        {
          objectName: `${table} (Uncompressed Row-Store Chunks)`,
          objectType: 'table',
          totalSizeBytes,
          bloatSizeBytes: tableBloatBytes,
          bloatPercentage: deadPct,
          wastedStorageFormatted: `${(tableBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: 'Older chunks remaining in uncompressed row format consume 90% more disk bandwidth',
          remedyAction: `Convert aged chunks to columnar format via compress_chunk()`,
        },
      ];

      repackScript = `-- TimescaleDB Hypertable Chunk Compression & Data Defragmentation
-- 1. Enable compression policy on hypertable:
ALTER TABLE ${table} SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'device_id',
    timescaledb.compress_orderby = 'recorded_at DESC'
);

-- 2. Add automatic policy for chunks older than 7 days:
SELECT add_compression_policy('${table}', INTERVAL '7 days');

-- 3. Compress all existing historical chunks immediately:
SELECT compress_chunk(i) FROM show_chunks('${table}', older_than => INTERVAL '7 days') i;
`;

      autovacuumDdl = `-- TimescaleDB Automated Data Retention & Chunk Drop Policy
SELECT add_retention_policy('${table}', INTERVAL '90 days');
`;

      hygieneQuery = `SELECT 
    hypertable_name, 
    chunk_name, 
    is_compressed, 
    pg_size_pretty(before_compression_total_bytes) AS uncompressed_size,
    pg_size_pretty(after_compression_total_bytes) AS compressed_size
FROM timescaledb_information.chunks
WHERE hypertable_name = '${table}';`;

      expertRecommendations = [
        'TimescaleDB columnar compression achieves 90-95% disk reduction while maintaining queryability.',
        'Always segment compression by high-cardinality lookup keys (e.g., `device_id`, `tenant_id`) and order by timestamp.',
        'Drop old chunks via `drop_chunks()` instead of running `DELETE`; dropping a chunk is an instant metadata operation without MVCC bloat.',
      ];

    // --- 13. Vector AI Engines (Milvus / Pinecone / Qdrant / pgvector) ---
    } else if (engineFamily === 'vector') {
      lockLevel = 'NONE (Online Background Segment Vector Compaction)';
      recommendedCommand = `POST /collections/${table}/compact`;
      findings = [
        {
          objectName: `${table} (Tombstoned Vectors & Fragmented HNSW Graph)`,
          objectType: 'table',
          totalSizeBytes,
          bloatSizeBytes: tableBloatBytes,
          bloatPercentage: deadPct,
          wastedStorageFormatted: `${(tableBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: 'Deleted embedding IDs remain in HNSW neighbor links, degrading ANN recall accuracy',
          remedyAction: `Trigger collection compaction and rebuild HNSW/IVF index segments`,
        },
      ];

      repackScript = `#!/usr/bin/env bash
# Milvus / Vector Database Collection Compaction
curl -X POST "http://localhost:19530/v2/vectordb/collections/compact" \\
  -H "Content-Type: application/json" \\
  -d '{"collectionName": "${table}"}'

# Rebuild ANN Index Graph after vector purges:
curl -X POST "http://localhost:19530/v2/vectordb/indexes/rebuild" \\
  -H "Content-Type: application/json" \\
  -d '{"collectionName": "${table}", "fieldName": "vector"}'
`;

      autovacuumDdl = `# Vector Store Auto-Compaction Settings
auto_compaction_enabled: true
compaction_trigger_deleted_ratio: 0.15
segment_max_size_mb: 512
`;

      hygieneQuery = `GET /v2/vectordb/collections/describe?collectionName=${table}`;

      expertRecommendations = [
        'Vector deletions mark entity vectors as tombstones without immediately recomputing graph neighbor links.',
        'Compaction merges smaller raw segments into target 512MB segments and purges deleted embeddings.',
        'Rebuild scalar and HNSW indexes after large deletions to restore maximum ANN search throughput (QPS).',
      ];

    // --- 14. Distributed SQL (CockroachDB / YugabyteDB / TiDB) ---
    } else if (engineFamily === 'cockroach') {
      lockLevel = 'NONE (Distributed Range LSM Compaction)';
      recommendedCommand = `ALTER TABLE ${table} CONFIGURE ZONE USING gc.ttlseconds = 86400;`;
      findings = [
        {
          objectName: `${table} (Pebble/RocksDB MVCC Historical Keys & Range Tombstones)`,
          objectType: 'table',
          totalSizeBytes,
          bloatSizeBytes: tableBloatBytes,
          bloatPercentage: deadPct,
          wastedStorageFormatted: `${(tableBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: 'Uncompacted MVCC row revisions force Range Leaseholders to scan dead Pebble key tombstones',
          remedyAction: 'Reduce gc.ttlseconds and trigger range compaction on table span',
        },
      ];

      repackScript = `-- CockroachDB Zone Configuration & Range Compaction
-- 1. Lower MVCC Garbage Collection TTL to 24 hours:
ALTER TABLE ${table} CONFIGURE ZONE USING gc.ttlseconds = 86400;

-- 2. Force manual compaction on range span:
ALTER RANGE [table_start_key, table_end_key] COMPACT;
`;

      autovacuumDdl = `-- CockroachDB Automated GC Settings
ALTER TABLE ${table} CONFIGURE ZONE USING 
    gc.ttlseconds = 86400,
    range_min_bytes = 16777216,
    range_max_bytes = 67108864;
`;

      hygieneQuery = `SHOW ZONE CONFIGURATION FOR TABLE ${table};
SELECT * FROM crdb_internal.ranges WHERE table_name = '${table}';`;

      expertRecommendations = [
        'CockroachDB retains historical row versions for Time Travel queries (AS OF SYSTEM TIME).',
        'Lowering `gc.ttlseconds` allows Pebble background compactions to drop dead revisions and reclaim NVMe disk space.',
        'Ensure tables with heavy UPDATE traffic have compact primary keys to avoid large LSM range tombstone scans.',
      ];

    // --- 15. Streaming & Ledger (Kafka / Redpanda / Immudb) ---
    } else if (engineFamily === 'streaming_ledger') {
      lockLevel = 'NONE (Background Topic Log Cleaner Thread)';
      recommendedCommand = `kafka-configs.sh --alter --entity-type topics --entity-name ${table} --add-config cleanup.policy=compact`;
      findings = [
        {
          objectName: `${table} (Uncompacted Log Segments & Superseded Record Keys)`,
          objectType: 'table',
          totalSizeBytes,
          bloatSizeBytes: tableBloatBytes,
          bloatPercentage: deadPct,
          wastedStorageFormatted: `${(tableBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: 'Outdated record keys remain in append-only partition segment files',
          remedyAction: 'Enable log compaction policy and tune min.cleanable.dirty.ratio',
        },
      ];

      repackScript = `#!/usr/bin/env bash
# Kafka / Redpanda Topic Log Compaction
kafka-configs.sh --bootstrap-server localhost:9092 \\
  --alter --entity-type topics --entity-name ${table} \\
  --add-config cleanup.policy=compact,min.cleanable.dirty.ratio=0.2,segment.ms=86400000
`;

      autovacuumDdl = `# Broker server.properties Log Cleaner Tuning
log.cleaner.enable=true
log.cleaner.threads=4
log.cleaner.dedupe.buffer.size=134217728
`;

      hygieneQuery = `kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic ${table}`;

      expertRecommendations = [
        'Log compaction ensures that Kafka retains at least the last known value for each record key within a partition.',
        'Lower `min.cleanable.dirty.ratio` (e.g., from 0.5 to 0.2) to initiate cleaner threads more frequently on active topics.',
        'Ensure messages specify unique partition keys; records with null keys cannot be compacted and will be retained indefinitely.',
      ];

    // --- 16. Spatial & Geo (PostGIS / Tile38 / SpatiaLite) ---
    } else if (engineFamily === 'geo_spatial') {
      lockLevel = 'CONCURRENT (Spatial GiST / R-Tree Bounding Box Repack)';
      recommendedCommand = `CLUSTER ${table} USING idx_${table}_geom;`;
      findings = [
        {
          objectName: `${table} (Fragmented Spatial Geometries & GiST Index Bounding Boxes)`,
          objectType: 'table',
          totalSizeBytes,
          bloatSizeBytes: tableBloatBytes,
          bloatPercentage: deadPct,
          wastedStorageFormatted: `${(tableBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: 'Overlapping spatial bounding boxes in GiST index cause redundant tree traversals',
          remedyAction: `Re-cluster table along spatial Hilbert curve and reindex GiST concurrently`,
        },
      ];

      repackScript = `-- Spatial Table & R-Tree / GiST Defragmentation
CLUSTER ${table} USING idx_${table}_geom;
REINDEX INDEX CONCURRENTLY idx_${table}_geom;
VACUUM ANALYZE ${table};
`;

      autovacuumDdl = `ALTER TABLE ${table} SET (autovacuum_vacuum_scale_factor = 0.05);`;
      hygieneQuery = `SELECT relname, n_dead_tup, round(n_dead_tup::numeric / (n_live_tup + 1) * 100, 2) AS dead_pct FROM pg_stat_user_tables WHERE relname = '${table}';`;

      expertRecommendations = [
        'Spatial GiST indexes degrade in efficiency as bounding boxes become fragmented from non-spatial updates.',
        'Reclustering on a spatial index physically orders geometries along a Hilbert curve for optimal disk locality.',
        'Use `REINDEX INDEX CONCURRENTLY` to avoid blocking GIS API endpoints.',
      ];

    // --- 17. PostgreSQL Family (Default) ---
    } else {
      lockLevel = 'NONE (Zero-Downtime Online Repack via pg_repack / REINDEX CONCURRENTLY)';
      recommendedCommand = `REINDEX TABLE CONCURRENTLY ${table};`;
      findings = [
        {
          objectName: `public.${table} (Heap Tuple Pages)`,
          objectType: 'table',
          totalSizeBytes,
          bloatSizeBytes: tableBloatBytes,
          bloatPercentage: deadPct,
          wastedStorageFormatted: `${(tableBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: 'Sequential scans read dead tuple pages, evicting active data from shared_buffers',
          remedyAction: `pg_repack --table=public.${table} or VACUUM (VERBOSE, ANALYZE)`,
        },
        {
          objectName: `idx_${table}_pkey (B-Tree Leaf Pages)`,
          objectType: 'index',
          totalSizeBytes: Math.floor(totalSizeBytes * 0.35),
          bloatSizeBytes: indexBloatBytes,
          bloatPercentage: Math.min(95, deadPct + 8),
          wastedStorageFormatted: `${(indexBloatBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`,
          diskRandomSeekPenalty: 'B-Tree depth increased from 3 to 5 levels (additional random page seeks per lookup)',
          remedyAction: `REINDEX TABLE CONCURRENTLY ${table};`,
        },
      ];

      repackScript = `-- PostgreSQL Zero-Downtime Online Table & Index Repack
-- Method 1: Concurrent B-Tree Reindexing (Zero Lock Blocking, Postgres 12+)
REINDEX TABLE CONCURRENTLY ${table};

-- Method 2: Online Full Physical Table Repack using pg_repack (No Exclusive Table Locks)
# pg_repack --dbname=production_db --table=public.${table} --jobs=4
`;

      autovacuumDdl = `-- Aggressive Table-Specific Autovacuum Tuning to Prevent Future Bloat
ALTER TABLE ${table} SET (
    autovacuum_vacuum_scale_factor = 0.05,       -- Trigger vacuum on 5% row changes (default is 20%)
    autovacuum_vacuum_threshold = 1000,          -- Minimum 1,000 dead tuples
    autovacuum_analyze_scale_factor = 0.02,      -- Trigger analyze on 2% row changes
    autovacuum_vacuum_cost_limit = 2000,         -- Increase cost limit to prevent throttling
    autovacuum_vacuum_cost_delay = 2             -- Minimize sleep delay during cleanup
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
WHERE relname = '${table}'
ORDER BY n_dead_tup DESC;`;

      expertRecommendations = [
        'Never run plain `VACUUM FULL` in production without a scheduled maintenance window; it acquires an `ACCESS EXCLUSIVE` lock blocking all reads and writes.',
        'Use `REINDEX CONCURRENTLY` in Postgres 12+ or `pg_repack` to reclaim table and index disk space with zero lock interruption.',
        'Lower `autovacuum_vacuum_scale_factor` from default 0.20 to 0.02-0.05 on high-write tables so autovacuum runs frequently and avoids massive bloat spikes.',
      ];
    }

    const totalWastedStorageFormatted = estimatedDiskFreedGb >= 1000
      ? `${(estimatedDiskFreedGb / 1024).toFixed(2)} TB`
      : `${estimatedDiskFreedGb} GB`;

    const totalTableSizeFormatted = sizeGb >= 1000
      ? `${(sizeGb / 1024).toFixed(1)} TB`
      : `${sizeGb} GB`;

    return {
      engine: meta.id,
      engineName: engineName || meta.name,
      tableName: table,
      totalTableSizeFormatted,
      totalWastedStorageFormatted,
      averageBloatPercentage: deadPct,
      findings,
      repackScript,
      autovacuumTuningDdl: autovacuumDdl,
      hygieneCheckQuery: hygieneQuery,
      expertRecommendations,
      vacuumMetrics: {
        estimatedDurationMinutes,
        estimatedDiskFreedGb,
        postVacuumTableSizeGb: postVacuumSizeGb,
        lockLevel,
        recommendedCommand,
        autovacuumUrgency,
        dailyBloatGrowthMb,
        triggerThresholdDeadTuples,
        ioThroughputAssumedMbSec: ioSpeed,
      },
    };
  }
}
