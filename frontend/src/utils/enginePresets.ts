import { DATABASE_CATALOG, DatabaseEngine, DatabaseCategory } from '../types';

export interface BloatEnginePreset {
  tableName: string;
  totalTableSizeGb: number;
  deadTuplePercentage: number;
  avgDailyUpdates: number;
  targetIoSpeedMbSec: number;
  footprintLabel: string;
}

export interface PartitionEnginePreset {
  tableName: string;
  partitionColumn: string;
  strategy: 'range_monthly' | 'range_daily' | 'hash_sharding' | 'list_region' | 'composite_range_hash';
  estimatedMonthlyRows: number;
  retentionMonths: number;
}

export interface SizingEnginePreset {
  dailyWrites: number;
  avgRowSizeBytes: number;
  retentionDays: number;
  vectorCount: number;
  dimension: number;
  partitionTable: string;
  dbCpuCores: number;
}

export interface FinOpsEnginePreset {
  provider: 'aws_aurora' | 'aws_rds' | 'gcp_cloudsql' | 'gcp_alloydb' | 'azure_sql' | 'azure_cosmos' | 'neon_serverless' | 'supabase_cloud' | 'mongodb_atlas';
  dbSizeGb: number;
  vCpuCount: number;
  ramGb: number;
  readsM: number;
  writesM: number;
}

export interface SecurityEnginePreset {
  tableName: string;
  tenantColumn: string;
}

export interface ConfigTunerEnginePreset {
  ramGb: number;
  cpuCores: number;
  storageType: string;
  workloadType: string;
  maxConnections: number;
}

export interface CdcEnginePreset {
  sourceTable: string;
  destinationBroker: 'kafka' | 'rabbitmq' | 'sqs' | 'redis_streams';
}

export interface DisasterRecoveryEnginePreset {
  dbSizeGb: number;
  dailyChangePercent: number;
  cloudProvider: string;
}

export function getEngineMetadataSafe(engineId: string) {
  const norm = (engineId || 'postgresql').toLowerCase().trim();
  const direct = DATABASE_CATALOG.find((db) => db.id.toLowerCase() === norm);
  if (direct) return direct;
  const partial = DATABASE_CATALOG.find((db) => db.id.toLowerCase().includes(norm) || norm.includes(db.id.toLowerCase()));
  if (partial) return partial;
  return DATABASE_CATALOG[0];
}

export function resolveBloatPreset(engineId: string): BloatEnginePreset {
  const meta = getEngineMetadataSafe(engineId);
  const norm = engineId.toLowerCase();
  const cat = meta.category;

  if (cat === 'olap' || norm.includes('click') || norm.includes('duck') || norm.includes('starrocks') || norm.includes('doris')) {
    return {
      tableName: 'events_distributed',
      totalTableSizeGb: 1200,
      deadTuplePercentage: 22,
      avgDailyUpdates: 2500000,
      targetIoSpeedMbSec: 250,
      footprintLabel: '1.2 TB',
    };
  }
  if (norm.includes('snow') || norm.includes('bigquery') || norm.includes('redshift') || norm.includes('databricks')) {
    return {
      tableName: 'FACT_TRANSACTIONS',
      totalTableSizeGb: 2800,
      deadTuplePercentage: 18,
      avgDailyUpdates: 5000000,
      targetIoSpeedMbSec: 350,
      footprintLabel: '2.8 TB',
    };
  }
  if (cat === 'keyvalue' || norm.includes('redis') || norm.includes('valkey') || norm.includes('keydb') || norm.includes('memcached') || norm.includes('dragonfly')) {
    return {
      tableName: 'session_cache',
      totalTableSizeGb: 16,
      deadTuplePercentage: 24,
      avgDailyUpdates: 8500000,
      targetIoSpeedMbSec: 200,
      footprintLabel: '16 GB RAM',
    };
  }
  if (cat === 'wide_column' || norm.includes('cassandra') || norm.includes('scylla') || norm.includes('hbase')) {
    return {
      tableName: 'sensor_timeseries',
      totalTableSizeGb: 450,
      deadTuplePercentage: 40,
      avgDailyUpdates: 1200000,
      targetIoSpeedMbSec: 120,
      footprintLabel: '450 GB',
    };
  }
  if (cat === 'search' || norm.includes('elastic') || norm.includes('opensearch') || norm.includes('solr') || norm.includes('meili')) {
    return {
      tableName: 'log_search_index',
      totalTableSizeGb: 650,
      deadTuplePercentage: 35,
      avgDailyUpdates: 3200000,
      targetIoSpeedMbSec: 180,
      footprintLabel: '650 GB',
    };
  }
  if (cat === 'graph' || norm.includes('neo4j') || norm.includes('memgraph') || norm.includes('tiger') || norm.includes('neptune')) {
    return {
      tableName: 'nodes_graph_store',
      totalTableSizeGb: 180,
      deadTuplePercentage: 26,
      avgDailyUpdates: 750000,
      targetIoSpeedMbSec: 110,
      footprintLabel: '180 GB',
    };
  }
  if (cat === 'timeseries' || norm.includes('timescale') || norm.includes('influx') || norm.includes('quest') || norm.includes('tdengine')) {
    return {
      tableName: 'device_telemetry_chunks',
      totalTableSizeGb: 820,
      deadTuplePercentage: 29,
      avgDailyUpdates: 6000000,
      targetIoSpeedMbSec: 220,
      footprintLabel: '820 GB',
    };
  }
  if (cat === 'vector' || norm.includes('milvus') || norm.includes('pinecone') || norm.includes('qdrant') || norm.includes('chroma') || norm.includes('weaviate')) {
    return {
      tableName: 'embedding_vectors_hnsw',
      totalTableSizeGb: 95,
      deadTuplePercentage: 21,
      avgDailyUpdates: 400000,
      targetIoSpeedMbSec: 150,
      footprintLabel: '95 GB',
    };
  }
  if (cat === 'baas_embedded' || norm.includes('sqlite') || norm.includes('turso') || norm.includes('libsql') || norm.includes('pglite') || norm.includes('realm')) {
    return {
      tableName: 'user_local_store',
      totalTableSizeGb: 3.5,
      deadTuplePercentage: 25,
      avgDailyUpdates: 45000,
      targetIoSpeedMbSec: 40,
      footprintLabel: '3.5 GB',
    };
  }
  if (norm.includes('cockroach') || norm.includes('yugabyte') || norm.includes('spanner') || norm.includes('tidb')) {
    return {
      tableName: 'global_orders',
      totalTableSizeGb: 380,
      deadTuplePercentage: 30,
      avgDailyUpdates: 1100000,
      targetIoSpeedMbSec: 140,
      footprintLabel: '380 GB',
    };
  }
  if (cat === 'document' || norm.includes('mongo') || norm.includes('couch') || norm.includes('documentdb')) {
    return {
      tableName: 'orders_collection',
      totalTableSizeGb: 95,
      deadTuplePercentage: 34,
      avgDailyUpdates: 600000,
      targetIoSpeedMbSec: 85,
      footprintLabel: '95 GB',
    };
  }
  if (norm.includes('oracle') || norm.includes('db2')) {
    return {
      tableName: 'SALES_TRANSACTIONS',
      totalTableSizeGb: 250,
      deadTuplePercentage: 28,
      avgDailyUpdates: 650000,
      targetIoSpeedMbSec: 100,
      footprintLabel: '250 GB',
    };
  }
  if (norm.includes('sqlserver') || norm.includes('mssql')) {
    return {
      tableName: 'SalesOrders',
      totalTableSizeGb: 140,
      deadTuplePercentage: 35,
      avgDailyUpdates: 450000,
      targetIoSpeedMbSec: 90,
      footprintLabel: '140 GB',
    };
  }
  if (norm.includes('mysql') || norm.includes('maria')) {
    return {
      tableName: 'customer_orders',
      totalTableSizeGb: 85,
      deadTuplePercentage: 32,
      avgDailyUpdates: 400000,
      targetIoSpeedMbSec: 80,
      footprintLabel: '85 GB',
    };
  }

  // PostgreSQL and general relational default
  return {
    tableName: 'orders',
    totalTableSizeGb: 120,
    deadTuplePercentage: 38,
    avgDailyUpdates: 500000,
    targetIoSpeedMbSec: 75,
    footprintLabel: '120 GB',
  };
}

export function resolvePartitionPreset(engineId: string): PartitionEnginePreset {
  const meta = getEngineMetadataSafe(engineId);
  const norm = engineId.toLowerCase();
  const cat = meta.category;

  if (cat === 'olap' || norm.includes('click') || norm.includes('duck')) {
    return {
      tableName: 'events_log',
      partitionColumn: 'event_date',
      strategy: 'range_monthly',
      estimatedMonthlyRows: 150000000,
      retentionMonths: 36,
    };
  }
  if (norm.includes('snow') || norm.includes('bigquery') || norm.includes('redshift')) {
    return {
      tableName: 'FACT_SALES_LINE_ITEMS',
      partitionColumn: 'transaction_date',
      strategy: 'range_monthly',
      estimatedMonthlyRows: 85000000,
      retentionMonths: 48,
    };
  }
  if (cat === 'timeseries' || norm.includes('timescale') || norm.includes('influx')) {
    return {
      tableName: 'telemetry_stream',
      partitionColumn: 'recorded_at',
      strategy: 'range_daily',
      estimatedMonthlyRows: 200000000,
      retentionMonths: 12,
    };
  }
  if (cat === 'wide_column' || norm.includes('cassandra') || norm.includes('scylla')) {
    return {
      tableName: 'device_sensor_history',
      partitionColumn: 'bucket_month',
      strategy: 'hash_sharding',
      estimatedMonthlyRows: 60000000,
      retentionMonths: 24,
    };
  }
  if (cat === 'document' || norm.includes('mongo')) {
    return {
      tableName: 'customer_orders',
      partitionColumn: 'tenant_id',
      strategy: 'hash_sharding',
      estimatedMonthlyRows: 15000000,
      retentionMonths: 24,
    };
  }
  if (norm.includes('cockroach') || norm.includes('yugabyte')) {
    return {
      tableName: 'multi_region_orders',
      partitionColumn: 'geo_region',
      strategy: 'list_region',
      estimatedMonthlyRows: 30000000,
      retentionMonths: 24,
    };
  }
  if (cat === 'search' || norm.includes('elastic') || norm.includes('opensearch')) {
    return {
      tableName: 'application_traces',
      partitionColumn: '@timestamp',
      strategy: 'range_daily',
      estimatedMonthlyRows: 120000000,
      retentionMonths: 6,
    };
  }
  if (cat === 'baas_embedded' || norm.includes('sqlite') || norm.includes('turso')) {
    return {
      tableName: 'audit_events',
      partitionColumn: 'created_at',
      strategy: 'range_monthly',
      estimatedMonthlyRows: 600000,
      retentionMonths: 12,
    };
  }
  if (norm.includes('mysql') || norm.includes('maria')) {
    return {
      tableName: 'order_items',
      partitionColumn: 'created_at',
      strategy: 'range_monthly',
      estimatedMonthlyRows: 20000000,
      retentionMonths: 24,
    };
  }
  if (norm.includes('oracle') || norm.includes('db2')) {
    return {
      tableName: 'ORDER_TRANSACTIONS',
      partitionColumn: 'ORDER_DATE',
      strategy: 'range_monthly',
      estimatedMonthlyRows: 35000000,
      retentionMonths: 36,
    };
  }

  // Default PostgreSQL
  return {
    tableName: 'order_transactions',
    partitionColumn: 'created_at',
    strategy: 'range_monthly',
    estimatedMonthlyRows: 25000000,
    retentionMonths: 24,
  };
}

export function resolveSizingPreset(engineId: string): SizingEnginePreset {
  const meta = getEngineMetadataSafe(engineId);
  const norm = engineId.toLowerCase();
  const cat = meta.category;

  if (cat === 'vector' || norm.includes('milvus') || norm.includes('pinecone') || norm.includes('qdrant') || norm.includes('chroma') || norm.includes('weaviate')) {
    return {
      dailyWrites: 1500000,
      avgRowSizeBytes: 3072, // 1536 float16 vectors + metadata
      retentionDays: 365,
      vectorCount: 5000000,
      dimension: 1536,
      partitionTable: 'vector_embeddings',
      dbCpuCores: 32,
    };
  }
  if (cat === 'keyvalue' || norm.includes('redis') || norm.includes('valkey') || norm.includes('memcached') || norm.includes('dragonfly')) {
    return {
      dailyWrites: 85000000,
      avgRowSizeBytes: 85,
      retentionDays: 30,
      vectorCount: 1000000,
      dimension: 1536,
      partitionTable: 'session_keys',
      dbCpuCores: 16,
    };
  }
  if (cat === 'olap' || norm.includes('click') || norm.includes('snow') || norm.includes('duck') || norm.includes('bigquery')) {
    return {
      dailyWrites: 120000000,
      avgRowSizeBytes: 135,
      retentionDays: 730,
      vectorCount: 1000000,
      dimension: 1536,
      partitionTable: 'events_fact',
      dbCpuCores: 64,
    };
  }
  if (cat === 'timeseries' || norm.includes('timescale') || norm.includes('influx')) {
    return {
      dailyWrites: 60000000,
      avgRowSizeBytes: 95,
      retentionDays: 90,
      vectorCount: 1000000,
      dimension: 1536,
      partitionTable: 'telemetry_stream',
      dbCpuCores: 32,
    };
  }
  if (cat === 'wide_column' || norm.includes('cassandra') || norm.includes('scylla')) {
    return {
      dailyWrites: 40000000,
      avgRowSizeBytes: 380,
      retentionDays: 365,
      vectorCount: 1000000,
      dimension: 1536,
      partitionTable: 'sensor_metrics',
      dbCpuCores: 32,
    };
  }
  if (cat === 'baas_embedded' || norm.includes('sqlite') || norm.includes('turso')) {
    return {
      dailyWrites: 180000,
      avgRowSizeBytes: 240,
      retentionDays: 180,
      vectorCount: 250000,
      dimension: 768,
      partitionTable: 'app_records',
      dbCpuCores: 4,
    };
  }
  if (cat === 'document' || norm.includes('mongo')) {
    return {
      dailyWrites: 12000000,
      avgRowSizeBytes: 680,
      retentionDays: 365,
      vectorCount: 1000000,
      dimension: 1536,
      partitionTable: 'orders_collection',
      dbCpuCores: 16,
    };
  }

  // Relational OLTP
  return {
    dailyWrites: 5000000,
    avgRowSizeBytes: 450,
    retentionDays: 365,
    vectorCount: 1000000,
    dimension: 1536,
    partitionTable: 'orders',
    dbCpuCores: 16,
  };
}

export function resolveFinOpsPreset(engineId: string): FinOpsEnginePreset {
  const meta = getEngineMetadataSafe(engineId);
  const norm = engineId.toLowerCase();
  const cat = meta.category;

  if (norm.includes('mongo') || cat === 'document') {
    return {
      provider: 'mongodb_atlas',
      dbSizeGb: 180,
      vCpuCount: 8,
      ramGb: 32,
      readsM: 70,
      writesM: 20,
    };
  }
  if (norm.includes('supabase')) {
    return {
      provider: 'supabase_cloud',
      dbSizeGb: 120,
      vCpuCount: 8,
      ramGb: 32,
      readsM: 40,
      writesM: 10,
    };
  }
  if (norm.includes('neon') || norm.includes('turso') || cat === 'baas_embedded') {
    return {
      provider: 'neon_serverless',
      dbSizeGb: 45,
      vCpuCount: 4,
      ramGb: 16,
      readsM: 25,
      writesM: 5,
    };
  }
  if (norm.includes('azure') || norm.includes('mssql') || norm.includes('sqlserver')) {
    return {
      provider: 'azure_sql',
      dbSizeGb: 280,
      vCpuCount: 16,
      ramGb: 64,
      readsM: 65,
      writesM: 18,
    };
  }
  if (norm.includes('mysql') || norm.includes('maria')) {
    return {
      provider: 'gcp_cloudsql',
      dbSizeGb: 220,
      vCpuCount: 8,
      ramGb: 32,
      readsM: 55,
      writesM: 14,
    };
  }
  if (cat === 'olap' || norm.includes('click') || norm.includes('snow')) {
    return {
      provider: 'aws_aurora',
      dbSizeGb: 1500,
      vCpuCount: 32,
      ramGb: 128,
      readsM: 180,
      writesM: 85,
    };
  }

  return {
    provider: 'aws_aurora',
    dbSizeGb: 250,
    vCpuCount: 8,
    ramGb: 32,
    readsM: 50,
    writesM: 15,
  };
}

export function resolveSecurityPreset(engineId: string): SecurityEnginePreset {
  const meta = getEngineMetadataSafe(engineId);
  const norm = engineId.toLowerCase();
  const cat = meta.category;

  if (cat === 'olap' || norm.includes('click') || norm.includes('snow')) {
    return {
      tableName: 'account_events',
      tenantColumn: 'account_id',
    };
  }
  if (cat === 'document' || norm.includes('mongo')) {
    return {
      tableName: 'customer_profiles',
      tenantColumn: 'organization_id',
    };
  }
  if (cat === 'wide_column' || norm.includes('cassandra')) {
    return {
      tableName: 'client_telemetry',
      tenantColumn: 'tenant_uuid',
    };
  }
  if (cat === 'graph' || norm.includes('neo4j')) {
    return {
      tableName: 'UserAccountNode',
      tenantColumn: 'tenant_id',
    };
  }
  if (cat === 'baas_embedded' || norm.includes('sqlite')) {
    return {
      tableName: 'local_credentials',
      tenantColumn: 'user_id',
    };
  }

  return {
    tableName: 'customers',
    tenantColumn: 'tenant_id',
  };
}

export function resolveConfigTunerPreset(engineId: string): ConfigTunerEnginePreset {
  const meta = getEngineMetadataSafe(engineId);
  const norm = engineId.toLowerCase();
  const cat = meta.category;

  if (cat === 'baas_embedded' || norm.includes('sqlite') || norm.includes('turso')) {
    return {
      ramGb: 4,
      cpuCores: 2,
      storageType: 'nvme_ssd',
      workloadType: 'oltp_web',
      maxConnections: 50,
    };
  }
  if (cat === 'keyvalue' || norm.includes('redis') || norm.includes('valkey')) {
    return {
      ramGb: 64,
      cpuCores: 8,
      storageType: 'nvme_ssd',
      workloadType: 'in_memory_cache',
      maxConnections: 10000,
    };
  }
  if (cat === 'olap' || norm.includes('click') || norm.includes('duck')) {
    return {
      ramGb: 128,
      cpuCores: 32,
      storageType: 'nvme_ssd',
      workloadType: 'analytics_olap',
      maxConnections: 1200,
    };
  }
  if (cat === 'wide_column' || norm.includes('cassandra') || norm.includes('scylla')) {
    return {
      ramGb: 64,
      cpuCores: 16,
      storageType: 'nvme_ssd',
      workloadType: 'high_write_ingest',
      maxConnections: 2000,
    };
  }

  return {
    ramGb: 32,
    cpuCores: 8,
    storageType: 'nvme_ssd',
    workloadType: 'oltp_web',
    maxConnections: 300,
  };
}

export function resolveCdcPreset(engineId: string): CdcEnginePreset {
  const meta = getEngineMetadataSafe(engineId);
  const norm = engineId.toLowerCase();
  const cat = meta.category;

  if (cat === 'keyvalue' || norm.includes('redis')) {
    return {
      sourceTable: 'session_events',
      destinationBroker: 'redis_streams',
    };
  }
  if (cat === 'olap' || norm.includes('click')) {
    return {
      sourceTable: 'events_log',
      destinationBroker: 'kafka',
    };
  }
  if (cat === 'document' || norm.includes('mongo')) {
    return {
      sourceTable: 'order_stream',
      destinationBroker: 'kafka',
    };
  }

  return {
    sourceTable: 'orders',
    destinationBroker: 'kafka',
  };
}

export function resolveDisasterRecoveryPreset(engineId: string): DisasterRecoveryEnginePreset {
  const meta = getEngineMetadataSafe(engineId);
  const cat = meta.category;

  if (cat === 'olap') {
    return {
      dbSizeGb: 2500,
      dailyChangePercent: 12,
      cloudProvider: 'aws_s3',
    };
  }
  if (cat === 'baas_embedded') {
    return {
      dbSizeGb: 15,
      dailyChangePercent: 5,
      cloudProvider: 'aws_s3',
    };
  }
  if (cat === 'keyvalue') {
    return {
      dbSizeGb: 48,
      dailyChangePercent: 30,
      cloudProvider: 'aws_s3',
    };
  }

  return {
    dbSizeGb: 500,
    dailyChangePercent: 10,
    cloudProvider: 'aws_s3',
  };
}
