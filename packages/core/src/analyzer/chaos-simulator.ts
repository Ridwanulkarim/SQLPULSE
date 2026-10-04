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

export interface ChaosSimulationResult {
  engine: string;
  scenarioId: string;
  scenarioTitle: string;
  faultType: 'PRIMARY_CRASH' | 'NETWORK_SPLIT' | 'REPLICA_LAG_SPIKE' | 'CONNECTION_STARVATION' | 'DISK_OUT_OF_SPACE';
  totalDowntimeEstimatedSec: number;
  dataLossRisk: 'ZERO_DATA_LOSS_SYNC' | 'SUB_SECOND_ASYNC' | 'DATA_LOSS_WARNING';
  timeline: ChaosStep[];
  resilienceScore: number; 
  mitigationRunbook: string;
  recommendedConfigPatch: string;
}

export function simulateChaosScenario(options: {
  engine?: string;
  scenarioId?: string;
  clusterSize?: number;
  syncMode?: 'sync' | 'async';
}): ChaosSimulationResult {
  const engine = (options.engine || 'postgresql').toLowerCase();
  const scenarioId = options.scenarioId || 'primary_crash';

  let scenarioTitle = 'Sudden Primary Node Crash & Quorum Failover';
  let faultType: ChaosSimulationResult['faultType'] = 'PRIMARY_CRASH';
  let downtimeSec = 14;
  let timeline: ChaosStep[] = [];

  if (scenarioId === 'network_split') {
    scenarioTitle = 'Split-Brain Quorum & Network Partition';
    faultType = 'NETWORK_SPLIT';
    downtimeSec = 8;
    timeline = [
      {
        timeOffsetSec: 0,
        phase: 'Steady State',
        clusterState: 'HEALTHY',
        activePrimary: 'pg-node-primary-us-east',
        standbyStatus: '2x Sync Standbys in Quorum (lag: 1.2ms)',
        clientImpact: '0% Error Rate, Latency 4.2ms',
        circuitBreakerStatus: 'CLOSED',
        description: 'Cluster operating normally across multi-AZ topology.',
      },
      {
        timeOffsetSec: 3,
        phase: 'Network Partition Triggered',
        clusterState: 'SPLIT_BRAIN',
        activePrimary: 'Isolated Old Primary',
        standbyStatus: 'Standbys lose heartbeat to Primary',
        clientImpact: 'Client writes fail on split segment',
        circuitBreakerStatus: 'OPEN',
        description: 'Network link between AZ-a and AZ-b severed. Patroni / Raft quorum initiates election.',
      },
      {
        timeOffsetSec: 7,
        phase: 'Fencing & STONITH',
        clusterState: 'FAILING_OVER',
        activePrimary: 'Demoting Old Primary',
        standbyStatus: 'Promoting Standby-1 via majority consensus (2/3 votes)',
        clientImpact: 'Writes queued in connection pooler buffer',
        circuitBreakerStatus: 'OPEN',
        description: 'Old primary is fenced (self-terminated) to prevent split-brain dual writes.',
      },
      {
        timeOffsetSec: 11,
        phase: 'Cluster Stabilized',
        clusterState: 'RECOVERED',
        activePrimary: 'pg-node-standby-1 (New Primary)',
        standbyStatus: '1x Standby re-attached, old primary healing as standby',
        clientImpact: 'Writes resumed, 0 data loss',
        circuitBreakerStatus: 'CLOSED',
        description: 'New primary accepting read-write traffic. Full quorum restored.',
      }
    ];
  } else if (scenarioId === 'connection_starvation') {
    scenarioTitle = 'Connection Starvation & Thundering Herd Storm';
    faultType = 'CONNECTION_STARVATION';
    downtimeSec = 22;
    timeline = [
      {
        timeOffsetSec: 0,
        phase: 'Baseline Load',
        clusterState: 'HEALTHY',
        activePrimary: 'Primary (85 active conns)',
        standbyStatus: 'Replicas healthy',
        clientImpact: 'p99 latency 12ms',
        circuitBreakerStatus: 'CLOSED',
        description: 'Application services running within connection pool thresholds.',
      },
      {
        timeOffsetSec: 4,
        phase: 'Traffic Burst & Slow Query Lock',
        clusterState: 'DEGRADED',
        activePrimary: 'Primary (950 active conns / 1000 max)',
        standbyStatus: 'Replicas under-utilized',
        clientImpact: '504 Gateway Timeouts on upstream API',
        circuitBreakerStatus: 'OPEN',
        description: 'An unindexed heavy query holds an exclusive table lock, queueing 800+ worker threads.',
      },
      {
        timeOffsetSec: 12,
        phase: 'Context Switch Thrashing',
        clusterState: 'DEGRADED',
        activePrimary: 'CPU 100% (Kernel spinlocks)',
        standbyStatus: 'Replicas serving stale reads',
        clientImpact: 'Total API write stall',
        circuitBreakerStatus: 'OPEN',
        description: 'Postgres server spends 90% of CPU cycles swapping process memory rather than executing queries.',
      },
      {
        timeOffsetSec: 18,
        phase: 'Pooler Rate Limiting Triggered',
        clusterState: 'RECOVERED',
        activePrimary: 'Primary (Stabilized at 120 pooler conns)',
        standbyStatus: 'Replicas balanced',
        clientImpact: 'p99 latency returned to 15ms',
        circuitBreakerStatus: 'CLOSED',
        description: 'PgBouncer / Envoy drops queued excess queries and kills idle-in-transaction connections.',
      }
    ];
  } else {
    
    timeline = [
      {
        timeOffsetSec: 0,
        phase: 'Normal Operation',
        clusterState: 'HEALTHY',
        activePrimary: 'primary-node-01',
        standbyStatus: 'replica-node-02 (sync, lag 0ms)',
        clientImpact: '0% Error Rate',
        circuitBreakerStatus: 'CLOSED',
        description: 'Primary processing 8,500 QPS with synchronous replication.',
      },
      {
        timeOffsetSec: 2,
        phase: 'Kernel Panic / Hardware Crash',
        clusterState: 'DEGRADED',
        activePrimary: 'primary-node-01 (Unresponsive)',
        standbyStatus: 'Heartbeat timeout missed (3s)',
        clientImpact: 'Active in-flight transactions aborted',
        circuitBreakerStatus: 'OPEN',
        description: 'Primary node ceases heartbeats. Raft/Consul consensus initiates leader election.',
      },
      {
        timeOffsetSec: 8,
        phase: 'Standby Promotion & DNS Switch',
        clusterState: 'FAILING_OVER',
        activePrimary: 'Promoting replica-node-02',
        standbyStatus: 'WAL replay completed up to LSN 0/14B2890',
        clientImpact: 'Connection pool reconnecting to new VIP',
        circuitBreakerStatus: 'HALF_OPEN',
        description: 'Standby promoted to Read-Write mode. Virtual IP / Route53 DNS shifted.',
      },
      {
        timeOffsetSec: 14,
        phase: 'Full Recovery',
        clusterState: 'RECOVERED',
        activePrimary: 'replica-node-02 (Promoted Master)',
        standbyStatus: 'Autoscaled new replica joining cluster',
        clientImpact: 'Normal operation restored',
        circuitBreakerStatus: 'CLOSED',
        description: 'All application nodes routed to new master. Zero data loss verified.',
      }
    ];
  }

  const resilienceScore = scenarioId === 'primary_crash' ? 92 : scenarioId === 'network_split' ? 88 : 79;

  let mitigationRunbook = '';
  let recommendedConfigPatch = '';

  if (engine.includes('mysql') || engine.includes('maria')) {
    mitigationRunbook = `# ==========================================================
# SQLPulse Chaos Mitigation & Automatic Failover Runbook
# Scenario: ${scenarioTitle} (${engine.toUpperCase()})
# ==========================================================

1. [AUTOMATIC] Enforce Semi-Synchronous Replication:
   SET GLOBAL rpl_semi_sync_master_enabled = 1;
   SET GLOBAL rpl_semi_sync_master_wait_no_slave = 0;
   SET GLOBAL rpl_semi_sync_master_timeout = 1000;

2. [CLIENT] Deploy ProxySQL / MySQL Router Layer:
   Configure automatic read/write split with health checks on port 6033.

3. [STORAGE] Enforce ACID Zero-Data-Loss Durability:
   SET GLOBAL innodb_flush_log_at_trx_commit = 1;
   SET GLOBAL sync_binlog = 1;
`;
    recommendedConfigPatch = `rpl_semi_sync_master_enabled = 1
rpl_semi_sync_slave_enabled = 1
rpl_semi_sync_master_timeout = 1000
innodb_flush_log_at_trx_commit = 1
sync_binlog = 1
binlog_format = ROW
binlog_row_image = MINIMAL
`;
  } else if (engine.includes('oracle')) {
    mitigationRunbook = `# ==========================================================
# SQLPulse Chaos Mitigation & Automatic Failover Runbook
# Scenario: ${scenarioTitle} (${engine.toUpperCase()})
# ==========================================================

1. [AUTOMATIC] Enable Oracle Data Guard Fast-Start Failover (FSFO):
   DGMGRL> ENABLE FAST_START FAILOVER;
   DGMGRL> SET FAST_START FAILOVER THRESHOLD 30;

2. [CLIENT] Configure Oracle Fast Application Notification (FAN) & ONS:
   Ensure JDBC connection pool subscribes to Fast Connection Failover (FCF).

3. [DATA GUARD] Enforce Maximum Availability Mode:
   DGMGRL> EDIT DATABASE primary SET PROPERTY LogXptMode='SYNC';
`;
    recommendedConfigPatch = `DG_BROKER_START = TRUE
FAST_START_FAILOVER_TARGET = 'standby_db'
LOG_ARCHIVE_DEST_2 = 'SERVICE=standby_db SYNC AFFIRM VALID_FOR=(ONLINE_LOGFILES,PRIMARY_ROLE) DB_UNIQUE_NAME=standby_db'
`;
  } else if (engine.includes('sqlserver') || engine.includes('mssql')) {
    mitigationRunbook = `# ==========================================================
# SQLPulse Chaos Mitigation & Automatic Failover Runbook
# Scenario: ${scenarioTitle} (${engine.toUpperCase()})
# ==========================================================

1. [AUTOMATIC] Enforce Synchronous-Commit AlwaysOn Availability Group:
   ALTER AVAILABILITY GROUP [AG_PROD] 
   MODIFY REPLICA ON N'NODE_2' WITH (AVAILABILITY_MODE = SYNCHRONOUS_COMMIT, FAILOVER_MODE = AUTOMATIC);

2. [CLIENT] Connect via MultiSubnetFailover Listener:
   Server=tcp:ag-listener.corp.internal,1433;MultiSubnetFailover=True;
`;
    recommendedConfigPatch = `ALTER AVAILABILITY GROUP [AG_PROD]
SET (HEALTH_CHECK_TIMEOUT = 30000, AUTOMATED_BACKUP_PREFERENCE = SECONDARY);
`;
  } else if (engine.includes('mongo')) {
    mitigationRunbook = `# ==========================================================
# SQLPulse Chaos Mitigation & Automatic Failover Runbook
# Scenario: ${scenarioTitle} (${engine.toUpperCase()})
# ==========================================================

1. [QUORUM] Enforce w: "majority" Write Concern:
   db.collection.insertOne(doc, { writeConcern: { w: "majority", wtimeout: 5000 } });

2. [ELECTION] Configure Replica Set Priority Hierarchy:
   rs.reconfig({ members: [{ _id: 0, host: "primary:27017", priority: 2 }, { _id: 1, host: "secondary:27017", priority: 1 }] });
`;
    recommendedConfigPatch = `replication:
  replSetName: "rs0"
  enableMajorityReadConcern: true
`;
  } else {
    // Default: PostgreSQL
    mitigationRunbook = `# ==========================================================
# SQLPulse Chaos Mitigation & Automatic Failover Runbook
# Scenario: ${scenarioTitle} (${engine.toUpperCase()})
# ==========================================================

1. [AUTOMATIC] Enforce Synchronous Replication Quorum:
   SET synchronous_commit = 'on';
   SET synchronous_standby_names = 'FIRST 1 (standby_1, standby_2)';

2. [CLIENT] Configure Retry with Exponential Backoff:
   Enable max_retries = 3 with jitter in database client pool.

3. [POOLER] Deploy PgBouncer in Front of PostgreSQL:
   pool_mode = transaction
   default_pool_size = 50
   reserve_pool_size = 10
   server_idle_timeout = 60
`;
    recommendedConfigPatch = `synchronous_commit = on
synchronous_standby_names = 'ANY 1 (node_2, node_3)'
wal_keep_size = 4096MB
hot_standby_feedback = on
max_standby_streaming_delay = 30s
`;
  }

  return {
    engine,
    scenarioId,
    scenarioTitle,
    faultType,
    totalDowntimeEstimatedSec: downtimeSec,
    dataLossRisk: 'ZERO_DATA_LOSS_SYNC',
    timeline,
    resilienceScore,
    mitigationRunbook,
    recommendedConfigPatch,
  };
}
