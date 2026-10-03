import { DATABASE_CATALOG } from './db-catalog.data';

export type DatabaseCategory =
  | 'relational'
  | 'olap'
  | 'document'
  | 'keyvalue'
  | 'vector'
  | 'search'
  | 'graph'
  | 'timeseries'
  | 'wide_column'
  | 'baas_embedded'
  | 'geo_spatial'
  | 'streaming_ledger';

export type DatabaseEngine = string;

export interface DatabaseEngineMetadata {
  id: DatabaseEngine;
  name: string;
  category: DatabaseCategory;
  categoryLabel: string;
  icon: string;
  commandHint: string;
  description: string;
  rank?: number;
  popularityScore?: number;
}

export { DATABASE_CATALOG };

export type SeverityLevel = 'CRITICAL' | 'WARNING' | 'INFO' | 'OPTIMAL';

export interface BottleneckFinding {
  id: string;
  nodeType: string;
  relationName?: string;
  severity: SeverityLevel;
  title: string;
  description: string;
  metricLabel: string;
  metricValue: string | number;
  recommendation: string;
  suggestedSql?: string;
}

export interface GraphNodeData {
  id: string;
  nodeType: string;
  relationName?: string;
  totalCost: number;
  actualTotalTimeMs?: number;
  costPercentage: number;
  timePercentage: number;
  actualRows?: number;
  planRows: number;
  rowsRemovedByFilter?: number;
  sharedHitBlocks: number;
  sharedReadBlocks: number;
  isBottleneck: boolean;
  severity: SeverityLevel;
  details: Record<string, any>;
}

export interface GraphEdgeData {
  id: string;
  source: string;
  target: string;
}

export interface PlanAnalysisResult {
  engine?: DatabaseEngine;
  engineMetadata?: DatabaseEngineMetadata;
  performanceScore: number;
  executionTimeMs: number;
  planningTimeMs: number;
  totalCost: number;
  totalMemoryHits: number;
  totalDiskReads: number;
  cacheHitRatioPercentage: number;
  bottlenecks: BottleneckFinding[];
  recommendations: Array<{
    category: string;
    title: string;
    description: string;
    suggestedSql?: string;
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  graph: {
    nodes: GraphNodeData[];
    edges: GraphEdgeData[];
  };
}

export interface MigrationSafetyCheck {
  id: string;
  severity: SeverityLevel;
  title: string;
  reason: string;
  unsafeSql: string;
  safeAlternativeSql: string;
  lockLevel: string;
}

export interface MigrationAnalysisResult {
  engine?: DatabaseEngine;
  isSafeForProduction: boolean;
  totalStatements: number;
  riskScore: number;
  findings: MigrationSafetyCheck[];
}

export interface QueryAntiPatternFinding {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  antiPatternType: string;
  title: string;
  description: string;
  detectedCodeSnippet: string;
  recommendation: string;
}

export interface QueryAdvisorResult {
  engine: DatabaseEngine;
  originalQuery: string;
  rewrittenQuery: string;
  performanceScore: number;
  estimatedSpeedup: string;
  findings: QueryAntiPatternFinding[];
  suggestedCompoundIndex?: {
    tableName: string;
    equalityColumns: string[];
    sortColumns: string[];
    rangeColumns: string[];
    indexSql: string;
    rationale: string;
  };
}

export interface DataTypeMapping {
  sourceType: string;
  targetType: string;
  notes: string;
}

export interface FunctionMapping {
  sourceFunc: string;
  targetFunc: string;
  explanation: string;
}

export interface MigrationCaveat {
  category: 'index' | 'transaction' | 'datatype' | 'concurrency' | 'syntax' | 'performance';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface TranspileResult {
  sourceEngine: string;
  targetEngine: string;
  sourceEngineName: string;
  targetEngineName: string;
  transpiledCode: string;
  dataTypeMappings: DataTypeMapping[];
  functionMappings: FunctionMapping[];
  caveats: MigrationCaveat[];
  optimizationsApplied: string[];
}

export interface RamAllocationSlice {
  label: string;
  sizeGb: number;
  percentage: number;
  color: string;
  description: string;
}

export interface KeyConfigParam {
  param: string;
  value: string;
  defaultVal: string;
  category: 'memory' | 'cpu' | 'io' | 'concurrency';
  explanation: string;
}

export interface ConfigTuningResult {
  engine: string;
  engineName: string;
  configFileName: string;
  generatedConfigText: string;
  sysctlConfigText: string;
  limitsConfigText: string;
  ramAllocation: RamAllocationSlice[];
  keyParameters: KeyConfigParam[];
  expertTips: string[];
}

export interface TimelineStep {
  stepIndex: number;
  timeSec: number;
  txAState: {
    statement: string;
    status: 'IDLE' | 'EXECUTED' | 'ACQUIRED_LOCK' | 'WAITING' | 'DEADLOCK_VICTIM' | 'COMMITTED';
    lockHeld?: string;
    lockWaiting?: string;
  };
  txBState: {
    statement: string;
    status: 'IDLE' | 'EXECUTED' | 'ACQUIRED_LOCK' | 'WAITING' | 'DEADLOCK_VICTIM' | 'COMMITTED';
    lockHeld?: string;
    lockWaiting?: string;
  };
  activeLocks: {
    resource: string;
    heldByTx: string;
    waitingTx: string[];
    lockMode: 'ExclusiveLock' | 'ShareLock' | 'GapLock' | 'IntentionLock' | 'DistributedToken';
  }[];
  explanation: string;
  hasCycleDetected: boolean;
}

export interface DeadlockRemedy {
  title: string;
  type: 'deterministic_order' | 'skip_locked' | 'lock_timeout' | 'optimistic_version' | 'batch_atomic';
  codeSnippet: string;
  explanation: string;
}

export interface DeadlockSimulationResult {
  engine: string;
  engineName: string;
  scenarioId: string;
  scenarioTitle: string;
  hasDeadlock: boolean;
  deadlockDetectedAtStep: number | null;
  waitForCycle: { fromTx: string; toTx: string; resource: string; reason: string }[];
  steps: TimelineStep[];
  rootCause: string;
  remedies: DeadlockRemedy[];
}

export interface RtoStage {
  stage: string;
  durationMinutes: number;
  description: string;
}

export interface DisasterRecoveryResult {
  engine: string;
  engineName: string;
  strategy: string;
  rpo: {
    theoreticalRpo: string;
    rpoClassification: 'Zero Data Loss' | 'Near Real-Time (<1m)' | 'Standard (<15m)' | 'High Risk (24h)';
    explanation: string;
  };
  rto: {
    totalEstimatedRtoMinutes: number;
    formattedRto: string;
    stages: RtoStage[];
  };
  storageEconomics: {
    raw30DayRetentionGb: number;
    compressed30DayRetentionGb: number;
    compressionRatio: string;
    estimatedMonthlyStorageCostUsd: number;
  };
  backupScriptBash: string;
  cronDefinition: string;
  restoreRunbookMarkdown: string;
  verificationCommand: string;
}

export interface QuerySynthesizeResult {
  engine: string;
  engineName: string;
  dialectCategory: string;
  prompt: string;
  synthesizedQuery: string;
  zeroDowntimeIndexDdl: string;
  queryExplanation: string;
  complexityAnalysis: {
    timeComplexity: string;
    estimatedMemory: string;
    indexLookupType: string;
  };
  antipatternWarnings: string[];
}

export interface CodeSnippet {
  language: 'typescript' | 'python' | 'go' | 'java' | 'rust' | 'php';
  label: string;
  code: string;
}

export interface OrmSnippet {
  orm: 'prisma' | 'drizzle' | 'sqlalchemy' | 'gorm' | 'typeorm';
  label: string;
  filename: string;
  code: string;
}

export interface ConnectHubResult {
  engine: string;
  engineName: string;
  categoryLabel: string;
  connectionUri: string;
  maskedUri: string;
  jdbcUrl: string;
  environmentVariableSnippet: string;
  codeSnippets: CodeSnippet[];
  ormSnippets: OrmSnippet[];
  driverPackage: string;
  securityRecommendations: string[];
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

export interface SlowQueryGroup {
  fingerprint: string;
  sampleQuery: string;
  totalCalls: number;
  totalTimeMs: number;
  avgTimeMs: number;
  p95TimeMs: number;
  maxTimeMs: number;
  percentOfTotalTime: number;
  recommendedIndex: string;
}

export interface LogInspectResult {
  engine: string;
  engineName: string;
  totalQueriesParsed: number;
  uniqueFingerprints: number;
  slowestQueryMs: number;
  totalCumulativeDurationSec: number;
  groups: SlowQueryGroup[];
  diagnosticSummary: string;
  recommendations: string[];
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

export interface TopologyNode {
  id: string;
  name: string;
  role: 'primary' | 'sync_standby' | 'async_replica' | 'dr_replica' | 'witness' | 'edge_cache';
  region: string;
  status: 'healthy' | 'replicating' | 'syncing' | 'lagging' | 'standby';
  replicationLagMs: number;
  readCapacityQps: number;
  writeCapacityQps: number;
  quorumVote: boolean;
}

export interface ReplicationTopologyResult {
  engine: string;
  engineName: string;
  primaryRegion: string;
  failoverMechanism: string;
  totalNodesCount: number;
  readScalingFactor: string;
  rpoEstimate: string;
  rtoEstimate: string;
  nodes: TopologyNode[];
  topologyDiagramMermaid: string;
  haConfigSnippet: string;
  failoverSimulationPlan: {
    step: number;
    title: string;
    action: string;
    durationMs: number;
  }[];
  expertRecommendations: string[];
}

export interface RbacRole {
  name: string;
  scope: string;
  privileges: string[];
  description: string;
  ddlGrant: string;
}

export interface SecurityAuditItem {
  id: string;
  standard: 'SOC2' | 'HIPAA' | 'PCI-DSS' | 'GDPR';
  title: string;
  status: 'passed' | 'warning' | 'critical';
  impact: string;
  remediation: string;
}

export interface SecurityRbacResult {
  engine: string;
  engineName: string;
  tableName: string;
  complianceScore: number;
  roles: RbacRole[];
  rlsPolicyScript: string;
  dataMaskingScript: string;
  tlsHardeningConfig: string;
  auditItems: SecurityAuditItem[];
  expertRecommendations: string[];
}

export type DomainPresetType =
  
  | 'ecommerce'
  | 'fintech'
  | 'stock_trading'
  | 'crypto_web3'
  | 'insurance_claims'
  | 'real_estate'
  | 'pos_retail'
  | 'fraud_detection'
  | 'luxury_provenance'
  | 'live_events_ticketing'
  // 📊 Enterprise, Governance, Legal & HR
  | 'saas'
  | 'cybersecurity'
  | 'hr_payroll'
  | 'legal_contracts'
  | 'customer_support'
  | 'gov_civic_registry'
  | 'gdpr_privacy_audit'
  | 'compliance_sox'
  | 'procurement_rfp'
  | 'facility_management'
  // 🏥 Healthcare, Pharma, Biotech & Life Sciences
  | 'healthcare'
  | 'pharma_clinical'
  | 'genomics_sequencing'
  | 'radiology_dicom'
  | 'fitness_wearables'
  // 🚀 AI, Real-Time Media, Gaming & Communications
  | 'vector_embeddings'
  | 'iot'
  | 'ride_sharing'
  | 'food_delivery'
  | 'streaming_media'
  | 'music_audio'
  | 'gaming'
  | 'social_media'
  | 'telecom_5g'
  | 'podcast_ad_tech'
  | 'digital_publishing'
  | 'edtech'
  // 🔬 Science, Clean Energy, Transportation & Logistics
  | 'travel_hospitality'
  | 'supply_chain'
  | 'energy_grid'
  | 'ev_charging'
  | 'aerospace_flight'
  | 'meteorology'
  | 'smart_city'
  | 'agriculture_agtech'
  | 'autonomous_vehicles'
  | 'warehouse_robotics'
  | 'maritime_shipping'
  | 'industrial_scada'
  | 'satellite_constellation'
  | 'carbon_esg_tracking';

export interface MockDataResult {
  engine: string;
  engineName: string;
  preset: string;
  presetLabel?: string;
  rowCount: number;
  format: string;
  estimatedSizeBytes: number;
  estimatedSizeFormatted: string;
  sampleRecordsJson: any[];
  bulkScript: string;
  benchmarkScript: string;
  performanceCharacteristics: {
    ingestionRateRowsPerSec: string;
    indexBuildTimeSec: string;
    ramFootprintMb: string;
  };
  expertRecommendations: string[];
}

export type CloudProviderType = 'aws_rds' | 'aws_aurora' | 'gcp_cloudsql' | 'gcp_alloydb' | 'azure_sql' | 'azure_cosmos' | 'neon_serverless' | 'supabase_cloud' | 'mongodb_atlas';

export interface CostBreakdownItem {
  category: string;
  monthlyCostUsd: number;
  pctOfTotal: number;
  description: string;
}

export interface FinOpsResult {
  engine: string;
  engineName: string;
  cloudProvider: CloudProviderType;
  cloudProviderName: string;
  monthlyTotalCostUsd: number;
  annualTotalCostUsd: number;
  costBreakdown: CostBreakdownItem[];
  recommendedInstanceClass: string;
  storageConfiguration: {
    allocatedGb: number;
    storageType: string;
    effectiveIops: number;
    throughputMbSec: number;
    monthlyStorageCostUsd: number;
  };
  savingsOpportunities: {
    title: string;
    monthlySavingsUsd: number;
    difficulty: 'EASY' | 'MODERATE' | 'ADVANCED';
    actionableFix: string;
    ddlOrConfigSnippet: string;
  }[];
  terraformIaC: string;
}

export interface IndexDefinition {
  name: string;
  tableName: string;
  columns: string[];
  isUnique?: boolean;
  isPrimary?: boolean;
  indexType?: string;
  predicate?: string;
  sizeMb?: number;
  scansCount?: number;
}

export interface RedundantIndexFinding {
  indexName: string;
  tableName: string;
  columns: string[];
  redundantReason: string;
  supersedingIndexName: string;
  supersedingColumns: string[];
  writeAmplificationPenaltyPct: number;
  estimatedSpaceSavingsMb: number;
  suggestedAction: 'DROP' | 'CONSOLIDATE' | 'REORDER_COLUMNS';
  safeDropDdl: string;
}

export interface IndexDoctorResult {
  engine: string;
  engineName: string;
  tableName: string;
  healthScore: number;
  totalIndexesAnalyzed: number;
  redundanciesCount: number;
  totalEstimatedWasteMb: number;
  writeAmplificationReductionPct: number;
  findings: RedundantIndexFinding[];
  recommendedConsolidatedIndexes: {
    indexName: string;
    columns: string[];
    coveringIncludeColumns?: string[];
    purpose: string;
    createDdl: string;
  }[];
  cleanupMigrationScript: string;
  expertAuditSummary: string[];
}

export interface PiiFieldRule {
  columnName: string;
  piiCategory: 'EMAIL' | 'CREDIT_CARD' | 'PASSWORD' | 'SSN_NATIONAL_ID' | 'PHONE' | 'NAME' | 'IP_ADDRESS' | 'DATE_OF_BIRTH' | 'SALARY_FINANCIAL' | 'HEALTH_BIOMETRIC';
  complianceTag: 'GDPR_ARTICLE_9' | 'PCI_DSS_3.4' | 'HIPAA_SAFE_HARBOR' | 'SOC2_CONFIDENTIALITY' | 'CCPA_PERSONAL';
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  maskingMethod: 'DETERMINISTIC_HASH' | 'SYNTHETIC_FAKER' | 'NULLIFY' | 'PARTIAL_REDACT' | 'TOKENIZE';
  sampleOriginalValue: string;
  sampleMaskedValue: string;
}

export interface PiiSanitizerResult {
  engine: string;
  engineName: string;
  tableName: string;
  overallComplianceScore: number;
  detectedPiiCount: number;
  fields: PiiFieldRule[];
  pgDumpAnonRules: string;
  inPlaceScrubDdl: string;
  exportMaskedViewDdl: string;
  stagingSyncBashScript: string;
  auditRecommendations: string[];
}

export interface OptimizationRewriteDetail {
  ruleName: string;
  category: 'SARGABILITY' | 'INDEX_SEEK' | 'JOIN_TRANSFORMATION' | 'AGGREGATION' | 'PROJECTION';
  beforeSnippet: string;
  afterSnippet: string;
  explanation: string;
  estimatedSpeedup: string;
}

export interface QueryRewriterResult {
  engine: string;
  engineName: string;
  originalQuery: string;
  optimizedQuery: string;
  overallSpeedupFactor: string;
  optimizationsApplied: OptimizationRewriteDetail[];
  zeroDowntimeIndexDdl: string;
  astTransformationSummary: {
    planBefore: string;
    planAfter: string;
    iopsReductionPct: number;
    cpuReductionPct: number;
  };
  expertAnalysis: string[];
}

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

export interface OrmIssue {
  id: string;
  category: 'N_PLUS_ONE' | 'CARTESIAN_EXPLOSION' | 'OVER_FETCHING' | 'UNINDEXED_RELATION' | 'UNBATCHED_MUTATION';
  title: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  description: string;
  detectedPattern: string;
  estimatedExtraRoundtrips: number;
  latencyPenaltyMs: number;
  ormFixCode: string;
  rawSqlFixCode: string;
  explanation: string;
}

export interface OrmProfilerResult {
  ormFramework: string;
  detectedIssues: OrmIssue[];
  estimatedTotalRoundtrips: number;
  estimatedLatencySavingPercent: number;
  benchmarkSummary: {
    baselineLatencyMs: number;
    optimizedLatencyMs: number;
    networkPayloadReductionPercent: number;
  };
  recommendedOrmCode: string;
  recommendedSqlCte: string;
  guidelines: string[];
}

export interface ReadinessCheckItem {
  id: string;
  category: 'CONNECTION' | 'MEMORY' | 'MAINTENANCE' | 'BACKUP_WAL' | 'TIMEOUT_SAFETY' | 'SECURITY' | 'OBSERVABILITY';
  title: string;
  status: 'PASSED' | 'FAILED' | 'WARNING';
  currentValue: string;
  recommendedValue: string;
  riskDescription: string;
  remediationCommand: string;
}

export interface ProductionReadinessResult {
  engine: string;
  overallScore: number;
  letterGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  riskLevel: 'LOW' | 'MODERATE' | 'CRITICAL';
  passedChecksCount: number;
  failedChecksCount: number;
  warningChecksCount: number;
  checks: ReadinessCheckItem[];
  remediationScript: string;
  executiveSummary: string;
}

export interface ChaosStep {
  timeOffsetSec: number;
  phase: string;
  clusterState: 'HEALTHY' | 'DEGRADED' | 'FAILING_OVER' | 'SPLIT_BRAIN' | 'RECOVERED';
  activePrimary: string;
  standbyStatus: string;
  clientImpact: string;
  circuitBreakerStatus: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  description: string;
}

export interface ChaosSimulationResult {
  engine: string;
  scenarioId: string;
  scenarioTitle: string;
  faultType: 'PRIMARY_CRASH' | 'NETWORK_SPLIT' | 'REPLICA_LAG_SPIKE' | 'CONNECTION_STARVATION' | 'DISK_OUT_OF_SPACE';
  totalDowntimeEstimatedSec: number;
  dataLossRisk: 'ZERO_DATA_LOSS_SYNC' | 'SUB_SECOND_ASYNC' | 'DATA_LOSS_WARNING';
  timeline: ChaosStep[];
  resilienceScore: number;
  mitigationRunbook: string;
  recommendedConfigPatch: string;
}

export interface CdcOutboxResult {
  engine: string;
  sourceTable: string;
  eventType: string;
  outboxDdl: string;
  debeziumConnectorConfigJson: string;
  consumerWorkerCode: string;
  idempotencyStrategy: string;
  architectureGuidelines: string[];
}

export interface VectorTuningResult {
  engine: string;
  vectorDimension: number;
  totalVectorCount: number;
  indexType: 'HNSW' | 'IVFFLAT' | 'SCANN';
  distanceMetric: 'cosine' | 'l2' | 'inner_product';
  estimatedRamMb: number;
  estimatedBuildTimeSec: number;
  recallScorePercentage: number;
  estimatedQps: number;
  hnswParameters: {
    m: number;
    efConstruction: number;
    efSearch: number;
  };
  vectorIndexDdl: string;
  hybridSearchQuery: string;
  bestPractices: string[];
}
