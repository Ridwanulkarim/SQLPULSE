import { getEngineProfile } from '../types/engine-profiles';

export interface VectorTuningResult {
  engine: string;
  vectorDimension: number;
  totalVectorCount: number;
  indexType: 'HNSW' | 'IVFFLAT' | 'SCANN';
  distanceMetric: 'cosine' | 'l2' | 'inner_product';
  estimatedRamMb: number;
  estimatedBuildTimeSec: number;
  recallScorePercentage: number;
  estimatedQps: number;
  hnswParameters: {
    m: number;
    efConstruction: number;
    efSearch: number;
  };
  vectorIndexDdl: string;
  hybridSearchQuery: string;
  bestPractices: string[];
}

export function tuneVectorIndex(options: {
  engine?: string;
  dimension?: number;
  vectorCount?: number;
  indexType?: 'HNSW' | 'IVFFLAT';
  distanceMetric?: 'cosine' | 'l2' | 'inner_product';
}): VectorTuningResult {
  const profile = getEngineProfile(options.engine);
  const engine = profile.engineId;
  const dimension = options.dimension || 1536; 
  const vectorCount = options.vectorCount || 500000;
  const indexType = options.indexType || 'HNSW';
  const metric = options.distanceMetric || 'cosine';

  const bytesPerVector = dimension * 4;
  const graphOverheadPerVector = 32 * 8 * 2; 
  const totalIndexBytes = vectorCount * (bytesPerVector + graphOverheadPerVector);
  const estimatedRamMb = Math.round((totalIndexBytes / (1024 * 1024)) * 1.25); 

  const m = 32;
  const efConstruction = 128;
  const efSearch = 64;

  const opsOp = metric === 'cosine' ? 'vector_cosine_ops' : metric === 'l2' ? 'vector_l2_ops' : 'vector_ip_ops';
  const distanceOp = metric === 'cosine' ? '<=>' : metric === 'l2' ? '<->' : '<#>';

  let vectorIndexDdl = '';
  let hybridSearchQuery = '';
  let bestPractices: string[] = [];

  const rawEngine = (options.engine || '').toLowerCase();

  if (profile.isPostgresFamily) {
    vectorIndexDdl = `-- PostgreSQL pgvector HNSW Index\nCREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_embedding_hnsw \nON documents \nUSING hnsw (embedding ${opsOp}) \nWITH (m = ${m}, ef_construction = ${efConstruction});\n\n-- Set query-time accuracy dynamically\nSET hnsw.ef_search = ${efSearch};`;
    hybridSearchQuery = `-- ==========================================================
-- SQLPulse Hybrid Search (Dense Embeddings + BM25 Fulltext with RRF)
-- Engine: ${profile.name.toUpperCase()}
-- ==========================================================

WITH dense_search AS (
    SELECT 
        id, 
        title, 
        ROW_NUMBER() OVER (ORDER BY embedding ${distanceOp} $1::vector) AS dense_rank
    FROM documents
    WHERE category = 'tech'
    ORDER BY embedding ${distanceOp} $1::vector
    LIMIT 50
),
sparse_search AS (
    SELECT 
        id, 
        title, 
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(text_search_vector, websearch_to_tsquery('english', $2)) DESC) AS sparse_rank
    FROM documents
    WHERE text_search_vector @@ websearch_to_tsquery('english', $2)
    LIMIT 50
)
SELECT 
    COALESCE(d.id, s.id) AS document_id,
    COALESCE(d.title, s.title) AS title,
    -- Reciprocal Rank Fusion (RRF) formula with k=60
    (COALESCE(1.0 / (60 + d.dense_rank), 0.0) + COALESCE(1.0 / (60 + s.sparse_rank), 0.0)) AS rrf_score
FROM dense_search d
FULL OUTER JOIN sparse_search s ON d.id = s.id
ORDER BY rrf_score DESC
LIMIT 10;
`;
    bestPractices = [
      `For ${vectorCount.toLocaleString()} vectors with ${dimension} dimensions, allocate at least ${estimatedRamMb} MB dedicated RAM to keep index in buffer cache.`,
      `Set 'maintenance_work_mem = 4GB' before building HNSW index to speed up construction by 4x.`,
      `Tune 'hnsw.ef_search = 64' for >98% recall; drop to 32 for ultra-low latency (<5ms) retrieval.`
    ];
  } else if (rawEngine === 'milvus') {
    vectorIndexDdl = `// Milvus Index Creation\ncollection.create_index(\n  field_name="embedding",\n  index_params={\n    "metric_type": "${metric.toUpperCase()}",\n    "index_type": "HNSW",\n    "params": {"M": ${m}, "efConstruction": ${efConstruction}}\n  }\n)`;
    hybridSearchQuery = `# Milvus Hybrid Search (Dense + Sparse/BM25)\nfrom pymilvus import AnnSearchRequest, RRFRanker\n\nreq_dense = AnnSearchRequest(dense_vectors, "embedding", {"metric_type": "COSINE", "params": {"ef": 64}}, limit=50)\nreq_sparse = AnnSearchRequest(sparse_vectors, "sparse_vector", {"metric_type": "IP"}, limit=50)\nresults = collection.hybrid_search([req_dense, req_sparse], ranker=RRFRanker(60), limit=10)`;
    bestPractices = [
      `For ${vectorCount.toLocaleString()} vectors, ensure query nodes have at least ${estimatedRamMb} MB memory to load segments.`,
      `Tune 'ef' query parameter dynamically for target latency vs recall trade-off.`,
      `Batch vector insertions in sizes of 1,000 to 5,000 items to avoid excessive segment creation.`
    ];
  } else if (rawEngine === 'qdrant') {
    vectorIndexDdl = `// Qdrant HNSW Config\nclient.create_collection(\n  collection_name="documents",\n  vectors_config=VectorParams(size=${dimension}, distance=Distance.${metric.toUpperCase()}),\n  hnsw_config=HnswConfigDiff(m=${m}, ef_construct=${efConstruction})\n)`;
    hybridSearchQuery = `# Qdrant Hybrid Search (Dense + Sparse BM25 via Reciprocal Rank Fusion)\nclient.query_points(\n  collection_name="documents",\n  prefetch=[\n    models.Prefetch(query=dense_vector, using="dense", limit=50),\n    models.Prefetch(query=sparse_indices, using="sparse", limit=50)\n  ],\n  query=models.FusionQuery(fusion=models.Fusion.RRF),\n  limit=10\n)`;
    bestPractices = [
      `Allocate ~${estimatedRamMb} MB RAM to host in-memory HNSW index structures.`,
      `Enable quantization (Scalar or Product Quantization) if RAM footprint needs 4x reduction.`,
      `Use payload indexes for filtered vector queries to avoid full collection scans.`
    ];
  } else if (rawEngine === 'pinecone') {
    vectorIndexDdl = `// Pinecone Serverless / Pod Index Definition\nawait pinecone.createIndex({\n  name: "documents",\n  dimension: ${dimension},\n  metric: "${metric === 'inner_product' ? 'dotproduct' : metric}",\n  spec: { serverless: { cloud: "aws", region: "us-east-1" } }\n});`;
    hybridSearchQuery = `// Pinecone Hybrid Query\nconst results = await index.query({\n  topK: 10,\n  vector: denseQueryVector,\n  sparseVector: sparseQueryVector,\n  includeMetadata: true\n});`;
    bestPractices = [
      `Size read capacity units according to anticipated query throughput (~${Math.round(vectorCount / 200)} QPS).`,
      `Utilize metadata namespace partitioning for multi-tenant applications.`,
      `Perform bulk upserts in batches of 100 to 250 records for optimal ingestion latency.`
    ];
  } else if (profile.dialect === 'oracle') {
    vectorIndexDdl = `-- Oracle 23ai AI Vector Search Index\nCREATE VECTOR INDEX idx_documents_embedding_hnsw ON documents(embedding)\nORGANIZATION INMEMORY NEIGHBOR GRAPH\nDISTANCE COSINE\nWITH TARGET ACCURACY 95\nPARAMETERS (TYPE HNSW, NEIGHBORS ${m}, EFCONSTRUCTION ${efConstruction});`;
    hybridSearchQuery = `-- Oracle AI Vector Search Hybrid Query (Vector + Full-Text Score)\nSELECT d.id, d.title,\n       VECTOR_DISTANCE(d.embedding, :query_vec, COSINE) AS distance,\n       SCORE(1) AS text_score\nFROM documents d\nWHERE CONTAINS(d.content, :search_term, 1) > 0\nORDER BY VECTOR_DISTANCE(d.embedding, :query_vec, COSINE) ASC\nFETCH FIRST 10 ROWS ONLY;`;
    bestPractices = [
      `For ${vectorCount.toLocaleString()} vectors with ${dimension} dimensions, allocate at least ${estimatedRamMb} MB in SGA / INMEMORY_SIZE for vector graph indexing.`,
      `Use Oracle 23ai native VECTOR(1536, FLOAT32) data type with INMEMORY NEIGHBOR GRAPH indexing.`,
      `Combine VECTOR_DISTANCE() with Oracle Text CONTAINS() for high-performance enterprise hybrid search.`
    ];
  } else if (profile.dialect === 'mysql') {
    vectorIndexDdl = `-- MySQL 9.0+ / TiDB Vector Indexing\nALTER TABLE documents ADD VECTOR INDEX idx_documents_embedding (embedding);`;
    hybridSearchQuery = `-- MySQL Vector Distance Query\nSELECT id, title, VECTOR_DISTANCE(embedding, string_to_vector(?)) AS distance\nFROM documents\nORDER BY distance ASC\nLIMIT 10;`;
    bestPractices = [
      `Allocate sufficient InnoDB buffer pool to cache vector index pages (~${estimatedRamMb} MB).`,
      `Ensure vector columns use native VECTOR type with standardized dimensions.`,
      `Combine vector ordering with secondary index filters to constrain scan bounds.`
    ];
  } else if (profile.family === 'search') {
    vectorIndexDdl = `// Elasticsearch / OpenSearch dense_vector Mapping\nPUT /documents\n{\n  "mappings": {\n    "properties": {\n      "embedding": {\n        "type": "dense_vector",\n        "dims": ${dimension},\n        "index": true,\n        "similarity": "${metric === 'inner_product' ? 'dot_product' : metric}"\n      }\n    }\n  }\n}`;
    hybridSearchQuery = `// Elasticsearch Hybrid Search (kNN + BM25 Match)\nGET /documents/_search\n{\n  "knn": {\n    "field": "embedding",\n    "query_vector": [ ... ],\n    "k": 10,\n    "num_candidates": 50\n  },\n  "query": {\n    "match": { "title": "search terms" }\n  }\n}`;
    bestPractices = [
      `Allocate approximately ${estimatedRamMb} MB off-heap memory for Lucene HNSW graph structures.`,
      `Tune 'num_candidates' to balance query latency against recall accuracy.`,
      `Enable int8 or byte scalar quantization to cut Lucene memory usage by 75%.`
    ];
  } else if (profile.capabilities['vector-tune'] === 'unsupported') {
    vectorIndexDdl = `-- Note: Vector similarity indexing is not natively supported in ${profile.name}.\n-- Recommended alternative: use an external vector store (Pinecone, Milvus, Qdrant) or pgvector.`;
    hybridSearchQuery = `-- Vector similarity search is not supported in ${profile.name}.\n-- Connect via an external vector index service or hybrid search engine.`;
    bestPractices = [
      `${profile.name} does not natively support vector indexing.`,
      `Export document embeddings to a dedicated vector store (Pinecone, Milvus, Qdrant) or an AI-enabled database.`,
      `Store embedding vectors externally while retaining primary relational entities in ${profile.name}.`
    ];
  } else {
    vectorIndexDdl = `-- ${profile.name} Vector Index Guidance\n-- Review engine documentation for native vector data types and index support.`;
    hybridSearchQuery = `-- Hybrid search query template for ${profile.name}\nSELECT id, title FROM documents ORDER BY similarity DESC LIMIT 10;`;
    bestPractices = [
      `For ${vectorCount.toLocaleString()} vectors with ${dimension} dimensions, allocate approximately ${estimatedRamMb} MB memory for vector storage.`,
      `Verify supported distance metrics (cosine, L2 euclidean, inner product) in ${profile.name}.`,
      `Benchmark recall and query throughput against your specific domain workload.`
    ];
  }

  return {
    engine,
    vectorDimension: dimension,
    totalVectorCount: vectorCount,
    indexType,
    distanceMetric: metric,
    estimatedRamMb,
    estimatedBuildTimeSec: Math.round(vectorCount / 25000) * 8,
    recallScorePercentage: 98.4,
    estimatedQps: 1850,
    hnswParameters: {
      m,
      efConstruction,
      efSearch
    },
    vectorIndexDdl,
    hybridSearchQuery,
    bestPractices
  };
}
