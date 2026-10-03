import React, { useState, useEffect } from 'react';
import { DatabaseEngine, DATABASE_CATALOG } from '../types';
import { UniversalDbSelector } from './UniversalDbSelector';
import { ArrowRightLeft, Layers } from 'lucide-react';
import { DbBrandLogo } from './DbBrandLogo';

interface DbArchitectureProfile {
  capTheorem: string;
  concurrencyModel: string;
  primaryIndexStructure: string;
  secondaryIndexSupport: string;
  replicationConsensus: string;
  storageFormat: string;
  zeroDowntimeDdl: string;
  bestFor: string;
  antiPatterns: string;
}

interface DatabaseComparisonTabProps {
  selectedEngine?: DatabaseEngine | string;
  onSelectEngine?: (engine: DatabaseEngine) => void;
}

export const DatabaseComparisonTab: React.FC<DatabaseComparisonTabProps> = ({
  selectedEngine: propEngine,
  onSelectEngine,
}) => {
  const [db1Id, setDb1Id] = useState<DatabaseEngine>(
    (propEngine as DatabaseEngine) || 'postgres'
  );

  useEffect(() => {
    if (propEngine && propEngine !== db1Id) {
      setDb1Id(propEngine as DatabaseEngine);
    }
  }, [propEngine]);
  const [db2Id, setDb2Id] = useState<DatabaseEngine>('mysql');
  const [db3Id, setDb3Id] = useState<DatabaseEngine>('snowflake');
  const [mobileViewMode, setMobileViewMode] = useState<'table' | 'cards'>('table');

  const db1 = DATABASE_CATALOG.find((d) => d.id === db1Id) || DATABASE_CATALOG[3];
  const db2 = DATABASE_CATALOG.find((d) => d.id === db2Id) || DATABASE_CATALOG[1];
  const db3 = DATABASE_CATALOG.find((d) => d.id === db3Id) || DATABASE_CATALOG[5];

  const getProfile = (engineId: string, category: string): DbArchitectureProfile => {
    if (engineId === 'postgres') {
      return {
        capTheorem: 'CP (Consistent & Partition Tolerant)',
        concurrencyModel: 'MVCC with Snapshot Isolation & SSI (Serializable)',
        primaryIndexStructure: 'Heap storage with B-Tree Primary Key',
        secondaryIndexSupport: 'B-Tree, Hash, GiST, GIN, BRIN, SP-GiST, Bloom, HNSW (pgvector)',
        replicationConsensus: 'Streaming Physical Replication (Sync/Async), Logical Replication',
        storageFormat: 'Row-oriented (Heap pages, 8KB blocks, TOAST for out-of-line blobs)',
        zeroDowntimeDdl: 'CREATE INDEX CONCURRENTLY, ADD CONSTRAINT ... NOT VALID, lock_timeout',
        bestFor: 'Complex OLTP, transactional integrity, geospatial (PostGIS), AI embeddings',
        antiPatterns: 'Unindexed foreign keys, table-locking ALTER TABLE TYPE without expand-contract',
      };
    }
    if (engineId === 'mysql' || engineId === 'mariadb') {
      return {
        capTheorem: 'CA / CP (Configurable Group Replication)',
        concurrencyModel: 'InnoDB MVCC (Undo Logs + Redo Logs)',
        primaryIndexStructure: 'Clustered Index (B+Tree) by Primary Key',
        secondaryIndexSupport: 'Secondary B+Tree pointing to Primary Key, Full-Text, Spatial R-Tree',
        replicationConsensus: 'Binlog Replication (GTID Async/Semisync), Group Replication (Paxos)',
        storageFormat: 'Row-oriented InnoDB tablespaces (16KB pages, Doublewrite Buffer)',
        zeroDowntimeDdl: 'ALGORITHM=INPLACE, LOCK=NONE, ALGORITHM=INSTANT (MySQL 8.0+)',
        bestFor: 'High-throughput web backends, read-heavy OLTP, master-replica scale',
        antiPatterns: 'Non-concurrent table alterations triggering full table copies (COPY algorithm)',
      };
    }
    if (engineId === 'snowflake') {
      return {
        capTheorem: 'CP (Cloud Multi-Cluster Shared Data)',
        concurrencyModel: 'Multi-Version Concurrency with Time Travel & Zero-Copy Cloning',
        primaryIndexStructure: 'Micro-partitions (50MB - 500MB uncompressed columnar chunks)',
        secondaryIndexSupport: 'Search Optimization Service (Pruning Filters), Clustering Keys',
        replicationConsensus: 'Cross-Cloud / Cross-Region Data Replication',
        storageFormat: 'Proprietary Hybrid Columnar Storage (PAX format) in Cloud Object Store',
        zeroDowntimeDdl: 'Instant metadata-only operations for additions; background reclustering',
        bestFor: 'Enterprise Data Warehousing, petabyte-scale SQL analytics, BI dashboards',
        antiPatterns: 'Row-by-row high-frequency single INSERT transactions (< 100ms OLTP)',
      };
    }
    if (engineId === 'clickhouse') {
      return {
        capTheorem: 'AP / Tunable Consistency (Distributed MergeTree)',
        concurrencyModel: 'Vectorized query execution with asynchronous mutations',
        primaryIndexStructure: 'Sparse Primary Index + Sorting Key (MergeTree Engine)',
        secondaryIndexSupport: 'Data Skipping Indexes (MinMax, Set, Bloom Filter, TokenBF)',
        replicationConsensus: 'ClickHouse Keeper / ZooKeeper Raft-based Replication',
        storageFormat: 'Compressed Columnar Storage (.bin columns + .mrk markers with ZSTD/LZ4)',
        zeroDowntimeDdl: 'Instant Column Additions (Default values stored in metadata)',
        bestFor: 'Real-time telemetry, clickstream analytics, sub-second aggregations on billions of rows',
        antiPatterns: 'Frequent single-row UPDATE/DELETE (use ReplacingMergeTree or Partition Swapping)',
      };
    }
    if (category === 'vector') {
      return {
        capTheorem: 'Tunable Consistency / High-Availability AP',
        concurrencyModel: 'Vector Index Graph Traversal with Concurrent Ingest Pipelines',
        primaryIndexStructure: 'HNSW (Hierarchical Navigable Small World) Graph / IVF-PQ',
        secondaryIndexSupport: 'Payload metadata scalar filtering (Hybrid search)',
        replicationConsensus: 'Raft consensus per shard partition / Multi-zone cloud replication',
        storageFormat: 'Compressed dense vector float arrays (FP32, FP16, SQ8, Product Quantization)',
        zeroDowntimeDdl: 'Collection alias atomic re-pointing during index rebuilds',
        bestFor: 'AI/LLM Semantic Search, RAG embeddings, similarity recommendation engines',
        antiPatterns: 'Unquantized brute-force flat KNN scans across millions of embeddings',
      };
    }
    if (category === 'keyvalue') {
      return {
        capTheorem: 'AP (Async Replication) / CP (Raft Cluster)',
        concurrencyModel: 'Single-Threaded Event Loop (Redis) / Multi-Threaded Sharded (Dragonfly)',
        primaryIndexStructure: 'In-Memory Hash Table / Radix Tree / SkipList',
        secondaryIndexSupport: 'Sorted Sets (ZSET), Redis Stack Secondary Indexes (RediSearch)',
        replicationConsensus: 'Asynchronous In-Memory Replication with Sentinel / Raft Cluster',
        storageFormat: 'RAM-resident memory allocations (jemalloc) with RDB snapshot / AOF persistence',
        zeroDowntimeDdl: 'Non-blocking SCAN iteration, FLUSHDB ASYNC',
        bestFor: 'Sub-millisecond caching, session stores, real-time leaderboards, pub/sub',
        antiPatterns: 'Blocking O(N) commands like KEYS * and large unpipelined collections',
      };
    }
    if (category === 'document') {
      return {
        capTheorem: 'CP (Primary-Secondary with Majority Read/Write Concern)',
        concurrencyModel: 'WiredTiger Document-Level Concurrency with Ticket Queue',
        primaryIndexStructure: 'Unique B-Tree Index on `_id`',
        secondaryIndexSupport: 'Compound B-Tree, Multikey (Array) Indexes, Text, 2dsphere, Vector',
        replicationConsensus: 'Raft-like Replica Set Election Protocol',
        storageFormat: 'BSON Document format compressed with Snappy / zlib in WiredTiger tables',
        zeroDowntimeDdl: 'Rolling index builds on secondary members, index hiding',
        bestFor: 'Dynamic schemas, polymorphic entities, rapid product iteration, content management',
        antiPatterns: 'Arbitrary $where JavaScript evaluations and unbounded nested array growth',
      };
    }

    return {
      capTheorem: 'CP / ACID Compliant',
      concurrencyModel: 'Transactional Lock Manager / MVCC',
      primaryIndexStructure: 'B-Tree / Clustered Index',
      secondaryIndexSupport: 'Secondary B-Tree Indexes',
      replicationConsensus: 'Primary-Replica with WAL shipping',
      storageFormat: 'Page-based disk blocks with buffer cache',
      zeroDowntimeDdl: 'Online DDL with lock timeouts',
      bestFor: 'Transactional business data, normalized schemas',
      antiPatterns: 'Long-running transactions blocking metadata locks',
    };
  };

  const prof1 = getProfile(db1.id, db1.category);
  const prof2 = getProfile(db2.id, db2.category);
  const prof3 = getProfile(db3.id, db3.category);

  const presets = [
    { label: 'Relational Giants: Postgres vs MySQL vs Snowflake', d1: 'postgres', d2: 'mysql', d3: 'snowflake' },
    { label: 'Real-Time OLAP: ClickHouse vs Snowflake vs DuckDB', d1: 'clickhouse', d2: 'snowflake', d3: 'duckdb' },
    { label: 'Vector AI: Pinecone vs Milvus vs Qdrant', d1: 'pinecone', d2: 'milvus', d3: 'qdrant' },
    { label: 'In-Memory & Cache: Redis vs Valkey vs Memcached', d1: 'redis', d2: 'valkey', d3: 'memcached' },
    { label: 'Document NoSQL: MongoDB vs Couchbase vs Firestore', d1: 'mongodb', d2: 'couchbase', d3: 'firestore' },
  ];

  const dimensions = [
    { name: 'Category & Paradigm', d1: db1.categoryLabel, d2: db2.categoryLabel, d3: db3.categoryLabel },
    { name: 'CAP Theorem Classification', d1: prof1.capTheorem, d2: prof2.capTheorem, d3: prof3.capTheorem },
    { name: 'Concurrency & Isolation Model', d1: prof1.concurrencyModel, d2: prof2.concurrencyModel, d3: prof3.concurrencyModel },
    { name: 'Primary Key Storage Structure', d1: prof1.primaryIndexStructure, d2: prof2.primaryIndexStructure, d3: prof3.primaryIndexStructure },
    { name: 'Secondary Indexing Engines', d1: prof1.secondaryIndexSupport, d2: prof2.secondaryIndexSupport, d3: prof3.secondaryIndexSupport },
    { name: 'Replication & Consensus Protocol', d1: prof1.replicationConsensus, d2: prof2.replicationConsensus, d3: prof3.replicationConsensus },
    { name: 'Zero-Downtime DDL Capabilities', d1: prof1.zeroDowntimeDdl, d2: prof2.zeroDowntimeDdl, d3: prof3.zeroDowntimeDdl, isSafe: true },
    { name: 'Ideal Workloads (Best For)', d1: prof1.bestFor, d2: prof2.bestFor, d3: prof3.bestFor },
    { name: 'Architecture Anti-Patterns / Gotchas', d1: prof1.antiPatterns, d2: prof2.antiPatterns, d3: prof3.antiPatterns, isHazard: true },
  ];

  return (
    <div className="space-y-6">
      
      <div className="glass-card-light rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-200/60 pb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <ArrowRightLeft className="w-5 h-5 text-purple-600 shrink-0" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                447 Database Systems Comparison Matrix &amp; Architecture Deep-Dive
              </h2>
              <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold bg-purple-100 text-purple-800 rounded-full border border-purple-200">
                Side-by-Side Deep Analysis
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Compare any 2 or 3 database engines on CAP Theorem, MVCC concurrency, storage formats, replication protocols, and zero-downtime capabilities.
            </p>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-purple-200/60 text-xs font-semibold self-start sm:self-auto">
            <button
              onClick={() => setMobileViewMode('table')}
              className={`px-3 py-1 rounded-lg transition ${
                mobileViewMode === 'table' ? 'bg-white text-purple-950 font-bold shadow-sm' : 'text-slate-600'
              }`}
            >
              📊 Table View
            </button>
            <button
              onClick={() => setMobileViewMode('cards')}
              className={`px-3 py-1 rounded-lg transition ${
                mobileViewMode === 'cards' ? 'bg-white text-purple-950 font-bold shadow-sm' : 'text-slate-600'
              }`}
            >
              📱 Mobile Cards
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] uppercase font-bold text-purple-900/70 flex items-center gap-1">
            <Layers className="w-3 h-3 text-purple-600" />
            Quick Comparison Presets:
          </span>
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {presets.map((p, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setDb1Id(p.d1);
                  setDb2Id(p.d2);
                  setDb3Id(p.d3);
                }}
                className="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-white hover:bg-purple-50 text-slate-800 border border-purple-200 shrink-0 shadow-sm transition active:scale-95"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-1">
          <div className="p-3 rounded-xl border border-purple-200 bg-white/80 space-y-1.5 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-purple-800">System #1 (Left Column)</span>
            <UniversalDbSelector selectedEngine={db1Id} onSelectEngine={setDb1Id} label="" />
          </div>

          <div className="p-3 rounded-xl border border-indigo-200 bg-white/80 space-y-1.5 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-indigo-800">System #2 (Middle Column)</span>
            <UniversalDbSelector selectedEngine={db2Id} onSelectEngine={setDb2Id} label="" />
          </div>

          <div className="p-3 rounded-xl border border-teal-200 bg-white/80 space-y-1.5 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-teal-800">System #3 (Right Column)</span>
            <UniversalDbSelector selectedEngine={db3Id} onSelectEngine={setDb3Id} label="" />
          </div>
        </div>
      </div>

      {mobileViewMode === 'cards' ? (
        <div className="space-y-4">
          {dimensions.map((dim, idx) => (
            <div
              key={idx}
              className={`glass-card-light rounded-2xl p-4 sm:p-5 shadow-lg space-y-3 border ${
                dim.isSafe ? 'border-emerald-300 bg-emerald-50/20' : dim.isHazard ? 'border-rose-300 bg-rose-50/20' : 'border-purple-200/80'
              }`}
            >
              <div className="flex items-center gap-2 border-b border-purple-100 pb-2">
                <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  {dim.name}
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/40 border border-purple-200/70 dark:border-purple-800/60 space-y-1">
                  <div className="flex items-center gap-2 text-purple-950 dark:text-purple-200 font-bold">
                    <DbBrandLogo engineId={db1.id} size={18} />
                    <span>{db1.name}</span>
                    {db1.rank && <span className="text-[9px] px-1 rounded bg-purple-200 text-purple-900 font-mono">#{db1.rank}</span>}
                  </div>
                  <p className="text-slate-800 dark:text-slate-200 leading-relaxed pt-0.5">{dim.d1}</p>
                </div>

                <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/60 space-y-1">
                  <div className="flex items-center gap-2 text-indigo-950 dark:text-indigo-200 font-bold">
                    <DbBrandLogo engineId={db2.id} size={18} />
                    <span>{db2.name}</span>
                    {db2.rank && <span className="text-[9px] px-1 rounded bg-indigo-200 text-indigo-900 font-mono">#{db2.rank}</span>}
                  </div>
                  <p className="text-slate-800 dark:text-slate-200 leading-relaxed pt-0.5">{dim.d2}</p>
                </div>

                <div className="p-3 rounded-xl bg-teal-50/60 dark:bg-teal-950/40 border border-teal-200/70 dark:border-teal-800/60 space-y-1">
                  <div className="flex items-center gap-2 text-teal-950 dark:text-teal-200 font-bold">
                    <DbBrandLogo engineId={db3.id} size={18} />
                    <span>{db3.name}</span>
                    {db3.rank && <span className="text-[9px] px-1 rounded bg-teal-200 text-teal-900 font-mono">#{db3.rank}</span>}
                  </div>
                  <p className="text-slate-800 dark:text-slate-200 leading-relaxed pt-0.5">{dim.d3}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        
        <div className="glass-card-light rounded-2xl p-4 sm:p-5 shadow-lg overflow-x-auto scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b-2 border-purple-200 text-slate-900 bg-purple-50/70">
                <th className="py-3 px-3 sm:px-4 w-1/4 font-bold text-slate-700">Architectural Dimension</th>
                <th className="py-3 px-3 sm:px-4 w-1/4 font-bold text-purple-950">
                  <div className="flex items-center gap-2">
                    <DbBrandLogo engineId={db1.id} size={18} />
                    <span>{db1.name}</span>
                    {db1.rank && <span className="text-[10px] font-mono text-purple-700 bg-purple-100 px-1 rounded">#{db1.rank}</span>}
                  </div>
                </th>
                <th className="py-3 px-3 sm:px-4 w-1/4 font-bold text-indigo-950">
                  <div className="flex items-center gap-2">
                    <DbBrandLogo engineId={db2.id} size={18} />
                    <span>{db2.name}</span>
                    {db2.rank && <span className="text-[10px] font-mono text-indigo-700 bg-indigo-100 px-1 rounded">#{db2.rank}</span>}
                  </div>
                </th>
                <th className="py-3 px-3 sm:px-4 w-1/4 font-bold text-teal-950">
                  <div className="flex items-center gap-2">
                    <DbBrandLogo engineId={db3.id} size={18} />
                    <span>{db3.name}</span>
                    {db3.rank && <span className="text-[10px] font-mono text-teal-700 bg-teal-100 px-1 rounded">#{db3.rank}</span>}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-100 text-[11px] leading-relaxed">
              {dimensions.map((dim, idx) => (
                <tr
                  key={idx}
                  className={`hover:bg-purple-50/30 transition ${
                    dim.isSafe ? 'bg-emerald-50/30' : dim.isHazard ? 'bg-rose-50/30' : ''
                  }`}
                >
                  <td className={`py-3 px-3 sm:px-4 font-bold ${
                    dim.isSafe ? 'text-emerald-900' : dim.isHazard ? 'text-rose-900' : 'text-slate-700'
                  }`}>
                    {dim.name}
                  </td>
                  <td className={`py-3 px-3 sm:px-4 ${dim.isSafe ? 'text-emerald-950 font-medium' : dim.isHazard ? 'text-rose-950 font-medium' : 'text-slate-800'}`}>
                    {dim.d1}
                  </td>
                  <td className={`py-3 px-3 sm:px-4 ${dim.isSafe ? 'text-emerald-950 font-medium' : dim.isHazard ? 'text-rose-950 font-medium' : 'text-slate-800'}`}>
                    {dim.d2}
                  </td>
                  <td className={`py-3 px-3 sm:px-4 ${dim.isSafe ? 'text-emerald-950 font-medium' : dim.isHazard ? 'text-rose-950 font-medium' : 'text-slate-800'}`}>
                    {dim.d3}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
