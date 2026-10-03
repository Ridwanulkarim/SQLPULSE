import { PlanAnalyzer } from './plan-analyzer';
import { MultiEngineDispatcher } from './engine-dispatcher';
import { getEngineMetadata } from '../types/db-catalog.data';
import { SAMPLE_SLOW_PLAN, SAMPLE_OPTIMIZED_PLAN } from '../samples/sample-data';

describe('PlanAnalyzer Engine Tests', () => {
  const analyzer = new PlanAnalyzer();
  const dispatcher = new MultiEngineDispatcher();

  test('should detect Seq Scan bottlenecks and suggest B-Tree index', () => {
    const result = analyzer.analyze(SAMPLE_SLOW_PLAN);

    expect(result.performanceScore).toBeLessThan(80);
    expect(result.executionTimeMs).toBe(430.15);
    expect(result.totalCost).toBe(50825.2);
    expect(result.bottlenecks.length).toBeGreaterThanOrEqual(1);

    const seqScanBottleneck = result.bottlenecks.find((b) => b.nodeType === 'Seq Scan');
    expect(seqScanBottleneck).toBeDefined();
    expect(seqScanBottleneck?.severity).toBe('CRITICAL');
    expect(seqScanBottleneck?.suggestedSql).toContain('CREATE INDEX CONCURRENTLY');
  });

  test('should detect disk sort spill (work_mem exhaustion)', () => {
    const result = analyzer.analyze(SAMPLE_SLOW_PLAN);
    const diskSort = result.bottlenecks.find((b) => b.id.startsWith('disk_sort'));

    expect(diskSort).toBeDefined();
    expect(diskSort?.title).toContain('Sort Operation Spilled to Disk');
    expect(diskSort?.suggestedSql).toContain('SET work_mem');
  });

  test('should score clean index scan plans high (>= 90)', () => {
    const result = analyzer.analyze(SAMPLE_OPTIMIZED_PLAN);

    expect(result.performanceScore).toBeGreaterThanOrEqual(90);
    expect(result.bottlenecks.length).toBe(0);
    expect(result.cacheHitRatioPercentage).toBe(100);
  });

  test('MultiEngineDispatcher: handles native Postgres engines without fallback notice', () => {
    const engines = ['postgresql', 'cockroachdb', 'timescaledb', 'yugabytedb', 'amazon_aurora'] as const;
    for (const eng of engines) {
      const res = dispatcher.analyzePlan(eng as any, SAMPLE_OPTIMIZED_PLAN);
      expect(res.isFallbackAnalysis).toBe(false);
      expect(res.fallbackNotice).toBeUndefined();
    }
  });

  test('MultiEngineDispatcher: routes elasticsearch (search) and dynamodb (document) without relational fallback', () => {
    const esMeta = getEngineMetadata('elasticsearch');
    expect(esMeta.category).toBe('search');
    expect(esMeta.icon).toBe('🔍');

    const dynamoMeta = getEngineMetadata('amazon_dynamodb');
    expect(dynamoMeta.category).toBe('document');

    const esResult = dispatcher.analyzePlan('elasticsearch' as any, {});
    expect(esResult.isFallbackAnalysis).toBe(false);

    const dynamoResult = dispatcher.analyzePlan('amazon_dynamodb' as any, {});
    expect(dynamoResult.isFallbackAnalysis).toBe(false);
  });

  test('MultiEngineDispatcher: adapts DDL syntax for Oracle and MSSQL fallback', () => {
    const oracleResult = dispatcher.analyzePlan('oracle' as any, SAMPLE_SLOW_PLAN);
    expect(oracleResult.isFallbackAnalysis).toBe(true);
    expect(oracleResult.engineMetadata?.name).toBe('Oracle');
    expect(oracleResult.fallbackNotice).toContain('Oracle');
    const oracleIndex = oracleResult.bottlenecks.find((b) => b.suggestedSql?.includes('ONLINE;'));
    expect(oracleIndex).toBeDefined();

    const mssqlResult = dispatcher.analyzePlan('microsoft_sql_server' as any, SAMPLE_SLOW_PLAN);
    expect(mssqlResult.isFallbackAnalysis).toBe(true);
    expect(mssqlResult.engineMetadata?.name).toBe('Microsoft SQL Server');
    const mssqlIndex = mssqlResult.bottlenecks.find((b) => b.suggestedSql?.includes('WITH (ONLINE = ON);'));
    expect(mssqlIndex).toBeDefined();
  });

  test('MultiEngineDispatcher: unknown engine produces dynamic metadata, not Oracle', () => {
    const res = dispatcher.analyzePlan('not_a_real_engine' as any, SAMPLE_OPTIMIZED_PLAN);
    expect(res.isFallbackAnalysis).toBe(true);
    expect(res.engineMetadata?.id).toBe('not_a_real_engine');
    expect(res.engineMetadata?.name).toBe('Not A Real Engine (Custom)');
    expect(res.engineMetadata?.name).not.toBe('Oracle');
  });
});
