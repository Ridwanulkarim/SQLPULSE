import { getEngineMetadata } from '../types/db-catalog.data';
import { getEngineProfile } from '../types/engine-profiles';

export interface ChaosNodeStatus {
  name: string;
  role: 'primary' | 'standby' | 'promoted_leader' | 'isolated' | 'crashed' | 'witness';
  state: 'ONLINE' | 'OFFLINE' | 'VOTING' | 'REPLAYING' | 'FENCED';
  quorumVote: boolean;
  latencyMs: number;
}

export interface ChaosStep {
  stepIndex: number;
  timeOffsetSec: number;
  phase: string;
  clusterState: 'HEALTHY' | 'DEGRADED' | 'FAILING_OVER' | 'SPLIT_BRAIN' | 'RECOVERED';
  activePrimary: string;
  standbyStatus: string;
  clientImpact: string;
  circuitBreakerStatus: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  description: string;
  nodeStates?: ChaosNodeStatus[];
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

function resolveEngineDetails(rawEngine: string): {
  family: string;
  name: string;
  port: number;
  process: string;
  failoverManager: string;
  consensusProtocol: string;
  primaryPrefix: string;
  standbyPrefix: string;
  isPostgresFamily: boolean;
} {
  const norm = (rawEngine || 'postgresql').toLowerCase().trim();
  const profile = getEngineProfile(rawEngine || 'postgresql');
  const meta = getEngineMetadata(rawEngine || 'postgresql');

  if (norm.includes('mysql') || norm.includes('maria') || norm.includes('tidb') || norm.includes('percona') || profile.family === 'mysql') {
    return {
      family: 'mysql',
      name: 'MySQL / MariaDB',
      port: 3306,
      process: 'mysqld',
      failoverManager: 'Orchestrator + ProxySQL',
      consensusProtocol: 'Group Replication (Paxos)',
      primaryPrefix: 'mysql-writer-az1',
      standbyPrefix: 'mysql-reader-az2',
      isPostgresFamily: false,
    };
  }
  if (norm.includes('oracle') || profile.family === 'oracle') {
    return {
      family: 'oracle',
      name: 'Oracle Database',
      port: 1521,
      process: 'oracle',
      failoverManager: 'Data Guard Broker (FSFO)',
      consensusProtocol: 'Observer Quorum',
      primaryPrefix: 'oracle-prim-az1',
      standbyPrefix: 'oracle-stby-az2',
      isPostgresFamily: false,
    };
  }
  if (norm.includes('db2') || profile.family === 'db2') {
    return {
      family: 'db2',
      name: 'IBM DB2',
      port: 50000,
      process: 'db2sysc',
      failoverManager: 'TSA (Tivoli Storage Automation) / Pacemaker',
      consensusProtocol: 'HADR Peer State Quorum',
      primaryPrefix: 'db2-hadr-prim',
      standbyPrefix: 'db2-hadr-stby',
      isPostgresFamily: false,
    };
  }
  if (norm.includes('sap_hana') || norm.includes('hana') || profile.family === 'sap_hana') {
    return {
      family: 'sap_hana',
      name: 'SAP HANA',
      port: 30015,
      process: 'hdbnameserver',
      failoverManager: 'SAP HANA System Replication (HSR) + Pacemaker',
      consensusProtocol: 'HSR Sync Quorum with STONITH',
      primaryPrefix: 'hana-prim-site1',
      standbyPrefix: 'hana-sec-site2',
      isPostgresFamily: false,
    };
  }
  if (norm.includes('sqlserver') || norm.includes('mssql') || norm.includes('azure_sql') || profile.family === 'sqlserver') {
    return {
      family: 'mssql',
      name: 'Microsoft SQL Server',
      port: 1433,
      process: 'sqlservr',
      failoverManager: 'AlwaysOn WSFC / Pacemaker',
      consensusProtocol: 'Majority Node & File Share Witness',
      primaryPrefix: 'sql-ag-prim-01',
      standbyPrefix: 'sql-ag-sec-02',
      isPostgresFamily: false,
    };
  }
  if (norm.includes('mongo') || norm.includes('document') || profile.family === 'document') {
    return {
      family: 'mongodb',
      name: 'MongoDB',
      port: 27017,
      process: 'mongod',
      failoverManager: 'Replica Set Internal Election',
      consensusProtocol: 'MongoDB v1 Election (Raft-like)',
      primaryPrefix: 'mongo-prim-01',
      standbyPrefix: 'mongo-sec-02',
      isPostgresFamily: false,
    };
  }
  if (norm.includes('redis') || norm.includes('keydb') || norm.includes('dragonfly') || norm.includes('valkey') || profile.family === 'keyvalue') {
    return {
      family: 'redis',
      name: 'Redis',
      port: 6379,
      process: 'redis-server',
      failoverManager: 'Redis Sentinel / Redis Cluster',
      consensusProtocol: 'Sentinel Quorum Majority',
      primaryPrefix: 'redis-master-az1',
      standbyPrefix: 'redis-replica-az2',
      isPostgresFamily: false,
    };
  }
  if (norm.includes('click') || norm.includes('starrocks') || norm.includes('trino')) {
    return {
      family: 'clickhouse',
      name: 'ClickHouse',
      port: 8123,
      process: 'clickhouse-server',
      failoverManager: 'ClickHouse Keeper / ZooKeeper',
      consensusProtocol: 'Keeper Raft Quorum',
      primaryPrefix: 'ch-node1-leader',
      standbyPrefix: 'ch-node2-replica',
      isPostgresFamily: false,
    };
  }
  if (norm.includes('cassandra') || norm.includes('scylla') || profile.family === 'wide_column') {
    return {
      family: 'cassandra',
      name: 'Apache Cassandra / ScyllaDB',
      port: 9042,
      process: 'cassandra',
      failoverManager: 'Gossip Failure Detector (Phi Accrual)',
      consensusProtocol: 'Paxos LWT / Peer-to-Peer',
      primaryPrefix: 'cass-node1-rack1',
      standbyPrefix: 'cass-node2-rack2',
      isPostgresFamily: false,
    };
  }
  if (norm.includes('sqlite') || norm.includes('turso') || norm.includes('libsql') || profile.family === 'embedded') {
    return {
      family: 'sqlite',
      name: 'SQLite / Embedded',
      port: 8080,
      process: 'sqlite3',
      failoverManager: 'WAL Lock Manager / Litestream',
      consensusProtocol: 'Filesystem Shm Mutex',
      primaryPrefix: 'sqlite-writer-proc',
      standbyPrefix: 'sqlite-reader-proc',
      isPostgresFamily: false,
    };
  }
  if (norm.includes('snow') || norm.includes('bigquery') || norm.includes('redshift') || profile.family === 'columnar_olap') {
    return {
      family: 'snowflake',
      name: 'Cloud Data Warehouse (Snowflake)',
      port: 443,
      process: 'snowflake-wh',
      failoverManager: 'Cloud Control Plane Auto-Healing',
      consensusProtocol: 'Stateless Compute Redundancy',
      primaryPrefix: 'dw-compute-wh-1',
      standbyPrefix: 'dw-compute-wh-2',
      isPostgresFamily: false,
    };
  }
  if (norm.includes('elastic') || norm.includes('opensearch') || norm.includes('solr') || profile.family === 'search') {
    return {
      family: 'elasticsearch',
      name: 'Elasticsearch / OpenSearch',
      port: 9200,
      process: 'elasticsearch',
      failoverManager: 'Master Node Quorum (Cluster Coordination)',
      consensusProtocol: 'Raft Cluster State Consensus',
      primaryPrefix: 'es-master-node-01',
      standbyPrefix: 'es-data-node-02',
      isPostgresFamily: false,
    };
  }
  if (norm.includes('milvus') || norm.includes('qdrant') || norm.includes('pinecone') || norm.includes('weaviate') || profile.family === 'vector') {
    return {
      family: 'vector',
      name: 'Milvus / Vector Engine',
      port: 19530,
      process: 'milvus-coordinator',
      failoverManager: 'Coordinator Active-Standby / etcd Lease',
      consensusProtocol: 'Raft Coordinator Quorum',
      primaryPrefix: 'milvus-coord-primary',
      standbyPrefix: 'milvus-query-node-02',
      isPostgresFamily: false,
    };
  }
  if (norm.includes('neo4j') || norm.includes('memgraph') || profile.family === 'graph') {
    return {
      family: 'neo4j',
      name: 'Neo4j Graph Database',
      port: 7687,
      process: 'neo4j',
      failoverManager: 'Causal Clustering Core Quorum',
      consensusProtocol: 'Raft Protocol Consensus',
      primaryPrefix: 'neo4j-core-leader-01',
      standbyPrefix: 'neo4j-core-follower-02',
      isPostgresFamily: false,
    };
  }
  if (norm.includes('influx') || profile.family === 'timeseries') {
    return {
      family: 'influx',
      name: 'InfluxDB',
      port: 8086,
      process: 'influxd',
      failoverManager: 'InfluxDB High-Availability Influx-Relay / Cluster',
      consensusProtocol: 'TSM Ring Quorum',
      primaryPrefix: 'influx-node-01',
      standbyPrefix: 'influx-node-02',
      isPostgresFamily: false,
    };
  }
  if (norm.includes('timescale')) {
    return {
      family: 'timescale',
      name: 'TimescaleDB',
      port: 5432,
      process: 'postgres',
      failoverManager: 'Patroni + etcd',
      consensusProtocol: 'Distributed DCS Raft',
      primaryPrefix: 'ts-writer-01',
      standbyPrefix: 'ts-reader-02',
      isPostgresFamily: true,
    };
  }
  if (norm.includes('cockroach') || norm.includes('yugabyte')) {
    return {
      family: 'cockroach',
      name: 'CockroachDB / YugabyteDB',
      port: 26257,
      process: 'cockroach',
      failoverManager: 'Range Leaseholder Auto-Rebalancing',
      consensusProtocol: 'Multi-Raft Consensus per Range',
      primaryPrefix: 'crdb-node-az1',
      standbyPrefix: 'crdb-node-az2',
      isPostgresFamily: false,
    };
  }
  if (norm.includes('kafka') || norm.includes('redpanda')) {
    return {
      family: 'kafka',
      name: 'Apache Kafka / Redpanda',
      port: 9092,
      process: 'kafka-broker',
      failoverManager: 'KRaft Controller Quorum',
      consensusProtocol: 'KRaft Quorum Protocol',
      primaryPrefix: 'kafka-broker-leader-1',
      standbyPrefix: 'kafka-broker-follower-2',
      isPostgresFamily: false,
    };
  }
  if (profile.isPostgresFamily) {
    return {
      family: 'postgres',
      name: meta.name || 'PostgreSQL',
      port: 5432,
      process: 'postgres',
      failoverManager: 'Patroni + etcd',
      consensusProtocol: 'Raft Consensus',
      primaryPrefix: 'pg-primary-node-01',
      standbyPrefix: 'pg-standby-node-02',
      isPostgresFamily: true,
    };
  }
  return {
    family: 'generic',
    name: meta.name || 'Database',
    port: profile.connection.defaultPort || 8080,
    process: `${meta.id || 'db'}-daemon`,
    failoverManager: `${meta.name} High-Availability Supervisor`,
    consensusProtocol: 'Quorum Consensus Protocol',
    primaryPrefix: `${meta.id || 'node'}-prim-01`,
    standbyPrefix: `${meta.id || 'node'}-sec-02`,
    isPostgresFamily: false,
  };
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

  const eng = resolveEngineDetails(rawEngine);
  const profile = getEngineProfile(options.engine || 'postgresql');

  // Helper to generate node statuses for a cluster of size N
  const buildNodes = (overrides: {
    primaryState?: 'ONLINE' | 'OFFLINE' | 'VOTING' | 'FENCED';
    primaryRole?: ChaosNodeStatus['role'];
    standbyStates?: 'ONLINE' | 'OFFLINE' | 'VOTING' | 'REPLAYING' | 'FENCED';
    promotedIndex?: number;
    splitPartitionIndex?: number;
  }): ChaosNodeStatus[] => {
    const list: ChaosNodeStatus[] = [];
    // Node 0 is original primary
    list.push({
      name: `${eng.primaryPrefix}`,
      role: overrides.primaryRole || 'primary',
      state: overrides.primaryState || 'ONLINE',
      quorumVote: overrides.primaryState === 'ONLINE' || overrides.primaryState === 'VOTING',
      latencyMs: overrides.primaryState === 'OFFLINE' ? 0 : 2,
    });

    for (let i = 1; i < clusterSize; i++) {
      const isPromoted = overrides.promotedIndex === i;
      const isSplit = overrides.splitPartitionIndex !== undefined && i >= overrides.splitPartitionIndex;
      list.push({
        name: i === 1 ? eng.standbyPrefix : `${eng.family}-replica-0${i + 1}`,
        role: isPromoted ? 'promoted_leader' : isSplit ? 'isolated' : 'standby',
        state: isPromoted ? 'ONLINE' : (overrides.standbyStates || 'ONLINE'),
        quorumVote: true,
        latencyMs: 3 + i * 2,
      });
    }
    return list;
  };

  let scenarioTitle = 'Sudden Primary Crash & Quorum Failover';
  let faultType: ChaosSimulationResult['faultType'] = 'PRIMARY_CRASH';
  let downtimeSec = syncMode === 'sync' ? 7 : 12;
  let timeline: ChaosStep[] = [];
  let resilienceScore = 92;
  let mitigationRunbook = '';
  let recommendedConfigPatch = '';
  let chaosInjectionScript = '';

  const dataLossRisk: ChaosSimulationResult['dataLossRisk'] =
    syncMode === 'sync' ? 'ZERO_DATA_LOSS_SYNC' : 'SUB_SECOND_ASYNC';

  switch (scenarioId) {
    case 'network_split': {
      scenarioTitle = `Split-Brain Network Partition & Quorum Fencing (${eng.name})`;
      faultType = 'NETWORK_SPLIT';
      downtimeSec = 9;
      resilienceScore = 89;

      timeline = [
        {
          stepIndex: 1,
          timeOffsetSec: 0,
          phase: 'Baseline Multi-AZ Mesh',
          clusterState: 'HEALTHY',
          activePrimary: `${eng.primaryPrefix} (AZ-East-1a)`,
          standbyStatus: `${clusterSize - 1}x Standbys across AZ-East-1b/1c in active sync`,
          clientImpact: '0% Error Rate, Latency p99: 8.4ms',
          circuitBreakerStatus: 'CLOSED',
          description: `Healthy multi-AZ replication mesh operating via ${eng.consensusProtocol}.`,
          nodeStates: buildNodes({ primaryState: 'ONLINE' }),
        },
        {
          stepIndex: 2,
          timeOffsetSec: 3,
          phase: 'Inter-AZ Network Blackhole',
          clusterState: 'SPLIT_BRAIN',
          activePrimary: `${eng.primaryPrefix} (Isolated Partition)`,
          standbyStatus: `AZ-1b and AZ-1c isolated from old primary. Heartbeat severed.`,
          clientImpact: 'Clients in AZ-1a attempt writes; clients in AZ-1b receive gateway timeouts.',
          circuitBreakerStatus: 'OPEN',
          description: `Network switch failure drops all TCP traffic on port ${eng.port} between AZ-1a and remaining availability zones.`,
          nodeStates: buildNodes({ primaryRole: 'isolated', primaryState: 'ONLINE', splitPartitionIndex: 1 }),
        },
        {
          stepIndex: 3,
          timeOffsetSec: 6,
          phase: 'Quorum Evaluation & STONITH Fencing',
          clusterState: 'FAILING_OVER',
          activePrimary: 'Demoting Isolated Leader (No Quorum)',
          standbyStatus: `AZ-1b and AZ-1c form majority quorum (${majorityVotes}/${clusterSize} votes).`,
          clientImpact: 'Write requests paused in proxy connection buffer.',
          circuitBreakerStatus: 'OPEN',
          description: `Old isolated leader fails quorum lease renewal and executes STONITH self-fencing to avoid split-brain data divergence.`,
          nodeStates: buildNodes({ primaryRole: 'crashed', primaryState: 'FENCED', standbyStates: 'VOTING' }),
        },
        {
          stepIndex: 4,
          timeOffsetSec: 9,
          phase: 'New Primary Leader Promoted',
          clusterState: 'RECOVERED',
          activePrimary: `${eng.standbyPrefix} (New Quorum Leader)`,
          standbyStatus: 'Remaining majority nodes acknowledge new leader lease.',
          clientImpact: 'Writes resume through updated service mesh routing. Zero data loss.',
          circuitBreakerStatus: 'CLOSED',
          description: `Majority partition safely accepts traffic. Split-brain permanently prevented.`,
          nodeStates: buildNodes({ primaryRole: 'crashed', primaryState: 'OFFLINE', promotedIndex: 1 }),
        },
      ];

      chaosInjectionScript = `#!/usr/bin/env bash
# ==========================================================
# Chaos Fault Injection: Network Partition (Split-Brain)
# Target: ${eng.name} (Port ${eng.port})
# ==========================================================
echo "[CHAOS] Severing network traffic between AZ-1a and other zones using iptables..."
ssh root@${eng.primaryPrefix} "iptables -A INPUT -p tcp --dport ${eng.port} -j DROP"

# Or via Toxiproxy CLI:
toxiproxy-cli toxic add ${eng.family}_proxy -t timeout -a timeout=0
echo "[CHAOS] Network partition active on port ${eng.port}. Monitoring node fencing via ${eng.failoverManager}..."`;

      if (eng.family === 'mysql') {
        mitigationRunbook = `# ==========================================================
# SRE Runbook: MySQL Network Partition & Split-Brain Mitigation
# Stack: ${eng.failoverManager} (${eng.consensusProtocol})
# ==========================================================

1. [QUORUM PROTECTION] Verify Group Replication / Semi-Sync majority partition:
   SELECT * FROM performance_schema.replication_group_members;
   -- Enforce rpl_semi_sync_master_wait_no_slave = 1 to halt rogue master commits.
   -- Nodes on minority partition automatically transition to ERROR / UNREACHABLE.

2. [STONITH FENCING] Configure automated uncontactable node exit:
   SET GLOBAL group_replication_unreachable_majority_timeout = 10;
   SET GLOBAL group_replication_auto_increment_increment = ${clusterSize};

3. [PROXY ROUTING] Re-route client ingress:
   ProxySQL automatically decouples the minority hostgroup and directs all traffic to the active writer.`;

        recommendedConfigPatch = `# MySQL / MariaDB Split-Brain Fencing (my.cnf)
[mysqld]
gtid_mode = ON
enforce_gtid_consistency = ON
rpl_semi_sync_master_enabled = 1
group_replication_unreachable_majority_timeout = 10
group_replication_single_primary_mode = ON
group_replication_enforce_update_everywhere_checks = OFF
loose-group_replication_exit_state_action = READ_ONLY
`;
      } else if (eng.family === 'oracle') {
        mitigationRunbook = `# ==========================================================
# SRE Runbook: Oracle Data Guard Split-Brain Fencing
# Stack: ${eng.failoverManager}
# ==========================================================

1. [OBSERVER FENCING] Fast-Start Failover (FSFO) evaluates quorum:
   DGMGRL> SHOW FAST_START FAILOVER;
   -- Observer confirms primary is isolated from both standby and witness.

2. [ISOLATION] Primary automatically disables redo generation:
   Isolated database aborts transactions with ORA-16816.

3. [PROMOTION] Standby assumes PRIMARY role without split-brain risk:
   DGMGRL> SHOW CONFIGURATION;`;

        recommendedConfigPatch = `-- Oracle Data Guard Partition Fencing
DGMGRL> EDIT CONFIGURATION SET PROPERTY FastStartFailoverThreshold = 10;
DGMGRL> EDIT DATABASE '${eng.primaryPrefix}' SET PROPERTY NetTimeout = 10;
`;
      } else if (eng.family === 'mssql') {
        mitigationRunbook = `# ==========================================================
# SRE Runbook: SQL Server AlwaysOn Quorum Fencing
# Stack: ${eng.failoverManager}
# ==========================================================

1. [QUORUM HEALTH] Inspect cluster vote status:
   SELECT member_name, member_state_desc, number_of_quorum_votes FROM sys.dm_hadr_cluster_members;

2. [WITNESS LEASE] Majority partition claims Cloud / File Share Witness:
   Minority partition automatically yields and stops SQL Server engine to prevent split writes.

3. [LISTENER ROUTING] DNS / VNN shifts to new AG primary.`;

        recommendedConfigPatch = `-- SQL Server WSFC Quorum Hardening
ALTER AVAILABILITY GROUP [AG_PROD] SET (
    HEALTH_CHECK_TIMEOUT = 10000,
    DB_FAILOVER = ON,
    REQUIRED_SYNCHRONIZED_SECONDARIES_TO_COMMIT = 1
);
`;
      } else if (eng.isPostgresFamily) {
        mitigationRunbook = `# ==========================================================
# SRE Runbook: ${eng.name} Split-Brain Network Partition
# Stack: ${eng.failoverManager} (${eng.consensusProtocol})
# ==========================================================

1. [DCS LEASE] Check DCS leader lock acquisition:
   etcdctl endpoint health
   -- Minority partition nodes fail to renew etcd/Consul leader key within TTL (10s).

2. [WATCHDOG STONITH] Hardware watchdog trigger:
   Old isolated primary self-terminates via softdog / Linux watchdog device.

3. [SERVICE MESH] Consul / HAProxy health checks fail on port ${eng.port}, switching VIP to the new quorum leader.`;

        recommendedConfigPatch = `# ${eng.name} Split-Brain Mitigation (patroni.yml)
dcs:
  ttl: 15
  loop_wait: 5
  retry_timeout: 5
  synchronous_mode: true
  synchronous_mode_strict: true
watchdog:
  mode: automatic
  device: /dev/watchdog
  safety_margin: 5
`;
      } else {
        mitigationRunbook = `# ==========================================================
# SRE Runbook: ${eng.name} Split-Brain Network Partition Mitigation
# Stack: ${eng.failoverManager} (${eng.consensusProtocol})
# ==========================================================

1. [QUORUM ISOLATION] Verify majority partition consensus:
   Minority partition automatically steps down and rejects write transactions.

2. [FENCING] Fencing supervisor isolates stale primary node:
   Cluster manager fences partitioned node to guarantee zero diverging writes.

3. [SERVICE DISCOVERY] Client load balancer routes writes strictly to the active majority leader.`;

        recommendedConfigPatch = `# ${eng.name} Split-Brain Fencing Configuration (${profile.memoryParams.configFile})
cluster.quorum_majority_required = true
cluster.network_partition_handling = auto-fence-minority
cluster.split_brain_resolver = strict-majority
`;
      }
      break;
    }

    case 'connection_starvation': {
      scenarioTitle = `Thundering Herd Storm & Connection Pool Saturation (${eng.name})`;
      faultType = 'CONNECTION_STARVATION';
      downtimeSec = 18;
      resilienceScore = 78;

      timeline = [
        {
          stepIndex: 1,
          timeOffsetSec: 0,
          phase: 'Nominal Connection Usage',
          clusterState: 'HEALTHY',
          activePrimary: `${eng.primaryPrefix} (Active Conns: 120/1000)`,
          standbyStatus: 'Replicas serving read pool normally',
          clientImpact: 'p99 Latency: 12ms',
          circuitBreakerStatus: 'CLOSED',
          description: 'Application services operating well within connection pool thresholds.',
          nodeStates: buildNodes({ primaryState: 'ONLINE' }),
        },
        {
          stepIndex: 2,
          timeOffsetSec: 4,
          phase: 'Lock Pileup & Connection Wave',
          clusterState: 'DEGRADED',
          activePrimary: `${eng.primaryPrefix} (Active Conns: 940/1000 - Spiking)`,
          standbyStatus: 'Standbys unaffected',
          clientImpact: 'p99 Latency spikes to 3,400ms; Gateway HTTP 504 timeouts.',
          circuitBreakerStatus: 'OPEN',
          description: `An unindexed heavy transaction holds exclusive locks on port ${eng.port}, queueing 800+ backend worker threads.`,
          nodeStates: buildNodes({ primaryState: 'ONLINE' }),
        },
        {
          stepIndex: 3,
          timeOffsetSec: 9,
          phase: 'CPU Kernel Context Thrashing',
          clusterState: 'DEGRADED',
          activePrimary: 'CPU 100% (Kernel Spinlock Thrashing)',
          standbyStatus: 'Replicas absorbing read queries',
          clientImpact: 'Total API write stall. New client connections rejected.',
          circuitBreakerStatus: 'OPEN',
          description: 'Database server spends 92% of CPU time switching thread memory contexts rather than executing SQL.',
          nodeStates: buildNodes({ primaryState: 'VOTING' }),
        },
        {
          stepIndex: 4,
          timeOffsetSec: 15,
          phase: 'Circuit Breaker & Pooler Rate Limiting',
          clusterState: 'FAILING_OVER',
          activePrimary: 'Active Conns shedding excess clients (Pooler Throttling)',
          standbyStatus: 'Read queries rerouted to replicas',
          clientImpact: 'Excess requests rejected fast with 429 Retry-After, relieving engine.',
          circuitBreakerStatus: 'HALF_OPEN',
          description: 'Connection pooler circuit breaker trips, terminating idle-in-transaction connections and shedding excess load.',
          nodeStates: buildNodes({ primaryState: 'ONLINE' }),
        },
        {
          stepIndex: 5,
          timeOffsetSec: 18,
          phase: 'Cluster Stabilization',
          clusterState: 'RECOVERED',
          activePrimary: `${eng.primaryPrefix} (Active Conns: 150/1000)`,
          standbyStatus: 'Normal operation restored',
          clientImpact: 'p99 Latency normalized to 14ms.',
          circuitBreakerStatus: 'CLOSED',
          description: 'Connection flood cleared. Normal query processing resumes.',
          nodeStates: buildNodes({ primaryState: 'ONLINE' }),
        },
      ];

      chaosInjectionScript = `#!/usr/bin/env bash
# ==========================================================
# Chaos Fault Injection: Connection Storm on Port ${eng.port}
# Target: ${eng.name}
# ==========================================================
echo "[CHAOS] Spawning 1,200 simultaneous connection sockets on port ${eng.port}..."
for i in {1..1200}; do
  (nc -w 300 localhost ${eng.port} < /dev/zero > /dev/null 2>&1) &
done
echo "[CHAOS] 1,200 socket descriptors opened. Inspecting thread saturation and pooler backpressure..."`;

      if (eng.family === 'redis') {
        mitigationRunbook = `# ==========================================================
# SRE Runbook: Redis Client Flooding & Connection Saturation
# Stack: ${eng.failoverManager}
# ==========================================================

1. [MAXCLIENTS REJECTION] Enforce hard socket caps and client eviction:
   CONFIG SET maxclients 10000
   CONFIG SET timeout 30

2. [ZERO DATA LOSS] Enforce minimum replicas to accept writes:
   CONFIG SET min-replicas-to-write 1
   CONFIG SET min-replicas-max-lag 5

3. [PIPELINING & POOLING] Migrate client drivers to command pipelining and pooled connections.`;

        recommendedConfigPatch = `# Redis Sentinel & Connection Protection (redis.conf)
maxclients 10000
timeout 30
min-replicas-to-write 1
min-replicas-max-lag 5
tcp-keepalive 60
`;
      } else {
        mitigationRunbook = `# ==========================================================
# SRE Runbook: Thundering Herd & Connection Storm Mitigation
# Target Engine: ${eng.name} (Port ${eng.port})
# ==========================================================

1. [CIRCUIT BREAKING] Immediately reject runaway non-critical traffic:
   Configure gateway / Envoy circuit breaker: max_connections: 500, max_pending_requests: 100.

2. [TERMINATE IDLE SESSIONS] Kill blocking queries holding row locks:
   ${eng.isPostgresFamily 
     ? "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction' AND state_change < now() - INTERVAL '30 seconds';" 
     : eng.family === 'mysql' 
     ? "KILL CONNECTION (SELECT id FROM information_schema.processlist WHERE time > 30 AND command = 'Sleep');" 
     : eng.family === 'oracle'
     ? "ALTER SYSTEM DISCONNECT SESSION 'sid,serial#' IMMEDIATE;"
     : `-- Terminate idle blocking client sessions on ${eng.name}`}

3. [CONNECTION POOLING] Enforce transaction-level connection pooling (e.g. PgBouncer / ProxySQL / HikariCP).`;

        recommendedConfigPatch = `# ${eng.name} Connection Starvation Protection
${eng.isPostgresFamily ? `max_connections = 300
idle_in_transaction_session_timeout = '10000ms'
statement_timeout = '30000ms'
tcp_keepalives_idle = 60
tcp_keepalives_interval = 10
tcp_keepalives_count = 5` : eng.family === 'mysql' ? `max_connections = 500
wait_timeout = 60
interactive_timeout = 60
max_execution_time = 30000
thread_pool_size = 16
thread_pool_max_unused_threads = 100` : `max_connections = 400
query_timeout_seconds = 30
idle_session_timeout_seconds = 15`}
`;
      }
      break;
    }

    case 'replica_lag_spike': {
      scenarioTitle = `Replication Lag Avalanche & Read-After-Write Hazard (${eng.name})`;
      faultType = 'REPLICA_LAG_SPIKE';
      downtimeSec = 11;
      resilienceScore = 84;

      timeline = [
        {
          stepIndex: 1,
          timeOffsetSec: 0,
          phase: 'Nominal Replication Stream',
          clusterState: 'HEALTHY',
          activePrimary: `${eng.primaryPrefix} (Master)`,
          standbyStatus: `${eng.standbyPrefix} (Replication Lag: 1.2ms)`,
          clientImpact: 'Read-your-own-writes consistent across all nodes',
          circuitBreakerStatus: 'CLOSED',
          description: 'Replication apply workers keeping pace with write throughput.',
          nodeStates: buildNodes({ primaryState: 'ONLINE' }),
        },
        {
          stepIndex: 2,
          timeOffsetSec: 3,
          phase: 'Bulk Ingestion & Replica IO Saturation',
          clusterState: 'DEGRADED',
          activePrimary: `${eng.primaryPrefix} (High Ingestion Rate)`,
          standbyStatus: `${eng.standbyPrefix} (Replication Lag: 4,800ms and rising)`,
          clientImpact: 'Users reading stale records immediately after saving updates.',
          circuitBreakerStatus: 'OPEN',
          description: 'Massive batch UPDATE saturates single-threaded replica log apply worker.',
          nodeStates: buildNodes({ primaryState: 'ONLINE', standbyStates: 'REPLAYING' }),
        },
        {
          stepIndex: 3,
          timeOffsetSec: 7,
          phase: 'Read-Routing Failover to Primary',
          clusterState: 'FAILING_OVER',
          activePrimary: `${eng.primaryPrefix} (Accepting critical reads)`,
          standbyStatus: `${eng.standbyPrefix} (Replication Lag: 12,500ms - Ejected from read pool)`,
          clientImpact: 'Stale reads blocked. Critical queries routed to primary leader.',
          circuitBreakerStatus: 'HALF_OPEN',
          description: 'Load balancer ejects lagging replica from read pool once lag exceeds 5,000ms SLA.',
          nodeStates: buildNodes({ primaryState: 'ONLINE', standbyStates: 'FENCED' }),
        },
        {
          stepIndex: 4,
          timeOffsetSec: 11,
          phase: 'Replica Catch-up & Re-admission',
          clusterState: 'RECOVERED',
          activePrimary: `${eng.primaryPrefix} (Healthy)`,
          standbyStatus: `${eng.standbyPrefix} (Replication Lag: 8ms - Re-admitted to pool)`,
          clientImpact: 'Full read load-balancing restored across all replicas.',
          circuitBreakerStatus: 'CLOSED',
          description: 'Multi-threaded apply workers clear backlog. Read traffic redistributed.',
          nodeStates: buildNodes({ primaryState: 'ONLINE' }),
        },
      ];

      chaosInjectionScript = `#!/usr/bin/env bash
# ==========================================================
# Chaos Fault Injection: Replica I/O Throttling & Lag Spike
# Target: ${eng.name} (${eng.standbyPrefix})
# ==========================================================
echo "[CHAOS] Injecting 400ms latency on replica network interface..."
ssh root@${eng.standbyPrefix} "tc qdisc add dev eth0 root netem delay 400ms 50ms"
echo "[CHAOS] Replica latency injected. Monitoring read-pool auto-ejection threshold..."`;

      if (eng.family === 'mongodb') {
        mitigationRunbook = `# ==========================================================
# SRE Runbook: MongoDB Replica Set Lag Avalanche Mitigation
# Stack: ${eng.failoverManager}
# ==========================================================

1. [WRITE CONCERN ENFORCEMENT] Reject stale reads and throttle commits:
   db.adminCommand({ setDefaultRWConcern: 1, defaultWriteConcern: { w: "majority", wtimeout: 5000 } });

2. [SECONDARY READ AUTO-EJECTION] Configure Driver Read Preference:
   readPreference=secondaryPreferred&maxStalenessSeconds=30

3. [FLOW CONTROL] Enable MongoDB Flow Control to bound secondary replication lag:
   db.adminCommand({ setParameter: 1, enableFlowControl: true, flowControlTargetLagSeconds: 10 });`;

        recommendedConfigPatch = `# MongoDB mongod.conf Replication Tuning
replication:
  replSetName: "rs0"
  enableMajorityReadConcern: true
setParameter:
  enableFlowControl: true
  flowControlTargetLagSeconds: 10
`;
      } else {
        mitigationRunbook = `# ==========================================================
# SRE Runbook: Replication Lag Avalanche Mitigation
# Target Engine: ${eng.name}
# ==========================================================

1. [READ POOL AUTO-EJECTION] Configure ProxySQL / PgBouncer health check:
   Eject any replica exceeding lag > 5000ms to preserve session read consistency.

2. [PARALLEL REPLICATION] Enable multi-threaded replication apply:
   ${eng.family === 'mysql' 
     ? 'SET GLOBAL replica_parallel_workers = 8; SET GLOBAL replica_parallel_type = "LOGICAL_CLOCK";' 
     : eng.isPostgresFamily 
     ? "ALTER SYSTEM SET max_parallel_apply_workers_per_subscription = 4;" 
     : "Tune parallel redo/replica apply workers on standby instance."}

3. [BATCH THROTTLING] Throttle large bulk UPDATE/DELETE operations into batches of 1,000 rows.`;

        recommendedConfigPatch = `# ${eng.name} Parallel Replication Tuning
${eng.family === 'mysql' ? `replica_parallel_workers = 8
replica_parallel_type = LOGICAL_CLOCK
replica_preserve_commit_order = ON
max_relay_log_size = 536870912` : eng.isPostgresFamily ? `max_parallel_apply_workers_per_subscription = 4
max_standby_streaming_delay = 15s
wal_receiver_timeout = 10s
hot_standby_feedback = on` : `parallel_apply_workers = 8
replication_timeout_ms = 10000`}
`;
      }
      break;
    }

    case 'disk_out_of_space': {
      scenarioTitle = `WAL / Transaction Log Storage Exhaustion (${eng.name})`;
      faultType = 'DISK_OUT_OF_SPACE';
      downtimeSec = 16;
      resilienceScore = 81;

      timeline = [
        {
          stepIndex: 1,
          timeOffsetSec: 0,
          phase: 'Normal Storage Utilization',
          clusterState: 'HEALTHY',
          activePrimary: `${eng.primaryPrefix} (Disk Usage: 62%)`,
          standbyStatus: 'Standbys healthy',
          clientImpact: '0% Error Rate',
          circuitBreakerStatus: 'CLOSED',
          description: 'Operating normally with 150GB free on log volume.',
          nodeStates: buildNodes({ primaryState: 'ONLINE' }),
        },
        {
          stepIndex: 2,
          timeOffsetSec: 4,
          phase: 'Storage Threshold Breach (95%)',
          clusterState: 'DEGRADED',
          activePrimary: `${eng.primaryPrefix} (Disk Usage: 96% - Warning Alert)`,
          standbyStatus: 'Replicas healthy',
          clientImpact: 'Elevated disk flush latency; disk I/O queues stall.',
          circuitBreakerStatus: 'OPEN',
          description: 'Unchecked transaction log accumulation triggers critical low-disk threshold.',
          nodeStates: buildNodes({ primaryState: 'ONLINE' }),
        },
        {
          stepIndex: 3,
          timeOffsetSec: 9,
          phase: 'Emergency Read-Only Lockdown (PANIC Guard)',
          clusterState: 'DEGRADED',
          activePrimary: `${eng.primaryPrefix} (Read-Only Mode Enforced)`,
          standbyStatus: 'Replicas serving reads',
          clientImpact: 'Write transactions rejected with DISK_FULL / READ_ONLY_TRANSACTION.',
          circuitBreakerStatus: 'OPEN',
          description: 'Database daemon automatically switches to read-only to prevent catastrophic storage corruption.',
          nodeStates: buildNodes({ primaryState: 'VOTING' }),
        },
        {
          stepIndex: 4,
          timeOffsetSec: 16,
          phase: 'Automated Archive Purge & Recovery',
          clusterState: 'RECOVERED',
          activePrimary: `${eng.primaryPrefix} (Disk Usage: 45% - Read-Write Resumed)`,
          standbyStatus: 'Replication re-synchronized',
          clientImpact: 'Full read-write traffic operational.',
          circuitBreakerStatus: 'CLOSED',
          description: 'Automated WAL cleanup daemon ships archived segments to cloud storage and frees disk space.',
          nodeStates: buildNodes({ primaryState: 'ONLINE' }),
        },
      ];

      chaosInjectionScript = `#!/usr/bin/env bash
# ==========================================================
# Chaos Fault Injection: Rapid Disk Fill on Log Directory
# Target: ${eng.name}
# ==========================================================
echo "[CHAOS] Filling /var/log/db with 50GB file to simulate disk exhaustion..."
fallocate -l 50G /tmp/chaos_disk_fill.dat
echo "[CHAOS] Disk threshold exceeded. Checking emergency read-only enforcement in ${eng.name}..."`;

      if (eng.family === 'clickhouse') {
        mitigationRunbook = `# ==========================================================
# SRE Runbook: ClickHouse Disk Out of Space & Parts Explosion
# Stack: ${eng.failoverManager}
# ==========================================================

1. [FREE DISK EMERGENCY] Drop old detached parts and temporary files:
   ALTER TABLE events DROP DETACHED PART '...';
   ALTER TABLE events FREEZE;

2. [STORAGE TIERING POLICY] Move cold historical partitions to S3 Object Storage:
   ALTER TABLE events MOVE PARTITION 202601 TO VOLUME 's3_cold';

3. [TTL ENFORCEMENT] Enforce automated column and table TTLs for automatic deletion.`;

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
      } else {
        mitigationRunbook = `# ==========================================================
# SRE Runbook: Disk Out of Space & WAL Exhaustion Mitigation
# Target Engine: ${eng.name}
# ==========================================================

1. [EMERGENCY DISK RECLAIM] Free space on log mount:
   ${eng.isPostgresFamily 
     ? 'pg_archivecleanup /var/lib/postgresql/wal $(ls -t /var/lib/postgresql/wal | head -n 5 | tail -n 1)' 
     : eng.family === 'mysql' 
     ? 'PURGE BINARY LOGS BEFORE NOW() - INTERVAL 1 DAY;' 
     : eng.family === 'oracle'
     ? 'RMAN> CROSSCHECK ARCHIVELOG ALL; DELETE EXPIRED ARCHIVELOG ALL;'
     : `# Purge expired transaction logs past retention threshold on ${eng.name}`}

2. [DROP UNUSED REPLICATION SLOTS] Prevent transaction log retention runaway:
   ${eng.isPostgresFamily ? 'SELECT pg_drop_replication_slot(slot_name) FROM pg_replication_slots WHERE active = false;' : 'Inspect inactive replication handles and consumer groups.'}

3. [STORAGE AUTOSCALING] Enable cloud volume storage autoscaling (Scale up by 25% at 85% utilization).`;

        recommendedConfigPatch = `# ${eng.name} Disk Space Quota & Auto-Pruning
${eng.isPostgresFamily ? `wal_keep_size = 2048MB
max_slot_wal_keep_size = 4096MB
archive_cleanup_command = 'pg_archivecleanup /var/lib/postgresql/wal %r'
wal_compression = zstd` : eng.family === 'mysql' ? `binlog_expire_logs_seconds = 259200 # 3 Days
max_binlog_size = 1073741824 # 1GB
innodb_undo_log_truncate = ON` : `retention_days = 3
auto_purge_logs = true`}
`;
      }
      break;
    }

    case 'primary_crash':
    default: {
      scenarioTitle = `Sudden ${eng.name} Primary Crash & Automatic Failover`;
      faultType = 'PRIMARY_CRASH';
      downtimeSec = syncMode === 'sync' ? 7 : 12;
      resilienceScore = syncMode === 'sync' ? 94 : 85;

      timeline = [
        {
          stepIndex: 1,
          timeOffsetSec: 0,
          phase: 'Baseline Cluster Health',
          clusterState: 'HEALTHY',
          activePrimary: `${eng.primaryPrefix} (Leader)`,
          standbyStatus: `${clusterSize - 1}x Standbys in Sync (Heartbeat: 80ms)`,
          clientImpact: '0% Error Rate, Latency p95: 3.8ms',
          circuitBreakerStatus: 'CLOSED',
          description: `${eng.name} cluster operating normally with ${clusterSize} nodes under ${eng.failoverManager}.`,
          nodeStates: buildNodes({ primaryState: 'ONLINE' }),
        },
        {
          stepIndex: 2,
          timeOffsetSec: 2,
          phase: 'Kernel Panic / Hardware Severed',
          clusterState: 'DEGRADED',
          activePrimary: `${eng.primaryPrefix} [OFFLINE / UNRESPONSIVE]`,
          standbyStatus: `Missed 2x heartbeat pings on port ${eng.port}. Quorum election initiated.`,
          clientImpact: 'In-flight writes hold TCP sockets; upstream gateway starts queuing requests.',
          circuitBreakerStatus: 'OPEN',
          description: `Primary process abruptly terminated without clean flush. ${eng.failoverManager} detects missing lease.`,
          nodeStates: buildNodes({ primaryRole: 'crashed', primaryState: 'OFFLINE' }),
        },
        {
          stepIndex: 3,
          timeOffsetSec: 5,
          phase: 'Leader Election & Quorum Consensus',
          clusterState: 'FAILING_OVER',
          activePrimary: 'ELECTION IN PROGRESS',
          standbyStatus: `Candidate elected with ${majorityVotes}/${clusterSize} majority votes (${eng.consensusProtocol}).`,
          clientImpact: 'Client connection pool rejects new write sockets (HTTP 503 circuit trip).',
          circuitBreakerStatus: 'OPEN',
          description: `Majority consensus reached. Standby with highest commit LSN promoted.`,
          nodeStates: buildNodes({ primaryRole: 'crashed', primaryState: 'OFFLINE', standbyStates: 'VOTING' }),
        },
        {
          stepIndex: 4,
          timeOffsetSec: 7,
          phase: 'Promotion & Virtual IP / DNS Shift',
          clusterState: 'FAILING_OVER',
          activePrimary: `${eng.standbyPrefix} (Promoted Primary)`,
          standbyStatus: 'Replay catch-up completed. Virtual IP shifted to new primary.',
          clientImpact: 'Connection pools reconnecting to new VIP / listener.',
          circuitBreakerStatus: 'HALF_OPEN',
          description: `Read-write mode activated on new leader. Client pooler refreshes target backend.`,
          nodeStates: buildNodes({ primaryRole: 'crashed', primaryState: 'OFFLINE', promotedIndex: 1 }),
        },
        {
          stepIndex: 5,
          timeOffsetSec: downtimeSec,
          phase: 'Cluster Fully Stabilized',
          clusterState: 'RECOVERED',
          activePrimary: `${eng.standbyPrefix} (Active Primary)`,
          standbyStatus: `${clusterSize - 2}x Standbys active; old primary scheduled for automated re-clone.`,
          clientImpact: 'All read/write queries normal. 0 data loss verified.',
          circuitBreakerStatus: 'CLOSED',
          description: `${eng.name} cluster operational. Quorum re-established with ${majorityVotes}/${clusterSize} healthy nodes.`,
          nodeStates: buildNodes({ primaryRole: 'standby', primaryState: 'ONLINE', promotedIndex: 1 }),
        },
      ];

      chaosInjectionScript = `#!/usr/bin/env bash
# ==========================================================
# Chaos Fault Injection: Immediate Primary Hardware Crash
# Target: ${eng.name} (${eng.primaryPrefix})
# ==========================================================
echo "[CHAOS] Injecting SIGKILL on ${eng.name} primary daemon (${eng.process})..."
ssh root@${eng.primaryPrefix} "pkill -9 -f ${eng.process}"

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
      engine: ${eng.family}
EOF
echo "[CHAOS] Primary daemon killed! Monitoring automated failover via ${eng.failoverManager}..."`;

      if (eng.family === 'mysql') {
        mitigationRunbook = `# ==========================================================
# SRE Runbook: MySQL Sudden Primary Crash & Failover
# High Availability Stack: ${eng.failoverManager}
# ==========================================================

1. [LEADER ELECTION] Orchestrator validates primary failure:
   orchestrator-client -c topology -i 10.0.1.10:3306

2. [PROMOTION] Lowest GTID-lag standby assumes primary role:
   SET GLOBAL read_only = OFF;
   SET GLOBAL super_read_only = OFF;

3. [PROXY ROUTING] ProxySQL shifts port 6033 write hostgroup to new primary.

4. [AUTO RE-ATTACH] Former primary re-attaches via MySQL Clone Plugin upon recovery.`;

        recommendedConfigPatch = `# MySQL High-Availability Failover (my.cnf)
[mysqld]
gtid_mode = ON
enforce_gtid_consistency = ON
rpl_semi_sync_master_enabled = 1
rpl_semi_sync_slave_enabled = 1
rpl_semi_sync_master_timeout = 1000
innodb_flush_log_at_trx_commit = 1
sync_binlog = 1
`;
      } else if (eng.family === 'oracle') {
        mitigationRunbook = `# ==========================================================
# SRE Runbook: Oracle Database Fast-Start Failover (FSFO)
# High Availability Stack: ${eng.failoverManager}
# ==========================================================

1. [OBSERVER TRIGGER] Observer detects primary heartbeat loss:
   DGMGRL> ENABLE FAST_START FAILOVER;

2. [AUTOMATIC FAILOVER] Standby assumes PRIMARY role:
   Data Guard Broker executes failover within 3 seconds.

3. [FLASHBACK REINSTATEMENT] When old primary reboots, Broker runs Flashback Database:
   DGMGRL> REINSTATE DATABASE 'old_primary';`;

        recommendedConfigPatch = `-- Oracle Data Guard High-Availability Tuning
DGMGRL> EDIT CONFIGURATION SET PROTECTION MODE AS MAXAVAILABILITY;
DGMGRL> ENABLE FAST_START FAILOVER;
DGMGRL> SET FAST_START FAILOVER THRESHOLD 15;
`;
      } else if (eng.family === 'mssql') {
        mitigationRunbook = `# ==========================================================
# SRE Runbook: SQL Server AlwaysOn Automatic Failover
# High Availability Stack: ${eng.failoverManager}
# ==========================================================

1. [CLUSTER HEALTH] WSFC detects lease loss on primary replica:
   Secondary replica in SYNCHRONOUS_COMMIT transitions to PRIMARY.

2. [LISTENER] AG Virtual Network Name listener re-binds IP to new primary.

3. [AUTO-SEEDING] Former primary rejoins as secondary upon OS reboot.`;

        recommendedConfigPatch = `-- SQL Server AlwaysOn Automatic Failover Tuning
ALTER AVAILABILITY GROUP [AG_PROD]
MODIFY REPLICA ON N'NODE_2' WITH (
    AVAILABILITY_MODE = SYNCHRONOUS_COMMIT,
    FAILOVER_MODE = AUTOMATIC
);
`;
      } else if (eng.isPostgresFamily) {
        mitigationRunbook = `# ==========================================================
# SRE Runbook: ${eng.name} Primary Crash & Patroni Failover
# High Availability Stack: ${eng.failoverManager}
# ==========================================================

1. [AUTOMATIC] Enforce Synchronous Replication Quorum:
   SET synchronous_commit = 'on';
   SET synchronous_standby_names = 'FIRST 1 (${eng.standbyPrefix}, standby_3)';

2. [DCS ELECTION] Patroni / etcd detects lost primary lease within loop_wait (10s):
   Standby with highest LSN position claims leader lock key in etcd.

3. [PROMOTION] Patroni executes promotion command:
   Standby switches from read-only to read-write mode.

4. [VIP REWIRE] HAProxy / Keepalived health check (port 8008) rewires write traffic.

5. [PG_REWIND] When old primary recovers, pg_rewind reconciles divergence and rejoins as standby.`;

        recommendedConfigPatch = `# PostgreSQL High-Availability Hardening (postgresql.conf)
synchronous_commit = on
synchronous_standby_names = 'ANY 1 (standby_1, standby_2)'
wal_keep_size = 4096MB
hot_standby_feedback = on
max_standby_streaming_delay = 30s
restart_after_crash = off
`;
      } else {
        mitigationRunbook = `# ==========================================================
# SRE Runbook: ${eng.name} Primary Crash & Failover
# High Availability Stack: ${eng.failoverManager}
# ==========================================================

1. [HEARTBEAT DETECTION] Cluster supervisor detects primary heartbeat loss:
   Leader lease expires after timeout threshold.

2. [QUORUM ELECTION] ${eng.consensusProtocol} initiates leader election:
   Standby node with highest transaction sequence is elected new primary.

3. [PROMOTION] Promote replica to read-write authority:
   Cluster supervisor updates routing table and accepts incoming client connections.

4. [INGRESS ROUTING] Ingress load balancer / VIP switches active upstream endpoint to ${eng.primaryPrefix}.

5. [REPLICA REINTEGRATION] When former primary node recovers, it syncs state and rejoins cluster as standby.`;

        recommendedConfigPatch = `# ${eng.name} High-Availability Hardening (${profile.memoryParams.configFile})
cluster.failover_mode = automatic
cluster.heartbeat_timeout_ms = 3000
cluster.election_timeout_ms = 5000
cluster.sync_mode = ${syncMode}
`;
      }
      break;
    }
  }

  return {
    engine: rawEngine,
    engineName: eng.name,
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
      quorumRequirement: `${majorityVotes}/${clusterSize} Nodes (${eng.consensusProtocol})`,
      failoverManager: eng.failoverManager,
      consensusProtocol: eng.consensusProtocol,
      syncMode,
    },
  };
}
