import {
  SAMPLES_BY_ENGINE,
  MultiEngineDispatcher,
  SqlTranspiler,
  ConfigAutoTuner,
  DeadlockSimulator,
  DisasterRecoveryCalculator,
  QuerySynthesizer,
  ConnectHubGenerator,
  PartitionArchitect,
  LogInspector,
  BloatAnalyzer,
  ReplicationTopologyAnalyzer,
  SecurityRbacAnalyzer,
  MockGeneratorAnalyzer,
  FinOpsCalculatorAnalyzer,
  IndexDoctorAnalyzer,
  PiiSanitizerAnalyzer,
  QueryRewriterAnalyzer,
  analyzeSchemaDiff,
  profileOrmQuery,
  auditProductionReadiness,
  simulateChaosScenario,
  generateCdcOutboxArchitecture,
  tuneVectorIndex,
  PlanAnalyzer,
  DatabaseEngine,
} from '@sqlpulse/core';

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
const planAnalyzer = new PlanAnalyzer();

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

  simulateReplicationTopology(params: any) {
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

  buildCdcOutbox(params: any) {
    return generateCdcOutboxArchitecture(params);
  },

  tuneVector(params: any) {
    return tuneVectorIndex(params);
  },

  tuneVectorIndex(params: any) {
    return tuneVectorIndex(params);
  },

  saveReport(title?: string, raw_query?: string, raw_plan?: any) {
    const analysisResult = planAnalyzer.analyze(raw_plan || {});
    return {
      success: true,
      reportId: 'offline_local_report',
      shareUrl: '/report/offline_local_report',
      data: {
        id: 'offline_local_report',
        title: title || 'PostgreSQL Query Analysis',
        raw_query,
        raw_plan,
        performance_score: analysisResult.performanceScore,
        total_cost: analysisResult.totalCost,
        execution_time_ms: analysisResult.executionTimeMs,
        planning_time_ms: analysisResult.planningTimeMs,
        total_memory_hits: analysisResult.totalMemoryHits,
        total_disk_reads: analysisResult.totalDiskReads,
        cache_hit_ratio: analysisResult.cacheHitRatioPercentage,
        bottlenecks: analysisResult.bottlenecks,
        recommendations: analysisResult.recommendations,
        graph: analysisResult.graph,
      },
    };
  },

  fetchReport(id: string) {
    return {
      id,
      title: 'Local Report',
      raw_plan: {},
      performance_score: 100,
    };
  },
};
