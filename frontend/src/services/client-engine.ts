import { SAMPLES_BY_ENGINE } from '../samples/sample-data';
import { MultiEngineDispatcher } from '../analyzer/engine-dispatcher';
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
import { DatabaseEngine } from '../types';

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

export const clientEngine = {
  getSamples(engine: DatabaseEngine = 'postgres') {
    const fallback = (SAMPLES_BY_ENGINE as any)[engine] || SAMPLES_BY_ENGINE.postgres;
    return {
      slowPlan: fallback.slow,
      optimizedPlan: fallback.optimized,
      migrationSql: fallback.migration,
    };
  },

  analyzePlan(plan: any, _query?: string, engine: DatabaseEngine = 'postgres') {
    return dispatcher.analyzePlan(engine, plan);
  },

  lintMigration(sql: string, engine: DatabaseEngine = 'postgres') {
    return dispatcher.lintMigration(engine, sql);
  },

  adviseQuery(query: string, engine: DatabaseEngine = 'postgres') {
    return dispatcher.adviseQuery(engine, query);
  },

  transpileSql(sourceEngine: string, targetEngine: string, sourceCode: string) {
    return transpiler.transpile({ sourceEngine, targetEngine, sourceCode });
  },

  tuneConfig(params: any) {
    return configTuner.tune(params);
  },

  simulateDeadlock(params: any) {
    return deadlockSimulator.simulate(params);
  },

  calculateDisasterRecovery(params: any) {
    return disasterRecoveryCalculator.calculate(params);
  },

  synthesizeQuery(params: any) {
    return querySynthesizer.synthesize(params);
  },

  fetchConnectHub(params: any) {
    return connectHub.generate(params);
  },

  planPartition(params: any) {
    return partitionArchitect.plan(params);
  },

  inspectLogs(params: any) {
    return logInspector.inspect(params);
  },

  analyzeBloat(params: any) {
    return bloatAnalyzer.analyze(params);
  },

  simulateReplication(params: any) {
    return replicationAnalyzer.analyze(params);
  },

  generateSecurityRbac(params: any) {
    return securityRbacAnalyzer.analyze(params);
  },

  generateMockData(params: any) {
    return mockGeneratorAnalyzer.generate(params);
  },

  calculateFinOps(params: any) {
    return finOpsCalculator.calculate(params);
  },

  auditIndexDoctor(params: any) {
    return indexDoctorAnalyzer.audit(params);
  },

  sanitizePii(params: any) {
    return piiSanitizerAnalyzer.sanitize(params);
  },

  rewriteQuery(params: any) {
    return queryRewriterAnalyzer.rewrite(params);
  },

  diffSchema(params: any) {
    return analyzeSchemaDiff(params);
  },

  profileOrm(params: any) {
    return profileOrmQuery(params);
  },

  auditReadiness(params: any) {
    return auditProductionReadiness(params);
  },

  simulateChaos(params: any) {
    return simulateChaosScenario(params);
  },

  generateCdcOutbox(params: any) {
    return generateCdcOutboxArchitecture(params);
  },

  tuneVectorIndex(params: any) {
    return tuneVectorIndex(params);
  },

  saveReport(title: string, raw_query: string, raw_plan: any) {
    const id = 'report_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const reportData = {
      id,
      title,
      raw_query,
      raw_plan,
      created_at: new Date().toISOString(),
    };
    try {
      localStorage.setItem(`sqlpulse_report_${id}`, JSON.stringify(reportData));
    } catch (e) {
      // ignore
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://sqlpulse.vercel.app';
    return {
      reportId: id,
      shareUrl: `${origin}/?report=${id}`,
    };
  },

  fetchReport(id: string) {
    try {
      const data = localStorage.getItem(`sqlpulse_report_${id}`);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      // ignore
    }
    return {
      id,
      title: 'Saved Query Plan Optimization Report',
      raw_query: "SELECT * FROM orders WHERE status = 'completed';",
      raw_plan: SAMPLES_BY_ENGINE.postgres.slow,
      created_at: new Date().toISOString(),
    };
  },
};
