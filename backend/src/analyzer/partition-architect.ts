import { DATABASE_CATALOG } from '../types/db-catalog.data';

export interface PartitionRequest {
  engine: string;
  tableName: string;
  partitionColumn: string;
  strategy: 'range_monthly' | 'range_daily' | 'hash_sharding' | 'list_region' | 'composite_range_hash';
  estimatedMonthlyRows?: number;
  retentionMonths?: number;
}

export interface ShardSlice {
  shardName: string;
  rangeOrHash: string;
  estimatedRows: string;
  estimatedSizeGb: string;
}

export interface PartitionResult {
  engine: string;
  engineName: string;
  strategy: string;
  strategyTitle: string;
  tableName: string;
  partitionColumn: string;
  partitionDdl: string;
  maintenanceAutomation: string;
  pruningSimulation: {
    sampleQuery: string;
    partitionsScanned: string;
    totalPartitions: number;
    speedupFactor: string;
    explanation: string;
  };
  shardDistribution: ShardSlice[];
  expertGuidelines: string[];
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

export class PartitionArchitect {
  public plan(req: PartitionRequest): PartitionResult {
    const meta = getEngineMeta(req.engine);
    const table = req.tableName || 'events_log';
    const col = req.partitionColumn || 'created_at';
    const strategy = req.strategy || 'range_monthly';
    const rows = Math.max(100000, req.estimatedMonthlyRows || 10000000);
    const retention = Math.max(1, req.retentionMonths || 12);

    const norm = req.engine.toLowerCase();

    if (norm === 'clickhouse') {
      return this.planClickHouse(meta, table, col, strategy, rows, retention);
    } else if (norm === 'mysql' || norm === 'mariadb') {
      return this.planMySQL(meta, table, col, strategy, rows, retention);
    } else if (norm === 'mongodb') {
      return this.planMongo(meta, table, col, strategy, rows, retention);
    } else if (norm === 'cassandra' || norm === 'scylladb') {
      return this.planCassandra(meta, table, col, strategy, rows, retention);
    } else {
      // Default: PostgreSQL Declarative Partitioning
      return this.planPostgres(meta, table, col, strategy, rows, retention);
    }
  }

  private planPostgres(meta: any, table: string, col: string, strategy: string, rows: number, retention: number): PartitionResult {
    const ddl = `-- PostgreSQL Declarative Partitioning Master Table
CREATE TABLE ${table} (
    id BIGSERIAL,
    tenant_id INT NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB,
    ${col} TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id, ${col})
) PARTITION BY RANGE (${col});

-- Sample Range Partitions for 2026 (Monthly Slices)
CREATE TABLE ${table}_2026_10 PARTITION OF ${table}
    FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');

CREATE TABLE ${table}_2026_11 PARTITION OF ${table}
    FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');

CREATE TABLE ${table}_2026_12 PARTITION OF ${table}
    FOR VALUES FROM ('2026-12-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');

-- Zero-Downtime Local Indexes on Child Partitions
CREATE INDEX idx_${table}_tenant ON ${table}(tenant_id, ${col} DESC);
`;

    const partman = `-- Automated Partition Management via pg_partman extension
CREATE EXTENSION IF NOT EXISTS pg_partman;

SELECT partman.create_parent(
    p_parent_table => 'public.${table}',
    p_control => '${col}',
    p_type => 'native',
    p_interval => 'monthly',
    p_premake => 4
);

-- Retention Policy (Drop or Detach partitions older than ${retention} months)
UPDATE partman.part_config 
SET retention = '${retention} months', retention_keep_table = false
WHERE parent_table = 'public.${table}';
`;

    const avgRowSizeBytes = 250;
    const monthlySizeGb = +((rows * avgRowSizeBytes) / (1024 * 1024 * 1024)).toFixed(2);

    const shards: ShardSlice[] = [
      { shardName: `${table}_2026_10`, rangeOrHash: '2026-10-01 to 2026-10-31', estimatedRows: `${(rows / 1000000).toFixed(1)}M rows`, estimatedSizeGb: `${monthlySizeGb} GB` },
      { shardName: `${table}_2026_11`, rangeOrHash: '2026-11-01 to 2026-11-30', estimatedRows: `${(rows / 1000000).toFixed(1)}M rows`, estimatedSizeGb: `${monthlySizeGb} GB` },
      { shardName: `${table}_2026_12`, rangeOrHash: '2026-12-01 to 2026-12-31', estimatedRows: `${(rows / 1000000).toFixed(1)}M rows`, estimatedSizeGb: `${monthlySizeGb} GB` },
      { shardName: `${table}_default`, rangeOrHash: 'Catch-all Unmatched', estimatedRows: '< 10K rows', estimatedSizeGb: '< 0.1 GB' },
    ];

    return {
      engine: meta.id,
      engineName: meta.name,
      strategy,
      strategyTitle: 'PostgreSQL Native Declarative Range Partitioning',
      tableName: table,
      partitionColumn: col,
      partitionDdl: ddl,
      maintenanceAutomation: partman,
      pruningSimulation: {
        sampleQuery: `SELECT * FROM ${table} WHERE ${col} >= '2026-10-15' AND ${col} < '2026-10-20';`,
        partitionsScanned: '1 of 12 child partitions (91.6% I/O reduction)',
        totalPartitions: 12,
        speedupFactor: '12x faster scan time',
        explanation: 'PostgreSQL Partition Pruning (enable_partition_pruning = on) excludes all non-matching partition tables at query planning time.',
      },
      shardDistribution: shards,
      expertGuidelines: [
        'Primary Key must include the partitioning column (e.g. PRIMARY KEY (id, created_at)).',
        'Drop old partitions instantly with `DROP TABLE partition_name` instead of running slow, space-bloating `DELETE FROM` statements.',
        'Use pg_partman background worker to pre-create upcoming month partitions automatically.',
      ],
    };
  }

  private planClickHouse(meta: any, table: string, col: string, strategy: string, rows: number, retention: number): PartitionResult {
    const ddl = `-- ClickHouse High-Throughput Columnar Partitioning
CREATE TABLE ${table} (
    id UInt64,
    tenant_id UInt32,
    event_type LowCardinality(String),
    payload String,
    ${col} DateTime64(3, 'UTC')
) ENGINE = ReplacingMergeTree()
PARTITION BY toYYYYMM(${col})
ORDER BY (tenant_id, ${col}, id)
TTL ${col} + INTERVAL ${retention} MONTH DELETE;
`;

    return {
      engine: meta.id,
      engineName: meta.name,
      strategy,
      strategyTitle: 'ClickHouse Columnar Partitioning with Auto TTL Eviction',
      tableName: table,
      partitionColumn: col,
      partitionDdl: ddl,
      maintenanceAutomation: `-- ClickHouse automatically merges and evicts parts using background merge threads.\n-- Verify partition parts state:\nSELECT partition, name, active, rows, data_uncompressed_bytes FROM system.parts WHERE table = '${table}';`,
      pruningSimulation: {
        sampleQuery: `SELECT count() FROM ${table} WHERE ${col} >= '2026-10-01' AND ${col} < '2026-11-01';`,
        partitionsScanned: '1 partition part directory (202610)',
        totalPartitions: 12,
        speedupFactor: 'Zero-overhead minmax partition index seek',
        explanation: 'ClickHouse skips entire physical part folders matching the toYYYYMM() expression.',
      },
      shardDistribution: [
        { shardName: '202610', rangeOrHash: 'toYYYYMM = 202610', estimatedRows: `${(rows / 1000000).toFixed(1)}M rows`, estimatedSizeGb: `${+(rows * 60 / (1024*1024*1024)).toFixed(2)} GB (Compressed)` },
      ],
      expertGuidelines: [
        'Do NOT partition by daily date if inserting millions of rows per hour, as this creates too many small parts.',
        'Always set TTL clause directly in table DDL for automatic partition dropping without cron jobs.',
      ],
    };
  }

  private planMySQL(meta: any, table: string, col: string, strategy: string, rows: number, retention: number): PartitionResult {
    const ddl = `-- MySQL 8.0 InnoDB Range Partitioning
CREATE TABLE ${table} (
    id BIGINT NOT NULL,
    tenant_id INT NOT NULL,
    payload JSON,
    ${col} DATETIME NOT NULL,
    PRIMARY KEY (id, ${col})
) ENGINE=InnoDB
PARTITION BY RANGE (TO_DAYS(${col})) (
    PARTITION p_2026_10 VALUES LESS THAN (TO_DAYS('2026-11-01')),
    PARTITION p_2026_11 VALUES LESS THAN (TO_DAYS('2026-12-01')),
    PARTITION p_2026_12 VALUES LESS THAN (TO_DAYS('2027-01-01')),
    PARTITION p_max VALUES LESS THAN MAXVALUE
);
`;

    return {
      engine: meta.id,
      engineName: meta.name,
      strategy,
      strategyTitle: 'MySQL InnoDB Range Partitioning with TO_DAYS',
      tableName: table,
      partitionColumn: col,
      partitionDdl: ddl,
      maintenanceAutomation: `-- Add new partition with zero-downtime:\nALTER TABLE ${table} REORGANIZE PARTITION p_max INTO (\n    PARTITION p_2027_01 VALUES LESS THAN (TO_DAYS('2027-02-01')),\n    PARTITION p_max VALUES LESS THAN MAXVALUE\n);`,
      pruningSimulation: {
        sampleQuery: `SELECT * FROM ${table} WHERE ${col} BETWEEN '2026-10-01' AND '2026-10-31';`,
        partitionsScanned: 'p_2026_10 only',
        totalPartitions: 4,
        speedupFactor: '4x faster InnoDB buffer pool scan',
        explanation: 'MySQL Partition Pruning analyzes WHERE predicates containing TO_DAYS() to isolate physical partition files.',
      },
      shardDistribution: [
        { shardName: 'p_2026_10', rangeOrHash: '< 2026-11-01', estimatedRows: `${(rows / 1000000).toFixed(1)}M`, estimatedSizeGb: '2.5 GB' },
      ],
      expertGuidelines: [
        'InnoDB requires all UNIQUE keys to explicitly contain the partition expression column.',
      ],
    };
  }

  private planMongo(meta: any, table: string, col: string, strategy: string, rows: number, retention: number): PartitionResult {
    const ddl = `// MongoDB Sharding Strategy & Key Configuration
// 1. Enable sharding on database
sh.enableSharding("production_db");

// 2. Create compound hashed shard key to ensure even cluster distribution
sh.shardCollection("production_db.${table}", { "tenant_id": "hashed", "${col}": 1 });

// 3. TTL Index for automated document expiry after ${retention} months
db.${table}.createIndex(
  { "${col}": 1 },
  { expireAfterSeconds: ${retention * 30 * 24 * 60 * 60} }
);
`;

    return {
      engine: meta.id,
      engineName: meta.name,
      strategy,
      strategyTitle: 'MongoDB Compound Hashed Sharding with TTL Expiry',
      tableName: table,
      partitionColumn: col,
      partitionDdl: ddl,
      maintenanceAutomation: `// Check Shard Chunk Distribution:\nsh.status();\ndb.${table}.getShardDistribution();`,
      pruningSimulation: {
        sampleQuery: `db.${table}.find({ tenant_id: 1048, ${col}: { $gte: ISODate("2026-10-01") } });`,
        partitionsScanned: 'Targeted single-shard routing (Mongos query router skips all other shards)',
        totalPartitions: 4,
        speedupFactor: 'Direct mongos shard key targeting',
        explanation: 'Query router hashes tenant_id and routes request directly to the authoritative mongod shard without scatter-gather.',
      },
      shardDistribution: [
        { shardName: 'shard-01', rangeOrHash: 'tenant_id hash bucket 0..25%', estimatedRows: `${(rows * 0.25 / 1000000).toFixed(1)}M`, estimatedSizeGb: '5.0 GB' },
        { shardName: 'shard-02', rangeOrHash: 'tenant_id hash bucket 25..50%', estimatedRows: `${(rows * 0.25 / 1000000).toFixed(1)}M`, estimatedSizeGb: '5.0 GB' },
        { shardName: 'shard-03', rangeOrHash: 'tenant_id hash bucket 50..75%', estimatedRows: `${(rows * 0.25 / 1000000).toFixed(1)}M`, estimatedSizeGb: '5.0 GB' },
        { shardName: 'shard-04', rangeOrHash: 'tenant_id hash bucket 75..100%', estimatedRows: `${(rows * 0.25 / 1000000).toFixed(1)}M`, estimatedSizeGb: '5.0 GB' },
      ],
      expertGuidelines: [
        'Avoid monotonic ascending shard keys (e.g. ObjectID or timestamp only) as they cause single-shard write hot-spotting.',
      ],
    };
  }

  private planCassandra(meta: any, table: string, col: string, strategy: string, rows: number, retention: number): PartitionResult {
    const ddl = `-- Apache Cassandra / ScyllaDB Compound Partition & Clustering Key Architecture
CREATE KEYSPACE IF NOT EXISTS production_keyspace
WITH replication = {'class': 'NetworkTopologyStrategy', 'us-east-1': 3};

CREATE TABLE production_keyspace.${table} (
    tenant_id uuid,
    bucket_date text, -- e.g. '2026-10'
    ${col} timestamp,
    id timeuuid,
    payload text,
    PRIMARY KEY ((tenant_id, bucket_date), ${col}, id)
) WITH CLUSTERING ORDER BY (${col} DESC, id ASC)
  AND default_time_to_live = ${retention * 30 * 24 * 60 * 60};
`;

    return {
      engine: meta.id,
      engineName: meta.name,
      strategy,
      strategyTitle: 'Cassandra / ScyllaDB Time-Window Partition Bucketing',
      tableName: table,
      partitionColumn: col,
      partitionDdl: ddl,
      maintenanceAutomation: `-- Monitor SSTable TimeWindowCompactionStrategy:\nALTER TABLE production_keyspace.${table} WITH compaction = {\n    'class': 'TimeWindowCompactionStrategy',\n    'compaction_window_size': '1',\n    'compaction_window_unit': 'DAYS'\n};`,
      pruningSimulation: {
        sampleQuery: `SELECT * FROM ${table} WHERE tenant_id = 94812 AND bucket_date = '2026-10' AND ${col} >= '2026-10-15';`,
        partitionsScanned: '1 partition token (O(1) direct ring node lookup)',
        totalPartitions: 256,
        speedupFactor: 'Sub-millisecond token-aware ring routing',
        explanation: 'Driver calculates Murmur3Partitioner hash of (tenant_id, bucket_date) and sends request directly to replica nodes.',
      },
      shardDistribution: [
        { shardName: 'Token Bucket', rangeOrHash: 'Murmur3Hash(tenant_id, bucket_date)', estimatedRows: '100K rows per partition', estimatedSizeGb: '25 MB' },
      ],
      expertGuidelines: [
        'Keep partition sizes below 100MB and under 100,000 cells to prevent JVM GC pauses.',
      ],
    };
  }
}
