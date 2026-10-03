import {
  PostgresExplainOutput,
  PostgresPlanNode,
  PlanAnalysisResult,
  BottleneckFinding,
  GraphNodeData,
  GraphEdgeData,
  SeverityLevel,
} from '../types/plan.types';

export class PlanAnalyzer {
  
  public analyze(rawInput: any): PlanAnalysisResult {
    const planOutput = this.normalizeInput(rawInput);
    const rootNode = planOutput.Plan;
    const executionTimeMs = planOutput['Execution Time'] ?? rootNode['Actual Total Time'] ?? 0;
    const planningTimeMs = planOutput['Planning Time'] ?? 0;
    const rootCost = rootNode['Total Cost'] || 1;

    let totalMemoryHits = 0;
    let totalDiskReads = 0;
    let totalTempDiskUsage = 0;

    const bottlenecks: BottleneckFinding[] = [];
    const graphNodes: GraphNodeData[] = [];
    const graphEdges: GraphEdgeData[] = [];

    let nodeIdCounter = 0;

    const traverse = (node: PostgresPlanNode, parentId?: string): string => {
      const currentNodeId = `node_${++nodeIdCounter}`;

      const hitBlocks = (node['Shared Hit Blocks'] || 0) + (node['Local Hit Blocks'] || 0);
      const readBlocks = (node['Shared Read Blocks'] || 0) + (node['Local Read Blocks'] || 0);
      const tempWritten = (node['Temp Written Blocks'] || 0) + (node['Sort Space Used'] || 0);

      totalMemoryHits += hitBlocks;
      totalDiskReads += readBlocks;
      totalTempDiskUsage += tempWritten;

      const nodeBottlenecks = this.evaluateNodeRules(node, rootCost, executionTimeMs);
      bottlenecks.push(...nodeBottlenecks);

      const isBottleneck = nodeBottlenecks.length > 0;
      const highestSeverity: SeverityLevel = nodeBottlenecks.reduce<SeverityLevel>(
        (prev, curr) => {
          if (curr.severity === 'CRITICAL' || prev === 'CRITICAL') return 'CRITICAL';
          if (curr.severity === 'WARNING' || prev === 'WARNING') return 'WARNING';
          if (curr.severity === 'INFO' || prev === 'INFO') return 'INFO';
          return 'OPTIMAL';
        },
        isBottleneck ? 'INFO' : 'OPTIMAL'
      );

      const costPercentage = Math.min(100, Number(((node['Total Cost'] / rootCost) * 100).toFixed(1)));
      const nodeActualTime = node['Actual Total Time'] ?? 0;
      const timePercentage = executionTimeMs > 0
        ? Math.min(100, Number(((nodeActualTime / executionTimeMs) * 100).toFixed(1)))
        : costPercentage;

      graphNodes.push({
        id: currentNodeId,
        nodeType: node['Node Type'],
        relationName: node['Relation Name'] || node['Alias'],
        totalCost: node['Total Cost'],
        actualTotalTimeMs: node['Actual Total Time'],
        costPercentage,
        timePercentage,
        actualRows: node['Actual Rows'],
        planRows: node['Plan Rows'],
        rowsRemovedByFilter: node['Rows Removed by Filter'],
        sharedHitBlocks: hitBlocks,
        sharedReadBlocks: readBlocks,
        isBottleneck,
        severity: highestSeverity,
        details: {
          ...node,
          Plans: undefined, // exclude recursive children for cleaner node detail payload
        },
      });

      if (parentId) {
        graphEdges.push({
          id: `edge_${parentId}_to_${currentNodeId}`,
          source: parentId,
          target: currentNodeId,
        });
      }

      if (node.Plans && Array.isArray(node.Plans)) {
        for (const childNode of node.Plans) {
          traverse(childNode, currentNodeId);
        }
      }

      return currentNodeId;
    };

    traverse(rootNode);

    const totalBlocks = totalMemoryHits + totalDiskReads;
    const cacheHitRatioPercentage = totalBlocks > 0
      ? Number(((totalMemoryHits / totalBlocks) * 100).toFixed(2))
      : 100;

    const performanceScore = this.calculateScore(bottlenecks, cacheHitRatioPercentage, executionTimeMs);

    const recommendations = this.generateSummaryRecommendations(bottlenecks, cacheHitRatioPercentage);

    return {
      engine: 'postgres',
      performanceScore,
      executionTimeMs: Number(executionTimeMs.toFixed(3)),
      planningTimeMs: Number(planningTimeMs.toFixed(3)),
      totalCost: rootNode['Total Cost'],
      totalMemoryHits,
      totalDiskReads,
      cacheHitRatioPercentage,
      bottlenecks,
      recommendations,
      graph: {
        nodes: graphNodes,
        edges: graphEdges,
      },
    };
  }

  private normalizeInput(rawInput: any): PostgresExplainOutput {
    if (typeof rawInput === 'string') {
      try {
        rawInput = JSON.parse(rawInput);
      } catch (err: any) {
        throw new Error(`Invalid JSON format: ${err.message}`);
      }
    }

    if (Array.isArray(rawInput)) {
      if (rawInput.length > 0 && rawInput[0].Plan) {
        return rawInput[0];
      }
      throw new Error('Array input does not contain a valid root "Plan" node.');
    }

    if (rawInput && rawInput.Plan) {
      return rawInput;
    }

    throw new Error('Provided JSON lacks root "Plan" object. Ensure EXPLAIN (FORMAT JSON) was executed.');
  }

  private evaluateNodeRules(
    node: PostgresPlanNode,
    rootCost: number,
    totalExecutionTime: number
  ): BottleneckFinding[] {
    const findings: BottleneckFinding[] = [];
    const nodeType = node['Node Type'];
    const relationName = node['Relation Name'] || node['Alias'] || 'target_table';
    const filter = node['Filter'];
    const rowsRemoved = node['Rows Removed by Filter'] || 0;
    const actualRows = node['Actual Rows'] ?? node['Plan Rows'] ?? 0;
    const nodeTime = node['Actual Total Time'] || 0;

    if (nodeType === 'Seq Scan') {
      if (rowsRemoved > 500 || actualRows > 1000) {
        const filterColumns = this.extractColumnsFromFilter(filter);
        const colList = filterColumns.length > 0 ? filterColumns.join(', ') : 'column_name';
        const indexName = `idx_${relationName}_${filterColumns[0] || 'perf'}`;

        findings.push({
          id: `seq_scan_${Math.random().toString(36).substring(2, 8)}`,
          nodeType,
          relationName,
          severity: rowsRemoved > 5000 || actualRows > 10000 ? 'CRITICAL' : 'WARNING',
          title: `Expensive Sequential Scan on Table "${relationName}"`,
          description: `Postgres scanned the entire table sequentially because no applicable index was found. Filter discarded ${rowsRemoved.toLocaleString()} rows.`,
          metricLabel: 'Rows Removed by Filter',
          metricValue: rowsRemoved,
          recommendation: `Add a B-Tree index on ${relationName} (${colList}) to enable rapid Index Scans.`,
          suggestedSql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName} ON ${relationName} (${colList});`,
        });
      }
    }

    const planRows = node['Plan Rows'] || 1;
    if (actualRows > 0) {
      const rowRatio = actualRows / planRows;
      if (rowRatio > 10 || rowRatio < 0.1) {
        findings.push({
          id: `stale_stats_${Math.random().toString(36).substring(2, 8)}`,
          nodeType,
          relationName,
          severity: 'WARNING',
          title: `Stale Query Planner Statistics on "${relationName}"`,
          description: `The query planner predicted ${planRows.toLocaleString()} rows, but actual execution produced ${actualRows.toLocaleString()} rows (${rowRatio > 1 ? `${rowRatio.toFixed(1)}x higher` : 'significantly lower'}).`,
          metricLabel: 'Estimation Drift',
          metricValue: `${rowRatio.toFixed(1)}x`,
          recommendation: `Update optimizer statistics to help PostgreSQL choose better join algorithms and scan paths.`,
          suggestedSql: `ANALYZE ${relationName};`,
        });
      }
    }

    if (nodeType === 'Sort') {
      const sortMethod = node['Sort Method'] || '';
      const sortSpaceType = node['Sort Space Type'] || '';
      if (sortMethod.toLowerCase().includes('external') || sortSpaceType.toLowerCase() === 'disk') {
        const spaceUsedKb = node['Sort Space Used'] || 0;
        findings.push({
          id: `disk_sort_${Math.random().toString(36).substring(2, 8)}`,
          nodeType,
          relationName,
          severity: 'CRITICAL',
          title: `Sort Operation Spilled to Disk`,
          description: `The sort operation exceeded work_mem and spilled ${spaceUsedKb.toLocaleString()} KB to temporary disk storage, introducing severe I/O latency.`,
          metricLabel: 'Disk Space Used',
          metricValue: `${spaceUsedKb} KB`,
          recommendation: `Increase work_mem for this session or add an index matching the ORDER BY clause.`,
          suggestedSql: `SET work_mem = '64MB';`,
        });
      }
    }

    if (nodeType === 'Nested Loop') {
      const loops = node['Actual Loops'] || 1;
      if (loops > 1000 && (nodeTime > 50 || (nodeTime / totalExecutionTime) > 0.4)) {
        findings.push({
          id: `nested_loop_${Math.random().toString(36).substring(2, 8)}`,
          nodeType,
          severity: 'WARNING',
          title: `High Loop Count Nested Loop Join`,
          description: `Nested loop executed ${loops.toLocaleString()} iterations consuming ${(nodeTime).toFixed(2)}ms.`,
          metricLabel: 'Actual Loops',
          metricValue: loops,
          recommendation: `Ensure foreign keys in join predicates are indexed so Postgres can switch to Index Scans or Hash Joins.`,
        });
      }
    }

    const readBlocks = (node['Shared Read Blocks'] || 0);
    const hitBlocks = (node['Shared Hit Blocks'] || 0);
    if (readBlocks > 1000 && readBlocks > hitBlocks * 2) {
      findings.push({
        id: `high_io_${Math.random().toString(36).substring(2, 8)}`,
        nodeType,
        relationName,
        severity: 'WARNING',
        title: `Heavy Disk I/O Read Bottleneck on "${relationName}"`,
        description: `Node read ${readBlocks.toLocaleString()} blocks directly from disk compared to only ${hitBlocks.toLocaleString()} cache hits.`,
        metricLabel: 'Disk Blocks Read',
        metricValue: readBlocks,
        recommendation: `Ensure shared_buffers is adequately sized and hot tables/indexes fit into memory.`,
      });
    }

    return findings;
  }

  private extractColumnsFromFilter(filter?: string): string[] {
    if (!filter) return [];
    const cleaned = filter.replace(/[()'=]/g, ' ');
    const matches = cleaned.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
    const reservedWords = new Set([
      'and', 'or', 'not', 'null', 'true', 'false', 'is', 'like', 'in', 'between', 'any', 'all'
    ]);
    const columns = matches.filter(
      (token) => !reservedWords.has(token.toLowerCase()) && !/^\d+$/.test(token)
    );
    return Array.from(new Set(columns)).slice(0, 3);
  }

  private calculateScore(
    bottlenecks: BottleneckFinding[],
    cacheHitRatio: number,
    executionTimeMs: number
  ): number {
    let score = 100;

    for (const b of bottlenecks) {
      if (b.severity === 'CRITICAL') score -= 25;
      else if (b.severity === 'WARNING') score -= 12;
      else if (b.severity === 'INFO') score -= 5;
    }

    if (cacheHitRatio < 90) {
      score -= Math.round((90 - cacheHitRatio) * 0.5);
    }

    if (executionTimeMs > 1000) score -= 20;
    else if (executionTimeMs > 200) score -= 10;
    else if (executionTimeMs > 50) score -= 5;

    return Math.max(5, Math.min(100, score));
  }

  private generateSummaryRecommendations(
    bottlenecks: BottleneckFinding[],
    cacheHitRatio: number
  ): PlanAnalysisResult['recommendations'] {
    const list: PlanAnalysisResult['recommendations'] = [];

    const seqScans = bottlenecks.filter((b) => b.nodeType === 'Seq Scan' && b.suggestedSql);
    for (const scan of seqScans) {
      list.push({
        category: 'Indexing',
        title: `Create Index on ${scan.relationName}`,
        description: scan.recommendation,
        suggestedSql: scan.suggestedSql,
        impact: scan.severity === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
      });
    }

    const staleStats = bottlenecks.filter((b) => b.id.startsWith('stale_stats'));
    for (const stat of staleStats) {
      list.push({
        category: 'Statistics',
        title: `Re-analyze Table ${stat.relationName}`,
        description: stat.recommendation,
        suggestedSql: stat.suggestedSql,
        impact: 'MEDIUM',
      });
    }

    if (cacheHitRatio < 95) {
      list.push({
        category: 'Memory / Cache',
        title: 'Low Buffer Cache Hit Ratio',
        description: `Current cache hit ratio is ${cacheHitRatio}%. Ensure frequently accessed tables and indexes fit in RAM.`,
        impact: cacheHitRatio < 80 ? 'HIGH' : 'LOW',
      });
    }

    if (list.length === 0) {
      list.push({
        category: 'Optimization',
        title: 'Query Plan is Highly Optimized',
        description: 'No significant bottlenecks detected. Indexes and memory parameters are operating effectively.',
        impact: 'LOW',
      });
    }

    return list;
  }
}
