import React, { useState, useEffect } from 'react';
import { DatabaseEngine, DATABASE_CATALOG } from '../types';
import { UniversalDbSelector } from './UniversalDbSelector';
import { Calculator, Cpu, HardDrive, Layers, Server, Copy, Check, Network } from 'lucide-react';

import { resolveSizingPreset, getEngineMetadataSafe } from '../utils/enginePresets';

interface DatabaseSizingTabProps {
  selectedEngine?: DatabaseEngine | string;
  onSelectEngine?: (engine: DatabaseEngine) => void;
}

export const DatabaseSizingTab: React.FC<DatabaseSizingTabProps> = ({
  selectedEngine: propEngine,
  onSelectEngine,
}) => {
  const [selectedEngine, setSelectedEngine] = useState<DatabaseEngine>(
    (propEngine as DatabaseEngine) || 'postgres'
  );

  useEffect(() => {
    if (propEngine && propEngine !== selectedEngine) {
      setSelectedEngine(propEngine as DatabaseEngine);
    }
  }, [propEngine]);
  const [activeSubTab, setActiveSubTab] = useState<'vector' | 'oltp' | 'partitioning' | 'pooler'>('oltp');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const currentDb = getEngineMetadataSafe(selectedEngine);

  const [vectorCount, setVectorCount] = useState<number>(1000000); 
  const [dimension, setDimension] = useState<number>(1536); 
  const [quantization, setQuantization] = useState<'fp32' | 'fp16' | 'sq8' | 'pq'>('fp16');
  const [hnswM, setHnswM] = useState<number>(16);
  const efConstruction = 128;

  const [dailyWrites, setDailyWrites] = useState<number>(5000000); 
  const [avgRowSizeBytes, setAvgRowSizeBytes] = useState<number>(450); 
  const [retentionDays, setRetentionDays] = useState<number>(365); 
  const [indexOverheadPercent, setIndexOverheadPercent] = useState<number>(40); 
  const peakTpsMultiplier = 3; 

  const [partitionTable, setPartitionTable] = useState<string>('orders');
  const partitionKey = 'created_at';

  const [dbCpuCores, setDbCpuCores] = useState<number>(16); 
  const [appReplicas, setAppReplicas] = useState<number>(25); 
  const [threadsPerApp, setThreadsPerApp] = useState<number>(20); 
  const nvmeSpindles = 4;

  // Dynamically update realistic sizing parameters for any of the 447 engines
  useEffect(() => {
    if (currentDb.category === 'vector' || currentDb.category === 'search') {
      setActiveSubTab('vector');
    } else if (currentDb.category === 'relational' || currentDb.category === 'olap' || currentDb.category === 'wide_column') {
      setActiveSubTab('oltp');
    }

    const preset = resolveSizingPreset(selectedEngine);
    setDailyWrites(preset.dailyWrites);
    setAvgRowSizeBytes(preset.avgRowSizeBytes);
    setRetentionDays(preset.retentionDays);
    setVectorCount(preset.vectorCount);
    setDimension(preset.dimension);
    setPartitionTable(preset.partitionTable);
    setDbCpuCores(preset.dbCpuCores);
  }, [selectedEngine]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const bytesPerFloat = quantization === 'fp32' ? 4 : quantization === 'fp16' ? 2 : quantization === 'sq8' ? 1 : 0.25;
  const rawVectorBytes = vectorCount * dimension * bytesPerFloat;
  const rawVectorGB = rawVectorBytes / (1024 * 1024 * 1024);

  const hnswGraphBytes = vectorCount * (hnswM * 8 * 1.5 + 32);
  const hnswGraphGB = hnswGraphBytes / (1024 * 1024 * 1024);

  const totalVectorRamGB = (rawVectorGB + hnswGraphGB) * 1.25; 
  const estimatedQps = Math.round(15000 / (efConstruction / 64));

  let recommendedInstance = 'AWS r6i.large (2 vCPU, 16 GB RAM)';
  if (totalVectorRamGB > 256) recommendedInstance = 'AWS r6i.8xlarge (32 vCPU, 256 GB RAM) / Multi-Node Cluster';
  else if (totalVectorRamGB > 128) recommendedInstance = 'AWS r6i.4xlarge (16 vCPU, 128 GB RAM)';
  else if (totalVectorRamGB > 64) recommendedInstance = 'AWS r6i.2xlarge (8 vCPU, 64 GB RAM)';
  else if (totalVectorRamGB > 32) recommendedInstance = 'AWS r6i.xlarge (4 vCPU, 32 GB RAM)';

  const compressionRatio = currentDb.category === 'olap' ? 0.35 : 1.0;
  const rawDataPerDayBytes = dailyWrites * avgRowSizeBytes * compressionRatio;
  const rawDataTotalBytes = rawDataPerDayBytes * retentionDays;
  const rawDataTotalGB = rawDataTotalBytes / (1024 * 1024 * 1024);
  const totalStorageWithIndexesGB = rawDataTotalGB * (1 + indexOverheadPercent / 100) * 1.2;

  const avgWritesPerSecond = Math.round(dailyWrites / 86400);
  const peakWriteTps = Math.round(avgWritesPerSecond * peakTpsMultiplier);
  const estimatedWriteIops = Math.round(peakWriteTps * (1 + (indexOverheadPercent / 100) * 2));
  const recommendedBufferPoolGB = Math.max(8, Math.round(rawDataTotalGB * (currentDb.category === 'keyvalue' ? 1.2 : 0.25)));

  const optimalBackendConnections = dbCpuCores * 2 + nvmeSpindles;
  const totalAppConnectionsDemand = appReplicas * threadsPerApp;
  const contextSwitchOverhead = totalAppConnectionsDemand > 300 ? 'Severe (CPU Context Thrashing)' : 'Moderate';
  const memoryPerUnpooledConnectionMB = 10; 
  const unpooledMemoryWastedGB = ((totalAppConnectionsDemand * memoryPerUnpooledConnectionMB) / 1024).toFixed(1);

  const generatePgbouncerConfig = () => {
    if (currentDb.id === 'mysql' || currentDb.id === 'mariadb') {
      return `# ===================================================================
# PROXYSQL 2.x PRODUCTION CONFIGURATION (for ${currentDb.name})
# Target Backend: ${dbCpuCores} CPU Cores -> Optimal Pool: ${optimalBackendConnections} Connections
# ===================================================================

admin_variables={
    admin_credentials="admin:admin;radmin:radmin"
    mysql_ifaces="0.0.0.0:6032"
}

mysql_variables={
    threads=${Math.min(8, dbCpuCores)}
    max_connections=${Math.max(1000, totalAppConnectionsDemand * 2)}
    default_schema="production_db"
    connect_timeout_server=3000
    free_connections_pct=20
}

mysql_servers=(
    { address="127.0.0.1", port=3306, hostgroup=0, max_connections=${optimalBackendConnections} }
)`;
    } else if (currentDb.id === 'redis' || currentDb.id === 'keydb') {
      return `# ===================================================================
# TWEMPROXY / NUTCRACKER CONFIGURATION (for ${currentDb.name})
# ===================================================================

redis_pool:
  listen: 0.0.0.0:22121
  hash: fnv1a_64
  distribution: ketama
  auto_eject_hosts: true
  timeout: 400
  redis: true
  server_connections: ${optimalBackendConnections}
  servers:
   - 127.0.0.1:6379:1 server1`;
    }

    return `# ===================================================================
# PGBOUNCER PRODUCTION CONFIGURATION (for ${currentDb.name})
# Target Backend: ${dbCpuCores} CPU Cores -> Optimal Pool: ${optimalBackendConnections} Connections
# ===================================================================

[databases]
* = host=127.0.0.1 port=5432 auth_user=postgres

[pgbouncer]
logfile = /var/log/postgresql/pgbouncer.log
pidfile = /var/run/postgresql/pgbouncer.pid

# Connection Limits
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt

# Transaction Pooling Mode (Recommended for stateless web apps)
pool_mode = transaction

# Mathematical Sizing Formulas Applied
max_client_conn = ${Math.max(1000, totalAppConnectionsDemand * 2)}
default_pool_size = ${Math.round(optimalBackendConnections * 0.8)}
min_pool_size = ${Math.round(optimalBackendConnections * 0.2)}
reserve_pool_size = ${Math.round(optimalBackendConnections * 0.2)}
reserve_pool_timeout = 5

# Performance & Timeouts
server_idle_timeout = 60
client_idle_timeout = 0
query_timeout = 30
server_connect_timeout = 15`;
  };

  const generatePartitioningSql = () => {
    if (currentDb.id === 'mysql' || currentDb.id === 'mariadb') {
      return `-- MySQL / MariaDB InnoDB Range Partitioning Pattern for ${currentDb.name}
CREATE TABLE ${partitionTable} (
    id BIGINT NOT NULL AUTO_INCREMENT,
    ${partitionKey} DATE NOT NULL,
    customer_id BIGINT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    status VARCHAR(30) NOT NULL,
    PRIMARY KEY (id, ${partitionKey})
) ENGINE=InnoDB
PARTITION BY RANGE (YEAR(${partitionKey}) * 100 + MONTH(${partitionKey})) (
    PARTITION p202601 VALUES LESS THAN (202602),
    PARTITION p202602 VALUES LESS THAN (202603),
    PARTITION p202603 VALUES LESS THAN (202604),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- Zero-Downtime Drop Old Partition
-- ALTER TABLE ${partitionTable} DROP PARTITION p202501;`;
    } else if (currentDb.category === 'olap') {
      return `-- ClickHouse / OLAP Table Partitioning Pattern for ${currentDb.name}
CREATE TABLE ${partitionTable} (
    event_time DateTime,
    customer_id UInt64,
    amount Decimal(12, 2),
    status LowCardinality(String)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_time)
ORDER BY (customer_id, event_time);

-- Zero-Downtime Detach and Drop Old Partition
-- ALTER TABLE ${partitionTable} DROP PARTITION 202501;`;
    }

    return `-- ${currentDb.name} Declarative Range Partitioning Pattern
CREATE TABLE ${partitionTable} (
    id BIGSERIAL,
    ${partitionKey} TIMESTAMPTZ NOT NULL,
    customer_id BIGINT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(30) NOT NULL,
    PRIMARY KEY (id, ${partitionKey})
) PARTITION BY RANGE (${partitionKey});

-- Partitions
CREATE TABLE ${partitionTable}_2026_01 PARTITION OF ${partitionTable}
    FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2026-02-01 00:00:00+00');

CREATE TABLE ${partitionTable}_2026_02 PARTITION OF ${partitionTable}
    FOR VALUES FROM ('2026-02-01 00:00:00+00') TO ('2026-03-01 00:00:00+00');

-- Local Indexes
CREATE INDEX ON ${partitionTable} (customer_id, ${partitionKey});

-- Zero-Lock Partition Detach
-- ALTER TABLE ${partitionTable} DETACH PARTITION ${partitionTable}_2025_01 CONCURRENTLY;`;
  };

  return (
    <div className="space-y-6">
      
      <div className="glass-card-light rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-200/60 pb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Calculator className="w-5 h-5 text-purple-600 shrink-0" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Universal Database Architecture &amp; Capacity Sizing Studio
              </h2>
              <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold bg-purple-100 text-purple-800 rounded-full border border-purple-200">
                All {DATABASE_CATALOG.length} DBs Supported
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Accurately model RAM, IOPS demand, Vector HNSW graph overheads, PgBouncer pooler sizing, and storage across all {DATABASE_CATALOG.length} database systems.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <UniversalDbSelector
              selectedEngine={selectedEngine}
              onSelectEngine={(eng) => {
                setSelectedEngine(eng);
                onSelectEngine?.(eng);
              }}
              label="Selected Engine"
            />
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-purple-200/60 text-xs font-semibold w-full sm:w-fit overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveSubTab('vector')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeSubTab === 'vector'
                ? 'bg-white text-purple-950 shadow-sm border border-purple-200 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-purple-600" />
            Vector Embeddings RAM
          </button>
          <button
            onClick={() => setActiveSubTab('oltp')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeSubTab === 'oltp'
                ? 'bg-white text-purple-950 shadow-sm border border-purple-200 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
            💾 Storage &amp; IOPS
          </button>
          <button
            onClick={() => setActiveSubTab('pooler')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeSubTab === 'pooler'
                ? 'bg-white text-purple-950 shadow-sm border border-purple-200 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Network className="w-3.5 h-3.5 text-violet-600" />
            🔄 Connection Pooler
          </button>
          <button
            onClick={() => setActiveSubTab('partitioning')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeSubTab === 'partitioning'
                ? 'bg-white text-purple-950 shadow-sm border border-purple-200 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-teal-600" />
            📐 Partitioning
          </button>
        </div>

        {activeSubTab === 'vector' && (
          <div className="space-y-6 pt-2">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="text-[10px] uppercase font-bold text-slate-500 shrink-0">Embedding Presets:</span>
              <button
                onClick={() => {
                  setDimension(1536);
                  setQuantization('fp16');
                }}
                className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 shrink-0 font-medium"
              >
                OpenAI text-embedding-3-small (1536d)
              </button>
              <button
                onClick={() => {
                  setDimension(3072);
                  setQuantization('fp16');
                }}
                className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 shrink-0 font-medium"
              >
                OpenAI text-embedding-3-large (3072d)
              </button>
              <button
                onClick={() => {
                  setDimension(1024);
                  setQuantization('sq8');
                }}
                className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 shrink-0 font-medium"
              >
                Cohere Embed v3 (1024d SQ8)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Vector Count: <span className="font-mono text-purple-700 font-bold">{vectorCount.toLocaleString()}</span>
                </label>
                <input
                  type="range"
                  min="100000"
                  max="50000000"
                  step="100000"
                  value={vectorCount}
                  onChange={(e) => setVectorCount(parseInt(e.target.value, 10))}
                  className="w-full accent-purple-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Vector Dimension: <span className="font-mono text-purple-700 font-bold">{dimension}</span>
                </label>
                <input
                  type="number"
                  value={dimension}
                  onChange={(e) => setDimension(parseInt(e.target.value, 10) || 1536)}
                  className="w-full px-3 py-1.5 rounded-xl border border-purple-200 text-xs font-mono bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quantization:
                </label>
                <select
                  value={quantization}
                  onChange={(e) => setQuantization(e.target.value as any)}
                  className="w-full px-3 py-1.5 rounded-xl border border-purple-200 text-xs bg-white font-medium"
                >
                  <option value="fp32">FP32 (4 bytes/dim)</option>
                  <option value="fp16">FP16 (2 bytes/dim)</option>
                  <option value="sq8">SQ8 (1 byte/dim)</option>
                  <option value="pq">PQ (~0.25 bytes/dim)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  HNSW M: <span className="font-mono text-purple-700 font-bold">{hnswM}</span>
                </label>
                <select
                  value={hnswM}
                  onChange={(e) => setHnswM(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-1.5 rounded-xl border border-purple-200 text-xs bg-white font-medium"
                >
                  <option value="16">M = 16 (Standard)</option>
                  <option value="32">M = 32 (High QPS)</option>
                  <option value="64">M = 64 (Ultra Accuracy)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-purple-200/80 bg-white/90 space-y-1 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-500">Raw Vectors Storage</span>
                <div className="text-xl font-black text-slate-900 font-mono">
                  {rawVectorGB < 1 ? `${(rawVectorGB * 1024).toFixed(1)} MB` : `${rawVectorGB.toFixed(2)} GB`}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-indigo-200/80 bg-white/90 space-y-1 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-500">HNSW Graph Overhead</span>
                <div className="text-xl font-black text-indigo-950 font-mono">
                  {hnswGraphGB < 1 ? `${(hnswGraphGB * 1024).toFixed(1)} MB` : `${hnswGraphGB.toFixed(2)} GB`}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/70 space-y-1 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-emerald-800">Total RAM Required</span>
                <div className="text-xl font-black text-emerald-950 font-mono">
                  {totalVectorRamGB.toFixed(1)} GB
                </div>
              </div>

              <div className="p-4 rounded-xl border border-purple-300 bg-purple-50/70 space-y-1 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-purple-800">Estimated QPS</span>
                <div className="text-xl font-black text-purple-950 font-mono">
                  ~{estimatedQps.toLocaleString()} QPS
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-purple-200 bg-white/95 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-100 text-purple-700">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Recommended Instance for {currentDb.name}</h4>
                  <p className="text-xs text-purple-950 font-mono font-bold mt-0.5">{recommendedInstance}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'oltp' && (
          <div className="space-y-6 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Daily Rows: <span className="font-mono text-purple-700 font-bold">{dailyWrites.toLocaleString()}</span>
                </label>
                <input
                  type="range"
                  min="500000"
                  max="50000000"
                  step="500000"
                  value={dailyWrites}
                  onChange={(e) => setDailyWrites(parseInt(e.target.value, 10))}
                  className="w-full accent-purple-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Row Size: <span className="font-mono text-purple-700 font-bold">{avgRowSizeBytes} B</span>
                </label>
                <input
                  type="number"
                  value={avgRowSizeBytes}
                  onChange={(e) => setAvgRowSizeBytes(parseInt(e.target.value, 10) || 450)}
                  className="w-full px-3 py-1.5 rounded-xl border border-purple-200 text-xs font-mono bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Retention: <span className="font-mono text-purple-700 font-bold">{retentionDays} Days</span>
                </label>
                <input
                  type="number"
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(parseInt(e.target.value, 10) || 365)}
                  className="w-full px-3 py-1.5 rounded-xl border border-purple-200 text-xs font-mono bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Index Overhead: <span className="font-mono text-purple-700 font-bold">+{indexOverheadPercent}%</span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="120"
                  step="5"
                  value={indexOverheadPercent}
                  onChange={(e) => setIndexOverheadPercent(parseInt(e.target.value, 10))}
                  className="w-full accent-purple-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-purple-200/80 bg-white/90 space-y-1 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-500">1-Year Storage</span>
                <div className="text-xl font-black text-slate-900 font-mono">
                  {totalStorageWithIndexesGB > 1024
                    ? `${(totalStorageWithIndexesGB / 1024).toFixed(2)} TB`
                    : `${totalStorageWithIndexesGB.toFixed(1)} GB`}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-indigo-200/80 bg-white/90 space-y-1 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-500">Peak Write IOPS</span>
                <div className="text-xl font-black text-indigo-950 font-mono">
                  {estimatedWriteIops.toLocaleString()} IOPS
                </div>
              </div>

              <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/70 space-y-1 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-emerald-800">Buffer Cache (RAM)</span>
                <div className="text-xl font-black text-emerald-950 font-mono">
                  {recommendedBufferPoolGB} GB RAM
                </div>
              </div>

              <div className="p-4 rounded-xl border border-purple-300 bg-purple-50/70 space-y-1 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-purple-800">WAL Throughput</span>
                <div className="text-xl font-black text-purple-950 font-mono">
                  {((rawDataPerDayBytes / 86400 / 1024 / 1024) * 3).toFixed(2)} MB/s
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'pooler' && (
          <div className="space-y-6 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Database Server CPU Cores: <span className="font-mono text-purple-700 font-bold">{dbCpuCores} Cores</span>
                </label>
                <input
                  type="range"
                  min="2"
                  max="128"
                  step="2"
                  value={dbCpuCores}
                  onChange={(e) => setDbCpuCores(parseInt(e.target.value, 10))}
                  className="w-full accent-purple-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>2 vCPU</span>
                  <span>32</span>
                  <span>128 vCPU</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Web App Pod Replicas: <span className="font-mono text-purple-700 font-bold">{appReplicas} Pods</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="200"
                  step="1"
                  value={appReplicas}
                  onChange={(e) => setAppReplicas(parseInt(e.target.value, 10))}
                  className="w-full accent-purple-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Threads per Pod: <span className="font-mono text-purple-700 font-bold">{threadsPerApp} Threads</span>
                </label>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={threadsPerApp}
                  onChange={(e) => setThreadsPerApp(parseInt(e.target.value, 10))}
                  className="w-full accent-purple-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-rose-300 bg-rose-50/70 space-y-1 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-rose-800">Direct Client Connections</span>
                <div className="text-2xl font-black text-rose-950 font-mono">
                  {totalAppConnectionsDemand.toLocaleString()}
                </div>
                <span className="text-[10px] text-rose-700">Wastes ~{unpooledMemoryWastedGB} GB RAM in backend forks</span>
              </div>

              <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/70 space-y-1 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-emerald-800">Optimal Pooled Connections</span>
                <div className="text-2xl font-black text-emerald-950 font-mono">
                  {optimalBackendConnections} Connections
                </div>
                <span className="text-[10px] text-emerald-700">Formula: (CPU × 2) + NVMe spindles</span>
              </div>

              <div className="p-4 rounded-xl border border-purple-200 bg-white/90 space-y-1 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-500">Context Switching State</span>
                <div className="text-sm font-bold text-slate-900 font-mono">
                  {contextSwitchOverhead}
                </div>
                <span className="text-[10px] text-slate-500">Without connection pooler</span>
              </div>

              <div className="p-4 rounded-xl border border-indigo-200 bg-white/90 space-y-1 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-500">PgBouncer Pool Mode</span>
                <div className="text-sm font-bold text-indigo-950 font-mono">
                  Transaction Pooling
                </div>
                <span className="text-[10px] text-slate-500">Zero connection exhaustion</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  Auto-Generated PgBouncer Production Config (pgbouncer.ini)
                </span>
                <button
                  onClick={() => handleCopy(generatePgbouncerConfig(), 'pgbouncer_conf')}
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-purple-50 hover:bg-purple-100 px-3 py-1 rounded-lg border border-purple-200 transition shadow-sm"
                >
                  {copiedId === 'pgbouncer_conf' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      Copied pgbouncer.ini!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-purple-600" />
                      Copy pgbouncer.ini
                    </>
                  )}
                </button>
              </div>

              <pre className="bg-slate-950 text-emerald-400 p-4 rounded-xl text-xs font-mono border border-slate-800 overflow-x-auto shadow-inner whitespace-pre-wrap leading-relaxed">
                {generatePgbouncerConfig()}
              </pre>
            </div>
          </div>
        )}

        {activeSubTab === 'partitioning' && (
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span>Partitioning Schema for:</span>
                <span className="font-bold text-purple-900">{currentDb.name}</span>
                <span>({currentDb.categoryLabel})</span>
                <span className="text-slate-400">| Table:</span>
                <input
                  type="text"
                  value={partitionTable}
                  onChange={(e) => setPartitionTable(e.target.value)}
                  className="px-2 py-0.5 rounded border border-purple-200 text-xs font-mono font-bold text-purple-950 bg-white w-24"
                />
              </div>

              <button
                type="button"
                onClick={() => handleCopy(generatePartitioningSql(), 'partition_sql')}
                className="flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg border border-teal-200 transition shadow-sm self-start sm:self-auto"
              >
                {copiedId === 'partition_sql' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Copied {currentDb.name} DDL!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-teal-600" />
                    Copy Partitioning DDL
                  </>
                )}
              </button>
            </div>

            <pre className="bg-slate-950 text-emerald-400 p-4 rounded-xl text-xs font-mono border border-slate-800 overflow-x-auto shadow-inner whitespace-pre-wrap leading-relaxed">
              {generatePartitioningSql()}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
