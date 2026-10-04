import { DATABASE_CATALOG } from '../types/db-catalog.data';

export interface ConfigTuningRequest {
  engine: string;
  ramGb: number;
  cpuCores: number;
  storageType: 'nvme_ssd' | 'sata_ssd' | 'hdd' | 'ebs_network';
  workloadType: 'oltp_web' | 'olap_dw' | 'mixed_hybrid' | 'vector_ai' | 'cache_inmemory' | 'timeseries_iot';
  maxConnections: number;
}

export interface RamAllocationSlice {
  label: string;
  sizeGb: number;
  percentage: number;
  color: string;
  description: string;
}

export interface KeyConfigParam {
  param: string;
  value: string;
  defaultVal: string;
  category: 'memory' | 'cpu' | 'io' | 'concurrency';
  explanation: string;
}

export interface ConfigTuningResult {
  engine: string;
  engineName: string;
  configFileName: string;
  generatedConfigText: string;
  sysctlConfigText: string;
  limitsConfigText: string;
  ramAllocation: RamAllocationSlice[];
  keyParameters: KeyConfigParam[];
  expertTips: string[];
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

export class ConfigAutoTuner {
  public tune(req: ConfigTuningRequest): ConfigTuningResult {
    const meta = getEngineMeta(req.engine);
    const ram = Math.max(1, req.ramGb);
    const cores = Math.max(1, req.cpuCores);
    const conns = Math.max(10, req.maxConnections);
    const storage = req.storageType || 'nvme_ssd';
    const workload = req.workloadType || 'oltp_web';

    const normalizedEngine = req.engine.toLowerCase();

    if (normalizedEngine === 'postgres' || normalizedEngine === 'postgresql' || normalizedEngine === 'timescaledb') {
      return this.tunePostgres(req, meta, ram, cores, conns, storage, workload);
    } else if (normalizedEngine === 'mysql' || normalizedEngine === 'mariadb') {
      return this.tuneMySQL(req, meta, ram, cores, conns, storage, workload);
    } else if (normalizedEngine.includes('oracle') || normalizedEngine.includes('db2')) {
      return this.tuneOracle(req, meta, ram, cores, conns, storage, workload);
    } else if (normalizedEngine.includes('sqlserver') || normalizedEngine.includes('mssql') || normalizedEngine.includes('sql_server')) {
      return this.tuneSqlServer(req, meta, ram, cores, conns, storage, workload);
    } else if (normalizedEngine.includes('sqlite') || normalizedEngine.includes('turso') || normalizedEngine.includes('libsql')) {
      return this.tuneSQLite(req, meta, ram, cores, conns, storage, workload);
    } else if (normalizedEngine === 'clickhouse') {
      return this.tuneClickHouse(req, meta, ram, cores, conns, storage, workload);
    } else if (normalizedEngine === 'redis' || normalizedEngine === 'keydb' || normalizedEngine === 'valkey') {
      return this.tuneRedis(req, meta, ram, cores, conns, storage, workload);
    } else if (normalizedEngine === 'mongodb' || normalizedEngine === 'documentdb') {
      return this.tuneMongo(req, meta, ram, cores, conns, storage, workload);
    } else if (normalizedEngine === 'cassandra' || normalizedEngine === 'scylladb') {
      return this.tuneCassandra(req, meta, ram, cores, conns, storage, workload);
    } else if (normalizedEngine === 'elasticsearch' || normalizedEngine === 'opensearch') {
      return this.tuneElasticsearch(req, meta, ram, cores, conns, storage, workload);
    } else {
      
      return this.tuneUniversal(req, meta, ram, cores, conns, storage, workload);
    }
  }

  private tunePostgres(req: ConfigTuningRequest, meta: any, ram: number, cores: number, conns: number, storage: string, workload: string): ConfigTuningResult {
    
    const sharedBuffersGb = +(ram * (workload === 'olap_dw' ? 0.35 : 0.25)).toFixed(2);
    const effectiveCacheGb = +(ram * 0.75).toFixed(2);
    
    let workMemMb = Math.floor(((ram * 1024) * 0.20) / (conns * (workload === 'olap_dw' ? 2 : 4)));
    if (workMemMb < 4) workMemMb = 4;
    if (workMemMb > 2048) workMemMb = 2048;

    const maintWorkMemGb = +(Math.min(2.0, ram * 0.05)).toFixed(2);
    const maintWorkMemMb = Math.max(64, Math.floor(maintWorkMemGb * 1024));

    const maxWorkerProcesses = cores;
    const maxParallelWorkers = cores;
    const maxParallelWorkersPerGather = Math.min(8, Math.max(2, Math.floor(cores / 2)));
    const randomPageCost = (storage === 'nvme_ssd' ? '1.1' : storage === 'sata_ssd' ? '1.2' : '4.0');
    const effectiveIoConcurrency = (storage === 'nvme_ssd' ? 256 : storage === 'sata_ssd' ? 200 : 2);

    const minWalGb = Math.max(1, Math.floor(ram * 0.05));
    const maxWalGb = Math.max(2, Math.floor(ram * 0.20));

    const config = `# =========================================================================
# SQLPulse Production Config Auto-Tuner: PostgreSQL 14+ / 16+
# Hardware: ${ram} GB RAM | ${cores} vCPUs | ${storage.toUpperCase()} Storage | ${workload.toUpperCase()}
# Generated: ${new Date().toISOString()}
# =========================================================================

# --- CONNECTIONS & AUTHENTICATION ---
max_connections = ${conns}
superuser_reserved_connections = 3

# --- MEMORY USAGE & CACHE SIZING ---
shared_buffers = ${Math.floor(sharedBuffersGb * 1024)}MB                 # 25-35% of total system RAM
effective_cache_size = ${Math.floor(effectiveCacheGb * 1024)}MB           # ~75% of total system RAM
work_mem = ${workMemMb}MB                           # Per-operation sort & hash memory budget
maintenance_work_mem = ${maintWorkMemMb}MB               # VACUUM, CREATE INDEX, ALTER TABLE budget
dynamic_shared_memory_type = posix

# --- DISK IO & QUERY PLANNER COST CONSTANTS ---
random_page_cost = ${randomPageCost}                    # Low penalty for NVMe/SSD random seeks
seq_page_cost = 1.0
effective_io_concurrency = ${effectiveIoConcurrency}            # Concurrent IO requests storage can handle
default_statistics_target = ${workload === 'olap_dw' ? 500 : 100}

# --- WRITE AHEAD LOG (WAL) & CHECKPOINTS ---
wal_level = replica
wal_buffers = 16MB
min_wal_size = ${minWalGb}GB
max_wal_size = ${maxWalGb}GB
checkpoint_completion_target = 0.9           # Smooth I/O spread over checkpoint window
checkpoint_timeout = 15min

# --- PARALLEL QUERY EXECUTION ---
max_worker_processes = ${maxWorkerProcesses}
max_parallel_workers = ${maxParallelWorkers}
max_parallel_workers_per_gather = ${maxParallelWorkersPerGather}
max_parallel_maintenance_workers = ${Math.min(4, Math.floor(cores / 2))}

# --- AUTOVACUUM PERFORMANCE TUNING ---
autovacuum = on
autovacuum_max_workers = ${Math.min(6, Math.max(3, Math.floor(cores / 4)))}
autovacuum_vacuum_scale_factor = 0.05        # Trigger vacuum on 5% row changes
autovacuum_analyze_scale_factor = 0.02       # Trigger analyze on 2% row changes
autovacuum_vacuum_cost_limit = 2000          # High throughput vacuum throttling

# --- LOGGING & OBSERVABILITY ---
logging_collector = on
log_min_duration_statement = 250             # Log slow queries >= 250ms
log_checkpoints = on
log_connections = off
log_disconnections = off
log_lock_waits = on                          # Detect locks exceeding deadlock_timeout
deadlock_timeout = 1000ms
`;

    const sysctl = this.generateSysctl(ram, cores, conns);
    const limits = this.generateLimits();

    const ramAllocation: RamAllocationSlice[] = [
      { label: 'Postgres Shared Buffers', sizeGb: sharedBuffersGb, percentage: Math.round((sharedBuffersGb / ram) * 100), color: '#8B5CF6', description: 'In-memory database page cache' },
      { label: 'Work Mem Concurrency Budget', sizeGb: +(ram * 0.25).toFixed(2), percentage: 25, color: '#3B82F6', description: 'Dynamic query sorting, hash joins, bitmap scans' },
      { label: 'OS Page Cache & FS Buffers', sizeGb: +(ram * 0.35).toFixed(2), percentage: 35, color: '#10B981', description: 'Linux kernel filesystem caching for fast sequential reads' },
      { label: 'Kernel, Network & Connection Overhead', sizeGb: +(ram * 0.15).toFixed(2), percentage: 15, color: '#F59E0B', description: 'Backend process overhead (~10MB per active connection)' },
    ];

    const keyParams: KeyConfigParam[] = [
      { param: 'shared_buffers', value: `${Math.floor(sharedBuffersGb * 1024)}MB`, defaultVal: '128MB', category: 'memory', explanation: 'Dedicated shared memory segment for database caching.' },
      { param: 'work_mem', value: `${workMemMb}MB`, defaultVal: '4MB', category: 'memory', explanation: 'Memory allocated per sort/join operation before spilling to temp disk.' },
      { param: 'effective_cache_size', value: `${Math.floor(effectiveCacheGb * 1024)}MB`, defaultVal: '4096MB', category: 'memory', explanation: 'Estimates combined Postgres buffers and OS page cache to guide index scans.' },
      { param: 'random_page_cost', value: randomPageCost, defaultVal: '4.0', category: 'io', explanation: 'Tells query planner SSDs have nearly zero seek latency compared to spinning disks.' },
      { param: 'max_parallel_workers_per_gather', value: `${maxParallelWorkersPerGather}`, defaultVal: '2', category: 'cpu', explanation: 'Enables parallel worker threads to scan tables simultaneously.' },
    ];

    return {
      engine: meta.id,
      engineName: meta.name,
      configFileName: 'postgresql.conf',
      generatedConfigText: config,
      sysctlConfigText: sysctl,
      limitsConfigText: limits,
      ramAllocation,
      keyParameters: keyParams,
      expertTips: [
        'Place pg_wal directory on a dedicated NVMe or high-speed IOPS volume for high write throughput.',
        'Use PgBouncer in transaction pooling mode if your application creates over 300 active connections.',
        'Configure Linux Transparent Huge Pages (THP) to "madvise" or disable it to prevent memory latency spikes.',
      ],
    };
  }

  private tuneMySQL(req: ConfigTuningRequest, meta: any, ram: number, cores: number, conns: number, storage: string, workload: string): ConfigTuningResult {
    const bufferPoolGb = +(ram * 0.70).toFixed(2);
    const bufferPoolInstances = Math.min(64, Math.max(1, Math.floor(bufferPoolGb / 1)));
    const logFileGb = +(Math.min(8, Math.max(1, bufferPoolGb * 0.25))).toFixed(2);
    const ioCapacity = storage === 'nvme_ssd' ? 20000 : storage === 'sata_ssd' ? 4000 : 200;

    const config = `# =========================================================================
# SQLPulse Production Config Auto-Tuner: MySQL 8.0+ / MariaDB
# Hardware: ${ram} GB RAM | ${cores} vCPUs | ${storage.toUpperCase()} Storage | ${workload.toUpperCase()}
# Generated: ${new Date().toISOString()}
# =========================================================================

[mysqld]
# --- CONNECTION POOLING & THREADING ---
max_connections = ${conns}
max_connect_errors = 100000
thread_cache_size = 128
table_open_cache = 4096
table_definition_cache = 4096

# --- INNODB BUFFER POOL & MEMORY ---
innodb_buffer_pool_size = ${Math.floor(bufferPoolGb * 1024)}M          # 65-75% of total system RAM
innodb_buffer_pool_instances = ${bufferPoolInstances}
innodb_buffer_pool_dump_at_shutdown = ON
innodb_buffer_pool_load_at_startup = ON

# --- INNODB LOGGING & REDO LOG ---
innodb_redo_log_capacity = ${Math.floor(logFileGb * 1024)}M       # MySQL 8.0.30+ Redo capacity
innodb_log_buffer_size = 64M
innodb_flush_log_at_trx_commit = 1       # Full ACID compliance
innodb_flush_method = O_DIRECT           # Bypass double OS filesystem buffering

# --- INNODB DISK IOPS SCALING ---
innodb_io_capacity = ${ioCapacity}
innodb_io_capacity_max = ${ioCapacity * 2}
innodb_read_io_threads = ${Math.min(16, cores * 2)}
innodb_write_io_threads = ${Math.min(16, cores * 2)}

# --- SORT, JOIN & TEMP TABLES ---
sort_buffer_size = 4M
join_buffer_size = 4M
tmp_table_size = 64M
max_heap_table_size = 64M

# --- SLOW QUERY LOG ---
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow-query.log
long_query_time = 0.25                   # Slow query threshold: 250ms
log_queries_not_using_indexes = 0
`;

    const ramAllocation: RamAllocationSlice[] = [
      { label: 'InnoDB Buffer Pool', sizeGb: bufferPoolGb, percentage: 70, color: '#0284C7', description: 'Table, index and undo page memory cache' },
      { label: 'Connection Buffers & Threads', sizeGb: +(ram * 0.15).toFixed(2), percentage: 15, color: '#F59E0B', description: 'Per-thread sort, join, read buffers' },
      { label: 'OS Kernel & File Buffers', sizeGb: +(ram * 0.15).toFixed(2), percentage: 15, color: '#10B981', description: 'Linux OS networking and filesystem cache' },
    ];

    const keyParams: KeyConfigParam[] = [
      { param: 'innodb_buffer_pool_size', value: `${Math.floor(bufferPoolGb * 1024)}M`, defaultVal: '128M', category: 'memory', explanation: 'Primary memory storage for MySQL InnoDB caching data and index pages.' },
      { param: 'innodb_flush_method', value: 'O_DIRECT', defaultVal: 'fsync', category: 'io', explanation: 'Bypasses OS page cache to avoid double buffering data in memory.' },
      { param: 'innodb_io_capacity', value: `${ioCapacity}`, defaultVal: '200', category: 'io', explanation: 'Determines the rate of background page flushing to disk based on storage hardware.' },
    ];

    return {
      engine: meta.id,
      engineName: meta.name,
      configFileName: 'my.cnf',
      generatedConfigText: config,
      sysctlConfigText: this.generateSysctl(ram, cores, conns),
      limitsConfigText: this.generateLimits(),
      ramAllocation,
      keyParameters: keyParams,
      expertTips: [
        'Always set innodb_flush_method = O_DIRECT when running on Linux to eliminate duplicate cache overhead.',
        'Monitor innodb_buffer_pool_wait_free to verify buffer pool sizing is sufficient during write spikes.',
      ],
    };
  }

  private tuneClickHouse(req: ConfigTuningRequest, meta: any, ram: number, cores: number, conns: number, storage: string, workload: string): ConfigTuningResult {
    const maxMemoryUsageGb = +(ram * 0.85).toFixed(2);
    const maxMemoryUsageBytes = Math.floor(maxMemoryUsageGb * 1024 * 1024 * 1024);

    const config = `<!-- ======================================================================= -->
<!-- SQLPulse Production Config Auto-Tuner: ClickHouse Columnar OLAP Engine -->
<!-- Hardware: ${ram} GB RAM | ${cores} vCPUs | ${storage.toUpperCase()} Storage | ${workload.toUpperCase()} -->
<!-- ======================================================================= -->
<clickhouse>
    <!-- Server Sizing & Threading -->
    <max_connections>${conns}</max_connections>
    <keep_alive_timeout>10</keep_alive_timeout>
    <max_concurrent_queries>${Math.max(100, cores * 8)}</max_concurrent_queries>
    <uncompressed_cache_size>${Math.floor(ram * 0.15 * 1024 * 1024 * 1024)}</uncompressed_cache_size>
    <mark_cache_size>${Math.floor(ram * 0.10 * 1024 * 1024 * 1024)}</mark_cache_size>

    <!-- User Profile Limits & Memory Budget -->
    <profiles>
        <default>
            <!-- Max RAM per single analytical query (${Math.floor(maxMemoryUsageGb * 0.7)} GB) -->
            <max_memory_usage>${Math.floor(maxMemoryUsageBytes * 0.7)}</max_memory_usage>
            <!-- Max RAM across all queries on this node (${maxMemoryUsageGb} GB) -->
            <max_memory_usage_for_user>${maxMemoryUsageBytes}</max_memory_usage_for_user>
            <max_threads>${cores}</max_threads>
            <max_execution_time>300</max_execution_time>
            <join_use_nulls>0</join_use_nulls>
            <optimize_distinct_in_order>1</optimize_distinct_in_order>
        </default>
    </profiles>
</clickhouse>`;

    return {
      engine: meta.id,
      engineName: meta.name,
      configFileName: 'clickhouse-config.xml',
      generatedConfigText: config,
      sysctlConfigText: this.generateSysctl(ram, cores, conns),
      limitsConfigText: this.generateLimits(),
      ramAllocation: [
        { label: 'ClickHouse Query Execution RAM', sizeGb: +(ram * 0.65).toFixed(2), percentage: 65, color: '#F43F5E', description: 'Vectorized query processing, hash tables, and aggregations' },
        { label: 'Mark Cache & Uncompressed Cache', sizeGb: +(ram * 0.20).toFixed(2), percentage: 20, color: '#8B5CF6', description: 'Fast index mark offsets and decompression buffer' },
        { label: 'OS Page Cache & Kernel', sizeGb: +(ram * 0.15).toFixed(2), percentage: 15, color: '#10B981', description: 'Direct I/O and kernel page buffers' },
      ],
      keyParameters: [
        { param: 'max_memory_usage', value: `${Math.floor(maxMemoryUsageGb * 0.7)} GB`, defaultVal: '10 GB', category: 'memory', explanation: 'Limits RAM consumption per query to prevent Out-Of-Memory kernel kills.' },
        { param: 'max_threads', value: `${cores}`, defaultVal: 'cores', category: 'cpu', explanation: 'Parallelism degree for columnar vector pipeline processing.' },
      ],
      expertTips: [
        'Batch your INSERT statements (10,000+ rows per batch or 1 insert/sec) to avoid creating millions of tiny parts on disk.',
        'Use Compact and Wide part formats depending on column counts to minimize disk open file descriptors.',
      ],
    };
  }

  private tuneRedis(req: ConfigTuningRequest, meta: any, ram: number, cores: number, conns: number, storage: string, workload: string): ConfigTuningResult {
    const maxMemoryGb = +(ram * 0.80).toFixed(2);

    const config = `# =========================================================================
# SQLPulse Production Config Auto-Tuner: Redis 7.x / KeyDB / Valkey
# Hardware: ${ram} GB RAM | ${cores} vCPUs | ${storage.toUpperCase()} Storage | ${workload.toUpperCase()}
# =========================================================================

# Network & Concurrency
bind 0.0.0.0
port 6379
tcp-backlog 65536
maxclients ${conns}
timeout 300
tcp-keepalive 300

# Memory Management & Eviction
maxmemory ${Math.floor(maxMemoryGb * 1024)}mb
maxmemory-policy allkeys-lru
maxmemory-samples 10

# Multi-Threaded I/O Engine
io-threads ${Math.min(8, Math.max(2, Math.floor(cores * 0.75)))}
io-threads-do-reads yes

# Persistence Strategy (Hybrid RDB + AOF)
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec
no-appendfsync-on-rewrite yes
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

# Active Defragmentation
activedefrag yes
active-defrag-ignore-bytes 100mb
active-defrag-threshold-lower 10
active-defrag-threshold-upper 30
`;

    return {
      engine: meta.id,
      engineName: meta.name,
      configFileName: 'redis.conf',
      generatedConfigText: config,
      sysctlConfigText: this.generateSysctl(ram, cores, conns, true),
      limitsConfigText: this.generateLimits(),
      ramAllocation: [
        { label: 'Redis Data Key-Value Store', sizeGb: maxMemoryGb, percentage: 80, color: '#DC2626', description: 'In-memory data structures, dictionaries, lists, sets' },
        { label: 'Fork BGSAVE & AOF Rewrite Margin', sizeGb: +(ram * 0.15).toFixed(2), percentage: 15, color: '#F59E0B', description: 'Copy-On-Write memory buffer for non-blocking snapshotting' },
        { label: 'OS Kernel & Socket Buffers', sizeGb: +(ram * 0.05).toFixed(2), percentage: 5, color: '#10B981', description: 'TCP connection buffers and kernel overhead' },
      ],
      keyParameters: [
        { param: 'maxmemory', value: `${Math.floor(maxMemoryGb * 1024)}mb`, defaultVal: 'unlimited', category: 'memory', explanation: 'Hard boundary preventing Redis from exceeding physical host RAM.' },
        { param: 'maxmemory-policy', value: 'allkeys-lru', defaultVal: 'noeviction', category: 'memory', explanation: 'Evicts least recently used keys when maxmemory limit is reached.' },
        { param: 'io-threads', value: `${Math.min(8, Math.max(2, Math.floor(cores * 0.75)))}`, defaultVal: '1', category: 'cpu', explanation: 'Enables threaded I/O for network socket read/write offloading.' },
      ],
      expertTips: [
        'Set vm.overcommit_memory = 1 in /etc/sysctl.conf to prevent Redis BGSAVE forks from failing.',
        'Disable Linux Transparent Huge Pages (echo never > /sys/kernel/mm/transparent_hugepage/enabled) to prevent huge copy-on-write memory usage spikes.',
      ],
    };
  }

  private tuneMongo(req: ConfigTuningRequest, meta: any, ram: number, cores: number, conns: number, storage: string, workload: string): ConfigTuningResult {
    const wiredTigerCacheGb = +(Math.max(1, (ram - 1) * 0.5)).toFixed(2);

    const config = `# =========================================================================
# SQLPulse Production Config Auto-Tuner: MongoDB 6.x / 7.x (WiredTiger)
# Hardware: ${ram} GB RAM | ${cores} vCPUs | ${storage.toUpperCase()} Storage | ${workload.toUpperCase()}
# =========================================================================

storage:
  dbPath: /var/lib/mongodb
  journal:
    enabled: true
  wiredTiger:
    engineConfig:
      cacheSizeGB: ${wiredTigerCacheGb}
      journalCompressor: snappy
      directoryForIndexes: true
    collectionConfig:
      blockCompressor: snappy
    indexConfig:
      prefixCompression: true

net:
  port: 27017
  bindIp: 0.0.0.0
  maxIncomingConnections: ${conns}

processManagement:
  timeZoneInfo: /usr/share/zoneinfo

operationProfiling:
  mode: slowOp
  slowOpThresholdMs: 200
`;

    return {
      engine: meta.id,
      engineName: meta.name,
      configFileName: 'mongod.conf',
      generatedConfigText: config,
      sysctlConfigText: this.generateSysctl(ram, cores, conns),
      limitsConfigText: this.generateLimits(),
      ramAllocation: [
        { label: 'WiredTiger Cache', sizeGb: wiredTigerCacheGb, percentage: 50, color: '#10B981', description: 'Internal document, B-Tree index, and compression buffer' },
        { label: 'OS Filesystem Page Cache', sizeGb: +(ram * 0.40).toFixed(2), percentage: 40, color: '#3B82F6', description: 'Linux page cache for fast WiredTiger disk blocks' },
        { label: 'Connection & Query Overhead', sizeGb: +(ram * 0.10).toFixed(2), percentage: 10, color: '#F59E0B', description: 'Per-connection stack memory (1MB per thread)' },
      ],
      keyParameters: [
        { param: 'storage.wiredTiger.engineConfig.cacheSizeGB', value: `${wiredTigerCacheGb}`, defaultVal: '50% RAM - 1GB', category: 'memory', explanation: 'Allocates half of available RAM to WiredTiger, leaving remaining RAM for OS cache.' },
      ],
      expertTips: [
        'Always set Linux vm.zone_reclaim_mode = 0 on NUMA architectures to avoid severe MongoDB lockups.',
        'Format disks using XFS file system with noatime mount option for optimum WiredTiger throughput.',
      ],
    };
  }

  private tuneCassandra(req: ConfigTuningRequest, meta: any, ram: number, cores: number, conns: number, storage: string, workload: string): ConfigTuningResult {
    const heapGb = Math.min(31, Math.max(4, Math.floor(ram * 0.4)));

    const config = `# =========================================================================
# SQLPulse Production Config Auto-Tuner: Apache Cassandra / ScyllaDB
# Hardware: ${ram} GB RAM | ${cores} vCPUs | ${storage.toUpperCase()} Storage | ${workload.toUpperCase()}
# =========================================================================

cluster_name: 'ProductionCluster'
num_tokens: 16
hints_directory: /var/lib/cassandra/hints
data_file_directories:
    - /var/lib/cassandra/data
commitlog_directory: /var/lib/cassandra/commitlog
saved_caches_directory: /var/lib/cassandra/saved_caches

# Concurrency & Native Transport
concurrent_reads: ${cores * 8}
concurrent_writes: ${cores * 8}
concurrent_counter_writes: ${cores * 4}
native_transport_max_threads: ${cores * 16}

# Memory & Caching
file_cache_size_in_mb: ${Math.floor(ram * 0.25 * 1024)}
memtable_allocation_type: heap_buffers
memtable_cleanup_threshold: 0.33
memtable_flush_writers: ${Math.min(8, Math.max(2, Math.floor(cores / 2)))}
`;

    return {
      engine: meta.id,
      engineName: meta.name,
      configFileName: 'cassandra.yaml',
      generatedConfigText: config,
      sysctlConfigText: this.generateSysctl(ram, cores, conns),
      limitsConfigText: this.generateLimits(),
      ramAllocation: [
        { label: 'JVM Heap Memory', sizeGb: heapGb, percentage: Math.round((heapGb / ram) * 100), color: '#3B82F6', description: 'G1GC Java heap (capped at 31GB to retain Compressed Oops)' },
        { label: 'OS Page Cache & Memtables', sizeGb: +(ram - heapGb - 2).toFixed(2), percentage: Math.round(((ram - heapGb - 2) / ram) * 100), color: '#10B981', description: 'SSTable disk page caching' },
        { label: 'System & Direct Off-Heap', sizeGb: 2, percentage: Math.round((2 / ram) * 100), color: '#F59E0B', description: 'JNI and networking buffers' },
      ],
      keyParameters: [
        { param: 'concurrent_reads', value: `${cores * 8}`, defaultVal: '32', category: 'concurrency', explanation: 'Read coordinator thread pool scaled to available CPU cores.' },
        { param: 'concurrent_writes', value: `${cores * 8}`, defaultVal: '32', category: 'concurrency', explanation: 'Write executor thread pool for commitlog and memtable ingestion.' },
      ],
      expertTips: [
        'Keep JVM Heap under 32GB to avoid disabling Java Compressed Object Pointers (CompressedOops).',
        'Place commitlog on a physically dedicated SSD/NVMe drive to avoid contention with SSTable flushes.',
      ],
    };
  }

  private tuneElasticsearch(req: ConfigTuningRequest, meta: any, ram: number, cores: number, conns: number, storage: string, workload: string): ConfigTuningResult {
    const heapGb = Math.min(31, Math.max(2, Math.floor(ram * 0.5)));

    const config = `# =========================================================================
# SQLPulse Production Config Auto-Tuner: Elasticsearch / OpenSearch
# Hardware: ${ram} GB RAM | ${cores} vCPUs | ${storage.toUpperCase()} Storage | ${workload.toUpperCase()}
# =========================================================================

cluster.name: production-search-cluster
node.name: node-1
path.data: /var/lib/elasticsearch
path.logs: /var/log/elasticsearch

# Bootstrap & Memory Lock
bootstrap.memory_lock: true

# Thread Pools
processors: ${cores}
thread_pool.search.size: ${cores * 3}
thread_pool.search.queue_size: 1000
thread_pool.write.size: ${cores}
thread_pool.write.queue_size: 10000

# Indices & Circuit Breakers
indices.breaker.total.use_real_memory: true
indices.breaker.total.limit: 70%
indices.queries.cache.size: 10%
indices.memory.index_buffer_size: 20%
`;

    return {
      engine: meta.id,
      engineName: meta.name,
      configFileName: 'elasticsearch.yml',
      generatedConfigText: config,
      sysctlConfigText: this.generateSysctl(ram, cores, conns),
      limitsConfigText: this.generateLimits(),
      ramAllocation: [
        { label: 'Lucene / ES JVM Heap', sizeGb: heapGb, percentage: 50, color: '#F59E0B', description: 'Field data, aggregation buckets, cluster state' },
        { label: 'OS Filesystem Cache for Lucene Segments', sizeGb: +(ram * 0.45).toFixed(2), percentage: 45, color: '#10B981', description: 'Crucial for Lucene inverted index segment caching' },
        { label: 'OS & Network Buffers', sizeGb: +(ram * 0.05).toFixed(2), percentage: 5, color: '#6366F1', description: 'Kernel networking' },
      ],
      keyParameters: [
        { param: 'bootstrap.memory_lock', value: 'true', defaultVal: 'false', category: 'memory', explanation: 'Locks JVM heap in RAM using mlockall to prevent swapping to disk.' },
      ],
      expertTips: [
        'Set jvm.options: -Xms' + heapGb + 'g -Xmx' + heapGb + 'g for equal initial and maximum heap.',
        'Ensure vm.max_map_count is set to at least 262144 in /etc/sysctl.conf.',
      ],
    };
  }

  private tuneOracle(req: ConfigTuningRequest, meta: any, ram: number, cores: number, conns: number, storage: string, workload: string): ConfigTuningResult {
    const sgaGb = +(ram * 0.60).toFixed(2);
    const pgaGb = +(ram * 0.20).toFixed(2);
    const processes = Math.max(100, Math.floor(conns * 1.2));
    const sessions = Math.floor(processes * 1.5 + 24);

    const config = `# =========================================================================
# SQLPulse Production Config Auto-Tuner: Oracle Database 19c/21c/23c
# Hardware: ${ram} GB RAM | ${cores} vCPUs | ${storage.toUpperCase()} Storage | ${workload.toUpperCase()}
# File: init.ora / spfile
# =========================================================================

*.db_name='PROD'
*.memory_target=0
*.sga_target=${Math.floor(sgaGb * 1024)}M
*.pga_aggregate_target=${Math.floor(pgaGb * 1024)}M
*.processes=${processes}
*.sessions=${sessions}
*.open_cursors=1000
*.db_block_size=8192
*.filesystemio_options=SETALL
*.disk_asynch_io=TRUE
*.db_writer_processes=${Math.min(8, Math.max(2, Math.floor(cores / 4)))}
*.parallel_max_servers=${cores * 4}
*.cursor_sharing=EXACT
*.undo_management=AUTO
*.undo_retention=10800
`;

    return {
      engine: meta.id,
      engineName: meta.name,
      configFileName: 'init.ora',
      generatedConfigText: config,
      sysctlConfigText: this.generateSysctl(ram, cores, conns),
      limitsConfigText: this.generateLimits(),
      ramAllocation: [
        { label: 'System Global Area (SGA)', sizeGb: sgaGb, percentage: 60, color: '#DC2626', description: 'Buffer Cache, Shared Pool, Redo Log Buffer' },
        { label: 'Program Global Area (PGA)', sizeGb: pgaGb, percentage: 20, color: '#F59E0B', description: 'Workareas for Sorting, Hashing, and Bitmap Operations' },
        { label: 'Linux OS Kernel & Filesystem', sizeGb: +(ram * 0.20).toFixed(2), percentage: 20, color: '#10B981', description: 'HugePages and OS processes' },
      ],
      keyParameters: [
        { param: 'sga_target', value: `${Math.floor(sgaGb * 1024)}M`, defaultVal: 'auto', category: 'memory', explanation: 'Total shared memory pool for data blocks, SQL parse tree cache, and redo buffer.' },
        { param: 'pga_aggregate_target', value: `${Math.floor(pgaGb * 1024)}M`, defaultVal: 'auto', category: 'memory', explanation: 'Target memory allocated to session work areas for sorting and hash joins.' },
        { param: 'filesystemio_options', value: 'SETALL', defaultVal: 'NONE', category: 'io', explanation: 'Enables asynchronous I/O and direct I/O simultaneously for optimal NVMe throughput.' },
      ],
      expertTips: [
        'Configure Linux HugePages in `/etc/security/limits.conf` to eliminate TLB cache overhead for SGA allocations larger than 16GB.',
        'Set `filesystemio_options = SETALL` on Linux systems using Ext4/XFS filesystems.',
      ],
    };
  }

  private tuneSqlServer(req: ConfigTuningRequest, meta: any, ram: number, cores: number, conns: number, storage: string, workload: string): ConfigTuningResult {
    const maxServerMemoryMb = Math.floor(ram * 1024 * 0.80);
    const minServerMemoryMb = Math.floor(ram * 1024 * 0.25);
    const maxdop = Math.min(8, cores);
    const costThreshold = 50;

    const config = `-- =========================================================================
-- SQLPulse Production Config Auto-Tuner: Microsoft SQL Server
-- Hardware: ${ram} GB RAM | ${cores} vCPUs | ${storage.toUpperCase()} Storage | ${workload.toUpperCase()}
-- =========================================================================

EXEC sys.sp_configure N'show advanced options', 1;
RECONFIGURE WITH OVERRIDE;
GO

-- 1. Buffer Pool Memory Caps (Preventing OS starvation)
EXEC sys.sp_configure N'max server memory (MB)', ${maxServerMemoryMb};
EXEC sys.sp_configure N'min server memory (MB)', ${minServerMemoryMb};
GO

-- 2. Parallelism Sizing
EXEC sys.sp_configure N'max degree of parallelism', ${maxdop};
EXEC sys.sp_configure N'cost threshold for parallelism', ${costThreshold};
GO

-- 3. Optimization Flags
EXEC sys.sp_configure N'optimize for ad hoc workloads', 1;
RECONFIGURE WITH OVERRIDE;
GO

-- 4. TempDB Sizing (Best Practice: 1 data file per CPU core up to 8)
-- Check ALTER DATABASE tempdb ADD FILE syntax for multi-file striped tempdb.
`;

    return {
      engine: meta.id,
      engineName: meta.name,
      configFileName: 'sqlserver_tuning.sql',
      generatedConfigText: config,
      sysctlConfigText: this.generateSysctl(ram, cores, conns),
      limitsConfigText: this.generateLimits(),
      ramAllocation: [
        { label: 'SQL Server Buffer Pool', sizeGb: +(ram * 0.80).toFixed(2), percentage: 80, color: '#2563EB', description: 'Data pages, execution plan cache, and sort/hash memory' },
        { label: 'OS & Thread Stack Overhead', sizeGb: +(ram * 0.20).toFixed(2), percentage: 20, color: '#10B981', description: 'Windows/Linux OS, CLR, thread stacks' },
      ],
      keyParameters: [
        { param: 'max server memory (MB)', value: `${maxServerMemoryMb}`, defaultVal: '2147483647', category: 'memory', explanation: 'Upper bound on SQL Server buffer pool to prevent OS paging.' },
        { param: 'cost threshold for parallelism', value: `${costThreshold}`, defaultVal: '5', category: 'cpu', explanation: 'Raises query cost threshold before SQL Server spawns parallel thread trees.' },
        { param: 'max degree of parallelism', value: `${maxdop}`, defaultVal: '0', category: 'cpu', explanation: 'Caps MAXDOP to avoid CXPACKET thread coordination stalls.' },
      ],
      expertTips: [
        'Set `optimize for ad hoc workloads = 1` to cache compiled plan stubs instead of full query plans on initial executions.',
        'Grant the SQL Server Service Account `Perform Volume Maintenance Tasks` (Lock Pages in Memory - LPIM).',
      ],
    };
  }

  private tuneSQLite(req: ConfigTuningRequest, meta: any, ram: number, cores: number, conns: number, storage: string, workload: string): ConfigTuningResult {
    const cacheSizeKb = Math.floor(ram * 1024 * 0.40 * 1024);
    const mmapSizeMb = Math.min(2147483647, Math.floor(ram * 1024 * 0.50));

    const config = `-- =========================================================================
-- SQLPulse Production Config Auto-Tuner: SQLite 3
-- Hardware: ${ram} GB RAM | ${cores} vCPUs | ${storage.toUpperCase()} Storage | ${workload.toUpperCase()}
-- =========================================================================

-- 1. Enable Write-Ahead Logging (Non-blocking concurrent readers + single writer)
PRAGMA journal_mode = WAL;

-- 2. Relax Disk Sync in WAL Mode (Safe from corruption, high write throughput)
PRAGMA synchronous = NORMAL;

-- 3. Dedicated Page Cache Allocation in RAM (-kibibytes)
PRAGMA cache_size = -${cacheSizeKb};

-- 4. Memory-Mapped I/O Allocation
PRAGMA mmap_size = ${mmapSizeMb * 1024 * 1024};

-- 5. In-Memory Temporary Storage for Sorts & Indexes
PRAGMA temp_store = MEMORY;

-- 6. Enforce Referential Integrity & Optimization
PRAGMA foreign_keys = ON;
PRAGMA page_size = 4096;
PRAGMA busy_timeout = 5000;
`;

    return {
      engine: meta.id,
      engineName: meta.name,
      configFileName: 'sqlite_tuning.sql',
      generatedConfigText: config,
      sysctlConfigText: this.generateSysctl(ram, cores, conns),
      limitsConfigText: this.generateLimits(),
      ramAllocation: [
        { label: 'SQLite Page Cache & WAL Pool', sizeGb: +(ram * 0.40).toFixed(2), percentage: 40, color: '#0EA5E9', description: 'In-memory B-Tree pages' },
        { label: 'OS Page Cache & mmap Space', sizeGb: +(ram * 0.50).toFixed(2), percentage: 50, color: '#10B981', description: 'Zero-copy kernel file mapping' },
        { label: 'Application & Process Memory', sizeGb: +(ram * 0.10).toFixed(2), percentage: 10, color: '#F59E0B', description: 'Process runtime and memory temporary store' },
      ],
      keyParameters: [
        { param: 'PRAGMA journal_mode', value: 'WAL', defaultVal: 'DELETE', category: 'io', explanation: 'Allows concurrent read operations without waiting on active transaction writers.' },
        { param: 'PRAGMA synchronous', value: 'NORMAL', defaultVal: 'FULL', category: 'io', explanation: 'Avoids excessive fsync calls in WAL mode while remaining ACID safe.' },
        { param: 'PRAGMA cache_size', value: `-${cacheSizeKb}`, defaultVal: '-2000', category: 'memory', explanation: 'Increases page cache allocation to retain active hot indexes in RAM.' },
      ],
      expertTips: [
        'Always set `PRAGMA synchronous = NORMAL;` when using WAL mode for a 3-5x write throughput improvement.',
        'Use `PRAGMA busy_timeout = 5000;` to gracefully wait on file locks instead of immediately failing with `SQLITE_BUSY`.',
      ],
    };
  }

  private tuneUniversal(req: ConfigTuningRequest, meta: any, ram: number, cores: number, conns: number, storage: string, workload: string): ConfigTuningResult {
    const memoryPoolGb = +(ram * 0.65).toFixed(2);

    const config = `# =========================================================================
# SQLPulse Production Config Auto-Tuner: ${meta.name} (${meta.categoryLabel})
# Rank #${meta.rank || 999} on DB-Engines
# Hardware: ${ram} GB RAM | ${cores} vCPUs | ${storage.toUpperCase()} Storage | ${workload.toUpperCase()}
# =========================================================================

# Sizing Matrix Config for ${meta.name}
max_connections = ${conns}
memory_cache_size = ${Math.floor(memoryPoolGb * 1024)}MB
worker_threads = ${cores}
io_concurrency = ${storage === 'nvme_ssd' ? 256 : 32}
enable_query_cache = true
slow_query_log_ms = 250
`;

    return {
      engine: meta.id,
      engineName: meta.name,
      configFileName: `${meta.id.toLowerCase()}.conf`,
      generatedConfigText: config,
      sysctlConfigText: this.generateSysctl(ram, cores, conns),
      limitsConfigText: this.generateLimits(),
      ramAllocation: [
        { label: `${meta.name} Cache & Buffer Pool`, sizeGb: memoryPoolGb, percentage: 65, color: '#8B5CF6', description: 'Engine working memory and index buffers' },
        { label: 'OS Kernel & File Buffers', sizeGb: +(ram * 0.25).toFixed(2), percentage: 25, color: '#10B981', description: 'Linux filesystem cache' },
        { label: 'Connection & Network Overhead', sizeGb: +(ram * 0.10).toFixed(2), percentage: 10, color: '#F59E0B', description: 'Socket buffers and thread stacks' },
      ],
      keyParameters: [
        { param: 'memory_cache_size', value: `${Math.floor(memoryPoolGb * 1024)}MB`, defaultVal: 'auto', category: 'memory', explanation: `Primary memory budget for ${meta.name}.` },
        { param: 'worker_threads', value: `${cores}`, defaultVal: 'auto', category: 'cpu', explanation: 'Concurrency worker threads bound to CPU cores.' },
      ],
      expertTips: [
        `Tune file system mount options with 'noatime' and format with XFS or Ext4 for ${meta.name}.`,
        `Run periodic backup verifications and monitor memory limits under peak ${workload} workloads.`,
      ],
    };
  }

  private generateSysctl(ramGb: number, cores: number, conns: number, isRedis = false): string {
    return `# =========================================================================
# /etc/sysctl.conf — Production Database Kernel Parameters
# Hardware: ${ramGb} GB RAM | ${cores} Cores | ${conns} Max Connections
# Apply with: sudo sysctl -p
# =========================================================================

# --- VIRTUAL MEMORY TUNING ---
vm.swappiness = 10                                # Aggressively avoid swapping active DB pages
vm.dirty_background_ratio = 3                     # Start background flushing when dirty pages reach 3%
vm.dirty_ratio = 10                               # Force synchronous flush when dirty pages reach 10%
vm.dirty_expire_centisecs = 500                   # Flush dirty memory every 5 seconds
vm.max_map_count = 262144                         # Required for high mmap instances (ES/Mongo/Postgres)
${isRedis ? 'vm.overcommit_memory = 1                         # Required for non-blocking Redis BGSAVE forks' : 'vm.overcommit_memory = 2\nvm.overcommit_ratio = 80'}

# --- NETWORK SOCKET & CONNECTION SCALING ---
net.core.somaxconn = 65535                        # Maximum TCP connection backlog listen queue
net.core.netdev_max_backlog = 10000
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.tcp_tw_reuse = 1                         # Fast reuse of TIME_WAIT sockets for DB clients
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_intvl = 15
net.ipv4.tcp_keepalive_probes = 5

# --- TCP BUFFER SIZING FOR HIGH BANDWIDTH ---
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216

# --- FILE SYSTEM DESCRIPTORS ---
fs.file-max = 2097152
`;
  }

  private generateLimits(): string {
    return `# /etc/security/limits.d/99-database.conf
*          soft    nofile     1048576
*          hard    nofile     1048576
*          soft    nproc      65536
*          hard    nproc      65536
*          soft    memlock    unlimited
*          hard    memlock    unlimited
`;
  }
}
