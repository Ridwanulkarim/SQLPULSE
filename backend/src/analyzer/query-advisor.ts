import { DatabaseEngine, DATABASE_CATALOG } from '../types/plan.types';

export interface QueryAntiPatternFinding {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  antiPatternType: string;
  title: string;
  description: string;
  detectedCodeSnippet: string;
  recommendation: string;
}

export interface QueryAdvisorResult {
  engine: DatabaseEngine;
  engineName?: string;
  originalQuery: string;
  rewrittenQuery: string;
  performanceScore: number;
  estimatedSpeedup: string;
  findings: QueryAntiPatternFinding[];
  suggestedCompoundIndex?: {
    tableName: string;
    equalityColumns: string[];
    sortColumns: string[];
    rangeColumns: string[];
    indexSql: string;
    rationale: string;
  };
}

export class QueryAdvisor {
  public analyze(query: string, engine: DatabaseEngine = 'postgres'): QueryAdvisorResult {
    const cleanQuery = query.trim();
    const metadata = DATABASE_CATALOG.find((d) => d.id === engine) || DATABASE_CATALOG[0];
    const category = metadata.category || 'relational';
    const findings: QueryAntiPatternFinding[] = [];

    // ================= 1. SQL & OLAP ENGINES =================
    if (category === 'relational' || category === 'olap' || category === 'baas_embedded') {
      // 1. Check SELECT *
      if (/SELECT\s+(\*\s+|[a-zA-Z0-9_]+\.\*\s+)FROM/i.test(cleanQuery)) {
        findings.push({
          id: `anti_select_star_${Math.random().toString(36).substring(2, 7)}`,
          severity: 'WARNING',
          antiPatternType: 'Payload Bloat & Uncovered Index Scan',
          title: `${metadata.name}: SELECT * Projection Anti-Pattern`,
          description:
            'Query requests all columns using wildcard (*). This prevents Covering Index (Index-Only) scans and increases network I/O and cache churn.',
          detectedCodeSnippet: 'SELECT *',
          recommendation: 'Explicitly specify only required columns (e.g., SELECT id, user_id, status, total_amount).',
        });
      }

      // 2. Check Non-sargable functions in WHERE clause
      const nonSargableMatch = cleanQuery.match(/WHERE\s+.*?([a-zA-Z0-9_]+)\s*\(\s*([a-zA-Z0-9_.]+)\s*\)\s*(=|>|<|LIKE|IN)/i);
      if (nonSargableMatch) {
        const funcName = nonSargableMatch[1];
        const colName = nonSargableMatch[2];
        findings.push({
          id: `anti_nonsargable_${Math.random().toString(36).substring(2, 7)}`,
          severity: 'CRITICAL',
          antiPatternType: 'Non-Sargable Predicate',
          title: `${metadata.name}: Index-Killing Function Wrapping: ${funcName}(${colName})`,
          description: `Wrapping column "${colName}" inside function "${funcName}()" prevents B-Tree/Clustered index lookups, forcing a full table scan.`,
          detectedCodeSnippet: `${funcName}(${colName})`,
          recommendation: `Rewrite into an index-sargable range (e.g. replace YEAR(created_at) = 2024 with created_at >= '2024-01-01' AND created_at < '2025-01-01').`,
        });
      }

      // 3. Leading Wildcard in LIKE
      const leadingWildcardMatch = cleanQuery.match(/LIKE\s+['"]%([^'"]+)['"]/i);
      if (leadingWildcardMatch) {
        findings.push({
          id: `anti_leading_wildcard_${Math.random().toString(36).substring(2, 7)}`,
          severity: 'CRITICAL',
          antiPatternType: 'Leading Wildcard Scan',
          title: `${metadata.name}: Non-Indexable Leading Wildcard LIKE '%...'`,
          description: 'A leading wildcard (%keyword) makes prefix index matching impossible, forcing a full scan.',
          detectedCodeSnippet: leadingWildcardMatch[0],
          recommendation: 'Use GIN / Trigram index in Postgres, Full-Text Search in MySQL, or dedicated search engine.',
        });
      }

      // 4. Deep Offset Pagination
      const offsetMatch = cleanQuery.match(/OFFSET\s+(\d+)/i);
      if (offsetMatch && parseInt(offsetMatch[1], 10) >= 1000) {
        findings.push({
          id: `anti_deep_offset_${Math.random().toString(36).substring(2, 7)}`,
          severity: 'WARNING',
          antiPatternType: 'Deep Offset Latency Cliff',
          title: `${metadata.name}: Deep Offset Pagination (OFFSET ${offsetMatch[1]})`,
          description: 'OFFSET forces the database to read, sort, and discard all preceding rows, causing latency cliffs.',
          detectedCodeSnippet: offsetMatch[0],
          recommendation: 'Switch to Keyset / Cursor-based pagination (WHERE (created_at, id) < ($last_created, $last_id)).',
        });
      }

      // 5. Unbounded ORDER BY
      if (/ORDER\s+BY/i.test(cleanQuery) && !/LIMIT/i.test(cleanQuery) && !/FETCH\s+FIRST/i.test(cleanQuery)) {
        findings.push({
          id: `anti_unbounded_sort_${Math.random().toString(36).substring(2, 7)}`,
          severity: 'WARNING',
          antiPatternType: 'Unbounded Memory Sort',
          title: `${metadata.name}: ORDER BY without LIMIT`,
          description: 'Sorting the entire result set without a LIMIT clause causes memory sort spills to disk.',
          detectedCodeSnippet: 'ORDER BY [no LIMIT]',
          recommendation: 'Add a LIMIT clause to enable top-N heap sort in memory.',
        });
      }
    }
    // ================= 2. DOCUMENT / NOSQL (MongoDB, Couchbase) =================
    else if (category === 'document') {
      if (/\$where/i.test(cleanQuery)) {
        findings.push({
          id: `doc_where_js_${Math.random().toString(36).substring(2, 7)}`,
          severity: 'CRITICAL',
          antiPatternType: 'JavaScript Engine Evaluation ($where)',
          title: `${metadata.name}: Unindexed $where Javascript Evaluation`,
          description: 'Using $where executes the V8/SpiderMonkey Javascript engine for every single document, disabling all indexes.',
          detectedCodeSnippet: '$where',
          recommendation: 'Use native query operators ($eq, $gt, $in, $expr) instead of arbitrary JS.',
        });
      }
      if (/\.skip\(\s*\d{4,}\s*\)/i.test(cleanQuery) || /skip:\s*\d{4,}/i.test(cleanQuery)) {
        findings.push({
          id: `doc_skip_${Math.random().toString(36).substring(2, 7)}`,
          severity: 'WARNING',
          antiPatternType: 'Deep Skip Performance Degradation',
          title: `${metadata.name}: Deep Cursor Skip Anti-Pattern`,
          description: 'Using large skip values requires scanning and discarding documents on the server.',
          detectedCodeSnippet: 'skip()',
          recommendation: 'Use range pagination on _id or indexed timestamps ({ _id: { $gt: last_id } }).',
        });
      }
    }
    // ================= 3. KEY-VALUE & IN-MEMORY (Redis, Valkey) =================
    else if (category === 'keyvalue') {
      if (/KEYS\s+/i.test(cleanQuery) || /HGETALL/i.test(cleanQuery)) {
        findings.push({
          id: `kv_keys_blocking_${Math.random().toString(36).substring(2, 7)}`,
          severity: 'CRITICAL',
          antiPatternType: 'Single-Thread Event Loop Blocking',
          title: `${metadata.name}: O(N) Blocking Command Detected`,
          description: 'Executing KEYS or HGETALL on large datasets blocks the single-threaded server, causing cascading client timeouts.',
          detectedCodeSnippet: cleanQuery.split('\n')[0] || 'KEYS *',
          recommendation: 'Replace KEYS with SCAN and HGETALL with HSCAN or pipelined HMGET.',
        });
      }
    }
    // ================= 4. VECTOR AI (Pinecone, Milvus, Qdrant, Chroma) =================
    else if (category === 'vector') {
      if (/exact_search:\s*true|brute_force/i.test(cleanQuery)) {
        findings.push({
          id: `vec_brute_force_${Math.random().toString(36).substring(2, 7)}`,
          severity: 'CRITICAL',
          antiPatternType: 'Unindexed Exact Vector KNN Scan',
          title: `${metadata.name}: Exact Flat Vector Distance Scan`,
          description: 'Performing exact KNN comparisons across all vector embeddings yields O(N*D) compute and millisecond latency spikes.',
          detectedCodeSnippet: 'exact_search',
          recommendation: 'Enable HNSW or IVF-PQ index with efSearch = 64 for sub-millisecond approximate nearest neighbor lookups.',
        });
      }
    }
    // ================= 5. GRAPH DBS (Neo4j, Memgraph, Dgraph) =================
    else if (category === 'graph') {
      if (/\-\[\s*:\s*[a-zA-Z0-9_]*\s*\*\]\->/i.test(cleanQuery) || /MATCH\s+\([a-zA-Z0-9_]+\)\s*,\s*\([a-zA-Z0-9_]+\)/i.test(cleanQuery)) {
        findings.push({
          id: `graph_cartesian_${Math.random().toString(36).substring(2, 7)}`,
          severity: 'CRITICAL',
          antiPatternType: 'Unbounded Graph Traversal / Cartesian Product',
          title: `${metadata.name}: Unbounded Traversal or Cartesian Product`,
          description: 'Unbounded variable-length paths (-[:REL*]->) cause combinatorial graph explosion.',
          detectedCodeSnippet: 'Unbounded path',
          recommendation: 'Specify upper depth bound (e.g. -[:REL*1..3]->) and anchor traversal with indexed start nodes.',
        });
      }
    }
    // ================= 6. WIDE-COLUMN (Cassandra, ScyllaDB) =================
    else if (category === 'wide_column') {
      if (/ALLOW\s+FILTERING/i.test(cleanQuery)) {
        findings.push({
          id: `cql_allow_filtering_${Math.random().toString(36).substring(2, 7)}`,
          severity: 'CRITICAL',
          antiPatternType: 'Cross-Node Cluster Scan (ALLOW FILTERING)',
          title: `${metadata.name}: ALLOW FILTERING Anti-Pattern`,
          description: 'ALLOW FILTERING forces Cassandra/Scylla to scan all nodes and partitions across the entire distributed cluster.',
          detectedCodeSnippet: 'ALLOW FILTERING',
          recommendation: 'Design queries that specify the Partition Key or build a Materialized View.',
        });
      }
    }

    // Extract table and build compound index recommendation
    const tableMatch = cleanQuery.match(/FROM\s+([a-zA-Z0-9_]+)/i);
    const tableName = tableMatch ? tableMatch[1] : 'orders';

    const equalityCols: string[] = [];
    const sortCols: string[] = [];
    const rangeCols: string[] = [];

    const eqMatches = cleanQuery.matchAll(/([a-zA-Z0-9_]+)\s*=\s*('[^']+'|\d+|true|false|\$\d+)/gi);
    for (const m of eqMatches) {
      if (m[1].toLowerCase() !== 'limit' && !equalityCols.includes(m[1].toLowerCase())) {
        equalityCols.push(m[1].toLowerCase());
      }
    }

    const sortMatch = cleanQuery.match(/ORDER\s+BY\s+([a-zA-Z0-9_,\s]+?)(ASC|DESC|LIMIT|;|$)/i);
    if (sortMatch) {
      const parsed = sortMatch[1].split(',').map((s) => s.trim().replace(/\s+(ASC|DESC)$/i, ''));
      for (const col of parsed) {
        if (col && !sortCols.includes(col.toLowerCase())) sortCols.push(col.toLowerCase());
      }
    }

    const rangeMatches = cleanQuery.matchAll(/([a-zA-Z0-9_]+)\s*(>|<|>=|<=|BETWEEN)\s*/gi);
    for (const m of rangeMatches) {
      if (!equalityCols.includes(m[1].toLowerCase()) && !rangeCols.includes(m[1].toLowerCase())) {
        rangeCols.push(m[1].toLowerCase());
      }
    }

    const allIndexCols = [...equalityCols, ...sortCols, ...rangeCols];
    const indexColList = allIndexCols.length > 0 ? allIndexCols.join(', ') : 'status, created_at';
    const indexName = `idx_${tableName}_${allIndexCols[0] || 'perf'}_${allIndexCols[1] || 'opt'}`;

    let indexSql = `CREATE INDEX ${indexName} ON ${tableName} (${indexColList});`;
    if (engine === 'postgres') {
      indexSql = `CREATE INDEX CONCURRENTLY ${indexName} ON ${tableName} (${indexColList});`;
    } else if (engine === 'mysql' || engine === 'mariadb') {
      indexSql = `ALTER TABLE ${tableName} ADD INDEX ${indexName} (${indexColList}) ALGORITHM=INPLACE, LOCK=NONE;`;
    } else if (engine === 'oracle') {
      indexSql = `CREATE INDEX ${indexName} ON ${tableName} (${indexColList}) ONLINE;`;
    } else if (engine === 'mssql' || engine === 'sqlserver') {
      indexSql = `CREATE NONCLUSTERED INDEX ${indexName} ON ${tableName} (${indexColList}) WITH (ONLINE = ON);`;
    } else if (category === 'document') {
      indexSql = `db.${tableName}.createIndex({ ${allIndexCols.map((c) => `"${c}": 1`).join(', ') || '"status": 1'} }, { background: true });`;
    } else if (category === 'vector') {
      indexSql = `CREATE INDEX ON ${tableName} USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 128);`;
    }

    // Build rewritten query
    let rewrittenQuery = cleanQuery;
    if (rewrittenQuery.includes('SELECT *')) {
      rewrittenQuery = rewrittenQuery.replace(/SELECT\s+\*\s+FROM/i, `SELECT id, ${allIndexCols.join(', ') || 'user_id, status, amount'} FROM`);
    }
    if (!rewrittenQuery.toUpperCase().includes('LIMIT') && rewrittenQuery.toUpperCase().includes('ORDER BY') && (category === 'relational' || category === 'olap')) {
      rewrittenQuery += '\nLIMIT 50;';
    }

    let performanceScore = 100;
    for (const f of findings) {
      if (f.severity === 'CRITICAL') performanceScore -= 30;
      else if (f.severity === 'WARNING') performanceScore -= 15;
      else if (f.severity === 'INFO') performanceScore -= 5;
    }
    performanceScore = Math.max(15, Math.min(100, performanceScore));

    return {
      engine,
      engineName: metadata.name,
      originalQuery: cleanQuery,
      rewrittenQuery,
      performanceScore,
      estimatedSpeedup: findings.length > 0 ? `${findings.length * 15 + 10}x - ${findings.length * 40 + 20}x Faster` : 'Already Optimized',
      findings,
      suggestedCompoundIndex: {
        tableName,
        equalityColumns: equalityCols,
        sortColumns: sortCols,
        rangeColumns: rangeCols,
        indexSql,
        rationale: `Applied ESR (Equality ➔ Sort ➔ Range) geometry for ${metadata.name}: Place equalities [${equalityCols.join(', ') || 'none'}] first, sorting columns [${sortCols.join(', ') || 'none'}] second, and range filters [${rangeCols.join(', ') || 'none'}] last.`,
      },
    };
  }
}
