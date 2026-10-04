import { z } from 'zod';

export const saveReportSchema = z.object({
  title: z.string().max(200).optional(),
  raw_query: z.string().max(50000).optional(),
  raw_plan: z.union([
    z.string().min(1).max(1000000),
    z.record(z.any()),
    z.array(z.any()),
  ]),
});

export const analyzePlanSchema = z.object({
  plan: z.union([
    z.string().min(1).max(1000000),
    z.record(z.any()),
    z.array(z.any()),
  ]),
  query: z.string().max(50000).optional(),
  engine: z.string().min(1).max(100).default('postgres'),
});

export const lintMigrationSchema = z.object({
  sql: z.string().min(1).max(100000),
  engine: z.string().min(1).max(100).default('postgres'),
});

export const adviseQuerySchema = z.object({
  query: z.string().min(1).max(50000),
  engine: z.string().min(1).max(100).default('postgres'),
});

export const transpileSchema = z.object({
  sourceEngine: z.string().min(1).max(100).default('oracle'),
  targetEngine: z.string().min(1).max(100).default('postgres'),
  sourceCode: z.string().min(1).max(100000),
});

export const tuneConfigSchema = z.object({
  engine: z.string().min(1).max(100).default('postgres'),
  ramGb: z.number().min(0.5).max(4096).default(16),
  cpuCores: z.number().min(1).max(512).default(4),
  storageType: z.string().max(50).default('nvme_ssd'),
  workloadType: z.string().max(50).default('oltp_web'),
  maxConnections: z.number().min(5).max(50000).default(200),
});

export const deadlockSchema = z.object({
  engine: z.string().min(1).max(100).default('postgres'),
  scenarioId: z.string().max(100).default('circular_row_locks'),
  txASql: z.string().max(10000).optional(),
  txBSql: z.string().max(10000).optional(),
});

export const disasterRecoverySchema = z.object({
  engine: z.string().min(1).max(100).default('postgres'),
  dbSizeGb: z.number().min(1).max(1000000).default(500),
  dailyChangePercent: z.number().min(0.1).max(100).default(10),
  networkBandwidthMbps: z.number().min(1).max(100000).default(1000),
  diskThroughputMbSec: z.number().min(1).max(100000).default(500),
  backupStrategy: z.string().max(100).default('daily_full_plus_wal_cdc'),
  cloudProvider: z.string().max(50).default('aws_s3'),
});

export const synthesizeQuerySchema = z.object({
  prompt: z.string().min(1).max(10000),
  targetEngine: z.string().min(1).max(100).default('postgres'),
  schemaContext: z.string().max(50000).optional(),
  domainPreset: z.string().max(50).optional(),
});

export const connectHubSchema = z.object({
  engine: z.string().min(1).max(100).default('postgres'),
  host: z.string().max(255).optional(),
  port: z.number().min(1).max(65535).optional(),
  database: z.string().max(255).optional(),
  username: z.string().max(255).optional(),
  password: z.string().max(255).optional(),
  sslMode: z.string().max(50).optional(),
  poolSize: z.number().min(1).max(5000).optional(),
});

export const partitionSchema = z.object({
  engine: z.string().min(1).max(100).default('postgres'),
  tableName: z.string().min(1).max(255).default('user_events'),
  partitionColumn: z.string().min(1).max(255).default('created_at'),
  strategy: z.string().max(50).default('range_monthly'),
  estimatedMonthlyRows: z.number().min(1).max(1000000000000).default(10000000),
  retentionMonths: z.number().min(1).max(1200).default(12),
});

export const inspectLogsSchema = z.object({
  engine: z.string().min(1).max(100).default('postgres'),
  logContent: z.string().max(500000).default(''),
});

export const bloatSchema = z.object({
  engine: z.string().min(1).max(100).default('postgres'),
  tableName: z.string().max(255).optional(),
  totalTableSizeGb: z.number().min(0.01).max(1000000).optional(),
  deadTuplePercentage: z.number().min(0).max(100).optional(),
  avgDailyUpdates: z.number().min(0).max(1000000000).optional(),
  targetIoSpeedMbSec: z.number().min(1).max(10000).optional(),
});

export const replicationSchema = z.object({
  engine: z.string().min(1).max(100).default('postgres'),
  primaryRegion: z.string().max(100).optional(),
  syncReplicasCount: z.number().min(0).max(100).optional(),
  asyncReplicasCount: z.number().min(0).max(100).optional(),
  failoverManager: z.string().max(100).optional(),
  networkRttMs: z.number().min(0).max(5000).optional(),
});

export const securityRbacSchema = z.object({
  engine: z.string().min(1).max(100).default('postgres'),
  tableName: z.string().max(255).optional(),
  tenantColumn: z.string().max(255).optional(),
  piiColumns: z.array(z.string().max(255)).max(100).optional(),
  enforceTls: z.boolean().optional(),
});

export const mockDataSchema = z.object({
  engine: z.string().min(1).max(100).default('postgres'),
  preset: z.string().max(50).optional(),
  rowCount: z.number().min(1).max(50000).default(100),
  format: z.string().max(50).default('sql_insert'),
});

export const finOpsSchema = z.object({
  engine: z.string().min(1).max(100).default('postgres'),
  cloudProvider: z.string().max(50).optional(),
  dbSizeGb: z.number().min(1).max(1000000).optional(),
  monthlyReadQueriesMillion: z.number().min(0).max(1000000000).optional(),
  monthlyWriteQueriesMillion: z.number().min(0).max(1000000000).optional(),
  ramGb: z.number().min(0.5).max(4096).optional(),
  vCpuCount: z.number().min(1).max(512).optional(),
  storageTier: z.string().max(50).optional(),
  provisionedIops: z.number().min(0).max(1000000).optional(),
  backupRetentionDays: z.number().min(0).max(3650).optional(),
  multiRegionHa: z.boolean().optional(),
});

export const indexDoctorSchema = z.object({
  engine: z.string().min(1).max(100).default('postgres'),
  tableName: z.string().max(255).optional(),
  indexes: z.array(z.any()).max(100).optional(),
  rawIndexDdl: z.string().max(50000).optional(),
});

export const piiSanitizerSchema = z.object({
  engine: z.string().min(1).max(100).default('postgres'),
  tableName: z.string().max(255).optional(),
  columns: z.array(z.string().max(255)).max(100).optional(),
  anonymizationSalt: z.string().max(255).optional(),
});

export const queryRewriterSchema = z.object({
  engine: z.string().min(1).max(100).default('postgres'),
  query: z.string().min(1).max(50000),
  tableHint: z.string().max(255).optional(),
});

export const schemaDiffSchema = z.object({
  engine: z.string().min(1).max(100).default('postgresql'),
  sourceEnv: z.string().max(255).optional(),
  targetEnv: z.string().max(255).optional(),
  sourceDdl: z.string().max(200000).optional(),
  targetDdl: z.string().max(200000).optional(),
});

export const ormProfilerSchema = z.object({
  framework: z.string().min(1).max(50).default('prisma'),
  rawQueryOrCode: z.string().max(100000).optional(),
  batchSize: z.number().min(1).max(50000).default(1000),
});

export const readinessSchema = z.object({
  engine: z.string().min(1).max(100).default('postgres'),
  environmentType: z.string().max(50).optional(),
  estimatedQps: z.number().min(1).max(10000000).optional(),
  applyTuningPatch: z.boolean().optional(),
});

export const chaosSchema = z.object({
  engine: z.string().min(1).max(100).default('postgres'),
  scenarioId: z.string().max(100).optional(),
  clusterSize: z.number().min(1).max(100).optional(),
  syncMode: z.enum(['sync', 'async']).optional(),
});

export const cdcOutboxSchema = z.object({
  engine: z.string().min(1).max(100).default('postgres'),
  sourceTable: z.string().max(255).optional(),
  destinationBroker: z.enum(['kafka', 'rabbitmq', 'sqs', 'redis_streams']).optional(),
});

export const vectorTuneSchema = z.object({
  engine: z.string().min(1).max(100).default('postgres'),
  dimension: z.number().min(1).max(32768).optional(),
  vectorCount: z.number().min(1).max(1000000000).optional(),
  indexType: z.enum(['HNSW', 'IVFFLAT']).optional(),
  distanceMetric: z.enum(['cosine', 'l2', 'inner_product']).optional(),
});
