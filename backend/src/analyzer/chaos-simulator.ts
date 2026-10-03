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
  resilienceScore: number; // 0-100
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
    // Default primary crash
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

  const mitigationRunbook = `# ==========================================================
# SQLPulse Chaos Mitigation & Automatic Failover Runbook
# Scenario: ${scenarioTitle}
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

  const recommendedConfigPatch = `synchronous_commit = on
synchronous_standby_names = 'ANY 1 (node_2, node_3)'
wal_keep_size = 4096MB
hot_standby_feedback = on
max_standby_streaming_delay = 30s
`;

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
