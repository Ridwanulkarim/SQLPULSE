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
import { clientEngine } from './client-engine';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api/v1';

async function safeRequest<T>(
  url: string,
  options: RequestInit,
  fallbackFn: () => T | Promise<T>
): Promise<T> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';

    // If static hosting returns 404 or an HTML page (Vercel/Netlify SPA fallback) or 502/503/504:
    // This indicates no backend API is running on this route -> run in-browser client-side heuristic engine
    if (
      res.status === 404 ||
      res.status === 502 ||
      res.status === 503 ||
      res.status === 504 ||
      !contentType.includes('application/json')
    ) {
      return fallbackFn();
    }

    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.data !== undefined) {
        return json.data;
      }
      if (json && json.samples !== undefined) {
        return json.samples;
      }
      if (json && json.shareUrl !== undefined) {
        return json;
      }
      return json;
    }

    // Backend is a real API returning an explicit JSON error (e.g. 400 Bad Request, 403 Forbidden, 422)
    let errorMsg = `Server error (HTTP ${res.status}): ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson && errJson.error) {
        errorMsg = errJson.error;
      }
    } catch (_) {}

    throw new Error(errorMsg);
  } catch (err: any) {
    // If it's a network offline error or fetch failed -> fallback to client-side engine
    const isNetworkOffline =
      err.name === 'TypeError' ||
      (err.message && (
        err.message.includes('Failed to fetch') ||
        err.message.includes('NetworkError') ||
        err.message.includes('fetch failed') ||
        err.message.includes('ERR_CONNECTION_REFUSED')
      ));

    if (isNetworkOffline) {
      return fallbackFn();
    }

    throw err;
  }
}

export const analyzeQueryPlan = async (
  plan: any,
  query?: string,
  engine: DatabaseEngine = 'postgres'
): Promise<PlanAnalysisResult> => {
  return safeRequest(
    `${API_BASE}/analyze/plan`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, query, engine }),
    },
    () => clientEngine.analyzePlan(plan, query, engine)
  );
};

export const lintMigrationSql = async (
  sql: string,
  engine: DatabaseEngine = 'postgres'
): Promise<MigrationAnalysisResult> => {
  return safeRequest(
    `${API_BASE}/analyze/migration`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, engine }),
    },
    () => clientEngine.lintMigration(sql, engine)
  );
};

export const adviseQuery = async (
  query: string,
  engine: DatabaseEngine = 'postgres'
): Promise<QueryAdvisorResult> => {
  return safeRequest(
    `${API_BASE}/analyze/query`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, engine }),
    },
    () => clientEngine.adviseQuery(query, engine)
  );
};

export const transpileSql = async (
  sourceEngine: string,
  targetEngine: string,
  sourceCode: string
): Promise<TranspileResult> => {
  return safeRequest(
    `${API_BASE}/analyze/transpile`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceEngine, targetEngine, sourceCode }),
    },
    () => clientEngine.transpileSql(sourceEngine, targetEngine, sourceCode)
  );
};

export const tuneDatabaseConfig = async (params: {
  engine: string;
  ramGb: number;
  cpuCores: number;
  storageType: string;
  workloadType: string;
  maxConnections: number;
}): Promise<ConfigTuningResult> => {
  return safeRequest(
    `${API_BASE}/analyze/tune-config`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    () => clientEngine.tuneConfig(params)
  );
};

export const simulateDeadlockScenario = async (params: {
  engine: string;
  scenarioId?: string;
  txASql?: string;
  txBSql?: string;
}): Promise<DeadlockSimulationResult> => {
  return safeRequest(
    `${API_BASE}/analyze/deadlock-simulate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    () => clientEngine.simulateDeadlock(params)
  );
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
  return safeRequest(
    `${API_BASE}/analyze/disaster-recovery`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    () => clientEngine.calculateDisasterRecovery(params)
  );
};

export const synthesizeQuery = async (params: {
  prompt: string;
  targetEngine: string;
  schemaContext?: string;
  domainPreset?: string;
}): Promise<QuerySynthesizeResult> => {
  return safeRequest(
    `${API_BASE}/analyze/synthesize-query`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    () => clientEngine.synthesizeQuery(params)
  );
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
  return safeRequest(
    `${API_BASE}/analyze/connect-hub`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    () => clientEngine.fetchConnectHub(params)
  );
};

export const planPartitionStrategy = async (params: {
  engine: string;
  tableName: string;
  partitionColumn: string;
  strategy: string;
  estimatedMonthlyRows?: number;
  retentionMonths?: number;
}): Promise<PartitionResult> => {
  return safeRequest(
    `${API_BASE}/analyze/partition-plan`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    () => clientEngine.planPartition(params)
  );
};

export const inspectSlowLogs = async (params: {
  engine: string;
  logContent?: string;
}): Promise<LogInspectResult> => {
  return safeRequest(
    `${API_BASE}/analyze/inspect-logs`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    () => clientEngine.inspectLogs(params)
  );
};

export const analyzeTableBloat = async (params: {
  engine: string;
  tableName?: string;
  totalTableSizeGb?: number;
  deadTuplePercentage?: number;
  avgDailyUpdates?: number;
}): Promise<BloatAnalyzeResult> => {
  return safeRequest(
    `${API_BASE}/analyze/bloat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    () => clientEngine.analyzeBloat(params)
  );
};

export const simulateReplicationTopology = async (params: {
  engine: string;
  primaryRegion?: string;
  syncReplicasCount?: number;
  asyncReplicasCount?: number;
  failoverManager?: string;
  networkRttMs?: number;
}): Promise<ReplicationTopologyResult> => {
  return safeRequest(
    `${API_BASE}/analyze/replication`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    () => clientEngine.simulateReplication(params)
  );
};

export const generateSecurityRbac = async (params: {
  engine: string;
  tableName?: string;
  tenantColumn?: string;
  piiColumns?: string[];
  enforceTls?: boolean;
}): Promise<SecurityRbacResult> => {
  return safeRequest(
    `${API_BASE}/analyze/security-rbac`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    () => clientEngine.generateSecurityRbac(params)
  );
};

export const generateMockDataset = async (params: {
  engine: string;
  preset?: string;
  rowCount?: number;
  format?: string;
}): Promise<MockDataResult> => {
  return safeRequest(
    `${API_BASE}/analyze/mock-data`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    () => clientEngine.generateMockData(params)
  );
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
  return safeRequest(
    `${API_BASE}/analyze/finops`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    () => clientEngine.calculateFinOps(params)
  );
};

export const auditIndexDoctor = async (params: {
  engine: string;
  tableName?: string;
  indexes?: any[];
  rawIndexDdl?: string;
}): Promise<IndexDoctorResult> => {
  return safeRequest(
    `${API_BASE}/analyze/index-doctor`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    () => clientEngine.auditIndexDoctor(params)
  );
};

export const sanitizePii = async (params: {
  engine: string;
  tableName?: string;
  columns?: string[];
  anonymizationSalt?: string;
}): Promise<PiiSanitizerResult> => {
  return safeRequest(
    `${API_BASE}/analyze/pii-sanitizer`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    () => clientEngine.sanitizePii(params)
  );
};

export const rewriteQuery = async (params: {
  engine: string;
  query: string;
  tableHint?: string;
}): Promise<QueryRewriterResult> => {
  return safeRequest(
    `${API_BASE}/analyze/query-rewriter`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    () => clientEngine.rewriteQuery(params)
  );
};

export const diffSchema = async (params: {
  engine: string;
  sourceEnv?: string;
  targetEnv?: string;
  sourceDdl?: string;
  targetDdl?: string;
}): Promise<SchemaDiffResult> => {
  return safeRequest(
    `${API_BASE}/analyze/schema-diff`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    () => clientEngine.diffSchema(params)
  );
};

export const profileOrm = async (params: {
  framework: string;
  rawQueryOrCode?: string;
  batchSize?: number;
}): Promise<OrmProfilerResult> => {
  return safeRequest(
    `${API_BASE}/analyze/orm-profile`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    () => clientEngine.profileOrm(params)
  );
};

export const auditReadiness = async (params: {
  engine: string;
  environmentType?: string;
  estimatedQps?: number;
  applyTuningPatch?: boolean;
}): Promise<ProductionReadinessResult> => {
  return safeRequest(
    `${API_BASE}/analyze/production-readiness`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    () => clientEngine.auditReadiness(params)
  );
};

export const simulateChaos = async (params: {
  engine: string;
  scenarioId?: string;
  clusterSize?: number;
  syncMode?: 'sync' | 'async';
}): Promise<ChaosSimulationResult> => {
  return safeRequest(
    `${API_BASE}/analyze/chaos-simulate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    () => clientEngine.simulateChaos(params)
  );
};

export const generateCdcOutbox = async (params: {
  engine: string;
  sourceTable?: string;
  destinationBroker?: 'kafka' | 'rabbitmq' | 'sqs' | 'redis_streams';
}): Promise<CdcOutboxResult> => {
  return safeRequest(
    `${API_BASE}/analyze/cdc-outbox`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    () => clientEngine.generateCdcOutbox(params)
  );
};

export const tuneVectorIndex = async (params: {
  engine: string;
  dimension?: number;
  vectorCount?: number;
  indexType?: 'HNSW' | 'IVFFLAT';
  distanceMetric?: 'cosine' | 'l2' | 'inner_product';
}): Promise<VectorTuningResult> => {
  return safeRequest(
    `${API_BASE}/analyze/vector-tune`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    () => clientEngine.tuneVectorIndex(params)
  );
};

export const fetchSamples = async (engine: DatabaseEngine = 'postgres') => {
  return safeRequest(
    `${API_BASE}/samples?engine=${engine}`,
    { method: 'GET' },
    () => clientEngine.getSamples(engine)
  );
};

export const saveReportPermalink = async (title: string, raw_query: string, raw_plan: any) => {
  const res = await fetch(`${API_BASE}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, raw_query, raw_plan }),
  });
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    let errorMsg = `Failed to save analysis report (HTTP ${res.status})`;
    if (contentType.includes('application/json')) {
      try {
        const json = await res.json();
        if (json && json.error) errorMsg = json.error;
      } catch (_) {}
    }
    throw new Error(errorMsg);
  }
  return res.json();
};

export const fetchReportById = async (id: string, accessKey?: string) => {
  const headers: Record<string, string> = {};
  if (accessKey) {
    headers['x-report-key'] = accessKey;
  }
  const res = await fetch(`${API_BASE}/reports/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers,
  });
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    let errorMsg = `Analysis report "${id}" could not be retrieved (HTTP ${res.status})`;
    if (contentType.includes('application/json')) {
      try {
        const json = await res.json();
        if (json && json.error) errorMsg = json.error;
      } catch (_) {}
    }
    throw new Error(errorMsg);
  }
  const json = await res.json();
  return json.data;
};
