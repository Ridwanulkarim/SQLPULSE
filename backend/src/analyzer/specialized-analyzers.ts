import { PlanAnalysisResult, BottleneckFinding, GraphNodeData, DatabaseEngine } from '../types/plan.types';

export class SpecializedAnalyzers {
  // 1. Redis & Key-Value Analyzer (BigKey, O(N) blocking commands, Eviction)
  public static analyzeRedis(rawInput: any): PlanAnalysisResult {
    const text = typeof rawInput === 'string' ? rawInput : JSON.stringify(rawInput, null, 2);
    const bottlenecks: BottleneckFinding[] = [];

    if (/KEYS\s+\*|HGETALL|SMEMBERS/i.test(text)) {
      bottlenecks.push({
        id: 'redis_blocking_cmd',
        nodeType: 'O(N) Blocking Command',
        severity: 'CRITICAL',
        title: 'Blocking O(N) Command in Production (KEYS * / HGETALL)',
        description: 'Redis is single-threaded. Running KEYS * or full collection reads blocks all concurrent client requests until completion.',
        metricLabel: 'Complexity',
        metricValue: 'O(N) Blocking',
        recommendation: 'Use SCAN, HSCAN, or SSCAN with small COUNT buckets to iterate collections non-blockingly.',
        suggestedSql: 'SCAN 0 MATCH user:* COUNT 100',
      });
    }

    if (/MEMORY\s+USAGE/i.test(text) || text.includes('bytes')) {
      bottlenecks.push({
        id: 'redis_bigkey',
        nodeType: 'BigKey Detection',
        severity: 'WARNING',
        title: 'Large Key Memory Footprint (BigKey Hazard)',
        description: 'Large Hash/Set keys exceed recommended limits, increasing garbage collection and replication lag.',
        metricLabel: 'Memory Usage',
        metricValue: 'High Memory',
        recommendation: 'Sharding large hash sets into sub-keys (e.g. user:123:part1).',
      });
    }

    const isBottleneck = bottlenecks.length > 0;
    const graphNodes: GraphNodeData[] = [
      {
        id: 'redis_root',
        nodeType: 'Redis Command Execution',
        totalCost: isBottleneck ? 1500 : 50,
        actualTotalTimeMs: isBottleneck ? 45.2 : 0.45,
        costPercentage: 100,
        timePercentage: 100,
        planRows: 10000,
        sharedHitBlocks: 10000,
        sharedReadBlocks: 0,
        isBottleneck,
        severity: isBottleneck ? 'CRITICAL' : 'OPTIMAL',
        details: { commandContext: text },
      },
    ];

    return {
      engine: 'redis',
      performanceScore: isBottleneck ? 45 : 98,
      executionTimeMs: isBottleneck ? 45.2 : 0.45,
      planningTimeMs: 0.05,
      totalCost: isBottleneck ? 1500 : 50,
      totalMemoryHits: 10000,
      totalDiskReads: 0,
      cacheHitRatioPercentage: 100,
      bottlenecks,
      recommendations: bottlenecks.map((b) => ({
        category: 'Redis In-Memory',
        title: b.title,
        description: b.recommendation,
        suggestedSql: b.suggestedSql,
        impact: 'HIGH' as const,
      })),
      graph: { nodes: graphNodes, edges: [] },
    };
  }

  // 2. Search & Vector AI Analyzer (Weaviate / Milvus / Pinecone / Qdrant / Elasticsearch)
  public static analyzeSearchVector(rawInput: any, engine: DatabaseEngine = 'weaviate'): PlanAnalysisResult {
    const text = typeof rawInput === 'string' ? rawInput : JSON.stringify(rawInput, null, 2);
    const bottlenecks: BottleneckFinding[] = [];

    if (/BruteForceVectorScan|FLAT/i.test(text) || text.includes('flat scan') || text.includes('without HNSW')) {
      bottlenecks.push({
        id: 'vector_flat_scan',
        nodeType: 'Unindexed Vector Scan (FLAT)',
        severity: 'CRITICAL',
        title: `${engine.toUpperCase()}: Exhaustive Brute-Force Vector Scan (FLAT Index)`,
        description: 'Searching without an approximate nearest neighbor (ANN HNSW/IVF) index forces full O(N) cosine/L2 distance calculations across all high-dimensional vectors.',
        metricLabel: 'Vector Index',
        metricValue: 'Brute-Force Scan',
        recommendation: 'Build an HNSW or IVF_SQ8 index on the collection with efSearch=64 and maxConnections=16.',
        suggestedSql: `client.collections.create(name="Articles", vector_index_config=Configure.VectorIndex.hnsw())`,
      });
    }

    if (/from\s*:\s*([1-9][0-9]{4,})/i.test(text) || text.includes('deep_pagination')) {
      bottlenecks.push({
        id: 'search_deep_paging',
        nodeType: 'Deep Pagination',
        severity: 'CRITICAL',
        title: 'Deep Pagination Overhead (from + size > 10,000)',
        description: 'Paginating deeply forces the cluster to sort and allocate memory for all preceding shards.',
        metricLabel: 'Offset Penalty',
        metricValue: '> 10,000 docs',
        recommendation: 'Use "search_after" with point-in-time (PIT) tokens or cursor-based pagination.',
      });
    }

    if (text.includes('post_filter_unindexed_metadata') || text.includes('Metadata filtering after vector')) {
      bottlenecks.push({
        id: 'vector_post_filtering',
        nodeType: 'Post-Query Metadata Filter',
        severity: 'WARNING',
        title: 'High Discard Ratio: Post-ANN Metadata Filtering',
        description: 'Applying filters after vector distance scan discards candidates, reducing result recall and wasting compute.',
        metricLabel: 'Filter Strategy',
        metricValue: 'Post-Filter Penalty',
        recommendation: 'Enable pre-filtering or single-stage filtering in Weaviate / Milvus / Pinecone payload indexes.',
      });
    }

    const isBottleneck = bottlenecks.some((b) => b.severity === 'CRITICAL');
    const graphNodes: GraphNodeData[] = [
      {
        id: 'search_root',
        nodeType: `${engine.toUpperCase()} Search Execution`,
        totalCost: isBottleneck ? 1200 : 25,
        actualTotalTimeMs: isBottleneck ? 280.0 : 3.5,
        costPercentage: 100,
        timePercentage: 100,
        planRows: isBottleneck ? 500000 : 10,
        sharedHitBlocks: 500,
        sharedReadBlocks: isBottleneck ? 4500 : 0,
        isBottleneck,
        severity: isBottleneck ? 'CRITICAL' : 'OPTIMAL',
        details: { searchContext: text },
      },
    ];

    return {
      engine,
      performanceScore: isBottleneck ? 42 : 94,
      executionTimeMs: isBottleneck ? 280.0 : 3.5,
      planningTimeMs: 1.2,
      totalCost: isBottleneck ? 1200 : 25,
      totalMemoryHits: 500,
      totalDiskReads: isBottleneck ? 4500 : 0,
      cacheHitRatioPercentage: isBottleneck ? 75.0 : 99.5,
      bottlenecks,
      recommendations: bottlenecks.map((b) => ({
        category: 'Vector & Semantic AI Search',
        title: b.title,
        description: b.recommendation,
        suggestedSql: b.suggestedSql,
        impact: (b.severity === 'CRITICAL' ? 'HIGH' : 'MEDIUM') as 'HIGH' | 'MEDIUM' | 'LOW',
      })),
      graph: { nodes: graphNodes, edges: [] },
    };
  }

  // 3. Graph Database Analyzer (Neo4j / Memgraph / Dgraph / ArangoDB)
  public static analyzeGraph(rawInput: any, engine: DatabaseEngine = 'neo4j'): PlanAnalysisResult {
    const text = typeof rawInput === 'string' ? rawInput : JSON.stringify(rawInput, null, 2);
    const bottlenecks: BottleneckFinding[] = [];

    if (/AllNodesScan|Type-based root function without indexed predicate/i.test(text) || (text.includes('AllNodesScan') && !text.includes('NodeIndexSeek'))) {
      bottlenecks.push({
        id: 'graph_all_nodes',
        nodeType: 'AllNodesScan / Full Graph Scan',
        severity: 'CRITICAL',
        title: `${engine.toUpperCase()}: Full Graph Traversal (AllNodesScan)`,
        description: 'The query traversed all nodes without leveraging property indexes or schema labels, causing high memory and CPU utilization.',
        metricLabel: 'Graph Traversal',
        metricValue: 'Full Label Scan',
        recommendation: 'Create an index or unique constraint on the starting node label and lookup predicate.',
        suggestedSql: engine === 'dgraph' ? '@filter(eq(email, "...")) with index' : 'CREATE INDEX FOR (u:User) ON (u.email);',
      });
    }

    if (/CartesianProduct|explosive traversal/i.test(text)) {
      bottlenecks.push({
        id: 'graph_cartesian',
        nodeType: 'CartesianProduct',
        severity: 'CRITICAL',
        title: 'Unconnected Graph Patterns (Cartesian Product)',
        description: 'Query matches disconnected graph patterns resulting in quadratic combinations (M × N).',
        metricLabel: 'Join Complexity',
        metricValue: 'Cartesian (M × N)',
        recommendation: 'Connect patterns with explicit directional relationships or use WITH clauses to narrow subsets.',
      });
    }

    const isBottleneck = bottlenecks.length > 0;
    const graphNodes: GraphNodeData[] = [
      {
        id: 'graph_root',
        nodeType: `${engine.toUpperCase()} Graph Traversal`,
        totalCost: isBottleneck ? 8000 : 40,
        actualTotalTimeMs: isBottleneck ? 290.0 : 1.2,
        costPercentage: 100,
        timePercentage: 100,
        planRows: isBottleneck ? 200000 : 10,
        sharedHitBlocks: 45000,
        sharedReadBlocks: isBottleneck ? 5000 : 0,
        isBottleneck,
        severity: isBottleneck ? 'CRITICAL' : 'OPTIMAL',
        details: { cypherProfile: text },
      },
    ];

    return {
      engine,
      performanceScore: isBottleneck ? 38 : 96,
      executionTimeMs: isBottleneck ? 290.0 : 1.2,
      planningTimeMs: 2.0,
      totalCost: isBottleneck ? 8000 : 40,
      totalMemoryHits: 45000,
      totalDiskReads: isBottleneck ? 5000 : 0,
      cacheHitRatioPercentage: isBottleneck ? 88.0 : 100,
      bottlenecks,
      recommendations: bottlenecks.map((b) => ({
        category: 'Graph & Network Query Tuning',
        title: b.title,
        description: b.recommendation,
        suggestedSql: b.suggestedSql,
        impact: 'HIGH' as const,
      })),
      graph: { nodes: graphNodes, edges: [] },
    };
  }

  // 4. Time-Series Analyzer (InfluxDB / TimescaleDB / Prometheus)
  public static analyzeTimeSeries(rawInput: any, engine: DatabaseEngine = 'influxdb'): PlanAnalysisResult {
    const text = typeof rawInput === 'string' ? rawInput : JSON.stringify(rawInput, null, 2);
    const bottlenecks: BottleneckFinding[] = [];

    if (/Pushdown disabled|High cardinality|non-tag predicate/i.test(text)) {
      bottlenecks.push({
        id: 'ts_high_cardinality',
        nodeType: 'High Cardinality / Missing Pushdown',
        severity: 'CRITICAL',
        title: `${engine.toUpperCase()}: Non-Indexed Field Scan / Unbounded Time Range`,
        description: 'Filtering on non-tag fields or querying wide time windows without downsampling forces full disk chunk scans.',
        metricLabel: 'Data Points Scanned',
        metricValue: '> 10M Points',
        recommendation: 'Filter on indexed tags (e.g., tag_host) and utilize continuous aggregates / recording rules with window downsampling.',
        suggestedSql: '|> aggregateWindow(every: 1m, fn: mean)',
      });
    }

    const isBottleneck = bottlenecks.length > 0;
    const graphNodes: GraphNodeData[] = [
      {
        id: 'ts_root',
        nodeType: `${engine.toUpperCase()} Time-Series Chunk Scan`,
        totalCost: isBottleneck ? 15000 : 50,
        actualTotalTimeMs: isBottleneck ? 680.0 : 3.1,
        costPercentage: 100,
        timePercentage: 100,
        planRows: isBottleneck ? 12000000 : 60,
        sharedHitBlocks: 15000,
        sharedReadBlocks: isBottleneck ? 85000 : 0,
        isBottleneck,
        severity: isBottleneck ? 'CRITICAL' : 'OPTIMAL',
        details: { fluxContext: text },
      },
    ];

    return {
      engine,
      performanceScore: isBottleneck ? 35 : 95,
      executionTimeMs: isBottleneck ? 680.0 : 3.1,
      planningTimeMs: 1.5,
      totalCost: isBottleneck ? 15000 : 50,
      totalMemoryHits: 15000,
      totalDiskReads: isBottleneck ? 85000 : 0,
      cacheHitRatioPercentage: isBottleneck ? 60.0 : 99.0,
      bottlenecks,
      recommendations: bottlenecks.map((b) => ({
        category: 'Time-Series Engine Optimization',
        title: b.title,
        description: b.recommendation,
        suggestedSql: b.suggestedSql,
        impact: 'HIGH' as const,
      })),
      graph: { nodes: graphNodes, edges: [] },
    };
  }

  // 5. Wide-Column Analyzer (Cassandra / ScyllaDB / HBase)
  public static analyzeWideColumn(rawInput: any, engine: DatabaseEngine = 'cassandra'): PlanAnalysisResult {
    const text = typeof rawInput === 'string' ? rawInput : JSON.stringify(rawInput, null, 2);
    const bottlenecks: BottleneckFinding[] = [];

    if (/ALLOW\s+FILTERING|scatter-gather|cross-shard/i.test(text)) {
      bottlenecks.push({
        id: 'cassandra_allow_filtering',
        nodeType: 'ALLOW FILTERING / Cross-Shard Scan',
        severity: 'CRITICAL',
        title: `${engine.toUpperCase()}: Anti-Pattern (ALLOW FILTERING / Cross-Shard Scatter-Gather)`,
        description: 'Scanning without a Partition Key forces every node/shard in the cluster ring to read local SSTables, leading to massive coordinator timeouts and CPU spikes.',
        metricLabel: 'Cluster Scope',
        metricValue: 'Cross-Node Full Scan',
        recommendation: 'Design the primary key partition hash to match query filtering patterns.',
        suggestedSql: 'CREATE TABLE orders_by_status (status text, id uuid, PRIMARY KEY ((status), id));',
      });
    }

    const isBottleneck = bottlenecks.length > 0;
    const graphNodes: GraphNodeData[] = [
      {
        id: 'cassandra_root',
        nodeType: `${engine.toUpperCase()} Ring Read`,
        totalCost: isBottleneck ? 5000 : 10,
        actualTotalTimeMs: isBottleneck ? 210.0 : 1.2,
        costPercentage: 100,
        timePercentage: 100,
        planRows: isBottleneck ? 100000 : 1,
        sharedHitBlocks: 1000,
        sharedReadBlocks: isBottleneck ? 50000 : 0,
        isBottleneck,
        severity: isBottleneck ? 'CRITICAL' : 'OPTIMAL',
        details: { cqlContext: text },
      },
    ];

    return {
      engine,
      performanceScore: isBottleneck ? 30 : 96,
      executionTimeMs: isBottleneck ? 210.0 : 1.2,
      planningTimeMs: 0.5,
      totalCost: isBottleneck ? 5000 : 10,
      totalMemoryHits: 1000,
      totalDiskReads: isBottleneck ? 50000 : 0,
      cacheHitRatioPercentage: isBottleneck ? 50.0 : 100,
      bottlenecks,
      recommendations: bottlenecks.map((b) => ({
        category: 'Wide-Column Data Modeling',
        title: b.title,
        description: b.recommendation,
        suggestedSql: b.suggestedSql,
        impact: 'HIGH' as const,
      })),
      graph: { nodes: graphNodes, edges: [] },
    };
  }
}
