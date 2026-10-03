export const SAMPLES_BY_ENGINE: Record<string, { slow: any; optimized: any; migration?: string }> = {
  
  postgres: {
    slow: [
      {
        Plan: {
          'Node Type': 'Sort',
          'Startup Cost': 48325.2,
          'Total Cost': 50825.2,
          'Plan Rows': 100000,
          'Plan Width': 214,
          'Actual Startup Time': 342.15,
          'Actual Total Time': 415.82,
          'Actual Rows': 94500,
          'Actual Loops': 1,
          'Sort Key': ['orders.created_at DESC'],
          'Sort Method': 'external merge',
          'Sort Space Used': 24576,
          'Sort Space Type': 'Disk',
          'Shared Hit Blocks': 120,
          'Shared Read Blocks': 8540,
          Plans: [
            {
              'Node Type': 'Seq Scan',
              'Relation Name': 'orders',
              'Alias': 'orders',
              'Startup Cost': 0.0,
              'Total Cost': 24500.0,
              'Plan Rows': 150000,
              'Plan Width': 128,
              'Actual Rows': 94500,
              'Filter': "(status = 'completed' AND total_amount > 150)",
              'Rows Removed by Filter': 55500,
              'Shared Hit Blocks': 40,
              'Shared Read Blocks': 5100,
            },
          ],
        },
        'Execution Time': 430.15,
      },
    ],
    optimized: [
      {
        Plan: {
          'Node Type': 'Index Scan',
          'Relation Name': 'orders',
          'Index Name': 'idx_orders_status_amount_created',
          'Startup Cost': 0.42,
          'Total Cost': 84.5,
          'Plan Rows': 120,
          'Actual Rows': 120,
          'Index Cond': "(status = 'completed' AND total_amount > 150)",
          'Shared Hit Blocks': 45,
          'Shared Read Blocks': 0,
        },
        'Execution Time': 1.45,
      },
    ],
    migration: `-- PostgreSQL Unsafe Migration
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
ALTER TABLE users ADD COLUMN is_verified BOOLEAN NOT NULL;`,
  },

  mysql: {
    slow: {
      query_block: {
        select_id: 1,
        cost_info: { query_cost: '24500.00' },
        ordering_operation: {
          using_filesort: true,
          table: {
            table_name: 'orders',
            access_type: 'ALL',
            rows_examined_per_scan: 150000,
            rows_produced_per_join: 94500,
            filtered: '63.00',
            cost_info: { query_cost: '24500.00' },
            attached_condition: "((orders.status = 'completed') and (orders.total_amount > 150.00))",
          },
        },
      },
    },
    optimized: {
      query_block: {
        select_id: 1,
        cost_info: { query_cost: '45.00' },
        table: {
          table_name: 'orders',
          access_type: 'ref',
          possible_keys: ['idx_orders_status_amount'],
          key: 'idx_orders_status_amount',
          rows_examined_per_scan: 120,
          rows_produced_per_join: 120,
        },
      },
    },
    migration: `-- MySQL Unsafe Migration
CREATE INDEX idx_orders_customer ON orders(customer_id);
ALTER TABLE users MODIFY COLUMN bio LONGTEXT;`,
  },

  sqlite: {
    slow: [
      { id: 2, parent: 0, detail: 'SCAN TABLE orders' },
      { id: 3, parent: 0, detail: 'USE TEMP B-TREE FOR ORDER BY' },
    ],
    optimized: [
      { id: 2, parent: 0, detail: 'SEARCH TABLE orders USING INDEX idx_orders_status' },
    ],
    migration: `CREATE INDEX idx_orders_customer_id ON orders(customer_id);`,
  },

  oracle: {
    slow: [
      {
        Plan: {
          'Node Type': 'TABLE ACCESS FULL',
          'Relation Name': 'CUSTOMER_ORDERS',
          'Total Cost': 18500,
          'Plan Rows': 500000,
          'Actual Rows': 480000,
          'Filter': "STATUS = 'ACTIVE'",
          'Actual Total Time': 310.5,
          'Shared Hit Blocks': 200,
          'Shared Read Blocks': 12000,
        },
        'Execution Time': 325.2,
      },
    ],
    optimized: [
      {
        Plan: {
          'Node Type': 'INDEX RANGE SCAN',
          'Relation Name': 'CUSTOMER_ORDERS',
          'Index Name': 'IDX_CUST_STATUS',
          'Total Cost': 25,
          'Plan Rows': 50,
          'Actual Rows': 50,
          'Index Cond': "STATUS = 'ACTIVE'",
          'Actual Total Time': 0.85,
          'Shared Hit Blocks': 35,
          'Shared Read Blocks': 0,
        },
        'Execution Time': 1.1,
      },
    ],
  },

  mssql: {
    slow: [
      {
        Plan: {
          'Node Type': 'Clustered Index Scan',
          'Relation Name': 'SalesOrderHeader',
          'Total Cost': 14200,
          'Plan Rows': 250000,
          'Actual Rows': 180000,
          'Filter': '[Status] = 5',
          'Actual Total Time': 280.0,
          'Shared Hit Blocks': 400,
          'Shared Read Blocks': 9800,
        },
        'Execution Time': 295.4,
      },
    ],
    optimized: [
      {
        Plan: {
          'Node Type': 'Index Seek',
          'Relation Name': 'SalesOrderHeader',
          'Index Name': 'IX_SalesOrderHeader_Status',
          'Total Cost': 15,
          'Plan Rows': 40,
          'Actual Rows': 40,
          'Actual Total Time': 0.6,
          'Shared Hit Blocks': 25,
          'Shared Read Blocks': 0,
        },
        'Execution Time': 0.9,
      },
    ],
  },

  db2: {
    slow: [
      {
        Plan: {
          'Node Type': 'TBSCAN',
          'Relation Name': 'CUSTOMER_TRANS',
          'Total Cost': 22400,
          'Plan Rows': 300000,
          'Actual Rows': 280000,
          'Filter': "TRANS_STATUS = 'POSTED'",
          'Actual Total Time': 380.0,
          'Shared Hit Blocks': 300,
          'Shared Read Blocks': 14000,
        },
        'Execution Time': 395.0,
      },
    ],
    optimized: [
      {
        Plan: {
          'Node Type': 'IXSCAN',
          'Relation Name': 'CUSTOMER_TRANS',
          'Index Name': 'IDX_TRANS_STATUS',
          'Total Cost': 30,
          'Plan Rows': 80,
          'Actual Rows': 80,
          'Actual Total Time': 1.1,
          'Shared Hit Blocks': 40,
          'Shared Read Blocks': 0,
        },
        'Execution Time': 1.4,
      },
    ],
  },

  amazon_rds: {
    slow: [
      {
        Plan: {
          'Node Type': 'Seq Scan',
          'Relation Name': 'rds_orders_archive',
          'Total Cost': 31000,
          'Plan Rows': 400000,
          'Actual Rows': 390000,
          'Filter': "created_at < NOW() - INTERVAL '30 days'",
          'Actual Total Time': 410.0,
          'Shared Hit Blocks': 100,
          'Shared Read Blocks': 18000,
        },
        'Execution Time': 425.0,
      },
    ],
    optimized: [
      {
        Plan: {
          'Node Type': 'Index Scan',
          'Relation Name': 'rds_orders_archive',
          'Index Name': 'idx_rds_orders_created',
          'Total Cost': 50,
          'Plan Rows': 200,
          'Actual Rows': 200,
          'Actual Total Time': 1.8,
          'Shared Hit Blocks': 80,
          'Shared Read Blocks': 0,
        },
        'Execution Time': 2.1,
      },
    ],
  },

  mongodb: {
    slow: {
      executionStats: {
        executionSuccess: true,
        nReturned: 120,
        executionTimeMillis: 340,
        totalKeysExamined: 0,
        totalDocsExamined: 150000,
        executionStages: {
          stage: 'COLLSCAN',
          nReturned: 120,
          executionTimeMillisEstimate: 330,
          docsExamined: 150000,
          filter: { status: { $eq: 'completed' } },
        },
      },
    },
    optimized: {
      executionStats: {
        executionSuccess: true,
        nReturned: 120,
        executionTimeMillis: 2,
        totalKeysExamined: 120,
        totalDocsExamined: 120,
        executionStages: {
          stage: 'IXSCAN',
          nReturned: 120,
          indexName: 'status_1_createdAt_-1',
        },
      },
    },
    migration: `db.orders.createIndex({ customerId: 1 });`,
  },

  documentdb: {
    slow: {
      executionStats: {
        executionSuccess: true,
        nReturned: 80,
        executionTimeMillis: 310,
        totalKeysExamined: 0,
        totalDocsExamined: 120000,
        executionStages: {
          stage: 'COLLSCAN',
          nReturned: 80,
          docsExamined: 120000,
          filter: { accountTier: 'enterprise' },
        },
      },
    },
    optimized: {
      executionStats: {
        executionSuccess: true,
        nReturned: 80,
        executionTimeMillis: 3,
        totalKeysExamined: 80,
        totalDocsExamined: 80,
        executionStages: {
          stage: 'IXSCAN',
          nReturned: 80,
          indexName: 'accountTier_1',
        },
      },
    },
  },

  weaviate: {
    slow: {
      took: 320,
      timed_out: false,
      hits: { total: 100, hits: [{ _score: 0.72 }] },
      deep_pagination: true,
      query_type: 'BruteForceVectorScan',
      dimensions: 1536,
      distance: 'cosine',
      warning: 'No HNSW index build completed. Falling back to full flat scan over 500k vectors.',
    },
    optimized: {
      took: 4,
      timed_out: false,
      hits: { total: 10, hits: [{ _score: 0.96 }] },
      index_type: 'HNSW',
      efSearch: 64,
      maxConnections: 16,
      distance: 'cosine',
      vector: 'NearVector semantic query (hybrid bm25 + hnsw)',
    },
  },

  milvus: {
    slow: {
      took: 280,
      timed_out: false,
      hits: { total: 100, hits: [{ _score: 0.69 }] },
      deep_pagination: true,
      index_type: 'FLAT',
      warning: 'Milvus collection using FLAT index without quantization. High memory and CPU scan.',
    },
    optimized: {
      took: 3,
      timed_out: false,
      hits: { total: 10, hits: [{ _score: 0.94 }] },
      index_type: 'IVF_SQ8_HNSW',
      nprobe: 16,
      topK: 10,
    },
  },

  pinecone: {
    slow: {
      took: 195,
      timed_out: false,
      hits: { total: 100, hits: [{ _score: 0.78 }] },
      deep_pagination: true,
      filter_stage: 'post_filter_unindexed_metadata',
      warning: 'Metadata filtering after vector ANN scan caused 90% candidates to be discarded.',
    },
    optimized: {
      took: 6,
      timed_out: false,
      hits: { total: 10, hits: [{ _score: 0.98 }] },
      filter_stage: 'single_stage_metadata_prefilter',
      top_k: 10,
    },
  },

  qdrant: {
    slow: {
      took: 210,
      timed_out: false,
      hits: { total: 100 },
      query_type: 'ExactPayloadScan',
      warning: 'Unindexed JSON payload filter evaluated sequentially across 250,000 vector points.',
    },
    optimized: {
      took: 3.5,
      timed_out: false,
      hits: { total: 10 },
      index_type: 'HNSW_Payload_Indexed',
      hnsw_ef: 128,
    },
  },

  neo4j: {
    slow: `Cypher Execution Plan:
Planner: COST
Runtime: PIPELINED
+-------------------+----------------+----------------+
| Operator          | Details        | Estimated Rows |
+-------------------+----------------+----------------+
| +ProduceResults   | user.name      | 150000         |
| +AllNodesScan     | u:User         | 150000         |
| +CartesianProduct | (u),(o:Order)  | 22500000       |
+-------------------+----------------+----------------+
DbHits: 1500000, Execution Time: 380ms`,
    optimized: `Cypher Execution Plan:
Planner: COST
Runtime: PIPELINED
+-------------------+--------------------+----------------+
| Operator          | Details            | Estimated Rows |
+-------------------+--------------------+----------------+
| +ProduceResults   | user.name          | 5              |
| +NodeIndexSeek    | u:User(email)      | 1              |
| +Expand(All)      | (u)-[:PLACED]->(o) | 5              |
+-------------------+--------------------+----------------+
DbHits: 6, Execution Time: 1.8ms`,
  },

  memgraph: {
    slow: `Memgraph Query Profile:
Plan:
  - AllNodesScan (Label: Member) -> 200,000 nodes scanned
  - Filter (isActive == true) -> 180,000 removed
  - CartesianProduct (Member x Group) -> O(N*M) explosive traversal
Elapsed Time: 290ms`,
    optimized: `Memgraph Query Profile:
Plan:
  - NodeIndexSeek (Index: :Member(uuid)) -> 1 hit
  - ExpandByEdgeType (:MEMBER_OF) -> 3 groups
Elapsed Time: 0.9ms`,
  },

  dgraph: {
    slow: `Dgraph Query Profile:
query {
  users(func: type(User)) @explain {
    name
    email
    orders @filter(eq(status, "pending")) {
      id
      amount
    }
  }
}
Warning: Type-based root function without indexed predicate filter. Scanned 450,000 UIDs.`,
    optimized: `Dgraph Query Profile:
query {
  users(func: eq(email, "user@example.com")) @explain {
    name
    orders @filter(eq(status, "pending")) {
      id
      amount
    }
  }
}
Indexed predicate seek on 'email' and 'status'. Scanned 1 root UID. Execution: 1.2ms`,
  },

  arangodb: {
    slow: `ArangoDB Execution Plan:
Execution Profile:
  - EnumerateCollectionNode (users) -> 180,000 items
  - IndexNode (orders) -> Full Scan
  - TraversalNode (graph: social_graph, direction: OUTBOUND)
Warning: Missing edge index on graph relation. Total Time: 340ms`,
    optimized: `ArangoDB Execution Plan:
Execution Profile:
  - IndexNode (users by primary email) -> 1 item
  - ShortestPathNode (graph: social_graph, direction: OUTBOUND)
Optimal vertex and edge cache hit. Total Time: 2.1ms`,
  },

  elasticsearch: {
    slow: {
      took: 450,
      timed_out: false,
      hits: { total: 10000, hits: [{ _score: 1.0 }] },
      from: 15000,
      size: 50,
      deep_pagination: true,
    },
    optimized: {
      took: 5,
      timed_out: false,
      hits: { total: 50, hits: [{ _score: 2.85 }] },
      search_after: [1696238120, 'doc_9912'],
      point_in_time: { id: 'pit_123', keep_alive: '1m' },
    },
  },

  algolia: {
    slow: {
      processingTimeMS: 145,
      nbHits: 25000,
      warning: 'Unrestricted searchableAttributes scanning full HTML text content across 50,000 records without custom ranking.',
    },
    optimized: {
      processingTimeMS: 2.4,
      nbHits: 12,
      ranking: 'Typo -> Geo -> Exactness -> Proximity -> CustomScore',
      hitsPerPage: 10,
    },
  },

  meilisearch: {
    slow: {
      processingTimeMs: 180,
      estimatedTotalHits: 40000,
      warning: 'Deep offset pagination without filtered attributes index.',
    },
    optimized: {
      processingTimeMs: 1.8,
      estimatedTotalHits: 25,
      filter: 'category = "electronics"',
      limit: 20,
    },
  },

  solr: {
    slow: {
      QTime: 390,
      status: 0,
      response: { numFound: 500000, start: 20000 },
      warning: 'High offset deep pagination on uncommitted searcher.',
    },
    optimized: {
      QTime: 3.2,
      status: 0,
      cursorMark: 'AoE/AoE1ODQ3Nw==',
      response: { numFound: 50, start: 0 },
    },
  },

  influxdb: {
    slow: `Flux Execution Plan:
from(bucket: "iot_telemetry")
  |> range(start: -30d)
  |> filter(fn: (r) => r._measurement == "cpu_metrics")
  |> filter(fn: (r) => r.host == "server-01")
Warning: Pushdown disabled for non-tag predicate. Scanned 12,000,000 raw time-series data points. Total Time: 680ms`,
    optimized: `Flux Execution Plan:
from(bucket: "iot_telemetry")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "cpu_metrics" and r.tag_host == "server-01")
  |> aggregateWindow(every: 1m, fn: mean)
Pushdown active on storage engine TSI index. Scanned 60 points. Total Time: 3.1ms`,
  },

  dolphindb: {
    slow: `DolphinDB Timer Output:
Time elapsed: 480.2 ms
Warning: Unpartitioned full-table scan on 50,000,000 tick quotes without TSDB engine partitioning.`,
    optimized: `DolphinDB Timer Output:
Time elapsed: 1.4 ms
Vectorized OLAP execution on Partition (Date=2026.10.02, Symbol="AAPL"). Sub-millisecond aggregation.`,
  },

  timescaledb: {
    slow: [
      {
        Plan: {
          'Node Type': 'Append',
          'Relation Name': '_hyper_1_chunk',
          'Total Cost': 45000,
          'Plan Rows': 1000000,
          'Actual Rows': 980000,
          'Filter': "time > NOW() - INTERVAL '90 days'",
          'Actual Total Time': 520.0,
        },
        'Execution Time': 540.0,
      },
    ],
    optimized: [
      {
        Plan: {
          'Node Type': 'Custom Scan (ChunkAppend)',
          'Relation Name': 'cagg_hourly_metrics',
          'Total Cost': 45,
          'Plan Rows': 120,
          'Actual Rows': 120,
          'Actual Total Time': 2.1,
        },
        'Execution Time': 2.4,
      },
    ],
  },

  prometheus: {
    slow: `PromQL Query Analysis:
Expression: {job="kubernetes-nodes"} / count({job="kubernetes-nodes"})
Warning: High cardinality metric evaluation across 45,000 ephemeral pods over 14d lookback. High memory overhead.`,
    optimized: `PromQL Query Analysis:
Expression: sum(rate(node_cpu_seconds_total{mode!="idle"}[5m])) by (instance)
Optimal subquery evaluation with recording rules. Total execution time: 4.2ms`,
  },

  redis: {
    slow: `SLOWLOG GET 10
1) 1) (integer) 104
   2) (integer) 1696238120
   3) (integer) 68500
   4) 1) "KEYS"
      2) "session:user:*"
   5) "127.0.0.1:52134"
   6) ""`,
    optimized: `COMMAND: SCAN 0 MATCH session:user:* COUNT 100
1) "17"
2) 1) "session:user:8831"
   2) "session:user:9920"
Execution Time: 0.12ms (Non-blocking bucket iteration)`,
  },

  cassandra: {
    slow: `Tracing session 9e24fa10:
Activity: Executing single-partition query
Warning: Query 'SELECT * FROM user_events WHERE event_type = 'click' ALLOW FILTERING' scanned all partitions across 16 cluster nodes.
Total Latency: 420ms`,
    optimized: `Tracing session 3d12bc80:
Activity: Executing partition-directed query
Partition Key: (user_id = 94812)
Clustering Key range: (event_timestamp >= '2026-10-01')
Direct partition hit on Coordinator Node 10.0.1.4. Latency: 1.8ms`,
  },

  scylladb: {
    slow: `ScyllaDB Trace:
Executing cross-shard scatter-gather scan with ALLOW FILTERING on table 'sensor_readings'.
Warning: High inter-shard IPC latency due to missing Partition Key in WHERE clause. Latency: 210ms`,
    optimized: `ScyllaDB Trace:
Direct shard-pinned execution on Shard #3 (CPU Core #3). Partition Key matched hash ring. Latency: 0.65ms`,
  },

  datastax: {
    slow: `Astra DB Vector/CQL Trace:
Warning: ANN vector query combined with ALLOW FILTERING without vector index completion on 'products' table. Latency: 310ms`,
    optimized: `Astra DB Vector/CQL Trace:
Direct HNSW Vector index seek with Astra Serverless Vector routing. Latency: 2.1ms`,
  },
};

export const SAMPLE_SLOW_PLAN = SAMPLES_BY_ENGINE.postgres.slow;
export const SAMPLE_OPTIMIZED_PLAN = SAMPLES_BY_ENGINE.postgres.optimized;
export const SAMPLE_UNSAFE_MIGRATION = SAMPLES_BY_ENGINE.postgres.migration;
