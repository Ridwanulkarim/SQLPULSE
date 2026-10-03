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
import {
  analyzePlanSchema,
  lintMigrationSchema,
  adviseQuerySchema,
  transpileSchema,
  tuneConfigSchema,
  deadlockSchema,
  disasterRecoverySchema,
  synthesizeQuerySchema,
  connectHubSchema,
  partitionSchema,
  inspectLogsSchema,
  bloatSchema,
  replicationSchema,
  securityRbacSchema,
  mockDataSchema,
  finOpsSchema,
  indexDoctorSchema,
  piiSanitizerSchema,
  queryRewriterSchema,
  schemaDiffSchema,
  ormProfilerSchema,
  readinessSchema,
  chaosSchema,
  cdcOutboxSchema,
  vectorTuneSchema,
} from '../validators/schemas';

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
    const parse = analyzePlanSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid plan request', details: parse.error.errors });
      return;
    }
    const { plan, query, engine } = parse.data;
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
    const parse = lintMigrationSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid migration request', details: parse.error.errors });
      return;
    }
    const { sql, engine } = parse.data;
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
    const parse = adviseQuerySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid query advice request', details: parse.error.errors });
      return;
    }
    const { query, engine } = parse.data;
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
    const parse = transpileSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid transpile request', details: parse.error.errors });
      return;
    }
    const result = transpiler.transpile(parse.data);
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
    const parse = tuneConfigSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid config tuning request', details: parse.error.errors });
      return;
    }
    const result = configTuner.tune(parse.data as any);
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
    const parse = deadlockSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid deadlock simulation request', details: parse.error.errors });
      return;
    }
    const result = deadlockSimulator.simulate(parse.data as any);
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
    const parse = disasterRecoverySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid disaster recovery request', details: parse.error.errors });
      return;
    }
    const result = disasterRecoveryCalculator.calculate(parse.data as any);
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
    const parse = synthesizeQuerySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid query synthesis request', details: parse.error.errors });
      return;
    }
    const result = querySynthesizer.synthesize(parse.data as any);
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
    const parse = connectHubSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid connect hub request', details: parse.error.errors });
      return;
    }
    const result = connectHub.generate(parse.data as any);
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
    const parse = partitionSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid partition request', details: parse.error.errors });
      return;
    }
    const result = partitionArchitect.plan(parse.data as any);
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
    const parse = inspectLogsSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid slow logs request', details: parse.error.errors });
      return;
    }
    const result = logInspector.inspect(parse.data as any);
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
    const parse = bloatSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid bloat request', details: parse.error.errors });
      return;
    }
    const result = bloatAnalyzer.analyze(parse.data as any);
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
    const parse = replicationSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid replication request', details: parse.error.errors });
      return;
    }
    const result = replicationAnalyzer.analyze(parse.data as any);
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
    const parse = securityRbacSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid security RBAC request', details: parse.error.errors });
      return;
    }
    const result = securityRbacAnalyzer.analyze(parse.data as any);
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
    const parse = mockDataSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid mock data request', details: parse.error.errors });
      return;
    }
    const result = mockGeneratorAnalyzer.generate(parse.data as any);
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
    const parse = finOpsSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid FinOps request', details: parse.error.errors });
      return;
    }
    const result = finOpsCalculator.calculate(parse.data as any);
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
    const parse = indexDoctorSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid Index Doctor request', details: parse.error.errors });
      return;
    }
    const result = indexDoctorAnalyzer.audit(parse.data as any);
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
    const parse = piiSanitizerSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid PII sanitizer request', details: parse.error.errors });
      return;
    }
    const result = piiSanitizerAnalyzer.sanitize(parse.data as any);
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
    const parse = queryRewriterSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid query rewrite request', details: parse.error.errors });
      return;
    }
    const result = queryRewriterAnalyzer.rewrite(parse.data as any);
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
    const parse = schemaDiffSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid schema diff request', details: parse.error.errors });
      return;
    }
    const result = analyzeSchemaDiff(parse.data as any);
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
    const parse = ormProfilerSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid ORM profiler request', details: parse.error.errors });
      return;
    }
    const result = profileOrmQuery(parse.data as any);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to profile ORM queries.',
    });
  }
};

export const auditReadiness = (req: Request, res: Response): void => {
  try {
    const parse = readinessSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid readiness audit request', details: parse.error.errors });
      return;
    }
    const result = auditProductionReadiness(parse.data as any);
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
    const parse = chaosSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid chaos simulation request', details: parse.error.errors });
      return;
    }
    const result = simulateChaosScenario(parse.data as any);
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
    const parse = cdcOutboxSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid CDC outbox request', details: parse.error.errors });
      return;
    }
    const result = generateCdcOutboxArchitecture(parse.data as any);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to build CDC outbox architecture.',
    });
  }
};

export const tuneVector = (req: Request, res: Response): void => {
  try {
    const parse = vectorTuneSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: 'Invalid vector tuning request', details: parse.error.errors });
      return;
    }
    const result = tuneVectorIndex(parse.data as any);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Failed to tune vector index.',
    });
  }
};
