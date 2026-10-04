import { SqlTranspiler } from './transpiler';
import { ConfigAutoTuner } from './config-tuner';
import { DeadlockSimulator } from './deadlock-simulator';
import { DisasterRecoveryCalculator } from './disaster-recovery';
import { QuerySynthesizer } from './query-synthesizer';
import { ConnectHubGenerator } from './connect-hub';
import { PartitionArchitect } from './partition-architect';
import { LogInspector } from './log-inspector';
import { BloatAnalyzer } from './bloat-analyzer';
import { ReplicationTopologyAnalyzer } from './replication-topology';
import { SecurityRbacAnalyzer } from './security-rbac';
import { MockGeneratorAnalyzer } from './mock-generator';
import { FinOpsCalculatorAnalyzer } from './finops-calculator';
import { IndexDoctorAnalyzer } from './index-doctor';
import { PiiSanitizerAnalyzer } from './pii-sanitizer';
import { QueryRewriterAnalyzer } from './query-rewriter';
import { analyzeSchemaDiff } from './schema-diff';
import { auditProductionReadiness } from './production-readiness';

describe('Enterprise Multi-Engine Database Features Test Suite', () => {
  const transpiler = new SqlTranspiler();
  const configTuner = new ConfigAutoTuner();
  const deadlockSimulator = new DeadlockSimulator();
  const drCalculator = new DisasterRecoveryCalculator();
  const synthesizer = new QuerySynthesizer();
  const connectHub = new ConnectHubGenerator();
  const partitionArchitect = new PartitionArchitect();
  const logInspector = new LogInspector();
  const bloatAnalyzer = new BloatAnalyzer();
  const replicationAnalyzer = new ReplicationTopologyAnalyzer();
  const securityRbacAnalyzer = new SecurityRbacAnalyzer();
  const mockGenerator = new MockGeneratorAnalyzer();
  const finOpsCalculator = new FinOpsCalculatorAnalyzer();
  const indexDoctorAnalyzer = new IndexDoctorAnalyzer();
  const piiSanitizerAnalyzer = new PiiSanitizerAnalyzer();
  const queryRewriterAnalyzer = new QueryRewriterAnalyzer();

  test('1. SqlTranspiler converts Oracle NVL and VARCHAR2 to PostgreSQL', () => {
    const res = transpiler.transpile({
      sourceEngine: 'oracle',
      targetEngine: 'postgresql',
      sourceCode: 'SELECT NVL(name, \'N/A\'), col_val FROM orders WHERE ROWNUM <= 10;',
    });
    expect(res.transpiledCode).toContain('COALESCE');
    expect(res.transpiledCode).toContain('LIMIT 10');
    expect(res.sourceEngineName).toBe('Oracle');
    expect(res.targetEngineName).toBe('PostgreSQL');
  });

  test('2. ConfigAutoTuner produces tuned postgresql.conf and sysctl', () => {
    const res = configTuner.tune({
      engine: 'postgres',
      ramGb: 32,
      cpuCores: 8,
      storageType: 'nvme_ssd',
      workloadType: 'oltp_web',
      maxConnections: 300,
    });
    expect(res.generatedConfigText).toContain('shared_buffers');
    expect(res.sysctlConfigText).toContain('vm.swappiness = 10');
    expect(res.ramAllocation.length).toBeGreaterThan(0);
  });

  test('3. DeadlockSimulator simulates circular row lock and detects cycle', () => {
    const res = deadlockSimulator.simulate({
      engine: 'postgres',
      scenarioId: 'circular_row_locks',
    });
    expect(res.hasDeadlock).toBe(true);
    expect(res.waitForCycle.length).toBe(2);
    expect(res.remedies.length).toBeGreaterThan(0);
  });

  test('4. DisasterRecoveryCalculator computes RTO, RPO and bash backup scripts', () => {
    const res = drCalculator.calculate({
      engine: 'postgres',
      dbSizeGb: 500,
      dailyChangePercent: 10,
      networkBandwidthMbps: 1000,
      diskThroughputMbSec: 500,
      backupStrategy: 'daily_full_plus_wal_cdc',
      cloudProvider: 'aws_s3',
    });
    expect(res.rpo.rpoClassification).toBe('Near Real-Time (<1m)');
    expect(res.rto.totalEstimatedRtoMinutes).toBeGreaterThan(0);
    expect(res.backupScriptBash).toContain('pg_basebackup');
  });

  test('5. QuerySynthesizer translates natural language request into optimized query and zero-downtime index', () => {
    const res = synthesizer.synthesize({
      prompt: 'Find top 10 users who spent most money in 2024 but haven\'t placed an order in last 60 days',
      targetEngine: 'postgres',
    });
    expect(res.synthesizedQuery).toContain('NOT EXISTS');
    expect(res.zeroDowntimeIndexDdl).toContain('CONCURRENTLY');
    expect(res.complexityAnalysis.timeComplexity).toBeDefined();
  });

  test('6. ConnectHubGenerator produces connection strings and driver code', () => {
    const res = connectHub.generate({
      engine: 'postgres',
      host: 'localhost',
      port: 5432,
      database: 'test_db',
    });
    expect(res.connectionUri).toContain('postgresql://');
    expect(res.codeSnippets.length).toBeGreaterThanOrEqual(4);
    expect(res.ormSnippets.length).toBeGreaterThanOrEqual(2);
  });

  test('7. PartitionArchitect produces declarative range partitioning DDL', () => {
    const res = partitionArchitect.plan({
      engine: 'postgres',
      tableName: 'orders',
      partitionColumn: 'created_at',
      strategy: 'range_monthly',
    });
    expect(res.partitionDdl).toContain('PARTITION BY RANGE');
    expect(res.pruningSimulation.speedupFactor).toBeDefined();
    expect(res.shardDistribution.length).toBeGreaterThan(0);
  });

  test('8. LogInspector groups slow query fingerprints and recommends indexes', () => {
    const res = logInspector.inspect({
      engine: 'postgres',
      logContent: 'statement: SELECT * FROM orders WHERE customer_id = 94812;',
    });
    expect(res.groups.length).toBeGreaterThan(0);
    expect(res.groups[0].recommendedIndex).toBeDefined();
  });

  test('9. BloatAnalyzer calculates dead tuple bloat and generates zero-downtime repack script', () => {
    const res = bloatAnalyzer.analyze({
      engine: 'postgres',
      tableName: 'orders',
      totalTableSizeGb: 150,
      deadTuplePercentage: 42,
    });
    expect(res.findings.length).toBeGreaterThan(0);
    expect(res.repackScript).toContain('REINDEX TABLE CONCURRENTLY');
    expect(res.autovacuumTuningDdl).toContain('autovacuum_vacuum_scale_factor');
  });

  test('10. ReplicationTopologyAnalyzer generates cluster nodes and Patroni HA config', () => {
    const res = replicationAnalyzer.analyze({
      engine: 'postgres',
      primaryRegion: 'us-east-1',
      syncReplicasCount: 1,
      asyncReplicasCount: 2,
    });
    expect(res.nodes.length).toBe(5); 
    expect(res.haConfigSnippet).toContain('patroni.yml');
    expect(res.failoverSimulationPlan.length).toBeGreaterThan(0);
  });

  test('11. SecurityRbacAnalyzer generates RLS policies and RBAC roles', () => {
    const res = securityRbacAnalyzer.analyze({
      engine: 'postgres',
      tableName: 'customers',
      tenantColumn: 'tenant_id',
    });
    expect(res.roles.length).toBeGreaterThanOrEqual(3);
    expect(res.rlsPolicyScript).toContain('ENABLE ROW LEVEL SECURITY');
    expect(res.complianceScore).toBeGreaterThan(90);
    expect(res.auditItems.length).toBe(4);
  });

  test('12. MockGeneratorAnalyzer generates synthetic data batches and benchmark scripts across presets', () => {
    const fintechRes = mockGenerator.generate({
      engine: 'postgres',
      preset: 'fintech',
      rowCount: 10000,
    });
    expect(fintechRes.sampleRecordsJson.length).toBeGreaterThan(0);
    expect(fintechRes.bulkScript).toContain('INSERT INTO transactions');
    expect(fintechRes.benchmarkScript).toContain('pgbench');

    const healthRes = mockGenerator.generate({
      engine: 'postgres',
      preset: 'healthcare',
      rowCount: 5000,
    });
    expect(healthRes.sampleRecordsJson[0].patient_mrn).toBeDefined();
    expect(healthRes.bulkScript).toContain('patient_encounters');

    const cryptoRes = mockGenerator.generate({
      engine: 'mysql',
      preset: 'crypto_web3',
      rowCount: 2000,
    });
    expect(cryptoRes.sampleRecordsJson[0].tx_hash).toBeDefined();
    expect(cryptoRes.bulkScript).toContain('blockchain_blocks');

    const genomicsRes = mockGenerator.generate({
      engine: 'postgres',
      preset: 'genomics_sequencing',
      rowCount: 100000,
    });
    expect(genomicsRes.sampleRecordsJson[0].variant_id).toBeDefined();
    expect(genomicsRes.bulkScript).toContain('genomic_variants');

    const satelliteRes = mockGenerator.generate({
      engine: 'timescaledb',
      preset: 'satellite_constellation',
      rowCount: 50000,
    });
    expect(satelliteRes.sampleRecordsJson[0].norad_id).toBeDefined();
    expect(satelliteRes.bulkScript).toContain('orbital_satellite_telemetry');
  });

  test('13. FinOpsCalculator calculates cloud DB costs, breakdown and savings', () => {
    const res = finOpsCalculator.calculate({
      engine: 'postgres',
      cloudProvider: 'aws_aurora',
      dbSizeGb: 500,
      vCpuCount: 8,
      ramGb: 32,
    });
    expect(res.monthlyTotalCostUsd).toBeGreaterThan(0);
    expect(res.costBreakdown.length).toBeGreaterThan(3);
    expect(res.savingsOpportunities.length).toBeGreaterThan(0);
    expect(res.terraformIaC).toContain('resource "aws_db_instance"');
  });

  test('14. IndexDoctor detects redundant prefix indexes and calculates write reduction', () => {
    const res = indexDoctorAnalyzer.audit({
      engine: 'postgres',
      tableName: 'orders',
    });
    expect(res.findings.length).toBeGreaterThan(0);
    expect(res.writeAmplificationReductionPct).toBeGreaterThan(0);
    expect(res.cleanupMigrationScript).toContain('DROP INDEX CONCURRENTLY');
    expect(res.recommendedConsolidatedIndexes.length).toBeGreaterThan(0);
  });

  test('15. PiiSanitizer detects PII categories and generates pg_dump_anon rules', () => {
    const res = piiSanitizerAnalyzer.sanitize({
      engine: 'postgres',
      tableName: 'customers',
    });
    expect(res.fields.length).toBeGreaterThan(3);
    expect(res.pgDumpAnonRules).toContain('SECURITY LABEL FOR anon');
    expect(res.inPlaceScrubDdl).toContain('UPDATE "customers"');
    expect(res.overallComplianceScore).toBeGreaterThan(90);
  });

  test('16. QueryRewriter transforms non-sargable YEAR() and subquery IN to index seeks', () => {
    const res = queryRewriterAnalyzer.rewrite({
      engine: 'postgres',
      query: 'SELECT * FROM orders WHERE YEAR(created_at) = 2024 AND customer_id IN (SELECT id FROM vip_users);',
    });
    expect(res.optimizedQuery).toContain('created_at >= \'2024-01-01');
    expect(res.optimizedQuery).toContain('EXISTS');
    expect(res.optimizationsApplied.length).toBeGreaterThanOrEqual(2);
    expect(res.zeroDowntimeIndexDdl).toContain('CONCURRENTLY');
  });

  test('17. analyzeSchemaDiff generates dialect-specific zero-downtime forward and rollback DDL', () => {
    const pgDiff = analyzeSchemaDiff({ engine: 'postgresql' });
    expect(pgDiff.totalDriftCount).toBe(5);
    expect(pgDiff.forwardMigrationScript).toContain('CONCURRENTLY');
    expect(pgDiff.breakingChangesCount).toBeGreaterThan(0);

    const mysqlDiff = analyzeSchemaDiff({ engine: 'mysql' });
    expect(mysqlDiff.forwardMigrationScript).toContain('ALGORITHM=INPLACE, LOCK=NONE');

    const oracleDiff = analyzeSchemaDiff({ engine: 'oracle' });
    expect(oracleDiff.forwardMigrationScript).toContain('ONLINE');

    const mssqlDiff = analyzeSchemaDiff({ engine: 'microsoft_sql_server' });
    expect(mssqlDiff.forwardMigrationScript).toContain('WITH (ONLINE = ON)');
  });

  test('18. analyzeSchemaDiff performs dynamic AST diffing for custom Source & Target DDLs', () => {
    const srcDdl = `
      CREATE TABLE accounts (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(20) NULL,
        is_verified BOOLEAN DEFAULT FALSE
      );
      CREATE INDEX idx_accounts_phone ON accounts(phone);
      CREATE TABLE new_audit_logs (
        id BIGSERIAL PRIMARY KEY,
        action VARCHAR(64)
      );
    `;
    const tgtDdl = `
      CREATE TABLE accounts (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        old_legacy_col INT
      );
    `;

    const diff = analyzeSchemaDiff({
      engine: 'postgresql',
      sourceDdl: srcDdl,
      targetDdl: tgtDdl,
    });

    expect(diff.totalDriftCount).toBeGreaterThanOrEqual(4);
    const types = diff.changes.map(c => c.type);
    expect(types).toContain('TABLE_ADDED');
    expect(types).toContain('COLUMN_ADDED');
    expect(types).toContain('COLUMN_DROPPED');
    expect(types).toContain('INDEX_MISSING');
  });

  test('19. analyzeSchemaDiff returns distinct scenario datasets for presets', () => {
    const saasDiff = analyzeSchemaDiff({ sourceEnv: 'v2.4-stripe-billing (Staging)' });
    expect(saasDiff.changes.some(c => c.tableName === 'subscriptions' || c.tableName === 'invoices')).toBe(true);

    const erpDiff = analyzeSchemaDiff({ sourceEnv: 'Release-14-Inventory (Dev)', engine: 'oracle' });
    expect(erpDiff.changes.some(c => c.tableName === 'inventory_items' || c.tableName === 'general_ledger_entries')).toBe(true);

    const hipaaDiff = analyzeSchemaDiff({ sourceEnv: 'HIPAA-v3.0-Compliance-Branch' });
    expect(hipaaDiff.changes.some(c => c.tableName === 'patients' || c.tableName === 'hipaa_audit_trail')).toBe(true);
  });

  test('20. DeadlockSimulator parses custom SQL statements and identifies wait-for cycles', () => {
    const customDeadlock = deadlockSimulator.simulate({
      engine: 'postgresql',
      scenarioId: 'custom_sql',
      txASql: 'BEGIN; UPDATE inventory SET stock = stock - 1 WHERE id = 10; UPDATE warehouses SET items = items - 1 WHERE id = 99; COMMIT;',
      txBSql: 'BEGIN; UPDATE warehouses SET items = items - 1 WHERE id = 99; UPDATE inventory SET stock = stock - 1 WHERE id = 10; COMMIT;',
    });
    expect(customDeadlock.hasDeadlock).toBe(true);
    expect(customDeadlock.deadlockDetectedAtStep).toBe(5);
    expect(customDeadlock.waitForCycle.length).toBe(2);

    const safeSerialization = deadlockSimulator.simulate({
      engine: 'postgresql',
      scenarioId: 'custom_sql',
      txASql: 'BEGIN; UPDATE inventory SET stock = stock - 1 WHERE id = 10; COMMIT;',
      txBSql: 'BEGIN; UPDATE inventory SET stock = stock - 1 WHERE id = 10; COMMIT;',
    });
    expect(safeSerialization.hasDeadlock).toBe(false);
  });

  test('21. PartitionArchitect generates native DDL for Oracle, SQL Server, Snowflake, and Hive', () => {
    const oraclePlan = partitionArchitect.plan({
      engine: 'oracle',
      tableName: 'telemetry_events',
      partitionColumn: 'logged_at',
      strategy: 'range_monthly',
    });
    expect(oraclePlan.partitionDdl).toContain('PARTITION BY RANGE');
    expect(oraclePlan.partitionDdl).toContain('NUMTOYMINTERVAL');

    const mssqlPlan = partitionArchitect.plan({
      engine: 'microsoft_sql_server',
      tableName: 'telemetry_events',
      partitionColumn: 'logged_at',
      strategy: 'range_monthly',
    });
    expect(mssqlPlan.partitionDdl).toContain('CREATE PARTITION FUNCTION');
    expect(mssqlPlan.partitionDdl).toContain('CREATE PARTITION SCHEME');

    const snowflakePlan = partitionArchitect.plan({
      engine: 'snowflake',
      tableName: 'telemetry_events',
      partitionColumn: 'logged_at',
      strategy: 'range_monthly',
    });
    expect(snowflakePlan.partitionDdl).toContain('CLUSTER BY');

    const hivePlan = partitionArchitect.plan({
      engine: 'apache_hive',
      tableName: 'telemetry_events',
      partitionColumn: 'logged_at',
      strategy: 'range_monthly',
    });
    expect(hivePlan.partitionDdl).toContain('PARTITIONED BY');
    expect(hivePlan.partitionDdl).toContain('STORED AS ORC');
  });

  test('22. auditProductionReadiness returns dedicated, authentic engine checks across architectures', () => {
    const pg = auditProductionReadiness({ engine: 'postgres', estimatedQps: 5000 });
    expect(pg.engineName).toBe('PostgreSQL');
    expect(pg.checks.some(c => c.title.includes('Statement') && c.title.includes('Timeouts'))).toBe(true);
    expect(pg.checks.some(c => c.title.includes('Connection Floor vs Pooler'))).toBe(true);
    expect(pg.remediationScript).toContain('statement_timeout');

    const clickhouse = auditProductionReadiness({ engine: 'clickhouse', estimatedQps: 25000 });
    expect(clickhouse.engineName).toContain('ClickHouse');
    expect(clickhouse.checks.some(c => c.title.includes('Max Execution Time'))).toBe(true);
    expect(clickhouse.checks.some(c => c.title.includes('Parts to Throw Insert'))).toBe(true);
    expect(clickhouse.remediationScript).toContain('max_memory_usage');

    const redis = auditProductionReadiness({ engine: 'redis', estimatedQps: 50000 });
    expect(redis.engineName).toContain('Redis');
    expect(redis.checks.some(c => c.title.includes('MaxMemory Ceiling'))).toBe(true);
    expect(redis.checks.some(c => c.title.includes('Dangerous Commands'))).toBe(true);
    expect(redis.remediationScript).toContain('CONFIG SET maxmemory');

    const sqlite = auditProductionReadiness({ engine: 'sqlite', estimatedQps: 1000 });
    expect(sqlite.engineName).toContain('SQLite');
    expect(sqlite.checks.some(c => c.title.includes('Write-Ahead Logging'))).toBe(true);
    expect(sqlite.checks.some(c => c.title.includes('Busy Timeout'))).toBe(true);
    expect(sqlite.remediationScript).toContain('journal_mode = WAL');

    const oracle = auditProductionReadiness({ engine: 'oracle', estimatedQps: 10000 });
    expect(oracle.engineName).toBe('Oracle Database');
    expect(oracle.checks.some(c => c.title.includes('Resource Consumer Group'))).toBe(true);
    expect(oracle.checks.some(c => c.title.includes('DRCP'))).toBe(true);
    expect(oracle.remediationScript).toContain('DBMS_RESOURCE_MANAGER');

    const mongo = auditProductionReadiness({ engine: 'mongodb', estimatedQps: 5000 });
    expect(mongo.engineName).toBe('MongoDB');
    expect(mongo.checks.some(c => c.title.includes('maxTimeMS'))).toBe(true);
    expect(mongo.checks.some(c => c.title.includes('WiredTiger'))).toBe(true);
    expect(mongo.remediationScript).toContain('notablescan');
  });

  test('23. auditProductionReadiness dynamically scales score and concurrency metrics with QPS', () => {
    const lowTraffic = auditProductionReadiness({ engine: 'postgres', estimatedQps: 1000 });
    const extremeTraffic = auditProductionReadiness({ engine: 'postgres', estimatedQps: 100000 });

    // Score at 1,000 QPS is higher than at 100,000 QPS where unpooled/untimeout connections are lethal
    expect(lowTraffic.overallScore).toBeGreaterThan(extremeTraffic.overallScore);
    expect(extremeTraffic.letterGrade).toBe('F');
    expect(extremeTraffic.riskLevel).toBe('CRITICAL');

    // Concurrency metrics scale with traffic
    expect(extremeTraffic.concurrencyMetrics.estimatedConcurrentConnections)
      .toBeGreaterThan(lowTraffic.concurrencyMetrics.estimatedConcurrentConnections);
    expect(extremeTraffic.concurrencyMetrics.recommendedPoolerConnections)
      .toBeGreaterThan(lowTraffic.concurrencyMetrics.recommendedPoolerConnections);
    expect(extremeTraffic.concurrencyMetrics.estimatedBandwidthMbSec)
      .toBeGreaterThan(lowTraffic.concurrencyMetrics.estimatedBandwidthMbSec);
    expect(extremeTraffic.concurrencyMetrics.estimatedIopsDemand)
      .toBeGreaterThan(lowTraffic.concurrencyMetrics.estimatedIopsDemand);
  });

  test('24. auditProductionReadiness flips to hardened state with applyTuningPatch', () => {
    const baseline = auditProductionReadiness({ engine: 'postgres', estimatedQps: 25000, applyTuningPatch: false });
    const hardened = auditProductionReadiness({ engine: 'postgres', estimatedQps: 25000, applyTuningPatch: true });

    expect(baseline.appliedTuningPatch).toBe(false);
    expect(hardened.appliedTuningPatch).toBe(true);

    expect(hardened.overallScore).toBeGreaterThanOrEqual(96);
    expect(hardened.letterGrade).toBe('A+');
    expect(hardened.riskLevel).toBe('LOW');
    expect(hardened.failedChecksCount).toBe(0);
    expect(hardened.checks.every(c => c.status === 'PASSED')).toBe(true);
  });

  test('25. BloatAnalyzer generates authentic vacuum metrics and commands across 10 engine architectures', () => {
    // 1. PostgreSQL with vacuum metrics
    const pg = bloatAnalyzer.analyze({
      engine: 'postgres',
      tableName: 'invoices',
      totalTableSizeGb: 200,
      deadTuplePercentage: 35,
      avgDailyUpdates: 750000,
      targetIoSpeedMbSec: 100,
    });
    expect(pg.vacuumMetrics.estimatedDiskFreedGb).toBeGreaterThan(60);
    expect(pg.vacuumMetrics.postVacuumTableSizeGb).toBeLessThan(150);
    expect(pg.vacuumMetrics.estimatedDurationMinutes).toBeGreaterThan(10);
    expect(pg.vacuumMetrics.dailyBloatGrowthMb).toBeGreaterThan(100);
    expect(pg.repackScript).toContain('REINDEX TABLE CONCURRENTLY invoices');

    // 2. Oracle Database High Water Mark & SHRINK SPACE
    const oracle = bloatAnalyzer.analyze({
      engine: 'oracle',
      tableName: 'gl_transactions',
      totalTableSizeGb: 500,
      deadTuplePercentage: 45,
    });
    expect(oracle.engineName).toContain('Oracle');
    expect(oracle.repackScript).toContain('SHRINK SPACE CASCADE');
    expect(oracle.repackScript).toContain('ENABLE ROW MOVEMENT');
    expect(oracle.hygieneCheckQuery).toContain('chain_cnt');

    // 3. Microsoft SQL Server Index Rebuild / Reorganize
    const mssql = bloatAnalyzer.analyze({
      engine: 'mssql',
      tableName: 'audit_events',
      totalTableSizeGb: 300,
      deadTuplePercentage: 40,
    });
    expect(mssql.engineName).toBe('Microsoft SQL Server');
    expect(mssql.repackScript).toContain('REBUILD WITH (');
    expect(mssql.repackScript).toContain('ONLINE = ON');
    expect(mssql.hygieneCheckQuery).toContain('sys.dm_db_index_physical_stats');

    // 4. SQLite VACUUM INTO & Incremental Vacuum
    const sqlite = bloatAnalyzer.analyze({
      engine: 'sqlite',
      tableName: 'local_cache',
      totalTableSizeGb: 10,
      deadTuplePercentage: 30,
    });
    expect(sqlite.engineName).toBe('SQLite');
    expect(sqlite.repackScript).toContain('VACUUM INTO');
    expect(sqlite.autovacuumTuningDdl).toContain('PRAGMA incremental_vacuum');
    expect(sqlite.hygieneCheckQuery).toContain('freelist_count');

    // 5. Cassandra nodetool garbagecollect & tombstone thresholds
    const cassandra = bloatAnalyzer.analyze({
      engine: 'cassandra',
      tableName: 'user_timelines',
      totalTableSizeGb: 400,
      deadTuplePercentage: 50,
    });
    expect(cassandra.engineName).toBe('Apache Cassandra');
    expect(cassandra.repackScript).toContain('nodetool garbagecollect');
    expect(cassandra.autovacuumTuningDdl).toContain('LeveledCompactionStrategy');

    // 6. Redis active defragmentation
    const redis = bloatAnalyzer.analyze({
      engine: 'redis',
      tableName: 'session_keys',
      totalTableSizeGb: 64,
      deadTuplePercentage: 35,
    });
    expect(redis.engineName).toBe('Redis');
    expect(redis.repackScript).toContain('activedefrag yes');
    expect(redis.hygieneCheckQuery).toContain('mem_fragmentation_ratio');
  });
});

