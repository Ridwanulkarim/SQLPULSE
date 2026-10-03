import {
  PlanAnalysisResult,
  MigrationAnalysisResult,
  QueryAdvisorResult,
  DatabaseEngine,
  TranspileResult,
  ConfigTuningResult,
  DeadlockSimulationResult,
  DisasterRecoveryResult,
  QuerySynthesizeResult,
  ConnectHubResult,
  PartitionResult,
  LogInspectResult,
  BloatAnalyzeResult,
  ReplicationTopologyResult,
  SecurityRbacResult,
  MockDataResult,
  FinOpsResult,
  IndexDoctorResult,
  PiiSanitizerResult,
  QueryRewriterResult,
  SchemaDiffResult,
  OrmProfilerResult,
  ProductionReadinessResult,
  ChaosSimulationResult,
  CdcOutboxResult,
  VectorTuningResult,
} from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api/v1';

export const analyzeQueryPlan = async (
  plan: any,
  query?: string,
  engine: DatabaseEngine = 'postgres'
): Promise<PlanAnalysisResult> => {
  const res = await fetch(`${API_BASE}/analyze/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, query, engine }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to analyze query plan.');
  }

  return json.data;
};

export const lintMigrationSql = async (
  sql: string,
  engine: DatabaseEngine = 'postgres'
): Promise<MigrationAnalysisResult> => {
  const res = await fetch(`${API_BASE}/analyze/migration`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, engine }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to lint migration script.');
  }

  return json.data;
};

export const adviseQuery = async (
  query: string,
  engine: DatabaseEngine = 'postgres'
): Promise<QueryAdvisorResult> => {
  const res = await fetch(`${API_BASE}/analyze/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, engine }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to analyze query.');
  }

  return json.data;
};

export const transpileSql = async (
  sourceEngine: string,
  targetEngine: string,
  sourceCode: string
): Promise<TranspileResult> => {
  const res = await fetch(`${API_BASE}/analyze/transpile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceEngine, targetEngine, sourceCode }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to transpile SQL.');
  }

  return json.data;
};

export const tuneDatabaseConfig = async (params: {
  engine: string;
  ramGb: number;
  cpuCores: number;
  storageType: string;
  workloadType: string;
  maxConnections: number;
}): Promise<ConfigTuningResult> => {
  const res = await fetch(`${API_BASE}/analyze/tune-config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to generate tuned database config.');
  }

  return json.data;
};

export const simulateDeadlockScenario = async (params: {
  engine: string;
  scenarioId?: string;
  txASql?: string;
  txBSql?: string;
}): Promise<DeadlockSimulationResult> => {
  const res = await fetch(`${API_BASE}/analyze/deadlock-simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to simulate deadlock scenario.');
  }

  return json.data;
};

export const calculateDisasterRecovery = async (params: {
  engine: string;
  dbSizeGb: number;
  dailyChangePercent: number;
  networkBandwidthMbps: number;
  diskThroughputMbSec: number;
  backupStrategy: string;
  cloudProvider?: string;
}): Promise<DisasterRecoveryResult> => {
  const res = await fetch(`${API_BASE}/analyze/disaster-recovery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to calculate disaster recovery metrics.');
  }

  return json.data;
};

export const synthesizeQuery = async (params: {
  prompt: string;
  targetEngine: string;
  schemaContext?: string;
  domainPreset?: string;
}): Promise<QuerySynthesizeResult> => {
  const res = await fetch(`${API_BASE}/analyze/synthesize-query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to synthesize query.');
  }

  return json.data;
};

export const fetchConnectHubConfig = async (params: {
  engine: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  sslMode?: string;
  poolSize?: number;
}): Promise<ConnectHubResult> => {
  const res = await fetch(`${API_BASE}/analyze/connect-hub`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to generate connection string configuration.');
  }

  return json.data;
};

export const planPartitionStrategy = async (params: {
  engine: string;
  tableName: string;
  partitionColumn: string;
  strategy: string;
  estimatedMonthlyRows?: number;
  retentionMonths?: number;
}): Promise<PartitionResult> => {
  const res = await fetch(`${API_BASE}/analyze/partition-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to generate table partitioning plan.');
  }

  return json.data;
};

export const inspectSlowLogs = async (params: {
  engine: string;
  logContent?: string;
}): Promise<LogInspectResult> => {
  const res = await fetch(`${API_BASE}/analyze/inspect-logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to inspect slow query logs.');
  }

  return json.data;
};

export const analyzeTableBloat = async (params: {
  engine: string;
  tableName?: string;
  totalTableSizeGb?: number;
  deadTuplePercentage?: number;
  avgDailyUpdates?: number;
}): Promise<BloatAnalyzeResult> => {
  const res = await fetch(`${API_BASE}/analyze/bloat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to analyze table bloat.');
  }

  return json.data;
};

export const simulateReplicationTopology = async (params: {
  engine: string;
  primaryRegion?: string;
  syncReplicasCount?: number;
  asyncReplicasCount?: number;
  failoverManager?: string;
  networkRttMs?: number;
}): Promise<ReplicationTopologyResult> => {
  const res = await fetch(`${API_BASE}/analyze/replication`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to simulate replication topology.');
  }

  return json.data;
};

export const generateSecurityRbac = async (params: {
  engine: string;
  tableName?: string;
  tenantColumn?: string;
  piiColumns?: string[];
  enforceTls?: boolean;
}): Promise<SecurityRbacResult> => {
  const res = await fetch(`${API_BASE}/analyze/security-rbac`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to generate security RBAC & RLS policies.');
  }

  return json.data;
};

export const generateMockDataset = async (params: {
  engine: string;
  preset?: string;
  rowCount?: number;
  format?: string;
}): Promise<MockDataResult> => {
  const res = await fetch(`${API_BASE}/analyze/mock-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to generate synthetic mock data.');
  }

  return json.data;
};

export const calculateFinOps = async (params: {
  engine: string;
  cloudProvider?: string;
  dbSizeGb?: number;
  monthlyReadQueriesMillion?: number;
  monthlyWriteQueriesMillion?: number;
  ramGb?: number;
  vCpuCount?: number;
  storageTier?: string;
  provisionedIops?: number;
  backupRetentionDays?: number;
  multiRegionHa?: boolean;
}): Promise<FinOpsResult> => {
  const res = await fetch(`${API_BASE}/analyze/finops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to calculate cloud database FinOps pricing.');
  }

  return json.data;
};

export const auditIndexDoctor = async (params: {
  engine: string;
  tableName?: string;
  indexes?: any[];
  rawIndexDdl?: string;
}): Promise<IndexDoctorResult> => {
  const res = await fetch(`${API_BASE}/analyze/index-doctor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to audit index redundancy.');
  }

  return json.data;
};

export const sanitizePii = async (params: {
  engine: string;
  tableName?: string;
  columns?: string[];
  anonymizationSalt?: string;
}): Promise<PiiSanitizerResult> => {
  const res = await fetch(`${API_BASE}/analyze/pii-sanitizer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to generate PII data masking rules.');
  }

  return json.data;
};

export const rewriteQuery = async (params: {
  engine: string;
  query: string;
  tableHint?: string;
}): Promise<QueryRewriterResult> => {
  const res = await fetch(`${API_BASE}/analyze/query-rewriter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to rewrite query.');
  }

  return json.data;
};

export const diffSchema = async (params: {
  engine: string;
  sourceEnv?: string;
  targetEnv?: string;
  sourceDdl?: string;
  targetDdl?: string;
}): Promise<SchemaDiffResult> => {
  const res = await fetch(`${API_BASE}/analyze/schema-diff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to compute schema difference.');
  }
  return json.data;
};

export const profileOrm = async (params: {
  framework: string;
  rawQueryOrCode?: string;
  batchSize?: number;
}): Promise<OrmProfilerResult> => {
  const res = await fetch(`${API_BASE}/analyze/orm-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to profile ORM queries.');
  }
  return json.data;
};

export const auditReadiness = async (params: {
  engine: string;
  environmentType?: string;
  estimatedQps?: number;
}): Promise<ProductionReadinessResult> => {
  const res = await fetch(`${API_BASE}/analyze/production-readiness`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to audit production readiness.');
  }
  return json.data;
};

export const simulateChaos = async (params: {
  engine: string;
  scenarioId?: string;
  clusterSize?: number;
  syncMode?: 'sync' | 'async';
}): Promise<ChaosSimulationResult> => {
  const res = await fetch(`${API_BASE}/analyze/chaos-simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to simulate chaos scenario.');
  }
  return json.data;
};

export const generateCdcOutbox = async (params: {
  engine: string;
  sourceTable?: string;
  destinationBroker?: 'kafka' | 'rabbitmq' | 'sqs' | 'redis_streams';
}): Promise<CdcOutboxResult> => {
  const res = await fetch(`${API_BASE}/analyze/cdc-outbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to generate CDC Outbox architecture.');
  }
  return json.data;
};

export const tuneVectorIndex = async (params: {
  engine: string;
  dimension?: number;
  vectorCount?: number;
  indexType?: 'HNSW' | 'IVFFLAT';
  distanceMetric?: 'cosine' | 'l2' | 'inner_product';
}): Promise<VectorTuningResult> => {
  const res = await fetch(`${API_BASE}/analyze/vector-tune`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to tune vector index.');
  }
  return json.data;
};

export const fetchSamples = async (engine: DatabaseEngine = 'postgres') => {
  const res = await fetch(`${API_BASE}/samples?engine=${engine}`);
  const json = await res.json();
  return json.samples;
};

export const saveReportPermalink = async (title: string, raw_query: string, raw_plan: any) => {
  const res = await fetch(`${API_BASE}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, raw_query, raw_plan }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to generate report link.');
  }

  return json;
};

export const fetchReportById = async (id: string) => {
  const res = await fetch(`${API_BASE}/reports/${id}`);
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Report not found.');
  }
  return json.data;
};
