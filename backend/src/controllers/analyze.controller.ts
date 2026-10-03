import { Request, Response } from 'express';
import { MultiEngineDispatcher } from '../analyzer/engine-dispatcher';
import { SAMPLES_BY_ENGINE } from '../samples/sample-data';
import { DatabaseEngine } from '../types/plan.types';
import { SqlTranspiler } from '../analyzer/transpiler';
import { ConfigAutoTuner } from '../analyzer/config-tuner';
import { DeadlockSimulator } from '../analyzer/deadlock-simulator';
import { DisasterRecoveryCalculator } from '../analyzer/disaster-recovery';
import { QuerySynthesizer } from '../analyzer/query-synthesizer';
import { ConnectHubGenerator } from '../analyzer/connect-hub';
import { PartitionArchitect } from '../analyzer/partition-architect';
import { LogInspector } from '../analyzer/log-inspector';
import { BloatAnalyzer } from '../analyzer/bloat-analyzer';
import { ReplicationTopologyAnalyzer } from '../analyzer/replication-topology';
import { SecurityRbacAnalyzer } from '../analyzer/security-rbac';
import { MockGeneratorAnalyzer } from '../analyzer/mock-generator';
import { FinOpsCalculatorAnalyzer } from '../analyzer/finops-calculator';
import { IndexDoctorAnalyzer } from '../analyzer/index-doctor';
import { PiiSanitizerAnalyzer } from '../analyzer/pii-sanitizer';
import { QueryRewriterAnalyzer } from '../analyzer/query-rewriter';
import { analyzeSchemaDiff } from '../analyzer/schema-diff';
import { profileOrmQuery } from '../analyzer/orm-profiler';
import { auditProductionReadiness } from '../analyzer/production-readiness';
import { simulateChaosScenario } from '../analyzer/chaos-simulator';
import { generateCdcOutboxArchitecture } from '../analyzer/cdc-outbox';
import { tuneVectorIndex } from '../analyzer/vector-tuner';

const dispatcher = new MultiEngineDispatcher();
const transpiler = new SqlTranspiler();
const configTuner = new ConfigAutoTuner();
const deadlockSimulator = new DeadlockSimulator();
const disasterRecoveryCalculator = new DisasterRecoveryCalculator();
const querySynthesizer = new QuerySynthesizer();
const connectHub = new ConnectHubGenerator();
const partitionArchitect = new PartitionArchitect();
const logInspector = new LogInspector();
const bloatAnalyzer = new BloatAnalyzer();
const replicationAnalyzer = new ReplicationTopologyAnalyzer();
const securityRbacAnalyzer = new SecurityRbacAnalyzer();
const mockGeneratorAnalyzer = new MockGeneratorAnalyzer();
const finOpsCalculator = new FinOpsCalculatorAnalyzer();
const indexDoctorAnalyzer = new IndexDoctorAnalyzer();
const piiSanitizerAnalyzer = new PiiSanitizerAnalyzer();
const queryRewriterAnalyzer = new QueryRewriterAnalyzer();

export const analyzePlan = (req: Request, res: Response): void => {
  try {
    const { plan, query, engine = 'postgres' } = req.body;
    if (!plan) {
      res.status(400).json({ error: 'Missing required "plan" field in request body.' });
      return;
    }

    const result = dispatcher.analyzePlan(engine as DatabaseEngine, plan);
    res.json({
      success: true,
      engine,
      query: query || null,
      data: result,
    });
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to analyze query execution plan.',
    });
  }
};

export const lintMigration = (req: Request, res: Response): void => {
  try {
    const { sql, engine = 'postgres' } = req.body;
    if (!sql || typeof sql !== 'string') {
      res.status(400).json({ error: 'Missing or invalid "sql" field in request body.' });
      return;
    }

    const result = dispatcher.lintMigration(engine as DatabaseEngine, sql);
    res.json({
      success: true,
      engine,
      data: result,
    });
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to lint migration script.',
    });
  }
};

export const adviseQuery = (req: Request, res: Response): void => {
  try {
    const { query, engine = 'postgres' } = req.body;
    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Missing or invalid "query" field in request body.' });
      return;
    }

    const result = dispatcher.adviseQuery(engine as DatabaseEngine, query);
    res.json({
      success: true,
      engine,
      data: result,
    });
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to analyze query anti-patterns.',
    });
  }
};

export const getSamples = (req: Request, res: Response): void => {
  const engine = (req.query.engine as DatabaseEngine) || 'postgres';
  const engineSamples = (SAMPLES_BY_ENGINE as any)[engine] || SAMPLES_BY_ENGINE.postgres;

  res.json({
    success: true,
    engine,
    samples: {
      slowPlan: engineSamples.slow,
      optimizedPlan: engineSamples.optimized,
      unsafeMigration: engineSamples.migration,
    },
    allEngines: SAMPLES_BY_ENGINE,
  });
};

export const transpileSql = (req: Request, res: Response): void => {
  try {
    const { sourceEngine = 'oracle', targetEngine = 'postgres', sourceCode = '' } = req.body;
    if (!sourceCode) {
      res.status(400).json({ error: 'Missing required "sourceCode" in request body.' });
      return;
    }

    const result = transpiler.transpile({ sourceEngine, targetEngine, sourceCode });
    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to transpile code.',
    });
  }
};

export const tuneConfig = (req: Request, res: Response): void => {
  try {
    const {
      engine = 'postgres',
      ramGb = 16,
      cpuCores = 4,
      storageType = 'nvme_ssd',
      workloadType = 'oltp_web',
      maxConnections = 200,
    } = req.body;

    const result = configTuner.tune({
      engine,
      ramGb: Number(ramGb),
      cpuCores: Number(cpuCores),
      storageType,
      workloadType,
      maxConnections: Number(maxConnections),
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to generate tuned database configuration.',
    });
  }
};

export const simulateDeadlock = (req: Request, res: Response): void => {
  try {
    const { engine = 'postgres', scenarioId = 'circular_row_locks', txASql, txBSql } = req.body;
    const result = deadlockSimulator.simulate({ engine, scenarioId, txASql, txBSql });
    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to simulate deadlock scenario.',
    });
  }
};

export const calculateDisasterRecovery = (req: Request, res: Response): void => {
  try {
    const {
      engine = 'postgres',
      dbSizeGb = 500,
      dailyChangePercent = 10,
      networkBandwidthMbps = 1000,
      diskThroughputMbSec = 500,
      backupStrategy = 'daily_full_plus_wal_cdc',
      cloudProvider = 'aws_s3',
    } = req.body;

    const result = disasterRecoveryCalculator.calculate({
      engine,
      dbSizeGb: Number(dbSizeGb),
      dailyChangePercent: Number(dailyChangePercent),
      networkBandwidthMbps: Number(networkBandwidthMbps),
      diskThroughputMbSec: Number(diskThroughputMbSec),
      backupStrategy,
      cloudProvider,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to calculate disaster recovery metrics.',
    });
  }
};

export const synthesizeQuery = (req: Request, res: Response): void => {
  try {
    const { prompt, targetEngine = 'postgres', schemaContext, domainPreset } = req.body;
    if (!prompt) {
      res.status(400).json({ error: 'Missing required "prompt" field.' });
      return;
    }

    const result = querySynthesizer.synthesize({
      prompt,
      targetEngine,
      schemaContext,
      domainPreset,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to synthesize multi-engine query.',
    });
  }
};

export const generateConnectHub = (req: Request, res: Response): void => {
  try {
    const { engine = 'postgres', host, port, database, username, password, sslMode, poolSize } = req.body;
    const result = connectHub.generate({
      engine,
      host,
      port: port ? Number(port) : undefined,
      database,
      username,
      password,
      sslMode,
      poolSize: poolSize ? Number(poolSize) : undefined,
    });
    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to generate connection parameters.',
    });
  }
};

export const planPartitionStrategy = (req: Request, res: Response): void => {
  try {
    const { engine = 'postgres', tableName, partitionColumn, strategy, estimatedMonthlyRows, retentionMonths } = req.body;
    const result = partitionArchitect.plan({
      engine,
      tableName,
      partitionColumn,
      strategy,
      estimatedMonthlyRows: estimatedMonthlyRows ? Number(estimatedMonthlyRows) : 10000000,
      retentionMonths: retentionMonths ? Number(retentionMonths) : 12,
    });
    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to generate partitioning plan.',
    });
  }
};

export const inspectSlowLogs = (req: Request, res: Response): void => {
  try {
    const { engine = 'postgres', logContent = '' } = req.body;
    const result = logInspector.inspect({ engine, logContent });
    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to analyze slow query logs.',
    });
  }
};

export const analyzeBloat = (req: Request, res: Response): void => {
  try {
    const { engine = 'postgres', tableName, totalTableSizeGb, deadTuplePercentage, avgDailyUpdates } = req.body;
    const result = bloatAnalyzer.analyze({
      engine,
      tableName,
      totalTableSizeGb: totalTableSizeGb ? Number(totalTableSizeGb) : undefined,
      deadTuplePercentage: deadTuplePercentage ? Number(deadTuplePercentage) : undefined,
      avgDailyUpdates: avgDailyUpdates ? Number(avgDailyUpdates) : undefined,
    });
    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to analyze table bloat and vacuum requirements.',
    });
  }
};

export const simulateReplicationTopology = (req: Request, res: Response): void => {
  try {
    const { engine = 'postgres', primaryRegion, syncReplicasCount, asyncReplicasCount, failoverManager, networkRttMs } = req.body;
    const result = replicationAnalyzer.analyze({
      engine,
      primaryRegion,
      syncReplicasCount: syncReplicasCount !== undefined ? Number(syncReplicasCount) : undefined,
      asyncReplicasCount: asyncReplicasCount !== undefined ? Number(asyncReplicasCount) : undefined,
      failoverManager,
      networkRttMs: networkRttMs !== undefined ? Number(networkRttMs) : undefined,
    });
    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to simulate replication topology and failover scenarios.',
    });
  }
};

export const generateSecurityRbac = (req: Request, res: Response): void => {
  try {
    const { engine = 'postgres', tableName, tenantColumn, piiColumns, enforceTls } = req.body;
    const result = securityRbacAnalyzer.analyze({
      engine,
      tableName,
      tenantColumn,
      piiColumns,
      enforceTls,
    });
    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to generate security matrix, RLS and RBAC policies.',
    });
  }
};

export const generateMockData = (req: Request, res: Response): void => {
  try {
    const { engine = 'postgres', preset, rowCount, format } = req.body;
    const result = mockGeneratorAnalyzer.generate({
      engine,
      preset,
      rowCount: rowCount !== undefined ? Number(rowCount) : undefined,
      format,
    });
    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to generate synthetic mock dataset and load scripts.',
    });
  }
};

export const calculateFinOps = (req: Request, res: Response): void => {
  try {
    const {
      engine = 'postgres',
      cloudProvider,
      dbSizeGb,
      monthlyReadQueriesMillion,
      monthlyWriteQueriesMillion,
      ramGb,
      vCpuCount,
      storageTier,
      provisionedIops,
      backupRetentionDays,
      multiRegionHa,
    } = req.body;

    const result = finOpsCalculator.calculate({
      engine,
      cloudProvider,
      dbSizeGb: dbSizeGb !== undefined ? Number(dbSizeGb) : undefined,
      monthlyReadQueriesMillion: monthlyReadQueriesMillion !== undefined ? Number(monthlyReadQueriesMillion) : undefined,
      monthlyWriteQueriesMillion: monthlyWriteQueriesMillion !== undefined ? Number(monthlyWriteQueriesMillion) : undefined,
      ramGb: ramGb !== undefined ? Number(ramGb) : undefined,
      vCpuCount: vCpuCount !== undefined ? Number(vCpuCount) : undefined,
      storageTier,
      provisionedIops: provisionedIops !== undefined ? Number(provisionedIops) : undefined,
      backupRetentionDays: backupRetentionDays !== undefined ? Number(backupRetentionDays) : undefined,
      multiRegionHa: multiRegionHa !== undefined ? Boolean(multiRegionHa) : undefined,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to calculate cloud database FinOps pricing.',
    });
  }
};

export const auditIndexDoctor = (req: Request, res: Response): void => {
  try {
    const { engine = 'postgres', tableName, indexes, rawIndexDdl } = req.body;
    const result = indexDoctorAnalyzer.audit({
      engine,
      tableName,
      indexes,
      rawIndexDdl,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to audit index redundancy and write amplification.',
    });
  }
};

export const sanitizePii = (req: Request, res: Response): void => {
  try {
    const { engine = 'postgres', tableName, columns, anonymizationSalt } = req.body;
    const result = piiSanitizerAnalyzer.sanitize({
      engine,
      tableName,
      columns,
      anonymizationSalt,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to generate PII masking and data anonymization rules.',
    });
  }
};

export const rewriteQuery = (req: Request, res: Response): void => {
  try {
    const { engine = 'postgres', query, tableHint } = req.body;
    if (!query) {
      res.status(400).json({ error: 'Missing required "query" in request body.' });
      return;
    }

    const result = queryRewriterAnalyzer.rewrite({
      engine,
      query,
      tableHint,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to rewrite and optimize query sargability.',
    });
  }
};

export const diffSchema = (req: Request, res: Response): void => {
  try {
    const { engine = 'postgresql', sourceEnv, targetEnv, sourceDdl, targetDdl } = req.body;
    const result = analyzeSchemaDiff({
      engine,
      sourceEnv,
      targetEnv,
      sourceDdl,
      targetDdl,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to compute schema difference.',
    });
  }
};

export const profileOrm = (req: Request, res: Response): void => {
  try {
    const { framework = 'prisma', rawQueryOrCode, batchSize } = req.body;
    const result = profileOrmQuery({
      framework,
      rawQueryOrCode,
      batchSize: Number(batchSize || 1000),
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to profile ORM query anti-patterns.',
    });
  }
};

export const auditReadiness = (req: Request, res: Response): void => {
  try {
    const { engine = 'postgresql', environmentType, estimatedQps } = req.body;
    const result = auditProductionReadiness({
      engine,
      environmentType,
      estimatedQps: Number(estimatedQps || 5000),
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to audit production readiness.',
    });
  }
};

export const simulateChaos = (req: Request, res: Response): void => {
  try {
    const { engine = 'postgresql', scenarioId = 'primary_crash', clusterSize, syncMode } = req.body;
    const result = simulateChaosScenario({
      engine,
      scenarioId,
      clusterSize: Number(clusterSize || 3),
      syncMode,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to simulate chaos scenario.',
    });
  }
};

export const buildCdcOutbox = (req: Request, res: Response): void => {
  try {
    const { engine = 'postgresql', sourceTable, destinationBroker } = req.body;
    const result = generateCdcOutboxArchitecture({
      engine,
      sourceTable,
      destinationBroker,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to generate CDC Outbox architecture.',
    });
  }
};

export const tuneVector = (req: Request, res: Response): void => {
  try {
    const { engine = 'pgvector', dimension, vectorCount, indexType, distanceMetric } = req.body;
    const result = tuneVectorIndex({
      engine,
      dimension: Number(dimension || 1536),
      vectorCount: Number(vectorCount || 500000),
      indexType,
      distanceMetric,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to tune vector index.',
    });
  }
};
