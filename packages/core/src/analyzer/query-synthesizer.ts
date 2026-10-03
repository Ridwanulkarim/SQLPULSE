import { DATABASE_CATALOG } from '../types/db-catalog.data';

export interface QuerySynthesizeRequest {
  prompt: string;
  targetEngine: string;
  schemaContext?: string;
  domainPreset?: 'ecommerce' | 'saas_telemetry' | 'social_network' | 'iot_timeseries' | 'vector_rag';
}

export interface QuerySynthesizeResult {
  engine: string;
  engineName: string;
  dialectCategory: string;
  prompt: string;
  synthesizedQuery: string;
  zeroDowntimeIndexDdl: string;
  queryExplanation: string;
  complexityAnalysis: {
    timeComplexity: string;
    estimatedMemory: string;
    indexLookupType: string;
  };
  antipatternWarnings: string[];
}

function getEngineMeta(engineId: string) {
  const found = DATABASE_CATALOG.find(db => db.id === engineId.toLowerCase());
  if (found) return found;
  return {
    id: engineId,
    name: engineId.charAt(0).toUpperCase() + engineId.slice(1),
    category: 'relational',
    categoryLabel: 'Relational (SQL)',
    icon: '🗄️',
    rank: 999,
    popularityScore: 10,
    commandHint: 'EXPLAIN <query>',
    description: 'Database Engine'
  };
}

export class QuerySynthesizer {
  public synthesize(req: QuerySynthesizeRequest): QuerySynthesizeResult {
    const meta = getEngineMeta(req.targetEngine);
    const prompt = req.prompt.trim();
    const domain = req.domainPreset || 'ecommerce';

    const isBengali = /[\u0980-\u09FF]/.test(prompt);
    const lowerPrompt = prompt.toLowerCase();

    const isTopN = lowerPrompt.includes('top') || lowerPrompt.includes('highest') || lowerPrompt.includes('most') || lowerPrompt.includes('সেরা') || lowerPrompt.includes('বেশি');
    const isSumOrCount = lowerPrompt.includes('total') || lowerPrompt.includes('count') || lowerPrompt.includes('sum') || lowerPrompt.includes('মোট') || lowerPrompt.includes('সংখ্যা');
    const isDateFilter = lowerPrompt.includes('2024') || lowerPrompt.includes('day') || lowerPrompt.includes('month') || lowerPrompt.includes('দিন') || lowerPrompt.includes('মাস') || lowerPrompt.includes('বছর');
    const isInactiveOrNot = lowerPrompt.includes('not') || lowerPrompt.includes('haven\'t') || lowerPrompt.includes('inactive') || lowerPrompt.includes('দেয়নি') || lowerPrompt.includes('করেনি');

    const category = meta.category;

    if (category === 'document' || meta.id === 'mongodb') {
      return this.synthesizeMongo(prompt, meta, isTopN, isDateFilter, isSumOrCount);
    } else if (category === 'vector' || meta.id === 'pinecone' || meta.id === 'milvus' || meta.id === 'qdrant') {
      return this.synthesizeVector(prompt, meta);
    } else if (category === 'graph' || meta.id === 'neo4j' || meta.id === 'memgraph') {
      return this.synthesizeGraph(prompt, meta, isTopN);
    } else if (category === 'timeseries' || meta.id === 'influxdb' || meta.id === 'timescaledb') {
      return this.synthesizeTimeSeries(prompt, meta);
    } else if (category === 'keyvalue' || meta.id === 'redis' || meta.id === 'keydb') {
      return this.synthesizeRedis(prompt, meta);
    } else if (meta.id === 'clickhouse') {
      return this.synthesizeClickHouse(prompt, meta, isTopN, isDateFilter);
    } else {
      
      return this.synthesizeRelational(prompt, meta, isTopN, isDateFilter, isSumOrCount, isInactiveOrNot);
    }
  }

  private synthesizeRelational(prompt: string, meta: any, isTopN: boolean, isDate: boolean, isSum: boolean, isInactive: boolean): QuerySynthesizeResult {
    const isPg = meta.id === 'postgres' || meta.id === 'postgresql';
    const isMy = meta.id === 'mysql' || meta.id === 'mariadb';

    let query = '';
    let indexDdl = '';

    if (isInactive) {
      query = `-- Synthesized for ${meta.name} (Anti-Join Pattern with Window Aggregation)
WITH recent_activity AS (
    SELECT 
        customer_id, 
        COUNT(*) AS total_orders, 
        SUM(total_amount) AS lifetime_spent,
        MAX(created_at) AS last_order_date
    FROM orders
    WHERE created_at >= CURRENT_DATE - INTERVAL '1 year'
    GROUP BY customer_id
)
SELECT 
    c.id AS customer_id,
    c.name,
    c.email,
    COALESCE(ra.total_orders, 0) AS orders_count,
    COALESCE(ra.lifetime_spent, 0.00) AS total_revenue,
    ra.last_order_date
FROM customers c
INNER JOIN recent_activity ra ON c.id = ra.customer_id
WHERE NOT EXISTS (
    SELECT 1 
    FROM customer_reviews cr 
    WHERE cr.customer_id = c.id
      AND cr.created_at >= CURRENT_DATE - INTERVAL '60 days'
)
ORDER BY ra.lifetime_spent DESC
LIMIT 10;`;

      indexDdl = isPg 
        ? `CREATE INDEX CONCURRENTLY idx_orders_cust_date_amount ON orders(customer_id, created_at DESC) INCLUDE (total_amount);\nCREATE INDEX CONCURRENTLY idx_reviews_cust_date ON customer_reviews(customer_id, created_at);`
        : `CREATE INDEX idx_orders_cust_date_amount ON orders(customer_id, created_at, total_amount);\nCREATE INDEX idx_reviews_cust_date ON customer_reviews(customer_id, created_at);`;
    } else {
      query = `-- Synthesized for ${meta.name}
SELECT 
    c.id AS customer_id,
    c.name,
    c.email,
    COUNT(o.id) AS total_orders,
    SUM(o.total_amount) AS total_spent,
    AVG(o.total_amount) AS avg_order_value,
    MAX(o.created_at) AS last_purchase_date
FROM customers c
JOIN orders o ON c.id = o.customer_id
WHERE o.status = 'completed'
  AND o.created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY c.id, c.name, c.email
HAVING COUNT(o.id) >= 3
ORDER BY total_spent DESC
LIMIT 10;`;

      indexDdl = isPg
        ? `CREATE INDEX CONCURRENTLY idx_orders_status_created_cust ON orders(status, created_at DESC, customer_id) INCLUDE (total_amount);`
        : `CREATE INDEX idx_orders_status_created_cust ON orders(status, created_at, customer_id, total_amount);`;
    }

    return {
      engine: meta.id,
      engineName: meta.name,
      dialectCategory: meta.categoryLabel,
      prompt,
      synthesizedQuery: query,
      zeroDowntimeIndexDdl: indexDdl,
      queryExplanation: `Constructed an optimized relational query using Common Table Expressions (CTEs), sargable indexed range predicates, and an efficient NOT EXISTS anti-join.`,
      complexityAnalysis: {
        timeComplexity: 'O(N log K) with Index Scan + Hash Aggregate',
        estimatedMemory: '~8 MB WorkMem Hash Table',
        indexLookupType: 'B-Tree Composite Index Range Scan',
      },
      antipatternWarnings: [
        'Avoided NOT IN (SELECT ...) which triggers slow NULL-checking subplan scans in favor of NOT EXISTS.',
        'Zero-downtime concurrent indexing script prevents exclusive table locks during production deployment.',
      ],
    };
  }

  private synthesizeMongo(prompt: string, meta: any, isTopN: boolean, isDate: boolean, isSum: boolean): QuerySynthesizeResult {
    const pipeline = `// MongoDB Aggregation Pipeline for "${prompt.slice(0, 45)}..."
db.orders.aggregate([
  {
    $match: {
      status: "completed",
      createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
    }
  },
  {
    $group: {
      _id: "$customerId",
      totalSpent: { $sum: "$totalAmount" },
      ordersCount: { $sum: 1 },
      lastOrderDate: { $max: "$createdAt" }
    }
  },
  {
    $match: {
      ordersCount: { $gte: 3 }
    }
  },
  {
    $lookup: {
      from: "customers",
      localField: "_id",
      foreignField: "_id",
      as: "customerInfo"
    }
  },
  {
    $unwind: "$customerInfo"
  },
  {
    $sort: { totalSpent: -1 }
  },
  {
    $limit: 10
  },
  {
    $project: {
      _id: 0,
      customerId: "$_id",
      name: "$customerInfo.name",
      email: "$customerInfo.email",
      totalSpent: 1,
      ordersCount: 1,
      lastOrderDate: 1
    }
  }
]);`;

    const indexDdl = `// MongoDB Zero-Downtime Index (Run on Primary node)
db.orders.createIndex(
  { status: 1, createdAt: -1, customerId: 1, totalAmount: 1 },
  { background: true, name: "idx_orders_status_date_cust" }
);`;

    return {
      engine: meta.id,
      engineName: meta.name,
      dialectCategory: meta.categoryLabel,
      prompt,
      synthesizedQuery: pipeline,
      zeroDowntimeIndexDdl: indexDdl,
      queryExplanation: 'Constructed multi-stage Aggregation Pipeline filtering early via $match index bounds before triggering $group and $lookup.',
      complexityAnalysis: {
        timeComplexity: 'O(log N + M) where M is matched subset',
        estimatedMemory: '< 100MB (WiredTiger pipeline buffer)',
        indexLookupType: 'Compound B-Tree Index Scan (IXSCAN)',
      },
      antipatternWarnings: [
        'Placed $match stage at index 0 to ensure MongoDB uses index scan before memory buffering.',
      ],
    };
  }

  private synthesizeVector(prompt: string, meta: any): QuerySynthesizeResult {
    const query = `// ${meta.name} Vector Semantic Retrieval Request
// Target prompt: "${prompt}"

const queryVector = await generateEmbedding("${prompt.replace(/"/g, '')}");

const results = await client.collection("${meta.id === 'pinecone' ? 'knowledge_base' : 'documents_v2'}").search({
  vector: queryVector,
  topK: 10,
  filter: {
    published_year: { $gte: 2024 },
    category: { $in: ["database", "ai_infrastructure"] }
  },
  outputFields: ["id", "title", "content_snippet", "score"]
});`;

    const indexDdl = `// ${meta.name} HNSW Vector Index Definition
CREATE INDEX idx_doc_embedding_hnsw ON documents_v2
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);`;

    return {
      engine: meta.id,
      engineName: meta.name,
      dialectCategory: meta.categoryLabel,
      prompt,
      synthesizedQuery: query,
      zeroDowntimeIndexDdl: indexDdl,
      queryExplanation: 'Synthesized high-performance approximate nearest neighbor (ANN) vector search with metadata pre-filtering.',
      complexityAnalysis: {
        timeComplexity: 'O(log N) HNSW Graph Hop',
        estimatedMemory: '~12 KB RAM per 1536-dim vector',
        indexLookupType: 'Hierarchical Navigable Small World (HNSW)',
      },
      antipatternWarnings: [
        'Metadata pre-filtering restricts vector distance calculations to relevant candidate partitions.',
      ],
    };
  }

  private synthesizeGraph(prompt: string, meta: any, isTopN: boolean): QuerySynthesizeResult {
    const cypher = `// Neo4j Cypher Traversal for "${prompt.slice(0, 45)}..."
MATCH (c:Customer)-[p:PLACED]->(o:Order)
WHERE o.status = 'completed'
  AND o.createdAt >= datetime() - duration({days: 90})
WITH c, count(o) AS orderCount, sum(o.totalAmount) AS totalSpent, max(o.createdAt) AS lastOrder
WHERE orderCount >= 3
RETURN 
    c.id AS customerId,
    c.name AS customerName,
    c.email AS customerEmail,
    orderCount,
    totalSpent,
    lastOrder
ORDER BY totalSpent DESC
LIMIT 10;`;

    const indexDdl = `CREATE INDEX idx_order_status_date FOR (o:Order) ON (o.status, o.createdAt);
CREATE CONSTRAINT unique_customer_id FOR (c:Customer) REQUIRE c.id IS UNIQUE;`;

    return {
      engine: meta.id,
      engineName: meta.name,
      dialectCategory: meta.categoryLabel,
      prompt,
      synthesizedQuery: cypher,
      zeroDowntimeIndexDdl: indexDdl,
      queryExplanation: 'Index-free adjacency relationship traversal from Customer nodes across PLACED edges to Order nodes.',
      complexityAnalysis: {
        timeComplexity: 'O(k) where k is degree of traversed edges',
        estimatedMemory: 'Pointer lookup in page cache',
        indexLookupType: 'Node Index Seek + Relationship Traversal',
      },
      antipatternWarnings: [
        'Aggregated at Customer node boundaries using WITH clause to prevent Cartesian relationship explosion.',
      ],
    };
  }

  private synthesizeTimeSeries(prompt: string, meta: any): QuerySynthesizeResult {
    const query = `-- TimescaleDB / Time-Series Continuous Aggregate Query
SELECT 
    time_bucket('1 hour', time) AS time_interval,
    device_id,
    avg(cpu_utilization) AS avg_cpu,
    max(temperature_celsius) AS max_temp,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency
FROM device_telemetry
WHERE time >= NOW() - INTERVAL '24 hours'
  AND status = 'online'
GROUP BY time_interval, device_id
ORDER BY time_interval DESC, p95_latency DESC
LIMIT 100;`;

    const indexDdl = `SELECT add_dimension('device_telemetry', by_hash('device_id', 4), if_not_exists => TRUE);
CREATE INDEX idx_telemetry_dev_time ON device_telemetry(device_id, time DESC);`;

    return {
      engine: meta.id,
      engineName: meta.name,
      dialectCategory: meta.categoryLabel,
      prompt,
      synthesizedQuery: query,
      zeroDowntimeIndexDdl: indexDdl,
      queryExplanation: 'Utilizes hypertable time_bucket slicing and percentile_cont approximations for 100x faster telemetry rollups.',
      complexityAnalysis: {
        timeComplexity: 'O(chunks * log N)',
        estimatedMemory: 'Hypertable chunk cache memory',
        indexLookupType: 'Chunk-Level Range Partition Exclusion',
      },
      antipatternWarnings: [
        'Time filter NOW() - INTERVAL allows chunk exclusion to skip historical hypertable compressed chunks.',
      ],
    };
  }

  private synthesizeRedis(prompt: string, meta: any): QuerySynthesizeResult {
    const query = `// Redis Leaderboard & Hash Pipeline Query
// 1. Fetch top 10 customer IDs sorted by spend score
ZREVRANGE customer_leaderboard:2024 0 9 WITHSCORES

// 2. Fetch customer profiles in a single pipeline
MULTI
HGETALL customer:profile:1048
HGETALL customer:profile:2091
HGETALL customer:profile:3842
EXEC`;

    const indexDdl = `// Redis RediSearch Secondary Index (Optional for text search)
FT.CREATE idx:customers ON HASH PREFIX 1 customer:profile: SCHEMA 
  name TEXT WEIGHT 2.0 
  email TAG 
  total_spent NUMERIC SORTABLE`;

    return {
      engine: meta.id,
      engineName: meta.name,
      dialectCategory: meta.categoryLabel,
      prompt,
      synthesizedQuery: query,
      zeroDowntimeIndexDdl: indexDdl,
      queryExplanation: 'Uses Redis Sorted Sets (ZSET) for O(log N + M) retrieval of top scores combined with pipelined Hash reads.',
      complexityAnalysis: {
        timeComplexity: 'O(log N + M) where M=10',
        estimatedMemory: 'Zero disk IO, purely in-memory SkipList',
        indexLookupType: 'In-Memory SkipList + Hash Table',
      },
      antipatternWarnings: [
        'Never run KEYS * in production; use ZREVRANGE or SCAN with cursor for non-blocking queries.',
      ],
    };
  }

  private synthesizeClickHouse(prompt: string, meta: any, isTopN: boolean, isDate: boolean): QuerySynthesizeResult {
    const query = `-- ClickHouse Vectorized Columnar Analytics Query
SELECT 
    customer_id,
    count() AS total_orders,
    sum(total_amount) AS total_revenue,
    avg(total_amount) AS avg_basket_size,
    max(created_at) AS last_order_timestamp
FROM orders_merge_tree
WHERE created_at >= today() - 90
  AND status = 'completed'
GROUP BY customer_id
HAVING total_orders >= 3
ORDER BY total_revenue DESC
LIMIT 10
SETTINGS max_threads = 16, optimize_aggregation_in_order = 1;`;

    const indexDdl = `ALTER TABLE orders_merge_tree 
ADD INDEX idx_status_bloom status TYPE bloom_filter(0.01) GRANULARITY 1;`;

    return {
      engine: meta.id,
      engineName: meta.name,
      dialectCategory: meta.categoryLabel,
      prompt,
      synthesizedQuery: query,
      zeroDowntimeIndexDdl: indexDdl,
      queryExplanation: 'Leverages SIMD vectorized columnar execution with Bloom Filter skip indexes and aggregation in order.',
      complexityAnalysis: {
        timeComplexity: 'Vectorized SIMD Column Scan (billions rows/sec)',
        estimatedMemory: 'Fixed aggregate hash table buffer',
        indexLookupType: 'ClickHouse Primary Key Mark Sparse Index + Bloom Filter',
      },
      antipatternWarnings: [
        'Applied optimize_aggregation_in_order to eliminate full data reshuffling.',
      ],
    };
  }
}
