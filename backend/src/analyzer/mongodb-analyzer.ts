import {
  PlanAnalysisResult,
  BottleneckFinding,
  GraphNodeData,
  GraphEdgeData,
} from '../types/plan.types';

export class MongoDBAnalyzer {
  public analyze(rawInput: any): PlanAnalysisResult {
    const data = this.normalizeInput(rawInput);
    const stats = data.executionStats || data;
    const rootStage = stats.executionStages || data;

    const nReturned = stats.nReturned ?? rootStage.nReturned ?? 0;
    const totalDocsExamined = stats.totalDocsExamined ?? rootStage.docsExamined ?? 0;
    const totalKeysExamined = stats.totalKeysExamined ?? 0;
    const executionTimeMillis = stats.executionTimeMillis ?? 0;

    const bottlenecks: BottleneckFinding[] = [];
    const graphNodes: GraphNodeData[] = [];
    const graphEdges: GraphEdgeData[] = [];
    let nodeIdCounter = 0;

    const traverse = (stage: any, parentId?: string) => {
      if (!stage || typeof stage !== 'object') return;
      const currentNodeId = `mongo_stage_${++nodeIdCounter}`;
      const stageName = stage.stage || 'STAGE';
      const stageDocs = stage.docsExamined || 0;
      const stageReturned = stage.nReturned || 0;

      // Rule 1: COLLSCAN (Collection Scan)
      if (stageName === 'COLLSCAN' && (totalDocsExamined > 500 || stageDocs > 500)) {
        const filterKeys = Object.keys(stage.filter || {});
        const fieldName = filterKeys[0] || 'field_name';

        bottlenecks.push({
          id: `mongo_collscan_${Math.random().toString(36).substring(2, 7)}`,
          nodeType: 'COLLSCAN',
          severity: totalDocsExamined > 5000 ? 'CRITICAL' : 'WARNING',
          title: `MongoDB Collection Scan (COLLSCAN)`,
          description: `MongoDB performed a full collection scan across ${totalDocsExamined.toLocaleString()} documents because no index matched the query filter.`,
          metricLabel: 'Docs Examined vs Returned',
          metricValue: `${totalDocsExamined.toLocaleString()} : ${nReturned.toLocaleString()}`,
          recommendation: `Create an index on { ${fieldName}: 1 } to switch from COLLSCAN to IXSCAN.`,
          suggestedSql: `db.collection.createIndex({ "${fieldName}": 1 }, { background: true });`,
        });
      }

      // Rule 2: In-Memory SORT Stage (32MB Ram Limit Risk)
      if (stageName === 'SORT') {
        bottlenecks.push({
          id: `mongo_sort_${Math.random().toString(36).substring(2, 7)}`,
          nodeType: 'SORT',
          severity: 'WARNING',
          title: 'In-Memory Sort Stage (32MB RAM Limit Risk)',
          description: 'Query is sorting in memory without using an indexed order. This can fail if result exceeds 32MB.',
          metricLabel: 'Sort Stage',
          metricValue: 'In-Memory Sort',
          recommendation: 'Add an index matching the sort pattern.',
          suggestedSql: `db.collection.createIndex({ "status": 1, "createdAt": -1 });`,
        });
      }

      const isBottleneck = stageName === 'COLLSCAN' || stageName === 'SORT';
      graphNodes.push({
        id: currentNodeId,
        nodeType: stageName,
        totalCost: totalDocsExamined,
        actualTotalTimeMs: stage.executionTimeMillisEstimate || executionTimeMillis,
        costPercentage: 100,
        timePercentage: 100,
        actualRows: stageReturned,
        planRows: stageDocs,
        rowsRemovedByFilter: Math.max(0, stageDocs - stageReturned),
        sharedHitBlocks: totalKeysExamined,
        sharedReadBlocks: stageName === 'COLLSCAN' ? totalDocsExamined : 0,
        isBottleneck,
        severity: isBottleneck ? 'CRITICAL' : 'OPTIMAL',
        details: stage,
      });

      if (parentId) {
        graphEdges.push({
          id: `edge_${parentId}_to_${currentNodeId}`,
          source: parentId,
          target: currentNodeId,
        });
      }

      if (stage.inputStage) {
        traverse(stage.inputStage, currentNodeId);
      }
      if (Array.isArray(stage.inputStages)) {
        for (const input of stage.inputStages) {
          traverse(input, currentNodeId);
        }
      }
    };

    traverse(rootStage);

    let score = 100;
    for (const b of bottlenecks) {
      if (b.severity === 'CRITICAL') score -= 35;
      else if (b.severity === 'WARNING') score -= 15;
    }

    return {
      engine: 'mongodb',
      performanceScore: Math.max(10, score),
      executionTimeMs: executionTimeMillis,
      planningTimeMs: 0.5,
      totalCost: totalDocsExamined,
      totalMemoryHits: totalKeysExamined,
      totalDiskReads: totalDocsExamined,
      cacheHitRatioPercentage: totalKeysExamined > 0 ? 85.0 : 40.0,
      bottlenecks,
      recommendations: bottlenecks.map((b) => ({
        category: 'MongoDB Indexing',
        title: b.title,
        description: b.recommendation,
        suggestedSql: b.suggestedSql,
        impact: b.severity === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
      })),
      graph: {
        nodes: graphNodes,
        edges: graphEdges,
      },
    };
  }

  private normalizeInput(raw: any): any {
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch (e: any) {
        throw new Error(`Invalid MongoDB JSON explain: ${e.message}`);
      }
    }
    return raw;
  }
}
