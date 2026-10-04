export interface ChaosStep {
  timeOffsetSec: number;
  phase: string;
  clusterState: 'HEALTHY' | 'DEGRADED' | 'FAILING_OVER' | 'SPLIT_BRAIN' | 'RECOVERED';
  activePrimary: string;
  standbyStatus: string;
  clientImpact: string;
  circuitBreakerStatus: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  description: string;
}

export interface ChaosClusterTopologySummary {
  clusterSize: number;
  quorumRequirement: string;
  failoverManager: string;
  consensusProtocol: string;
  syncMode: 'sync' | 'async';
}

export interface ChaosSimulationResult {
  engine: string;
  engineName: string;
  scenarioId: string;
  scenarioTitle: string;
  faultType: 'PRIMARY_CRASH' | 'NETWORK_SPLIT' | 'REPLICA_LAG_SPIKE' | 'CONNECTION_STARVATION' | 'DISK_OUT_OF_SPACE';
  totalDowntimeEstimatedSec: number;
  dataLossRisk: 'ZERO_DATA_LOSS_SYNC' | 'SUB_SECOND_ASYNC' | 'DATA_LOSS_WARNING';
  timeline: ChaosStep[];
  resilienceScore: number;
  mitigationRunbook: string;
  recommendedConfigPatch: string;
  chaosInjectionScript: string;
  clusterTopologySummary: ChaosClusterTopologySummary;
}

export function simulateChaosScenario(options: {
  engine?: string;
  scenarioId?: string;
  clusterSize?: number;
  syncMode?: 'sync' | 'async';
}): ChaosSimulationResult {
  const rawEngine = (options.engine || 'postgresql').toLowerCase();
  const scenarioId = options.scenarioId || 'primary_crash';
  const clusterSize = Math.max(2, Math.min(9, options.clusterSize || 3));
  const syncMode = options.syncMode || 'sync';
  const majorityVotes = Math.floor(clusterSize / 2) + 1;

  // Resolve engine family and native high-availability tools
  let engineFamily = 'postgres';
  let engineName = 'PostgreSQL';
  let failoverManager = 'Patroni + etcd';
  let consensusProtocol = 'Raft Consensus';
  let primaryPrefix = 'pg-primary-node-01';
  let standbyPrefix = 'pg-standby-node-02';

  if (rawEngine.includes('mysql') || rawEngine.includes('maria') || rawEngine.includes('tidb') || rawEngine.includes('percona')) {
    engineFamily = 'mysql';
    engineName = 'MySQL / MariaDB';
    failoverManager = 'Orchestrator + ProxySQL';
    consensusProtocol = 'Group Replication (Paxos)';
    primaryPrefix = 'mysql-writer-az1';
    standbyPrefix = 'mysql-reader-az2';
  } else if (rawEngine.includes('oracle') || rawEngine.includes('db2')) {
    engineFamily = 'oracle';
    engineName = 'Oracle Database';
    failoverManager = 'Data Guard Broker (FSFO)';
    consensusProtocol = 'Observer Quorum';
    primaryPrefix = 'oracle-prod-prim';
    standbyPrefix = 'oracle-prod-stby';
  } else if (rawEngine.includes('sqlserver') || rawEngine.includes('mssql') || rawEngine.includes('azure_sql')) {
    engineFamily = 'mssql';
    engineName = 'Microsoft SQL Server';
    failoverManager = 'AlwaysOn WSFC / Pacemaker';
    consensusProtocol = 'Majority Node & File Share Quorum';
    primaryPrefix = 'sql-ag-prim-01';
    standbyPrefix = 'sql-ag-sec-02';
  } else if (rawEngine.includes('mongo') || rawEngine.includes('document')) {
    engineFamily = 'mongodb';
    engineName = 'MongoDB';
    failoverManager = 'Replica Set Internal Election';
    consensusProtocol = 'MongoDB v1 Election (Raft-like)';
    primaryPrefix = 'mongo-primary-01';
    standbyPrefix = 'mongo-secondary-02';
  } else if (rawEngine.includes('redis') || rawEngine.includes('keydb') || rawEngine.includes('dragonfly') || rawEngine.includes('valkey')) {
    engineFamily = 'redis';
    engineName = 'Redis';
    failoverManager = 'Redis Sentinel / Redis Cluster';
    consensusProtocol = 'Sentinel Quorum Majority';
    primaryPrefix = 'redis-master-node';
    standbyPrefix = 'redis-replica-node';
  } else if (rawEngine.includes('click') || rawEngine.includes('duck') || rawEngine.includes('starrocks') || rawEngine.includes('trino')) {
    engineFamily = 'clickhouse';
    engineName = 'ClickHouse';
    failoverManager = 'ClickHouse Keeper / ZooKeeper';
    consensusProtocol = 'Keeper Raft Quorum';
    primaryPrefix = 'ch-shard1-replica1';
    standbyPrefix = 'ch-shard1-replica2';
  } else if (rawEngine.includes('cassandra') || rawEngine.includes('scylla')) {
    engineFamily = 'cassandra';
    engineName = 'Apache Cassandra / ScyllaDB';
    failoverManager = 'Gossip Failure Detector (Phi Accrual)';
    consensusProtocol = 'Paxos LWT / Peer-to-Peer';
    primaryPrefix = 'cass-node-rack1-01';
    standbyPrefix = 'cass-node-rack2-02';
  } else if (rawEngine.includes('sqlite') || rawEngine.includes('turso') || rawEngine.includes('libsql')) {
    engineFamily = 'sqlite';
    engineName = 'SQLite / Embedded';
    failoverManager = 'WAL Lock Manager / Litestream';
    consensusProtocol = 'Filesystem Shm Mutex';
    primaryPrefix = 'sqlite-writer-proc';
    standbyPrefix = 'sqlite-reader-proc';
  } else if (rawEngine.includes('snow') || rawEngine.includes('bigquery') || rawEngine.includes('redshift')) {
    engineFamily = 'snowflake';
    engineName = 'Cloud Data Warehouse (Snowflake / BigQuery)';
    failoverManager = 'Cloud Control Plane Auto-Healing';
    consensusProtocol = 'Stateless Compute Redundancy';
    primaryPrefix = 'dw-warehouse-az1';
    standbyPrefix = 'dw-warehouse-az2';
  }

  let scenarioTitle = 'Sudden Primary Crash & Quorum Failover';
  let faultType: ChaosSimulationResult['faultType'] = 'PRIMARY_CRASH';
  let downtimeSec = syncMode === 'sync' ? 8 : 14;
  let timeline: ChaosStep[] = [];
  let resilienceScore = 92;
  let mitigationRunbook = '';
  let recommendedConfigPatch = '';
  let chaosInjectionScript = '';

  const dataLossRisk: ChaosSimulationResult['dataLossRisk'] =
    syncMode === 'sync' ? 'ZERO_DATA_LOSS_SYNC' : 'SUB_SECOND_ASYNC';

  // --- Scenario 1: Primary Crash ---
  if (scenarioId === 'primary_crash') {
    scenarioTitle = `Sudden ${engineName} Primary Crash & Automatic Failover`;
    faultType = 'PRIMARY_CRASH';
    downtimeSec = syncMode === 'sync' ? 7 : 12;
    resilienceScore = syncMode === 'sync' ? 94 : 85;

    timeline = [
      {
        timeOffsetSec: 0,
        phase: 'Baseline Cluster Health',
        clusterState: 'HEALTHY',
        activePrimary: `${primaryPrefix} (Leader)`,
        standbyStatus: `${clusterSize - 1}x Standbys in Sync (Heartbeat: 80ms)`,
        clientImpact: '0% Error Rate, Latency p95: 3.8ms',
        circuitBreakerStatus: 'CLOSED',
        description: `${engineName} cluster operating normally with ${clusterSize} nodes under ${failoverManager}.`,
      },
      {
        timeOffsetSec: 2,
        phase: 'Kernel Panic / Hardware Severed',
        clusterState: 'DEGRADED',
        activePrimary: `${primaryPrefix} [OFFLINE / UNRESPONSIVE]`,
        standbyStatus: `Missed 2x heartbeat pings. Quorum election initiated.`,
        clientImpact: 'In-flight writes hold TCP sockets; upstream gateway starts queuing requests.',
        circuitBreakerStatus: 'OPEN',
        description: `Primary process abruptly terminated without clean flush. ${failoverManager} detects missing lease.`,
      },
      {
        timeOffsetSec: 5,
        phase: 'Leader Election & Quorum Consensus',
        clusterState: 'FAILING_OVER',
        activePrimary: 'ELECTION IN PROGRESS',
        standbyStatus: `Candidate elected with ${majorityVotes}/${clusterSize} majority votes (${consensusProtocol}).`,
        clientImpact: 'Client connection pool rejects new write sockets (HTTP 503 circuit trip).',
        circuitBreakerStatus: 'OPEN',
        description: `Majority consensus reached. Standby with highest LSN / commit log promoted.`,
      },
      {
        timeOffsetSec: 7,
        phase: 'Promotion & Virtual IP / DNS Shift',
        clusterState: 'FAILING_OVER',
        activePrimary: `${standbyPrefix} (Promoted Primary)`,
        standbyStatus: 'Replay catch-up completed. Virtual IP shifted to new primary.',
        clientImpact: 'Connection pools reconnecting to new VIP / listener.',
        circuitBreakerStatus: 'HALF_OPEN',
        description: `Read-write mode activated on new leader. Client pooler refreshes target backend.`,
      },
      {
        timeOffsetSec: downtimeSec,
        phase: 'Cluster Fully Stabilized',
        clusterState: 'RECOVERED',
        activePrimary: `${standbyPrefix} (Active Primary)`,
        standbyStatus: `${clusterSize - 2}x Standbys active; old primary scheduled for automated re-clone.`,
        clientImpact: 'All read/write queries normal. 0 data loss verified.',
        circuitBreakerStatus: 'CLOSED',
        description: `${engineName} cluster operational. Quorum re-established with ${majorityVotes}/${clusterSize} healthy nodes.`,
      },
    ];

    chaosInjectionScript = `#!/usr/bin/env bash
# ==========================================================
# Chaos Fault Injection: Immediate Primary Hardware Crash
# Target: ${engineName} (${primaryPrefix})
# ==========================================================
echo "[CHAOS] Injecting SIGKILL on ${engineName} primary daemon..."
ssh root@${primaryPrefix} "pkill -9 -f ${engineFamily === 'postgres' ? 'postgres' : engineFamily === 'mysql' ? 'mysqld' : engineFamily === 'mongo' ? 'mongod' : 'redis-server'}"

# Or via Chaos Mesh Kubernetes CRD:
cat << 'EOF' | kubectl apply -f -
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: db-primary-crash
  namespace: database
spec:
  action: pod-kill
  mode: one
  selector:
    namespaces:
      - database
    labels:
      role: primary
      engine: ${engineFamily}
EOF
echo "[CHAOS] Primary killed! Monitoring automated failover via ${failoverManager}..."`;

  // --- Scenario 2: Network Split-Brain ---
  } else if (scenarioId === 'network_split') {
    scenarioTitle = `Split-Brain Network Partition & Quorum Fencing (${engineName})`;
    faultType = 'NETWORK_SPLIT';
    downtimeSec = 9;
    resilienceScore = 89;

    timeline = [
      {
        timeOffsetSec: 0,
        phase: 'Baseline Multi-AZ Mesh',
        clusterState: 'HEALTHY',
        activePrimary: `${primaryPrefix} (AZ-East-1a)`,
        standbyStatus: `${clusterSize - 1}x Standbys across AZ-East-1b and AZ-East-1c`,
        clientImpact: '0% Error Rate, Latency p99: 8.4ms',
        circuitBreakerStatus: 'CLOSED',
        description: `Healthy multi-AZ replication mesh connected with ${consensusProtocol}.`,
      },
      {
        timeOffsetSec: 3,
        phase: 'Inter-AZ Network Blackhole',
        clusterState: 'SPLIT_BRAIN',
        activePrimary: `${primaryPrefix} (Isolated Partition)`,
        standbyStatus: `AZ-1b and AZ-1c isolated from old primary. Heartbeat severed.`,
        clientImpact: 'Clients in AZ-1a attempt writes; clients in AZ-1b failover to read-only.',
        circuitBreakerStatus: 'OPEN',
        description: `Network switch failure drops packets between AZ-1a and other zones.`,
      },
      {
        timeOffsetSec: 6,
        phase: 'Quorum Evaluation & STONITH Fencing',
        clusterState: 'FAILING_OVER',
        activePrimary: 'Demoting Isolated Leader',
        standbyStatus: `AZ-1b and AZ-1c form majority quorum (${majorityVotes}/${clusterSize} votes).`,
        clientImpact: 'Write requests paused in connection proxy buffer.',
        circuitBreakerStatus: 'OPEN',
        description: `Old isolated primary fails quorum renewal and self-fences (STONITH) to eliminate dual-master split-brain.`,
      },
      {
        timeOffsetSec: 9,
        phase: 'New Primary Leader Promoted',
        clusterState: 'RECOVERED',
        activePrimary: `${standbyPrefix} (New Quorum Leader)`,
        standbyStatus: 'Remaining nodes acknowledge new leader lease.',
        clientImpact: 'Writes resume through updated service mesh routing.',
        circuitBreakerStatus: 'CLOSED',
        description: `Majority partition safely accepts traffic. Split-brain prevented.`,
      },
    ];

    chaosInjectionScript = `#!/usr/bin/env bash
# ==========================================================
# Chaos Fault Injection: Network Partition (Split-Brain)
# Target: ${engineName}
# ==========================================================
echo "[CHAOS] Severing network traffic between AZ-1a and AZ-1b/c using iptables..."
ssh root@${primaryPrefix} "iptables -A INPUT -p tcp --dport 5432 -j DROP"

# Or via Toxiproxy CLI:
toxiproxy-cli toxic add ${engineFamily}_proxy -t timeout -a timeout=0
echo "[CHAOS] Network partition active. Verifying STONITH node fencing..."`;

  // --- Scenario 3: Connection Starvation & Storm ---
  } else if (scenarioId === 'connection_starvation') {
    scenarioTitle = `Thundering Herd Storm & Connection Pool Saturation (${engineName})`;
    faultType = 'CONNECTION_STARVATION';
    downtimeSec = 18;
    resilienceScore = 78;

    timeline = [
      {
        timeOffsetSec: 0,
        phase: 'Nominal Traffic Flow',
        clusterState: 'HEALTHY',
        activePrimary: `${primaryPrefix} (Active Conns: 120/1000)`,
        standbyStatus: 'Replicas serving analytical read pool',
        clientImpact: 'p99 Latency: 12ms',
        circuitBreakerStatus: 'CLOSED',
        description: 'Application services operating well within connection pooling thresholds.',
      },
      {
        timeOffsetSec: 4,
        phase: 'Lock Pileup & Connection Wave',
        clusterState: 'DEGRADED',
        activePrimary: `${primaryPrefix} (Active Conns: 940/1000)`,
        standbyStatus: 'Standbys unaffected',
        clientImpact: 'p99 Latency spikes to 3,400ms; Gateway HTTP 504 timeouts.',
        circuitBreakerStatus: 'OPEN',
        description: 'An unindexed heavy query holds an exclusive row lock, queueing 800+ backend worker threads.',
      },
      {
        timeOffsetSec: 9,
        phase: 'CPU Kernel Context Thrashing',
        clusterState: 'DEGRADED',
        activePrimary: 'CPU 100% (Kernel Spinlock Thrashing)',
        standbyStatus: 'Serving read-only traffic',
        clientImpact: 'Total API write stall. New client connections rejected.',
        circuitBreakerStatus: 'OPEN',
        description: 'Database server spends 92% of CPU time switching thread memory contexts rather than executing SQL.',
      },
      {
        timeOffsetSec: 15,
        phase: 'Circuit Breaker & Pooler Rate Limiting',
        clusterState: 'FAILING_OVER',
        activePrimary: 'Active Conns shedding excess clients (Pooler Throttling)',
        standbyStatus: 'Read queries rerouted to replicas',
        clientImpact: 'Excess requests rejected fast with 429 Retry-After, relieving engine.',
        circuitBreakerStatus: 'HALF_OPEN',
        description: 'Pooler circuit breaker trips, terminating idle-in-transaction connections and shedding excess load.',
      },
      {
        timeOffsetSec: 18,
        phase: 'Cluster Stabilization',
        clusterState: 'RECOVERED',
        activePrimary: `${primaryPrefix} (Active Conns: 150/1000)`,
        standbyStatus: 'Normal operation restored',
        clientImpact: 'p99 Latency normalized to 14ms.',
        circuitBreakerStatus: 'CLOSED',
        description: 'Connection flood cleared. Normal query processing resumes.',
      },
    ];

    chaosInjectionScript = `#!/usr/bin/env bash
# ==========================================================
# Chaos Fault Injection: Connection Exhaustion & Lock Contention
# Target: ${engineName}
# ==========================================================
echo "[CHAOS] Spawning 1,200 simultaneous connection threads..."
for i in {1..1200}; do
  (nc -w 300 localhost 5432 < /dev/zero > /dev/null 2>&1) &
done
echo "[CHAOS] 1,200 socket descriptors opened. Inspecting connection pooler exhaustion..."`;

  // --- Scenario 4: Replica Lag Spike ---
  } else if (scenarioId === 'replica_lag_spike') {
    scenarioTitle = `Replication Lag Avalanche & Read-After-Write Hazard (${engineName})`;
    faultType = 'REPLICA_LAG_SPIKE';
    downtimeSec = 11;
    resilienceScore = 84;

    timeline = [
      {
        timeOffsetSec: 0,
        phase: 'Nominal Replication Stream',
        clusterState: 'HEALTHY',
        activePrimary: `${primaryPrefix} (Master)`,
        standbyStatus: `${standbyPrefix} (Replication Lag: 1.2ms)`,
        clientImpact: 'Read-your-own-writes consistent across all nodes',
        circuitBreakerStatus: 'CLOSED',
        description: 'Replication catch-up keeping pace with write throughput.',
      },
      {
        timeOffsetSec: 3,
        phase: 'Bulk ETL Ingestion & Replica IO Saturation',
        clusterState: 'DEGRADED',
        activePrimary: `${primaryPrefix} (High Ingestion Rate)`,
        standbyStatus: `${standbyPrefix} (Replication Lag: 4,800ms and rising)`,
        clientImpact: 'Users reading stale records immediately after saving profile / checkout updates.',
        circuitBreakerStatus: 'OPEN',
        description: 'Massive batch UPDATE saturates single-threaded replica log apply worker.',
      },
      {
        timeOffsetSec: 7,
        phase: 'Read-Routing Failover to Primary',
        clusterState: 'FAILING_OVER',
        activePrimary: `${primaryPrefix} (Accepting critical reads)`,
        standbyStatus: `${standbyPrefix} (Replication Lag: 12,500ms - Ejected from read pool)`,
        clientImpact: 'Stale reads blocked. Critical queries routed to primary.',
        circuitBreakerStatus: 'HALF_OPEN',
        description: 'Load balancer ejects lagging replica from read pool once lag exceeds 5,000ms SLA.',
      },
      {
        timeOffsetSec: 11,
        phase: 'Replica Catch-up & Re-admission',
        clusterState: 'RECOVERED',
        activePrimary: `${primaryPrefix} (Healthy)`,
        standbyStatus: `${standbyPrefix} (Replication Lag: 8ms - Re-admitted to pool)`,
        clientImpact: 'Full read load-balancing restored across all replicas.',
        circuitBreakerStatus: 'CLOSED',
        description: 'Replica apply worker clears backlog. Read traffic redistributed.',
      },
    ];

    chaosInjectionScript = `#!/usr/bin/env bash
# ==========================================================
# Chaos Fault Injection: Replica I/O Throttling & Lag Spike
# Target: ${engineName} (${standbyPrefix})
# ==========================================================
echo "[CHAOS] Injecting 90% disk I/O latency throttle on replica..."
ssh root@${standbyPrefix} "tc qdisc add dev eth0 root netem delay 400ms 50ms"
echo "[CHAOS] Replica network and disk latency delayed. Monitoring read pool auto-ejection..."`;

  // --- Scenario 5: Disk Out of Space ---
  } else {
    scenarioTitle = `WAL / Transaction Log Storage Exhaustion (${engineName})`;
    faultType = 'DISK_OUT_OF_SPACE';
    downtimeSec = 16;
    resilienceScore = 81;

    timeline = [
      {
        timeOffsetSec: 0,
        phase: 'Normal Storage Utilization',
        clusterState: 'HEALTHY',
        activePrimary: `${primaryPrefix} (Disk Usage: 62%)`,
        standbyStatus: 'Standbys healthy',
        clientImpact: '0% Error Rate',
        circuitBreakerStatus: 'CLOSED',
        description: 'Operating normally with 150GB free on WAL / transaction log mount.',
      },
      {
        timeOffsetSec: 4,
        phase: 'Storage Threshold Breach (95%)',
        clusterState: 'DEGRADED',
        activePrimary: `${primaryPrefix} (Disk Usage: 96% - Warning Alert)`,
        standbyStatus: 'Replicas healthy',
        clientImpact: 'Elevated disk flush latency',
        circuitBreakerStatus: 'OPEN',
        description: 'Unchecked transaction log accumulation triggers critical low-disk threshold.',
      },
      {
        timeOffsetSec: 9,
        phase: 'Emergency Read-Only Lockdown (PANIC Guard)',
        clusterState: 'DEGRADED',
        activePrimary: `${primaryPrefix} (Read-Only Mode Enforced)`,
        standbyStatus: 'Replicas serving reads',
        clientImpact: 'Write transactions rejected with DISK_FULL / READ_ONLY_TRANSACTION.',
        circuitBreakerStatus: 'OPEN',
        description: 'Database daemon automatically switches to read-only to prevent catastrophic page corruption.',
      },
      {
        timeOffsetSec: 16,
        phase: 'Automated Archive Purge & Recovery',
        clusterState: 'RECOVERED',
        activePrimary: `${primaryPrefix} (Disk Usage: 45% - Read-Write Resumed)`,
        standbyStatus: 'Replication re-synchronized',
        clientImpact: 'Full read-write traffic operational.',
        circuitBreakerStatus: 'CLOSED',
        description: 'Automated WAL cleanup daemon ships archived segments to object storage and frees disk space.',
      },
    ];

    chaosInjectionScript = `#!/usr/bin/env bash
# ==========================================================
# Chaos Fault Injection: Rapid Disk Fill on Log Directory
# Target: ${engineName}
# ==========================================================
echo "[CHAOS] Filling /var/log/db with 50GB sparse file..."
fallocate -l 50G /tmp/chaos_disk_fill.dat
echo "[CHAOS] Disk threshold exceeded. Checking emergency read-only enforcement..."`;
  }

  // --- Architecture-Specific Runbooks & Config Patches ---
  if (engineFamily === 'mysql') {
    mitigationRunbook = `# ==========================================================
# SQLPulse Chaos Mitigation & Automatic Failover Runbook
# Scenario: ${scenarioTitle} (${engineName})
# High Availability Stack: ${failoverManager}
# ==========================================================

1. [AUTOMATIC] Enforce Semi-Synchronous Replication:
   SET GLOBAL rpl_semi_sync_master_enabled = 1;
   SET GLOBAL rpl_semi_sync_master_wait_no_slave = 0;
   SET GLOBAL rpl_semi_sync_master_timeout = 1000;

2. [ORCHESTRATOR] Configure Automated Leader Promotion:
   In orchestrator.conf.json:
   "RecoveryPeriodBlockSeconds": 30,
   "FailMasterPromotionIfSQLThreadNotUpToDate": true,
   "ApplyMySQLPromotionAfterMasterFailover": true

3. [CLIENT LAYER] Deploy ProxySQL Connection Multiplexing:
   - Configure split on port 6033 with fast backend health checks (every 500ms).
   - Route writes to hostgroup 10 (writer), reads to hostgroup 20 (readers).
`;
    recommendedConfigPatch = `# MySQL / MariaDB High-Availability Hardening (my.cnf)
[mysqld]
rpl_semi_sync_master_enabled = 1
rpl_semi_sync_slave_enabled = 1
rpl_semi_sync_master_timeout = 1000
innodb_flush_log_at_trx_commit = 1
sync_binlog = 1
binlog_format = ROW
gtid_mode = ON
enforce_gtid_consistency = ON
`;

  } else if (engineFamily === 'oracle') {
    mitigationRunbook = `# ==========================================================
# SQLPulse Chaos Mitigation & Automatic Failover Runbook
# Scenario: ${scenarioTitle} (${engineName})
# High Availability Stack: ${failoverManager}
# ==========================================================

1. [AUTOMATIC] Enable Oracle Data Guard Fast-Start Failover (FSFO):
   DGMGRL> ENABLE FAST_START FAILOVER;
   DGMGRL> SET FAST_START FAILOVER THRESHOLD 15;
   DGMGRL> START OBSERVER;

2. [CLIENT REDIRECTION] Configure Fast Application Notification (FAN) & ONS:
   Ensure JDBC connection pools subscribe to Fast Connection Failover (FCF):
   (DESCRIPTION=(CONNECT_TIMEOUT=5)(RETRY_COUNT=3)(ADDRESS_LIST=...)(CONNECT_DATA=(SERVICE_NAME=app_rw)))

3. [STORAGE] Enforce Maximum Availability Mode:
   DGMGRL> EDIT DATABASE primary SET PROPERTY LogXptMode='SYNC';
`;
    recommendedConfigPatch = `-- Oracle Data Guard High Availability Configuration
DG_BROKER_START = TRUE
FAST_START_FAILOVER_TARGET = 'standby_db'
FAST_START_FAILOVER_THRESHOLD = 15
LOG_ARCHIVE_DEST_2 = 'SERVICE=standby_db SYNC AFFIRM VALID_FOR=(ONLINE_LOGFILES,PRIMARY_ROLE) DB_UNIQUE_NAME=standby_db'
`;

  } else if (engineFamily === 'mssql') {
    mitigationRunbook = `# ==========================================================
# SQLPulse Chaos Mitigation & Automatic Failover Runbook
# Scenario: ${scenarioTitle} (${engineName})
# High Availability Stack: ${failoverManager}
# ==========================================================

1. [AUTOMATIC] Enforce Synchronous-Commit AlwaysOn Availability Group:
   ALTER AVAILABILITY GROUP [AG_PROD] 
   MODIFY REPLICA ON N'NODE_2' WITH (AVAILABILITY_MODE = SYNCHRONOUS_COMMIT, FAILOVER_MODE = AUTOMATIC);

2. [LISTENER] Connect via MultiSubnetFailover Listener:
   Server=tcp:ag-listener.corp.internal,1433;MultiSubnetFailover=True;Connection Timeout=15;

3. [HEALTH] Configure Health Check Thresholds:
   ALTER AVAILABILITY GROUP [AG_PROD] SET (HEALTH_CHECK_TIMEOUT = 15000);
`;
    recommendedConfigPatch = `-- SQL Server AlwaysOn Availability Group Quorum Tuning
ALTER AVAILABILITY GROUP [AG_PROD]
SET (HEALTH_CHECK_TIMEOUT = 15000, FAILURE_CONDITION_LEVEL = 3, AUTOMATED_BACKUP_PREFERENCE = SECONDARY);
`;

  } else if (engineFamily === 'mongodb') {
    mitigationRunbook = `# ==========================================================
# SQLPulse Chaos Mitigation & Automatic Failover Runbook
# Scenario: ${scenarioTitle} (${engineName})
# High Availability Stack: ${failoverManager}
# ==========================================================

1. [QUORUM] Enforce w: "majority" Write Concern across all operations:
   db.collection.insertOne(doc, { writeConcern: { w: "majority", wtimeout: 5000 } });

2. [ELECTION] Configure Replica Set Election Priority:
   rs.reconfig({
     _id: "rs0",
     members: [
       { _id: 0, host: "mongo-1:27017", priority: 2 },
       { _id: 1, host: "mongo-2:27017", priority: 1 },
       { _id: 2, host: "mongo-3:27017", priority: 1 }
     ]
   });

3. [DRIVER] Enable Retryable Writes in Connection String:
   mongodb://mongo-1,mongo-2,mongo-3/?replicaSet=rs0&retryWrites=true&w=majority
`;
    recommendedConfigPatch = `# MongoDB mongod.conf Replication Hardening
replication:
  replSetName: "rs0"
  enableMajorityReadConcern: true
setParameter:
  electionTimeoutMillis: 5000
  heartbeatIntervalMillis: 1000
`;

  } else if (engineFamily === 'redis') {
    mitigationRunbook = `# ==========================================================
# SQLPulse Chaos Mitigation & Automatic Failover Runbook
# Scenario: ${scenarioTitle} (${engineName})
# High Availability Stack: ${failoverManager}
# ==========================================================

1. [SENTINEL] Configure Quorum and Down-After-Milliseconds:
   sentinel monitor mymaster redis-master 6379 2
   sentinel down-after-milliseconds mymaster 3000
   sentinel failover-timeout mymaster 10000

2. [ZERO DATA LOSS] Enforce Minimum Replicas for Writes:
   CONFIG SET min-replicas-to-write 1
   CONFIG SET min-replicas-max-lag 5

3. [CLIENT] Enable Automatic Topology Refresh in Lettuce / Jedis client.
`;
    recommendedConfigPatch = `# Redis Sentinel & Master Hardening (redis.conf)
min-replicas-to-write 1
min-replicas-max-lag 5
appendonly yes
appendfsync everysec
cluster-node-timeout 5000
`;

  } else if (engineFamily === 'clickhouse') {
    mitigationRunbook = `# ==========================================================
# SQLPulse Chaos Mitigation & Automatic Failover Runbook
# Scenario: ${scenarioTitle} (${engineName})
# High Availability Stack: ${failoverManager}
# ==========================================================

1. [KEEPER] Configure ClickHouse Keeper 3-Node Raft Quorum:
   Ensure raft_configuration defines 3 distinct voter servers.

2. [TABLES] Use ReplicatedMergeTree for all production engines:
   ENGINE = ReplicatedMergeTree('/clickhouse/tables/{shard}/events', '{replica}')

3. [ROUTING] Deploy chproxy or Envoy with active TCP health probes on port 9000/8123.
`;
    recommendedConfigPatch = `<!-- /etc/clickhouse-server/config.d/keeper.xml -->
<clickhouse>
    <zookeeper>
        <node index="1"><host>keeper-1</host><port>9181</port></node>
        <node index="2"><host>keeper-2</host><port>9181</port></node>
        <node index="3"><host>keeper-3</host><port>9181</port></node>
        <session_timeout_ms>10000</session_timeout_ms>
    </zookeeper>
</clickhouse>
`;

  } else if (engineFamily === 'cassandra') {
    mitigationRunbook = `# ==========================================================
# SQLPulse Chaos Mitigation & Automatic Failover Runbook
# Scenario: ${scenarioTitle} (${engineName})
# High Availability Stack: ${failoverManager}
# ==========================================================

1. [CONSISTENCY] Enforce LOCAL_QUORUM on all writes and reads:
   R + W > N (e.g. Replication Factor 3: Write to 2, Read from 2 = Strong Consistency).

2. [FAILURE DETECTOR] Tune Phi Accrual Conviction Threshold in cassandra.yaml:
   phi_convict_threshold: 12

3. [SNITCH] Configure GossipingPropertyFileSnitch across multiple racks and AZs.
`;
    recommendedConfigPatch = `# Cassandra Resilience Hardening (cassandra.yaml)
endpoint_snitch: GossipingPropertyFileSnitch
phi_convict_threshold: 12
dynamic_snitch_badness_threshold: 0.1
hinted_handoff_enabled: true
max_hint_window_in_ms: 10800000 # 3 hours
`;

  } else if (engineFamily === 'sqlite') {
    mitigationRunbook = `# ==========================================================
# SQLPulse Chaos Mitigation & Recovery Runbook
# Scenario: ${scenarioTitle} (${engineName})
# ==========================================================

1. [LOCKING] Configure Busy Timeout to eliminate immediate SQLITE_BUSY crashes:
   PRAGMA busy_timeout = 5000;

2. [JOURNAL] Enforce WAL (Write-Ahead Logging) Mode:
   PRAGMA journal_mode = WAL;
   PRAGMA synchronous = NORMAL;

3. [REPLICATION] Deploy Litestream for continuous streaming replication to S3.
`;
    recommendedConfigPatch = `-- SQLite Production Robustness PRAGMAs
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;
PRAGMA wal_autocheckpoint = 1000;
`;

  } else {
    // Default: PostgreSQL
    mitigationRunbook = `# ==========================================================
# SQLPulse Chaos Mitigation & Automatic Failover Runbook
# Scenario: ${scenarioTitle} (${engineName})
# High Availability Stack: ${failoverManager}
# ==========================================================

1. [AUTOMATIC] Enforce Synchronous Replication Quorum:
   SET synchronous_commit = 'on';
   SET synchronous_standby_names = 'FIRST 1 (${standbyPrefix}, standby_3)';

2. [PATRONI DCS] Configure Raft/etcd TTL & Lease Thresholds:
   In patroni.yml:
   ttl: 15
   loop_wait: 5
   retry_timeout: 5
   maximum_lag_on_failover: 1048576 # 1MB max replication lag

3. [CLIENT RETRY] Configure Connection Pooler (PgBouncer) & Exponential Jitter:
   pool_mode = transaction
   server_idle_timeout = 30
   query_wait_timeout = 10
`;
    recommendedConfigPatch = `# PostgreSQL High-Availability Hardening (postgresql.conf)
synchronous_commit = on
synchronous_standby_names = 'ANY 1 (standby_1, standby_2)'
wal_keep_size = 4096MB
hot_standby_feedback = on
max_standby_streaming_delay = 30s
restart_after_crash = off # Prevent crashed primary from restarting without DCS clearance
`;
  }

  return {
    engine: rawEngine,
    engineName,
    scenarioId,
    scenarioTitle,
    faultType,
    totalDowntimeEstimatedSec: downtimeSec,
    dataLossRisk,
    timeline,
    resilienceScore,
    mitigationRunbook,
    recommendedConfigPatch,
    chaosInjectionScript,
    clusterTopologySummary: {
      clusterSize,
      quorumRequirement: `${majorityVotes}/${clusterSize} Nodes (${consensusProtocol})`,
      failoverManager,
      consensusProtocol,
      syncMode,
    },
  };
}
