import { PlanAnalyzer } from './plan-analyzer';
import { SAMPLE_SLOW_PLAN, SAMPLE_OPTIMIZED_PLAN } from '../samples/sample-data';

describe('PlanAnalyzer Engine Tests', () => {
  const analyzer = new PlanAnalyzer();

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
});
