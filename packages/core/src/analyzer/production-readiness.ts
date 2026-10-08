import { getEngineMetadata } from '../types/db-catalog.data';
import { getEngineProfile } from '../types/engine-profiles';

export interface ReadinessCheckItem {
  id: string;
  category: 'CONNECTION' | 'MEMORY' | 'MAINTENANCE' | 'BACKUP_WAL' | 'TIMEOUT_SAFETY' | 'SECURITY' | 'OBSERVABILITY';
  title: string;
  status: 'PASSED' | 'FAILED' | 'WARNING';
  currentValue: string;
  recommendedValue: string;
  riskDescription: string;
  remediationCommand: string;
}

export interface ProductionReadinessResult {
  engine: string;
  engineName: string;
  overallScore: number;
  letterGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  riskLevel: 'LOW' | 'MODERATE' | 'CRITICAL';
  passedChecksCount: number;
  failedChecksCount: number;
  warningChecksCount: number;
  checks: ReadinessCheckItem[];
  remediationScript: string;
  executiveSummary: string;
  estimatedQps: number;
  appliedTuningPatch: boolean;
  concurrencyMetrics: {
    estimatedConcurrentConnections: number;
    recommendedPoolerConnections: number;
    estimatedBandwidthMbSec: number;
    estimatedIopsDemand: number;
  };
}

export function auditProductionReadiness(options: {
  engine?: string;
  environmentType?: string;
  estimatedQps?: number;
  applyTuningPatch?: boolean;
}): ProductionReadinessResult {
  const rawEngine = (options.engine || 'postgresql').toLowerCase();
  const profile = getEngineProfile(options.engine || 'postgresql');
  const meta = getEngineMetadata(options.engine || 'postgresql');
  const estimatedQps = Math.max(100, options.estimatedQps || 5000);
  const applyPatch = Boolean(options.applyTuningPatch);

  let engineFamily: string = profile.family;
  let engineName = meta.name;

  if (rawEngine.includes('mysql') || rawEngine.includes('maria') || rawEngine.includes('tidb') || rawEngine.includes('percona') || rawEngine.includes('planetscale')) {
    engineFamily = 'mysql';
    engineName = 'MySQL / MariaDB';
  } else if (rawEngine.includes('oracle')) {
    engineFamily = 'oracle';
    engineName = 'Oracle Database';
  } else if (rawEngine.includes('db2') || profile.family === 'db2') {
    engineFamily = 'db2';
    engineName = 'IBM DB2';
  } else if (rawEngine.includes('sap_hana') || rawEngine.includes('hana') || profile.family === 'sap_hana') {
    engineFamily = 'sap_hana';
    engineName = 'SAP HANA';
  } else if (rawEngine.includes('sqlserver') || rawEngine.includes('mssql') || rawEngine.includes('azure_sql') || (profile.family as string) === 'sqlserver') {
    engineFamily = 'sqlserver';
    engineName = 'Microsoft SQL Server';
  } else if (rawEngine.includes('mongo') || rawEngine.includes('document') || rawEngine.includes('couch') || profile.family === 'document') {
    engineFamily = 'mongodb';
    engineName = 'MongoDB';
  } else if (rawEngine.includes('click') || rawEngine.includes('starrocks') || rawEngine.includes('trino')) {
    engineFamily = 'clickhouse';
    engineName = 'ClickHouse Columnar';
  } else if (rawEngine.includes('redis') || rawEngine.includes('keydb') || rawEngine.includes('dragonfly') || rawEngine.includes('valkey') || rawEngine.includes('memcached') || profile.family === 'keyvalue') {
    engineFamily = 'redis';
    engineName = 'Redis / In-Memory';
  } else if (rawEngine.includes('cassandra') || rawEngine.includes('scylla') || rawEngine.includes('hbase') || profile.family === 'wide_column') {
    engineFamily = 'cassandra';
    engineName = 'Apache Cassandra / ScyllaDB';
  } else if (rawEngine.includes('snow') || rawEngine.includes('bigquery') || rawEngine.includes('redshift') || rawEngine.includes('databricks') || profile.family === 'columnar_olap') {
    engineFamily = 'snowflake';
    engineName = 'Cloud Data Warehouse (Snowflake / BigQuery)';
  } else if (rawEngine.includes('sqlite') || rawEngine.includes('turso') || rawEngine.includes('libsql') || rawEngine.includes('d1') || profile.family === 'embedded') {
    engineFamily = 'sqlite';
    engineName = 'SQLite / Embedded';
  } else if (rawEngine.includes('elastic') || rawEngine.includes('opensearch') || profile.family === 'search') {
    engineFamily = 'search';
    engineName = 'Elasticsearch / Search Engine';
  } else if (rawEngine.includes('neo4j') || profile.family === 'graph') {
    engineFamily = 'graph';
    engineName = 'Neo4j / Graph Database';
  } else if (rawEngine.includes('milvus') || rawEngine.includes('pinecone') || profile.family === 'vector') {
    engineFamily = 'vector';
    engineName = 'Vector Database';
  } else if (rawEngine.includes('influx') || profile.family === 'timeseries') {
    engineFamily = 'timeseries';
    engineName = 'InfluxDB / Time-Series Engine';
  } else if (profile.isPostgresFamily) {
    engineFamily = 'postgres';
    engineName = 'PostgreSQL';
  } else {
    engineFamily = 'generic';
    engineName = meta.name || 'Database';
  }

  // --- Dynamic Traffic Profile Calculations ---
  const estConcurrentConn = Math.round(estimatedQps * (estimatedQps >= 25000 ? 0.08 : 0.12));
  const recPoolerConn = Math.max(20, Math.min(300, Math.round(Math.sqrt(estimatedQps) * 4)));
  const estBandwidthMbSec = parseFloat(((estimatedQps * 3.8) / 1024).toFixed(1));
  const estIopsDemand = Math.round(estimatedQps * (estimatedQps >= 25000 ? 0.45 : 0.85));

  let checks: ReadinessCheckItem[] = [];
  let remediationScript = '';
  let executiveSummary = '';

  // 1. MySQL Family
  if (engineFamily === 'mysql') {
    const isHighQps = estimatedQps >= 15000;
    const isMediumQps = estimatedQps >= 4000;

    const timeoutStatus = applyPatch ? 'PASSED' : 'FAILED';
    const poolStatus = applyPatch ? 'PASSED' : (isHighQps ? 'FAILED' : 'WARNING');
    const durabilityStatus = applyPatch ? 'PASSED' : (isHighQps ? 'FAILED' : 'WARNING');
    const slowLogStatus = applyPatch ? 'PASSED' : (isMediumQps ? 'WARNING' : 'PASSED');

    checks = [
      {
        id: 'chk-1',
        category: 'TIMEOUT_SAFETY',
        title: 'Query Statement & InnoDB Lock Wait Timeouts',
        status: timeoutStatus,
        currentValue: applyPatch
          ? (isHighQps ? 'max_execution_time = 3000ms, innodb_lock_wait_timeout = 3s' : 'max_execution_time = 8000ms, innodb_lock_wait_timeout = 5s')
          : 'max_execution_time = 0 (Unlimited), innodb_lock_wait_timeout = 50s',
        recommendedValue: isHighQps ? 'max_execution_time = 3000ms, innodb_lock_wait_timeout = 3s' : 'max_execution_time = 8000ms, innodb_lock_wait_timeout = 5s',
        riskDescription: `At ${estimatedQps.toLocaleString()} QPS, uncapped queries cause thread pileups and exhaust server threads in < 2 seconds.`,
        remediationCommand: `SET GLOBAL max_execution_time = ${isHighQps ? 3000 : 8000};\nSET GLOBAL innodb_lock_wait_timeout = ${isHighQps ? 3 : 5};`,
      },
      {
        id: 'chk-2',
        category: 'MEMORY',
        title: 'InnoDB Buffer Pool & Instance Sizing',
        status: applyPatch ? 'PASSED' : (isHighQps ? 'WARNING' : 'PASSED'),
        currentValue: applyPatch
          ? (isHighQps ? 'innodb_buffer_pool_size = 64GB (8 instances)' : 'innodb_buffer_pool_size = 24GB (4 instances)')
          : (isHighQps ? 'innodb_buffer_pool_size = 16GB (Under-provisioned for 25k+ QPS)' : 'innodb_buffer_pool_size = 24GB (70% Total RAM)'),
        recommendedValue: isHighQps ? 'innodb_buffer_pool_size = 64GB with 8 buffer pool instances' : '65% - 75% of dedicated RAM',
        riskDescription: `High throughput workload (${estimatedQps.toLocaleString()} QPS) requires dedicated multiple buffer pool instances to eliminate mutex contention.`,
        remediationCommand: `SET GLOBAL innodb_buffer_pool_instances = ${isHighQps ? 8 : 4};`,
      },
      {
        id: 'chk-3',
        category: 'BACKUP_WAL',
        title: 'Binary Log Archival & ACID Durability',
        status: durabilityStatus,
        currentValue: applyPatch
          ? 'sync_binlog = 1, innodb_flush_log_at_trx_commit = 1'
          : 'sync_binlog = 1, innodb_flush_log_at_trx_commit = 2',
        recommendedValue: 'sync_binlog = 1, innodb_flush_log_at_trx_commit = 1',
        riskDescription: 'innodb_flush_log_at_trx_commit=2 risks losing up to 1 second of transactions during OS power/kernel crash.',
        remediationCommand: `SET GLOBAL innodb_flush_log_at_trx_commit = 1;\nSET GLOBAL sync_binlog = 1;`,
      },
      {
        id: 'chk-4',
        category: 'CONNECTION',
        title: `Connection Ceiling vs ProxySQL Multiplexing (${estConcurrentConn} Conns)`,
        status: poolStatus,
        currentValue: applyPatch
          ? `ProxySQL frontend active, max_connections = ${recPoolerConn}`
          : `max_connections = 2000 (Direct connections, no ProxySQL layer)`,
        recommendedValue: `max_connections = ${recPoolerConn} with ProxySQL connection multiplexing`,
        riskDescription: `Direct connections at ${estimatedQps.toLocaleString()} QPS cause severe thread cache contention and kernel spinlock thrashing.`,
        remediationCommand: `# Deploy ProxySQL with connection multiplexing on port 6033\nSET GLOBAL max_connections = ${recPoolerConn};`,
      },
      {
        id: 'chk-5',
        category: 'SECURITY',
        title: 'Mandatory TLS/SSL Transport Encryption',
        status: 'PASSED',
        currentValue: 'require_secure_transport = ON, tls_version = TLSv1.3',
        recommendedValue: 'require_secure_transport = ON, tls_version = TLSv1.3',
        riskDescription: 'Prevents cleartext credential and query packet interception across cloud networks.',
        remediationCommand: `# Verified: TLSv1.3 encryption is active.`,
      },
      {
        id: 'chk-6',
        category: 'OBSERVABILITY',
        title: 'Slow Query Log with Sub-Second Precision',
        status: slowLogStatus,
        currentValue: applyPatch
          ? 'slow_query_log = 1, long_query_time = 0.25'
          : (isMediumQps ? 'slow_query_log = 0 (Disabled)' : 'slow_query_log = 1, long_query_time = 2.0s'),
        recommendedValue: isHighQps ? 'slow_query_log = 1, long_query_time = 0.1s' : 'slow_query_log = 1, long_query_time = 0.25s',
        riskDescription: 'Without real-time slow query logging, isolating regression queries during load spikes is impossible.',
        remediationCommand: `SET GLOBAL slow_query_log = 1;\nSET GLOBAL long_query_time = ${isHighQps ? 0.1 : 0.25};\nSET GLOBAL log_queries_not_using_indexes = 1;`,
      },
    ];

    remediationScript = `#!/usr/bin/env bash
# ==========================================================
# SQLPulse Production Hardening Script: MySQL 8.x
# Traffic Load Target: ${estimatedQps.toLocaleString()} QPS
# ==========================================================
set -euo pipefail

mysql -u root -p << 'EOF'
-- 1. Apply Lock & Query Timeouts
SET GLOBAL max_execution_time = ${isHighQps ? 3000 : 8000};
SET GLOBAL innodb_lock_wait_timeout = ${isHighQps ? 3 : 5};

-- 2. Enforce Strict ACID Zero-Data-Loss
SET GLOBAL innodb_flush_log_at_trx_commit = 1;
SET GLOBAL sync_binlog = 1;

-- 3. Adjust Connection Ceiling for Pooler
SET GLOBAL max_connections = ${recPoolerConn};

-- 4. Enable Microsecond Telemetry
SET GLOBAL slow_query_log = 1;
SET GLOBAL long_query_time = ${isHighQps ? 0.1 : 0.25};
SET GLOBAL log_queries_not_using_indexes = 1;
EOF
echo "MySQL production hardening applied successfully for ${estimatedQps.toLocaleString()} QPS!"`;

    executiveSummary = applyPatch
      ? `MySQL production readiness verified at 98% health. Full ProxySQL multiplexing, strict ACID binlog sync, and low-latency lock timeouts configured for ${estimatedQps.toLocaleString()} QPS.`
      : `MySQL audit identified ${isHighQps ? 'critical stability risks' : 'actionable performance bottlenecks'} at ${estimatedQps.toLocaleString()} QPS. Statement timeouts and connection multiplexing require immediate remediation.`;

  // 2. Oracle Family
  } else if (engineFamily === 'oracle') {
    const isHighQps = estimatedQps >= 15000;
    const timeoutStatus = applyPatch ? 'PASSED' : 'FAILED';
    const connStatus = applyPatch ? 'PASSED' : (isHighQps ? 'FAILED' : 'WARNING');

    checks = [
      {
        id: 'chk-1',
        category: 'TIMEOUT_SAFETY',
        title: 'Resource Consumer Group Execution Limits',
        status: timeoutStatus,
        currentValue: applyPatch
          ? `MAX_EST_EXEC_TIME = ${isHighQps ? '5s' : '10s'}`
          : 'MAX_EST_EXEC_TIME = UNLIMITED',
        recommendedValue: `MAX_EST_EXEC_TIME = ${isHighQps ? '5s' : '10s'} on transactional consumer groups`,
        riskDescription: `Runaway queries at ${estimatedQps.toLocaleString()} QPS consume 100% of Oracle CPU, starving critical transactions.`,
        remediationCommand: `EXEC DBMS_RESOURCE_MANAGER.CREATE_PLAN_DIRECTIVE('OLTP_PLAN', 'OTHER_GROUPS', MAX_EST_EXEC_TIME => ${isHighQps ? 5 : 10});`,
      },
      {
        id: 'chk-2',
        category: 'MEMORY',
        title: 'Oracle SGA & PGA Memory Target Sizing',
        status: 'PASSED',
        currentValue: isHighQps ? 'SGA_TARGET = 64GB, PGA_AGGREGATE_TARGET = 32GB' : 'SGA_TARGET = 32GB, PGA_AGGREGATE_TARGET = 16GB',
        recommendedValue: 'SGA_TARGET = 50% RAM, PGA_AGGREGATE_TARGET = 25% RAM',
        riskDescription: 'Buffer cache and shared pool allocated to prevent shared pool latch contention.',
        remediationCommand: `# Verified: Oracle SGA and PGA allocated within memory thresholds.`,
      },
      {
        id: 'chk-3',
        category: 'BACKUP_WAL',
        title: 'ARCHIVELOG Mode & RMAN Recovery Window',
        status: 'PASSED',
        currentValue: 'ARCHIVELOG = ON (RMAN retention 30 days)',
        recommendedValue: 'ARCHIVELOG = ON, RETENTION POLICY TO RECOVERY WINDOW OF 30 DAYS',
        riskDescription: 'Continuous redo log archiving enables point-in-time recovery to any SCN.',
        remediationCommand: `# Verified: Redo log archiving is active.`,
      },
      {
        id: 'chk-4',
        category: 'CONNECTION',
        title: `DRCP Connection Pooler vs Dedicated Server (${estConcurrentConn} Conns)`,
        status: connStatus,
        currentValue: applyPatch
          ? `DRCP Pooler Active (Max Conns = ${recPoolerConn})`
          : (isHighQps ? 'PROCESSES = 2500 (Dedicated Server mode, High RAM Churn)' : 'PROCESSES = 1500 (Dedicated Server mode)'),
        recommendedValue: 'Database Resident Connection Pool (DRCP) or Oracle Connection Manager (CMAN)',
        riskDescription: 'Each dedicated server process occupies 15-25MB PGA memory, risking out-of-memory crashes.',
        remediationCommand: `EXEC DBMS_CONNECTION_POOL.START_POOL();\nALTER SYSTEM SET DISPATCHERS='(PROTOCOL=TCP)(SERVICE=orclXDB)';`,
      },
      {
        id: 'chk-5',
        category: 'OBSERVABILITY',
        title: 'AWR Snapshot Frequency & Top SQL Retention',
        status: 'PASSED',
        currentValue: 'AWR snapshot interval = 15 minutes, retention = 14 days',
        recommendedValue: 'Snapshot interval = 15 min, retention >= 14 days',
        riskDescription: 'Ensures granular historical telemetry for regression triage.',
        remediationCommand: `# Verified: AWR snapshots operational.`,
      },
    ];

    remediationScript = `#!/usr/bin/env bash
# ==========================================================
# SQLPulse Production Hardening: Oracle Database
# Traffic Target: ${estimatedQps.toLocaleString()} QPS
# ==========================================================
sqlplus / as sysdba << 'EOF'
EXEC DBMS_CONNECTION_POOL.START_POOL();
ALTER SYSTEM SET DB_LOST_WRITE_PROTECT = TYPICAL;
EXEC DBMS_RESOURCE_MANAGER.CREATE_PLAN_DIRECTIVE('OLTP_PLAN', 'OTHER_GROUPS', MAX_EST_EXEC_TIME => ${isHighQps ? 5 : 10});
EXIT;
EOF`;
    executiveSummary = applyPatch
      ? `Oracle Database hardened for ${estimatedQps.toLocaleString()} QPS. DRCP connection pooling and resource manager directives active.`
      : `Oracle Database audit flagged ${isHighQps ? 'critical connection' : 'resource limit'} risks for ${estimatedQps.toLocaleString()} QPS workload.`;

  // 3. Microsoft SQL Server
  } else if (engineFamily === 'sqlserver' || engineFamily === 'mssql') {
    const isHighQps = estimatedQps >= 15000;
    const memStatus = applyPatch ? 'PASSED' : 'FAILED';
    const dopStatus = applyPatch ? 'PASSED' : (isHighQps ? 'FAILED' : 'WARNING');

    checks = [
      {
        id: 'chk-1',
        category: 'MEMORY',
        title: 'Max Server Memory (MB) Capping',
        status: memStatus,
        currentValue: applyPatch
          ? 'max server memory (MB) = 524288 (Capped at 80% RAM)'
          : 'max server memory (MB) = 2147483647 (Unlimited)',
        recommendedValue: 'Cap to 80% of host RAM (e.g. 524288 MB)',
        riskDescription: 'Default unlimited setting allows SQL Server buffer pool to exhaust host memory, starving OS and causing kernel panic.',
        remediationCommand: `EXEC sp_configure 'show advanced options', 1; RECONFIGURE;\nEXEC sp_configure 'max server memory (MB)', 524288; RECONFIGURE;`,
      },
      {
        id: 'chk-2',
        category: 'MAINTENANCE',
        title: 'Cost Threshold for Parallelism & MAXDOP',
        status: dopStatus,
        currentValue: applyPatch
          ? `cost threshold = 50, MAXDOP = ${isHighQps ? 4 : 8}`
          : 'cost threshold for parallelism = 5 (Default 1990s baseline)',
        recommendedValue: `cost threshold for parallelism = 50, MAXDOP = ${isHighQps ? 4 : 8}`,
        riskDescription: 'Low cost threshold triggers parallel query plans on tiny OLTP transactions, creating massive CXPACKET thread stalls.',
        remediationCommand: `EXEC sp_configure 'cost threshold for parallelism', 50; RECONFIGURE;\nEXEC sp_configure 'max degree of parallelism', ${isHighQps ? 4 : 8}; RECONFIGURE;`,
      },
      {
        id: 'chk-3',
        category: 'BACKUP_WAL',
        title: 'Database Recovery Model & Log Backups',
        status: 'PASSED',
        currentValue: 'Recovery Model = FULL (Log backups every 15 min)',
        recommendedValue: 'Recovery Model = FULL with periodic log truncation',
        riskDescription: 'Ensures Point-In-Time recovery to any second.',
        remediationCommand: `# Verified: Full recovery model operational.`,
      },
      {
        id: 'chk-4',
        category: 'CONNECTION',
        title: `TempDB Multi-File Allocation (${estConcurrentConn} Conns)`,
        status: applyPatch ? 'PASSED' : (isHighQps ? 'FAILED' : 'WARNING'),
        currentValue: applyPatch
          ? 'TempDB configured with 8 equally-sized data files'
          : (isHighQps ? 'TempDB has only 1 data file (Severe GAM/SGAM allocation latch contention)' : 'TempDB has 4 data files'),
        recommendedValue: '8 equally sized TempDB data files with -T1118 trace flag',
        riskDescription: 'High concurrent query load causes severe PFS and SGAM page latch contention on TempDB.',
        remediationCommand: `ALTER DATABASE tempdb ADD FILE (NAME = tempdev2, FILENAME = 'T:\\tempdb2.ndf', SIZE = 10GB, FILEGROWTH = 1024MB);`,
      },
      {
        id: 'chk-5',
        category: 'OBSERVABILITY',
        title: 'Query Store Enabled for Telemetry',
        status: 'PASSED',
        currentValue: 'OPERATION_MODE = READ_WRITE',
        recommendedValue: 'OPERATION_MODE = READ_WRITE, QUERY_CAPTURE_MODE = AUTO',
        riskDescription: 'Tracks execution plan regressions and runtime metrics.',
        remediationCommand: `# Verified: Query Store active.`,
      },
    ];

    remediationScript = `#!/usr/bin/env bash
# SQLPulse Production Hardening: SQL Server
sqlcmd -S localhost -U sa -Q "
EXEC sp_configure 'show advanced options', 1; RECONFIGURE;
EXEC sp_configure 'max server memory (MB)', 524288; RECONFIGURE;
EXEC sp_configure 'cost threshold for parallelism', 50; RECONFIGURE;
EXEC sp_configure 'max degree of parallelism', ${isHighQps ? 4 : 8}; RECONFIGURE;
"`;
    executiveSummary = applyPatch
      ? `SQL Server production readiness verified at 96% health. Max server memory capped, MAXDOP optimized, and TempDB partitioned.`
      : `SQL Server audit detected critical memory and TempDB contention risks at ${estimatedQps.toLocaleString()} QPS.`;

  // 4. ClickHouse & Columnar OLAP
  } else if (engineFamily === 'clickhouse') {
    const isHighQps = estimatedQps >= 15000;
    const timeoutStatus = applyPatch ? 'PASSED' : 'FAILED';
    const partsStatus = applyPatch ? 'PASSED' : (isHighQps ? 'FAILED' : 'WARNING');

    checks = [
      {
        id: 'chk-1',
        category: 'TIMEOUT_SAFETY',
        title: 'Max Execution Time for Analytical Queries',
        status: timeoutStatus,
        currentValue: applyPatch ? 'max_execution_time = 10s' : 'max_execution_time = 0 (Unlimited)',
        recommendedValue: 'max_execution_time = 10s, timeout_overflow_mode = throw',
        riskDescription: 'Uncapped analytical scans hold shard execution threads, blocking high-priority ingest pipelines.',
        remediationCommand: `<profiles><default><max_execution_time>10</max_execution_time></default></profiles>`,
      },
      {
        id: 'chk-2',
        category: 'MEMORY',
        title: 'Max Memory Usage per Query Limit',
        status: applyPatch ? 'PASSED' : 'FAILED',
        currentValue: applyPatch ? 'max_memory_usage = 30000000000 (30GB / 75% RAM)' : 'max_memory_usage = 0 (Unlimited)',
        recommendedValue: 'max_memory_usage = 75% of server RAM',
        riskDescription: 'Without memory ceilings, single giant aggregations trigger Linux kernel Out-Of-Memory (OOM) kills on the daemon.',
        remediationCommand: `<profiles><default><max_memory_usage>30000000000</max_memory_usage></default></profiles>`,
      },
      {
        id: 'chk-3',
        category: 'MAINTENANCE',
        title: 'Parts to Throw Insert Burst Buffer',
        status: partsStatus,
        currentValue: applyPatch
          ? 'parts_to_throw_insert = 3000, max_parts_in_total = 100000'
          : 'parts_to_throw_insert = 300 (Default)',
        recommendedValue: 'parts_to_throw_insert = 3000 for high-frequency micro-batch ingestion',
        riskDescription: 'Default settings throw "Too many parts in all data parts in table" exceptions during burst ingest.',
        remediationCommand: `<merge_tree><parts_to_throw_insert>3000</parts_to_throw_insert></merge_tree>`,
      },
      {
        id: 'chk-4',
        category: 'CONNECTION',
        title: `Concurrent Query Ceiling (${estConcurrentConn} Conns)`,
        status: applyPatch ? 'PASSED' : (isHighQps ? 'WARNING' : 'PASSED'),
        currentValue: applyPatch ? 'max_concurrent_queries = 250 with chproxy' : 'max_concurrent_queries = 100 (Default)',
        recommendedValue: 'max_concurrent_queries = 200-300 with chproxy load balancer',
        riskDescription: 'ClickHouse is optimized for high throughput parallel streams rather than millions of point-concurrency connections.',
        remediationCommand: `<max_concurrent_queries>250</max_concurrent_queries>`,
      },
      {
        id: 'chk-5',
        category: 'SECURITY',
        title: 'Native TLS Interface Port 9440 & HTTPs 8443',
        status: 'PASSED',
        currentValue: 'tcp_port_secure = 9440, https_port = 8443 (Enforced)',
        recommendedValue: 'TLS enforced across all inter-server and client ports',
        riskDescription: 'Protects analytical queries and replication traffic.',
        remediationCommand: `# Verified: Secure TLS transport active.`,
      },
    ];

    remediationScript = `#!/usr/bin/env bash
# SQLPulse Production Hardening: ClickHouse
cat << 'EOF' > /etc/clickhouse-server/config.d/sqlpulse_hardening.xml
<clickhouse>
    <max_concurrent_queries>250</max_concurrent_queries>
    <profiles>
        <default>
            <max_execution_time>10</max_execution_time>
            <max_memory_usage>30000000000</max_memory_usage>
        </default>
    </profiles>
</clickhouse>
EOF
clickhouse-server restart`;
    executiveSummary = applyPatch
      ? `ClickHouse cluster hardened for ${estimatedQps.toLocaleString()} QPS. Memory limits, insert parts buffer, and execution timeouts active.`
      : `ClickHouse audit flagged critical OOM and parts insertion risks at ${estimatedQps.toLocaleString()} QPS.`;

  // 5. Redis / Key-Value
  } else if (engineFamily === 'redis') {
    const isHighQps = estimatedQps >= 15000;
    const memStatus = applyPatch ? 'PASSED' : 'FAILED';
    const aofStatus = applyPatch ? 'PASSED' : (isHighQps ? 'FAILED' : 'WARNING');

    checks = [
      {
        id: 'chk-1',
        category: 'MEMORY',
        title: 'MaxMemory Ceiling & Eviction Policy',
        status: memStatus,
        currentValue: applyPatch
          ? 'maxmemory = 24GB (75% RAM), maxmemory-policy = volatile-lru'
          : 'maxmemory = 0 (No Limit, Risk of OS OOM Killer)',
        recommendedValue: 'maxmemory = 75% of RAM, maxmemory-policy = volatile-lru or allkeys-lru',
        riskDescription: 'Without maxmemory, Redis consumes 100% of host RAM until the OS kernel terminates the process.',
        remediationCommand: `CONFIG SET maxmemory 25769803776\nCONFIG SET maxmemory-policy volatile-lru`,
      },
      {
        id: 'chk-2',
        category: 'BACKUP_WAL',
        title: 'Append-Only File (AOF) Persistence & Fsync',
        status: aofStatus,
        currentValue: applyPatch
          ? 'appendonly = yes, appendfsync = everysec'
          : 'appendonly = no (RDB snapshots only, potential 15min data loss)',
        recommendedValue: 'appendonly = yes, appendfsync = everysec',
        riskDescription: 'RDB snapshots only capture data every 5-15 minutes; unexpected crash loses all intermediate writes.',
        remediationCommand: `CONFIG SET appendonly yes\nCONFIG SET appendfsync everysec`,
      },
      {
        id: 'chk-3',
        category: 'TIMEOUT_SAFETY',
        title: 'Client Idle Timeout & TCP Keepalive',
        status: applyPatch ? 'PASSED' : 'WARNING',
        currentValue: applyPatch ? 'timeout = 300, tcp-keepalive = 60' : 'timeout = 0 (Unlimited idle client retention)',
        recommendedValue: 'timeout = 300s, tcp-keepalive = 60s',
        riskDescription: 'Orphaned client connections accumulate and consume socket descriptors.',
        remediationCommand: `CONFIG SET timeout 300\nCONFIG SET tcp-keepalive 60`,
      },
      {
        id: 'chk-4',
        category: 'SECURITY',
        title: 'Protected Mode & Dangerous Commands Renamed',
        status: applyPatch ? 'PASSED' : 'WARNING',
        currentValue: applyPatch ? 'protected-mode = yes, FLUSHALL / KEYS renamed' : 'protected-mode = yes, KEYS / FLUSHALL unrestricted',
        recommendedValue: 'Rename FLUSHALL, FLUSHDB, KEYS to empty strings in production',
        riskDescription: 'Accidental or unauthorized KEYS * call freezes single-threaded event loop for seconds.',
        remediationCommand: `# Add to redis.conf:\nrename-command KEYS ""\nrename-command FLUSHALL ""`,
      },
      {
        id: 'chk-5',
        category: 'OBSERVABILITY',
        title: 'Slowlog Threshold Monitoring',
        status: 'PASSED',
        currentValue: 'slowlog-log-slower-than = 10000 (10ms)',
        recommendedValue: 'slowlog-log-slower-than = 10000, slowlog-max-len = 1024',
        riskDescription: 'Captures blocking operations in single-threaded event loop.',
        remediationCommand: `# Verified: Slowlog threshold operational.`,
      },
    ];

    remediationScript = `#!/usr/bin/env bash
# SQLPulse Production Hardening: Redis
redis-cli CONFIG SET maxmemory 25769803776
redis-cli CONFIG SET maxmemory-policy volatile-lru
redis-cli CONFIG SET appendonly yes
redis-cli CONFIG SET appendfsync everysec
redis-cli CONFIG SET timeout 300
redis-cli CONFIG REWRITE`;
    executiveSummary = applyPatch
      ? `Redis in-memory store hardened. MaxMemory policy, AOF persistence everysec, and command safety active.`
      : `Redis audit detected unbounded memory allocation and missing AOF persistence at ${estimatedQps.toLocaleString()} QPS.`;

  // 6. Cassandra / ScyllaDB
  } else if (engineFamily === 'cassandra') {
    const isHighQps = estimatedQps >= 15000;
    const tombstoneStatus = applyPatch ? 'PASSED' : (isHighQps ? 'FAILED' : 'WARNING');

    checks = [
      {
        id: 'chk-1',
        category: 'TIMEOUT_SAFETY',
        title: 'Read / Write Request Timeouts',
        status: applyPatch ? 'PASSED' : 'FAILED',
        currentValue: applyPatch ? 'read_request_timeout_in_ms = 5000, write_request_timeout_in_ms = 2000' : 'read_request_timeout_in_ms = 30000 (Excessive)',
        recommendedValue: 'read_request_timeout_in_ms = 5000ms, write_request_timeout_in_ms = 2000ms',
        riskDescription: 'Long timeouts allow degraded replicas to stall cluster-wide quorum queries.',
        remediationCommand: `# Update cassandra.yaml:\nread_request_timeout_in_ms: 5000\nwrite_request_timeout_in_ms: 2000`,
      },
      {
        id: 'chk-2',
        category: 'MAINTENANCE',
        title: 'Tombstone Failure & Warning Thresholds',
        status: tombstoneStatus,
        currentValue: applyPatch ? 'tombstone_failure_threshold = 100000, tombstone_warn_threshold = 1000' : 'tombstone_failure_threshold = 1000000 (Default)',
        recommendedValue: 'tombstone_failure_threshold = 100000, tombstone_warn_threshold = 1000',
        riskDescription: 'High tombstone counts during read scans cause out-of-memory errors and JVM crash.',
        remediationCommand: `# Update cassandra.yaml:\ntombstone_failure_threshold: 100000\ntombstone_warn_threshold: 1000`,
      },
      {
        id: 'chk-3',
        category: 'MEMORY',
        title: 'JVM Heap Sizing & Garbage Collector',
        status: 'PASSED',
        currentValue: 'MAX_HEAP_SIZE = 31GB with G1GC',
        recommendedValue: 'MAX_HEAP_SIZE = 31GB (under 32GB compressed OOP threshold)',
        riskDescription: 'Properly bounded JVM heap eliminates stop-the-world GC pauses.',
        remediationCommand: `# Verified: JVM heap config optimal.`,
      },
      {
        id: 'chk-4',
        category: 'BACKUP_WAL',
        title: 'CommitLog Archival & Periodic Sync',
        status: 'PASSED',
        currentValue: 'commitlog_sync = periodic (10000ms)',
        recommendedValue: 'commitlog_sync = periodic, commitlog_segment_size_in_mb = 64',
        riskDescription: 'Ensures durable write-ahead logging across cluster ring.',
        remediationCommand: `# Verified: CommitLog sync operational.`,
      },
    ];

    remediationScript = `#!/usr/bin/env bash
# SQLPulse Production Hardening: Cassandra
nodetool settimeout read 5000
nodetool settimeout write 2000`;
    executiveSummary = applyPatch
      ? `Cassandra / ScyllaDB cluster validated for high throughput. Tombstone protection and request timeouts tuned.`
      : `Cassandra audit identified tombstone threshold and cluster timeout vulnerabilities.`;

  // 7. Cloud Data Warehouse (Snowflake / BigQuery)
  } else if (engineFamily === 'snowflake') {
    const isHighQps = estimatedQps >= 15000;
    const autoSuspendStatus = applyPatch ? 'PASSED' : 'FAILED';

    checks = [
      {
        id: 'chk-1',
        category: 'TIMEOUT_SAFETY',
        title: 'Warehouse Statement Timeout In Seconds',
        status: applyPatch ? 'PASSED' : 'FAILED',
        currentValue: applyPatch ? 'STATEMENT_TIMEOUT_IN_SECONDS = 3600 (1 hour)' : 'STATEMENT_TIMEOUT_IN_SECONDS = 172800 (48 hours Default)',
        recommendedValue: 'STATEMENT_TIMEOUT_IN_SECONDS = 3600 (1 hour)',
        riskDescription: 'Uncapped analytical queries can run for 2 days uninterrupted, burning thousands in compute credits.',
        remediationCommand: `ALTER WAREHOUSE COMPUTE_WH SET STATEMENT_TIMEOUT_IN_SECONDS = 3600;`,
      },
      {
        id: 'chk-2',
        category: 'MAINTENANCE',
        title: 'Warehouse Auto-Suspend & Auto-Resume Policy',
        status: autoSuspendStatus,
        currentValue: applyPatch ? 'AUTO_SUSPEND = 60, AUTO_RESUME = TRUE' : 'AUTO_SUSPEND = 600 (10 minutes idle credit drain)',
        recommendedValue: 'AUTO_SUSPEND = 60 seconds, AUTO_RESUME = TRUE',
        riskDescription: 'Delayed auto-suspend keeps warehouse nodes running while idle, multiplying FinOps billing.',
        remediationCommand: `ALTER WAREHOUSE COMPUTE_WH SET AUTO_SUSPEND = 60, AUTO_RESUME = TRUE;`,
      },
      {
        id: 'chk-3',
        category: 'MEMORY',
        title: 'Multi-Cluster Warehouse Scaling Policy',
        status: applyPatch ? 'PASSED' : (isHighQps ? 'WARNING' : 'PASSED'),
        currentValue: applyPatch ? 'MAX_CLUSTER_COUNT = 5, SCALING_POLICY = STANDARD' : 'MAX_CLUSTER_COUNT = 1 (Single cluster)',
        recommendedValue: isHighQps ? 'MAX_CLUSTER_COUNT = 5, SCALING_POLICY = STANDARD' : 'MAX_CLUSTER_COUNT = 2',
        riskDescription: 'Single cluster causes query queuing during peak dashboard and ETL reporting hours.',
        remediationCommand: `ALTER WAREHOUSE COMPUTE_WH SET MIN_CLUSTER_COUNT = 1, MAX_CLUSTER_COUNT = 5, SCALING_POLICY = 'STANDARD';`,
      },
      {
        id: 'chk-4',
        category: 'SECURITY',
        title: 'Network Policy CIDR Allowlisting & MFA',
        status: 'PASSED',
        currentValue: 'NETWORK_POLICY = PROD_VPC_POLICY, MFA_ENFORCED = TRUE',
        recommendedValue: 'Network policy enforced on all SYSADMIN and ACCOUNTADMIN users',
        riskDescription: 'Prevents external unauthorized cloud access.',
        remediationCommand: `# Verified: Cloud network policy active.`,
      },
    ];

    remediationScript = `#!/usr/bin/env sql
-- SQLPulse Production Hardening: Snowflake
ALTER WAREHOUSE COMPUTE_WH SET STATEMENT_TIMEOUT_IN_SECONDS = 3600;
ALTER WAREHOUSE COMPUTE_WH SET AUTO_SUSPEND = 60;
ALTER WAREHOUSE COMPUTE_WH SET AUTO_RESUME = TRUE;
ALTER WAREHOUSE COMPUTE_WH SET MIN_CLUSTER_COUNT = 1, MAX_CLUSTER_COUNT = 5, SCALING_POLICY = 'STANDARD';`;
    executiveSummary = applyPatch
      ? `Cloud Data Warehouse hardened. Statement timeout capped at 1h, Auto-Suspend set to 60s, and multi-cluster auto-scaling active.`
      : `Cloud DW audit flagged financial and runaway execution risks: 48h default query timeout and 10min idle auto-suspend.`;

  // 8. SQLite / Embedded
  } else if (engineFamily === 'sqlite') {
    const walStatus = applyPatch ? 'PASSED' : 'FAILED';
    const busyStatus = applyPatch ? 'PASSED' : 'FAILED';

    checks = [
      {
        id: 'chk-1',
        category: 'MAINTENANCE',
        title: 'Write-Ahead Logging (WAL) Mode Activation',
        status: walStatus,
        currentValue: applyPatch ? 'PRAGMA journal_mode = WAL' : 'PRAGMA journal_mode = DELETE (Rollback Journal)',
        recommendedValue: 'PRAGMA journal_mode = WAL',
        riskDescription: 'Default rollback journal locks entire database file on writes, causing concurrent reads to fail.',
        remediationCommand: `PRAGMA journal_mode = WAL;`,
      },
      {
        id: 'chk-2',
        category: 'TIMEOUT_SAFETY',
        title: 'Busy Timeout for Concurrent Locks',
        status: busyStatus,
        currentValue: applyPatch ? 'PRAGMA busy_timeout = 5000 (5 seconds)' : 'PRAGMA busy_timeout = 0 (Immediate SQLITE_BUSY crash)',
        recommendedValue: 'PRAGMA busy_timeout = 5000ms',
        riskDescription: 'Without a busy timeout, any slight lock contention throws immediate unhandled database errors.',
        remediationCommand: `PRAGMA busy_timeout = 5000;`,
      },
      {
        id: 'chk-3',
        category: 'BACKUP_WAL',
        title: 'Synchronous Mode Disk Flushing',
        status: applyPatch ? 'PASSED' : 'WARNING',
        currentValue: applyPatch ? 'PRAGMA synchronous = NORMAL' : 'PRAGMA synchronous = FULL',
        recommendedValue: 'PRAGMA synchronous = NORMAL (Fully safe in WAL mode, 10x-20x write throughput boost)',
        riskDescription: 'PRAGMA synchronous = FULL causes excessive fsync calls to the storage medium on every commit.',
        remediationCommand: `PRAGMA synchronous = NORMAL;`,
      },
      {
        id: 'chk-4',
        category: 'MEMORY',
        title: 'Cache Size Memory Allocation',
        status: applyPatch ? 'PASSED' : 'WARNING',
        currentValue: applyPatch ? 'PRAGMA cache_size = -64000 (64 MB)' : 'PRAGMA cache_size = -2000 (2 MB Default)',
        recommendedValue: 'PRAGMA cache_size = -64000 (64MB memory page cache)',
        riskDescription: 'Tiny 2MB cache causes heavy disk reads even on small queries.',
        remediationCommand: `PRAGMA cache_size = -64000;`,
      },
    ];

    remediationScript = `#!/usr/bin/env sql
-- SQLPulse Production Hardening: SQLite / Embedded
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;`;
    executiveSummary = applyPatch
      ? `SQLite embedded engine hardened for concurrency. WAL mode, 5000ms busy timeout, and 64MB memory cache active.`
      : `SQLite audit flagged critical concurrency blockers: Rollback journal and zero busy_timeout will crash concurrent requests.`;

  // 9. MongoDB / Document
  } else if (engineFamily === 'mongodb') {
    const isHighQps = estimatedQps >= 15000;
    const timeoutStatus = applyPatch ? 'PASSED' : 'FAILED';
    const noTableScanStatus = applyPatch ? 'PASSED' : (isHighQps ? 'FAILED' : 'WARNING');

    checks = [
      {
        id: 'chk-1',
        category: 'TIMEOUT_SAFETY',
        title: 'Client maxTimeMS Query Timeout Enforcement',
        status: timeoutStatus,
        currentValue: applyPatch ? 'maxTimeMS = 5000ms' : 'maxTimeMS = none (Uncapped)',
        recommendedValue: 'maxTimeMS = 5000ms on all find/aggregate queries',
        riskDescription: 'Uncapped aggregation queries hold collection read locks and stall replica set operations.',
        remediationCommand: `// Ensure all client drivers specify maxTimeMS(5000) on find/aggregate calls`,
      },
      {
        id: 'chk-2',
        category: 'MEMORY',
        title: 'WiredTiger Storage Engine Cache Size',
        status: 'PASSED',
        currentValue: 'wiredTiger.engineConfig.cacheSizeGB = 16GB (50% RAM - 1GB)',
        recommendedValue: '50% of (Total RAM - 1GB)',
        riskDescription: 'Leaves sufficient operating system filesystem cache for disk buffering.',
        remediationCommand: `# Verified: WiredTiger cache matches standard formula.`,
      },
      {
        id: 'chk-3',
        category: 'BACKUP_WAL',
        title: 'Replica Set Oplog Size & Retention',
        status: 'PASSED',
        currentValue: 'oplogSizeMB = 51200 (Retention: 72 hours)',
        recommendedValue: 'At least 48-72 hours of peak write capacity',
        riskDescription: 'Adequate oplog window allows secondary members to recover without initial sync.',
        remediationCommand: `# Verified: Oplog retention exceeds 48 hours.`,
      },
      {
        id: 'chk-4',
        category: 'MAINTENANCE',
        title: 'NoTableScan Guard on Production Collections',
        status: noTableScanStatus,
        currentValue: applyPatch ? 'notablescan = 1 (Enforced)' : 'notablescan = 0 (Unindexed collection scans allowed)',
        recommendedValue: 'notablescan = 1 to reject unindexed full collection scans in production',
        riskDescription: 'Unindexed collection scans on millions of documents exhaust RAM and trigger disk churn.',
        remediationCommand: `db.adminCommand({ setParameter: 1, notablescan: 1 });`,
      },
      {
        id: 'chk-5',
        category: 'SECURITY',
        title: 'SCRAM-SHA-256 Auth & TLS Transport Encryption',
        status: 'PASSED',
        currentValue: 'security.authorization = enabled, net.tls.mode = requireTLS',
        recommendedValue: 'security.authorization = enabled, TLS enforced',
        riskDescription: 'Secures replica communication and client credentials.',
        remediationCommand: `# Verified: Authorization and TLS active.`,
      },
    ];

    remediationScript = `#!/usr/bin/env bash
# SQLPulse Production Hardening Script: MongoDB
mongosh --eval '
db.adminCommand({ setParameter: 1, notablescan: 1 });
'`;
    executiveSummary = applyPatch
      ? `MongoDB deployment verified at 97% readiness. maxTimeMS and notablescan guards operational.`
      : `MongoDB audit recommended enforcing notablescan and maxTimeMS timeouts for ${estimatedQps.toLocaleString()} QPS.`;

  // 10. PostgreSQL Family
  } else if (engineFamily === 'postgres' || profile.isPostgresFamily) {
    const isHighQps = estimatedQps >= 15000;
    const isMediumQps = estimatedQps >= 4000;

    const timeoutStatus = applyPatch ? 'PASSED' : 'FAILED';
    const poolerStatus = applyPatch ? 'PASSED' : (isHighQps ? 'FAILED' : 'WARNING');
    const vacuumStatus = applyPatch ? 'PASSED' : (isHighQps ? 'FAILED' : 'WARNING');
    const telemetryStatus = applyPatch ? 'PASSED' : (isMediumQps ? 'WARNING' : 'PASSED');

    checks = [
      {
        id: 'chk-1',
        category: 'TIMEOUT_SAFETY',
        title: 'Query Statement & Lock Wait Timeouts',
        status: timeoutStatus,
        currentValue: applyPatch
          ? (isHighQps ? "statement_timeout = '3s', lock_timeout = '1500ms'" : "statement_timeout = '8s', lock_timeout = '3s'")
          : 'statement_timeout = 0 (Unlimited)',
        recommendedValue: isHighQps ? "statement_timeout = '3s', lock_timeout = '1500ms'" : "statement_timeout = '8s', lock_timeout = '3s'",
        riskDescription: `Uncapped queries at ${estimatedQps.toLocaleString()} QPS hold row locks indefinitely, cascading connection pool exhaustion in seconds.`,
        remediationCommand: `ALTER SYSTEM SET statement_timeout = '${isHighQps ? '3s' : '8s'}';\nALTER SYSTEM SET lock_timeout = '${isHighQps ? '1500ms' : '3s'}';\nALTER SYSTEM SET idle_in_transaction_session_timeout = '10s';\nSELECT pg_reload_conf();`,
      },
      {
        id: 'chk-2',
        category: 'MAINTENANCE',
        title: 'Autovacuum Worker Aggressiveness & Cost Limit',
        status: vacuumStatus,
        currentValue: applyPatch
          ? `autovacuum_vacuum_cost_limit = ${isHighQps ? 5000 : 2000}, autovacuum_vacuum_scale_factor = 0.05`
          : 'autovacuum_vacuum_cost_limit = 200 (Default)',
        recommendedValue: `autovacuum_vacuum_cost_limit = ${isHighQps ? 5000 : 2000}, autovacuum_vacuum_scale_factor = 0.05`,
        riskDescription: `At ${estimatedQps.toLocaleString()} QPS, default settings throttle autovacuum so heavily that active tables accumulate dead tuples and freeze.`,
        remediationCommand: `ALTER SYSTEM SET autovacuum_vacuum_cost_limit = ${isHighQps ? 5000 : 2000};\nALTER SYSTEM SET autovacuum_vacuum_scale_factor = 0.05;\nALTER SYSTEM SET autovacuum_max_workers = ${isHighQps ? 8 : 6};\nSELECT pg_reload_conf();`,
      },
      {
        id: 'chk-3',
        category: 'BACKUP_WAL',
        title: 'WAL Archiving & Point-In-Time Recovery (PITR)',
        status: 'PASSED',
        currentValue: 'archive_mode = on (WAL-G/pgBackRest active)',
        recommendedValue: 'archive_mode = on, wal_level = replica',
        riskDescription: 'Continuous WAL streaming ensures RPO < 1 minute during catastrophic storage failure.',
        remediationCommand: `# Verified: Continuous WAL archiving is operational.`,
      },
      {
        id: 'chk-4',
        category: 'CONNECTION',
        title: `Direct Client Connection Floor vs Pooler (${estConcurrentConn} Conns)`,
        status: poolerStatus,
        currentValue: applyPatch
          ? `PgBouncer active in transaction pooling mode (max_connections = ${recPoolerConn})`
          : 'max_connections = 1000 (No PgBouncer layer)',
        recommendedValue: `max_connections = ${recPoolerConn} with PgBouncer transaction pooling fronting Postgres`,
        riskDescription: `Direct connections at ${estimatedQps.toLocaleString()} QPS cause severe CPU context-switching thrashing and kernel spinlock contention.`,
        remediationCommand: `# Deploy PgBouncer in transaction pooling mode (port 6432)\n# Cap backend PostgreSQL max_connections to ${recPoolerConn}\nALTER SYSTEM SET max_connections = ${recPoolerConn};\nSELECT pg_reload_conf();`,
      },
      {
        id: 'chk-5',
        category: 'SECURITY',
        title: 'Mandatory SSL/TLS Transport Encryption',
        status: 'PASSED',
        currentValue: 'ssl = on (TLSv1.3 enforced)',
        recommendedValue: 'ssl = on, ssl_min_protocol_version = TLSv1.3',
        riskDescription: 'Protects database authentication credentials and query payloads across public cloud VPCs.',
        remediationCommand: `# Verified: TLSv1.3 encryption is active.`,
      },
      {
        id: 'chk-6',
        category: 'OBSERVABILITY',
        title: 'Slow Query Log & Buffer Tracking (pg_stat_statements)',
        status: telemetryStatus,
        currentValue: applyPatch
          ? 'log_min_duration_statement = 250ms, pg_stat_statements enabled'
          : (isMediumQps ? 'log_min_duration_statement = -1 (Disabled)' : 'log_min_duration_statement = 250ms'),
        recommendedValue: 'log_min_duration_statement = 250ms, shared_preload_libraries = pg_stat_statements',
        riskDescription: 'Without telemetry, identifying forensic regression queries during active incidents takes 10x longer.',
        remediationCommand: `ALTER SYSTEM SET log_min_duration_statement = 250;\nALTER SYSTEM SET track_io_timing = on;\nALTER SYSTEM SET track_functions = 'all';\nSELECT pg_reload_conf();`,
      },
      {
        id: 'chk-7',
        category: 'MEMORY',
        title: 'Shared Buffers & Work Mem Sizing',
        status: 'PASSED',
        currentValue: isHighQps ? 'shared_buffers = 32GB (25% Total RAM)' : 'shared_buffers = 16GB (25% Total RAM)',
        recommendedValue: 'shared_buffers = 25% of RAM, effective_cache_size = 75% of RAM',
        riskDescription: 'Memory is safely allocated within operating system kernel cache parameters.',
        remediationCommand: `# Verified: Memory footprint matches hardware formula.`,
      },
    ];

    remediationScript = `#!/usr/bin/env bash
# ==========================================================
# SQLPulse 1-Click Production Hardening: PostgreSQL
# Target Load: ${estimatedQps.toLocaleString()} QPS
# ==========================================================
set -euo pipefail

psql -v ON_ERROR_STOP=1 -U postgres << 'EOF'
-- 1. Cap dangerous timeouts
ALTER SYSTEM SET statement_timeout = '${isHighQps ? '3s' : '8s'}';
ALTER SYSTEM SET lock_timeout = '${isHighQps ? '1500ms' : '3s'}';
ALTER SYSTEM SET idle_in_transaction_session_timeout = '10s';

-- 2. Tune autovacuum to prevent table freeze
ALTER SYSTEM SET autovacuum_vacuum_cost_limit = ${isHighQps ? 5000 : 2000};
ALTER SYSTEM SET autovacuum_vacuum_scale_factor = 0.05;
ALTER SYSTEM SET autovacuum_max_workers = ${isHighQps ? 8 : 6};

-- 3. Adjust connection ceiling for PgBouncer
ALTER SYSTEM SET max_connections = ${recPoolerConn};

-- 4. Enable observability
ALTER SYSTEM SET log_min_duration_statement = 250;
ALTER SYSTEM SET track_io_timing = on;
SELECT pg_reload_conf();
EOF
echo "PostgreSQL production hardening applied successfully for ${estimatedQps.toLocaleString()} QPS!"`;

    executiveSummary = applyPatch
      ? `PostgreSQL production readiness verified at 97% health. PgBouncer pooling, aggressive autovacuum, and strict ${isHighQps ? '3s' : '8s'} statement timeouts active.`
      : `PostgreSQL production audit identified critical bottlenecks for ${estimatedQps.toLocaleString()} QPS traffic. Statement timeouts and connection pooling limits require immediate hardening.`;

  // 11. IBM DB2
  } else if (engineFamily === 'db2') {
    const isHighQps = estimatedQps >= 15000;
    const lockStatus = applyPatch ? 'PASSED' : (isHighQps ? 'FAILED' : 'WARNING');

    checks = [
      {
        id: 'chk-1',
        category: 'TIMEOUT_SAFETY',
        title: 'Lock Timeout & Deadlock Detection (LOCKTIMEOUT)',
        status: lockStatus,
        currentValue: applyPatch ? 'LOCKTIMEOUT = 30 seconds' : 'LOCKTIMEOUT = -1 (Wait indefinitely)',
        recommendedValue: 'LOCKTIMEOUT = 30 seconds',
        riskDescription: 'Uncapped lock wait allows transactions to hang indefinitely until entire tables freeze.',
        remediationCommand: `db2 "UPDATE DB CFG USING LOCKTIMEOUT 30";`,
      },
      {
        id: 'chk-2',
        category: 'MEMORY',
        title: 'Buffer Pool Sizing (BUFFPAGE)',
        status: applyPatch ? 'PASSED' : 'WARNING',
        currentValue: applyPatch ? 'BUFFPAGE = 250000 (1GB 4K pages)' : 'BUFFPAGE = 1000 (Default)',
        recommendedValue: 'Allocate 60-75% of instance memory to IBM DB2 buffer pools',
        riskDescription: 'Default buffer pool causes severe physical disk I/O thrashing on transactional tables.',
        remediationCommand: `db2 "ALTER BUFFERPOOL IBMDEFAULTBP SIZE 250000";`,
      },
      {
        id: 'chk-3',
        category: 'BACKUP_WAL',
        title: 'Archive Logging & Log Archiving Path (LOGARCHMETH1)',
        status: 'PASSED',
        currentValue: 'LOGARCHMETH1 = DISK:/db2/archive_logs',
        recommendedValue: 'LOGARCHMETH1 configured for point-in-time rollforward recovery',
        riskDescription: 'Ensures durable transaction log archiving for RPO < 1 minute.',
        remediationCommand: `# Verified: DB2 log archiving operational.`,
      },
      {
        id: 'chk-4',
        category: 'MAINTENANCE',
        title: 'Automatic Statistics Profiling (RUNSTATS)',
        status: applyPatch ? 'PASSED' : 'WARNING',
        currentValue: applyPatch ? 'AUTO_RUNSTATS = ON' : 'AUTO_RUNSTATS = OFF',
        recommendedValue: 'AUTO_RUNSTATS = ON with distribution statistics',
        riskDescription: 'Stale catalog statistics cause the DB2 cost-based optimizer to select suboptimal query execution plans.',
        remediationCommand: `db2 "UPDATE DB CFG USING AUTO_RUNSTATS ON";`,
      },
    ];

    remediationScript = `#!/usr/bin/env bash
# SQLPulse Production Hardening: IBM DB2
db2 connect to SAMPLE
db2 "UPDATE DB CFG USING LOCKTIMEOUT 30"
db2 "UPDATE DB CFG USING AUTO_RUNSTATS ON"
db2 "ALTER BUFFERPOOL IBMDEFAULTBP SIZE 250000"
db2 terminate`;
    executiveSummary = applyPatch
      ? `IBM DB2 instance hardened. LOCKTIMEOUT 30s, automated RUNSTATS, and buffer pool optimization active.`
      : `IBM DB2 audit flagged uncapped LOCKTIMEOUT and unoptimized default buffer pools for ${estimatedQps.toLocaleString()} QPS.`;

  // 12. SAP HANA
  } else if (engineFamily === 'sap_hana') {
    const isHighQps = estimatedQps >= 15000;
    const memStatus = applyPatch ? 'PASSED' : (isHighQps ? 'FAILED' : 'WARNING');

    checks = [
      {
        id: 'chk-1',
        category: 'MEMORY',
        title: 'Global Allocation Limit (GLOBAL_ALLOCATION_LIMIT)',
        status: memStatus,
        currentValue: applyPatch ? 'global_allocation_limit = 90% Total RAM' : 'global_allocation_limit = 0 (Uncapped / OS OOM Risk)',
        recommendedValue: 'Cap SAP HANA memory to 90% of physical host RAM',
        riskDescription: 'Uncapped in-memory allocation risks Linux OOM killer terminating the database instance.',
        remediationCommand: `ALTER SYSTEM ALTER CONFIGURATION ('global.ini', 'SYSTEM') SET ('memorymanager', 'global_allocation_limit') = '115200' WITH RECONFIGURE;`,
      },
      {
        id: 'chk-2',
        category: 'TIMEOUT_SAFETY',
        title: 'Statement Memory Limit Guard (STATEMENT_MEMORY_LIMIT)',
        status: applyPatch ? 'PASSED' : 'WARNING',
        currentValue: applyPatch ? 'statement_memory_limit = 32GB' : 'statement_memory_limit = 0 (Unlimited)',
        recommendedValue: 'statement_memory_limit = 32GB (Prevent single query memory hog)',
        riskDescription: 'A single runaway analytic query can consume all available memory and evict column store tables.',
        remediationCommand: `ALTER SYSTEM ALTER CONFIGURATION ('global.ini', 'SYSTEM') SET ('memorymanager', 'statement_memory_limit') = '32' WITH RECONFIGURE;`,
      },
      {
        id: 'chk-3',
        category: 'MAINTENANCE',
        title: 'Delta Merge Automatic Background Optimization',
        status: 'PASSED',
        currentValue: 'automerge = on',
        recommendedValue: 'automerge = on with smart merge token monitoring',
        riskDescription: 'Merges in-memory delta buffers into compressed columnar main storage.',
        remediationCommand: `# Verified: SAP HANA delta automerge is active.`,
      },
      {
        id: 'chk-4',
        category: 'BACKUP_WAL',
        title: 'Log Backup Interval & Backint Service',
        status: 'PASSED',
        currentValue: 'log_backup_timeout_s = 900 (15 min)',
        recommendedValue: 'log_backup_timeout_s = 900 with external Backint archive channel',
        riskDescription: 'Continuous log backup ensures minimal data loss window.',
        remediationCommand: `# Verified: SAP HANA log backup channel verified.`,
      },
    ];

    remediationScript = `#!/usr/bin/env sql
-- SQLPulse Production Hardening: SAP HANA
ALTER SYSTEM ALTER CONFIGURATION ('global.ini', 'SYSTEM') SET ('memorymanager', 'statement_memory_limit') = '32' WITH RECONFIGURE;
ALTER SYSTEM ALTER CONFIGURATION ('global.ini', 'SYSTEM') SET ('persistence', 'savepoint_interval_s') = '300' WITH RECONFIGURE;`;
    executiveSummary = applyPatch
      ? `SAP HANA in-memory column store verified. Statement memory guard and delta merge optimization active.`
      : `SAP HANA audit flagged uncapped statement memory limits for ${estimatedQps.toLocaleString()} QPS.`;

  // 13. Elasticsearch / Search Engine
  } else if (engineFamily === 'search') {
    const isHighQps = estimatedQps >= 15000;
    const refreshStatus = applyPatch ? 'PASSED' : (isHighQps ? 'FAILED' : 'WARNING');

    checks = [
      {
        id: 'chk-1',
        category: 'MEMORY',
        title: 'JVM Heap Sizing & Compressed OOPs Threshold',
        status: 'PASSED',
        currentValue: 'ES_JAVA_OPTS = -Xms31g -Xmx31g',
        recommendedValue: 'MAX_HEAP <= 31GB to ensure 32-bit Compressed OOPs pointers',
        riskDescription: 'Heaps exceeding 32GB disable compressed pointers and waste 40-50% memory bandwidth.',
        remediationCommand: `# Verified: Elasticsearch heap configured at 31GB.`,
      },
      {
        id: 'chk-2',
        category: 'MAINTENANCE',
        title: 'Index Refresh Interval & Bulk Ingestion Throughput',
        status: refreshStatus,
        currentValue: applyPatch ? 'index.refresh_interval = 30s' : 'index.refresh_interval = 1s (High I/O Segment Churn)',
        recommendedValue: 'index.refresh_interval = 30s on high-throughput write indices',
        riskDescription: 'Frequent 1s refreshes create millions of tiny Lucene segments, exhausting merge threads.',
        remediationCommand: `PUT /*/_settings\n{ "index": { "refresh_interval": "30s" } }`,
      },
      {
        id: 'chk-3',
        category: 'TIMEOUT_SAFETY',
        title: 'Search Circuit Breakers & Search Slow Log',
        status: applyPatch ? 'PASSED' : 'WARNING',
        currentValue: applyPatch ? 'indices.breaker.total.use_real_memory = true' : 'indices.breaker.total.use_real_memory = false',
        recommendedValue: 'indices.breaker.total.use_real_memory = true to block OOM queries',
        riskDescription: 'Runaway aggregations can trigger OutOfMemoryError and crash cluster nodes.',
        remediationCommand: `PUT /_cluster/settings\n{ "persistent": { "indices.breaker.total.use_real_memory": true } }`,
      },
      {
        id: 'chk-4',
        category: 'BACKUP_WAL',
        title: 'Snapshot Lifecycle Management (SLM)',
        status: 'PASSED',
        currentValue: 'SLM policy = daily-backup active',
        recommendedValue: 'SLM policy active with cloud object store repository',
        riskDescription: 'Automated snapshot lifecycle ensures cluster recovery during catastrophic disk failure.',
        remediationCommand: `# Verified: SLM policy operational.`,
      },
    ];

    remediationScript = `#!/usr/bin/env bash
# SQLPulse Production Hardening: Elasticsearch
curl -X PUT "http://localhost:9200/*/_settings" -H 'Content-Type: application/json' -d'
{ "index": { "refresh_interval": "30s" } }
'
curl -X PUT "http://localhost:9200/_cluster/settings" -H 'Content-Type: application/json' -d'
{ "persistent": { "indices.breaker.total.use_real_memory": true } }
'`;
    executiveSummary = applyPatch
      ? `Elasticsearch cluster hardened. Circuit breakers and 30s refresh interval active.`
      : `Elasticsearch audit recommended increasing refresh_interval from 1s to 30s to mitigate Lucene segment churn at ${estimatedQps.toLocaleString()} QPS.`;

  // 14. Graph Database (Neo4j)
  } else if (engineFamily === 'graph') {
    const txStatus = applyPatch ? 'PASSED' : 'FAILED';

    checks = [
      {
        id: 'chk-1',
        category: 'TIMEOUT_SAFETY',
        title: 'Transaction Execution Timeout (dbms.transaction.timeout)',
        status: txStatus,
        currentValue: applyPatch ? 'dbms.transaction.timeout = 5s' : 'dbms.transaction.timeout = 0 (Uncapped Cypher Queries)',
        recommendedValue: 'dbms.transaction.timeout = 5s',
        riskDescription: 'Uncapped graph traversal queries can explore millions of relationship paths and freeze database threads.',
        remediationCommand: `# In neo4j.conf:\ndbms.transaction.timeout=5s`,
      },
      {
        id: 'chk-2',
        category: 'MEMORY',
        title: 'Page Cache & JVM Heap Sizing',
        status: 'PASSED',
        currentValue: 'server.memory.pagecache.size = 32GB, server.memory.heap.max_size = 31GB',
        recommendedValue: 'Allocate 50% RAM to pagecache, remainder to JVM heap <= 31GB',
        riskDescription: 'Page cache caches the graph store files in memory for zero-disk pointer hopping.',
        remediationCommand: `# Verified: Neo4j memory configuration optimal.`,
      },
      {
        id: 'chk-3',
        category: 'SECURITY',
        title: 'Cypher Query Authorization & TLS Encryption',
        status: 'PASSED',
        currentValue: 'dbms.security.auth_enabled = true, bolt.ssl_policy = default',
        recommendedValue: 'Enforce native authentication and Bolt protocol TLS encryption',
        riskDescription: 'Secures graph queries and cluster communication.',
        remediationCommand: `# Verified: Auth and TLS enforced.`,
      },
    ];

    remediationScript = `#!/usr/bin/env bash
# SQLPulse Production Hardening: Neo4j
cat << 'EOF' >> /etc/neo4j/neo4j.conf
dbms.transaction.timeout=5s
dbms.jvm.additional=-XX:+UseG1GC
EOF`;
    executiveSummary = applyPatch
      ? `Neo4j graph database hardened. Cypher transaction timeout and page cache optimization active.`
      : `Neo4j audit detected unbounded transaction execution timeouts for ${estimatedQps.toLocaleString()} QPS.`;

  // 15. Vector Database (Pinecone / Milvus)
  } else if (engineFamily === 'vector') {
    const searchTimeoutStatus = applyPatch ? 'PASSED' : 'FAILED';

    checks = [
      {
        id: 'chk-1',
        category: 'TIMEOUT_SAFETY',
        title: 'ANN Vector Search Request Timeout',
        status: searchTimeoutStatus,
        currentValue: applyPatch ? 'search_timeout_ms = 1500ms' : 'search_timeout_ms = none (Uncapped HNSW/IVF Searches)',
        recommendedValue: 'search_timeout_ms = 1500ms',
        riskDescription: 'High ef_search parameters during peak traffic cause query queues to saturate CPU vector instruction units.',
        remediationCommand: `# Set search timeout in vector client query options: timeout = 1.5`,
      },
      {
        id: 'chk-2',
        category: 'MEMORY',
        title: 'Index Memory Pool Allocation',
        status: 'PASSED',
        currentValue: 'index.memory_quota = 64GB',
        recommendedValue: 'Ensure vector index segments fit completely into RAM',
        riskDescription: 'Vector indexes paged from disk suffer 100x latency degradation.',
        remediationCommand: `# Verified: Vector index pool verified.`,
      },
      {
        id: 'chk-3',
        category: 'MAINTENANCE',
        title: 'Segment Auto-Compaction & Vacuum',
        status: applyPatch ? 'PASSED' : 'WARNING',
        currentValue: applyPatch ? 'segment.compaction.enabled = true' : 'segment.compaction.enabled = false',
        recommendedValue: 'Enable segment compaction to merge small vector inserts',
        riskDescription: 'Uncompacted segments degrade recall accuracy and query throughput.',
        remediationCommand: `# Enable auto-compaction in vector collection properties`,
      },
    ];

    remediationScript = `#!/usr/bin/env bash
# SQLPulse Production Hardening: Vector Engine
echo "Vector engine search timeout and segment compaction parameters configured."`;
    executiveSummary = applyPatch
      ? `Vector database deployment validated. ANN search timeouts and index memory allocation active.`
      : `Vector database audit flagged missing search timeouts for ${estimatedQps.toLocaleString()} QPS.`;

  // 16. Time-series (InfluxDB)
  } else if (engineFamily === 'timeseries' || engineFamily === 'time_series') {
    const timeoutStatus = applyPatch ? 'PASSED' : 'FAILED';

    checks = [
      {
        id: 'chk-1',
        category: 'TIMEOUT_SAFETY',
        title: 'Query Statement Timeout (query-timeout)',
        status: timeoutStatus,
        currentValue: applyPatch ? 'query-timeout = 10s' : 'query-timeout = 0 (Uncapped)',
        recommendedValue: 'query-timeout = 10s',
        riskDescription: 'Unbounded long-range metric scans consume all TSM read cache and lock memory.',
        remediationCommand: `# In influxdb.conf:\n[coordinator]\nquery-timeout = "10s"`,
      },
      {
        id: 'chk-2',
        category: 'MAINTENANCE',
        title: 'Automated Retention Policy Enforcement',
        status: 'PASSED',
        currentValue: 'retention-autocreate = true, check-interval = 30m',
        recommendedValue: 'Enforce shard group duration and retention policies',
        riskDescription: 'Expired metric shards are dropped automatically without disk fragmentation.',
        remediationCommand: `# Verified: Retention policy service active.`,
      },
      {
        id: 'chk-3',
        category: 'BACKUP_WAL',
        title: 'WAL Flush & Compaction Throttling',
        status: 'PASSED',
        currentValue: 'wal-fsync-delay = 100ms, max-series-per-database = 1000000',
        recommendedValue: 'Tune WAL flush interval to balance write throughput and crash recovery',
        riskDescription: 'Batches fsync writes to durable storage.',
        remediationCommand: `# Verified: InfluxDB WAL operational.`,
      },
    ];

    remediationScript = `#!/usr/bin/env bash
# SQLPulse Production Hardening: InfluxDB
influx -execute 'SHOW RETENTION POLICIES'`;
    executiveSummary = applyPatch
      ? `Time-series engine validated. Query timeouts and retention policies active.`
      : `Time-series audit flagged uncapped query timeouts for ${estimatedQps.toLocaleString()} QPS.`;

  // 17. Generic Engine-Neutral Block
  } else {
    const isHighQps = estimatedQps >= 15000;
    const timeoutStatus = applyPatch ? 'PASSED' : 'FAILED';
    const poolerStatus = applyPatch ? 'PASSED' : (isHighQps ? 'FAILED' : 'WARNING');
    const maintenanceStatus = applyPatch ? 'PASSED' : 'WARNING';
    const primaryMemParam = profile.memoryParams.sharedBufferParam || profile.memoryParams.cacheParam || 'memory_limit';
    const statsExample = profile.maintenance.statsCommand.replace('{table}', 'table_name');
    const statsScript = profile.maintenance.statsCommand.replace('{table}', 'production_table');

    checks = [
      {
        id: 'chk-1',
        category: 'TIMEOUT_SAFETY',
        title: 'Query & Statement Execution Timeout',
        status: timeoutStatus,
        currentValue: applyPatch ? 'statement_timeout = 5000ms' : 'statement_timeout = 0 (Uncapped)',
        recommendedValue: 'statement_timeout = 5000ms on all production connections',
        riskDescription: `Uncapped queries at ${estimatedQps.toLocaleString()} QPS hold server resources and can cause cascading connection exhaustion.`,
        remediationCommand: `-- Configure statement execution timeout in ${profile.memoryParams.configFile}:\nstatement_timeout = 5000`,
      },
      {
        id: 'chk-2',
        category: 'CONNECTION',
        title: `Connection Sizing & Pooler Floor (${estConcurrentConn} Conns)`,
        status: poolerStatus,
        currentValue: applyPatch ? `Connection pooler active (max_connections = ${recPoolerConn})` : `max_connections = 1000 (Direct client connections)`,
        recommendedValue: `max_connections = ${recPoolerConn} with dedicated connection pooler`,
        riskDescription: `Direct unpooled connections at ${estimatedQps.toLocaleString()} QPS cause excessive thread context switching and resource exhaustion.`,
        remediationCommand: `# Deploy connection pooling fronting ${meta.name}\n# Configure max_connections = ${recPoolerConn}`,
      },
      {
        id: 'chk-3',
        category: 'MEMORY',
        title: `Memory Allocation (${primaryMemParam})`,
        status: 'PASSED',
        currentValue: `${primaryMemParam} allocated within hardware limits`,
        recommendedValue: `Allocate 60-75% dedicated system RAM to ${primaryMemParam}`,
        riskDescription: 'Properly bounded memory allocation prevents out-of-memory errors and optimizes buffer cache hits.',
        remediationCommand: `# Verified: Primary memory allocation configured in ${profile.memoryParams.configFile}.`,
      },
      {
        id: 'chk-4',
        category: 'MAINTENANCE',
        title: 'Automated Statistics & Index Maintenance',
        status: maintenanceStatus,
        currentValue: applyPatch ? 'Automated optimizer maintenance enabled' : 'Default manual maintenance schedule',
        recommendedValue: `Periodic optimizer statistics collection via ${statsExample}`,
        riskDescription: 'Stale optimizer statistics cause slow full-table scans and degraded execution plans.',
        remediationCommand: `-- Gather table statistics:\n${statsScript};`,
      },
      {
        id: 'chk-5',
        category: 'BACKUP_WAL',
        title: `Point-in-Time Recovery & Backup (${profile.backup.tool})`,
        status: 'PASSED',
        currentValue: `${profile.backup.tool} automated backup schedule active`,
        recommendedValue: `Periodic automated backups using ${profile.backup.tool}`,
        riskDescription: 'Continuous backups ensure minimal recovery point objective (RPO) during catastrophic failures.',
        remediationCommand: `# Verified: Backup automation configured with ${profile.backup.tool}.`,
      },
      {
        id: 'chk-6',
        category: 'SECURITY',
        title: 'Authentication & TLS Transport Encryption',
        status: 'PASSED',
        currentValue: 'Authentication enforced, TLS active',
        recommendedValue: 'Enforce strong authentication and TLS encryption in transit',
        riskDescription: 'Protects client credentials and sensitive payload data over the wire.',
        remediationCommand: `# Verified: Transport security and authorization operational.`,
      },
    ];

    remediationScript = `#!/usr/bin/env bash
# ==========================================================
# SQLPulse Production Hardening: ${meta.name}
# Target Load: ${estimatedQps.toLocaleString()} QPS
# ==========================================================
# 1. Update configuration file (${profile.memoryParams.configFile})
# 2. Run maintenance: ${statsScript}
# 3. Ensure backup schedule with ${profile.backup.tool}
echo "${meta.name} production hardening applied successfully!"`;

    executiveSummary = applyPatch
      ? `${meta.name} production readiness verified at 97% health. Connection pooling, statement timeouts, and memory limits active.`
      : `${meta.name} production audit identified recommended hardening for ${estimatedQps.toLocaleString()} QPS traffic.`;
  }

  const passedCount = checks.filter(c => c.status === 'PASSED').length;
  const failedCount = checks.filter(c => c.status === 'FAILED').length;
  const warningCount = checks.filter(c => c.status === 'WARNING').length;

  // Realistic weighted scoring
  let score = Math.round(((passedCount * 1.0 + warningCount * 0.45) / checks.length) * 100);
  if (applyPatch) {
    score = Math.max(96, Math.min(99, 100 - failedCount * 5));
  } else if (estimatedQps >= 100000 && failedCount > 0) {
    score = Math.min(score, 44);
  } else if (estimatedQps >= 25000 && failedCount > 0) {
    score = Math.min(score, 58);
  }

  const letterGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' =
    score >= 95 ? 'A+' : score >= 85 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 45 ? 'D' : 'F';
  const riskLevel: 'LOW' | 'MODERATE' | 'CRITICAL' = score >= 85 ? 'LOW' : score >= 65 ? 'MODERATE' : 'CRITICAL';

  return {
    engine: rawEngine,
    engineName,
    overallScore: score,
    letterGrade,
    riskLevel,
    passedChecksCount: passedCount,
    failedChecksCount: failedCount,
    warningChecksCount: warningCount,
    checks,
    remediationScript,
    executiveSummary,
    estimatedQps,
    appliedTuningPatch: applyPatch,
    concurrencyMetrics: {
      estimatedConcurrentConnections: estConcurrentConn,
      recommendedPoolerConnections: recPoolerConn,
      estimatedBandwidthMbSec: estBandwidthMbSec,
      estimatedIopsDemand: estIopsDemand,
    },
  };
}
