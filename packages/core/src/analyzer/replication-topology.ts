import { DATABASE_CATALOG, getEngineMetadata } from '../types/db-catalog.data';
import { resolveEngineFamily } from './sql-utils';

export interface ReplicationTopologyRequest {
  engine: string;
  primaryRegion?: string;
  syncReplicasCount?: number;
  asyncReplicasCount?: number;
  failoverManager?: string;
  networkRttMs?: number;
}

export interface TopologyNode {
  id: string;
  name: string;
  role: 'primary' | 'sync_standby' | 'async_replica' | 'dr_replica' | 'witness' | 'edge_cache';
  region: string;
  status: 'healthy' | 'replicating' | 'syncing' | 'lagging' | 'standby';
  replicationLagMs: number;
  readCapacityQps: number;
  writeCapacityQps: number;
  quorumVote: boolean;
}

export interface ReplicationTopologyResult {
  engine: string;
  engineName: string;
  primaryRegion: string;
  failoverMechanism: string;
  totalNodesCount: number;
  readScalingFactor: string;
  rpoEstimate: string;
  rtoEstimate: string;
  nodes: TopologyNode[];
  topologyDiagramMermaid: string;
  haConfigSnippet: string;
  failoverSimulationPlan: {
    step: number;
    title: string;
    action: string;
    durationMs: number;
  }[];
  expertRecommendations: string[];
}

export class ReplicationTopologyAnalyzer {
  public analyze(req: ReplicationTopologyRequest): ReplicationTopologyResult {
    const meta = getEngineMetadata(req.engine);
    const family = resolveEngineFamily(req.engine);
    const primaryRegion = req.primaryRegion || 'us-east-1 (N. Virginia)';
    const syncCount = req.syncReplicasCount !== undefined ? req.syncReplicasCount : 1;
    const asyncCount = req.asyncReplicasCount !== undefined ? req.asyncReplicasCount : 2;
    const rtt = req.networkRttMs || 15;

    const nodes: TopologyNode[] = [
      {
        id: 'node-primary-1',
        name: `${meta.name} Primary-01`,
        role: 'primary',
        region: primaryRegion,
        status: 'healthy',
        replicationLagMs: 0,
        readCapacityQps: 12500,
        writeCapacityQps: 8500,
        quorumVote: true,
      }
    ];

    for (let i = 1; i <= syncCount; i++) {
      nodes.push({
        id: `node-sync-${i}`,
        name: `${meta.name} Sync-Standby-0${i}`,
        role: 'sync_standby',
        region: i === 1 ? 'us-east-1 (AZ-b)' : 'us-east-2 (Ohio)',
        status: 'healthy',
        replicationLagMs: Math.max(1, Math.round(rtt * 0.4)),
        readCapacityQps: 11000,
        writeCapacityQps: 0,
        quorumVote: true,
      });
    }

    for (let j = 1; j <= asyncCount; j++) {
      nodes.push({
        id: `node-async-${j}`,
        name: `${meta.name} Async-ReadPool-0${j}`,
        role: 'async_replica',
        region: j === 1 ? 'eu-central-1 (Frankfurt)' : 'ap-southeast-1 (Singapore)',
        status: 'replicating',
        replicationLagMs: Math.round(rtt * (1.8 + j * 0.5)),
        readCapacityQps: 14000,
        writeCapacityQps: 0,
        quorumVote: false,
      });
    }

    nodes.push({
      id: 'node-dr-cross-region',
      name: `${meta.name} Cold-DR-Standby`,
      role: 'dr_replica',
      region: 'ap-northeast-1 (Tokyo)',
      status: 'standby',
      replicationLagMs: Math.round(rtt * 4.2),
      readCapacityQps: 5000,
      writeCapacityQps: 0,
      quorumVote: false,
    });

    let failoverMechanism = '';
    let haConfigSnippet = '';
    let rpo = '';
    let rto = '';
    let port = 5432;
    let readPort = 5433;
    let syncProtocol = 'Synchronous WAL Stream';
    let asyncProtocol = 'Asynchronous Physical Stream';
    let failoverSimulationPlan: { step: number; title: string; action: string; durationMs: number }[] = [];
    let expertRecommendations: string[] = [];

    switch (family) {
      case 'mysql': {
        port = 3306;
        readPort = 6033;
        syncProtocol = 'Multi-Paxos Group Replication';
        asyncProtocol = 'Asynchronous GTID Binlog';
        failoverMechanism = 'MySQL Group Replication + Orchestrator / ProxySQL';
        rpo = '0 ms (Multi-Paxos Group Replication)';
        rto = '< 5 Seconds (Automated Leader Election)';
        haConfigSnippet = `# MySQL 8.0 Group Replication & GTID Config (my.cnf)
[mysqld]
server_id = 101
gtid_mode = ON
enforce_gtid_consistency = ON
binlog_format = ROW
log_bin = /var/log/mysql/mysql-bin.log
log_slave_updates = ON
master_info_repository = TABLE
relay_log_info_repository = TABLE

# Group Replication Settings
plugin_load_add = 'group_replication.so'
group_replication_group_name = "8a94f83b-3602-47fe-bb78-8880574f5238"
group_replication_start_on_boot = ON
group_replication_local_address = "10.0.1.10:33061"
group_replication_group_seeds = "10.0.1.10:33061,10.0.1.11:33061,10.0.1.12:33061"
group_replication_bootstrap_group = OFF
group_replication_single_primary_mode = ON
group_replication_enforce_update_everywhere_checks = OFF`;

        failoverSimulationPlan = [
          { step: 1, title: 'Primary Leader Missing Heartbeat', action: 'ProxySQL / Orchestrator detects missing TCP reply from master port 3306 within 2000ms.', durationMs: 2000 },
          { step: 2, title: 'Paxos Consensus Quorum Vote', action: 'Remaining Group Replication members reach consensus to eject failed primary.', durationMs: 1200 },
          { step: 3, title: 'Secondary Node Promotion', action: 'Lowest-GTID lag standby is elected new primary; switch read-only mode to OFF.', durationMs: 600 },
          { step: 4, title: 'ProxySQL Hostgroup Rewiring', action: 'ProxySQL dynamic runtime moves client write connections to newly elected primary node.', durationMs: 300 },
          { step: 5, title: 'Recovered Node Auto-Catchup', action: 'Old primary joins as replica and syncs missing transactions via Clone Plugin.', durationMs: 1500 },
        ];

        expertRecommendations = [
          'Deploy MySQL Shell Cluster with Group Replication in Single-Primary mode to guarantee zero split-brain anomalies.',
          'Place ProxySQL in front of application pools to route writes to hostgroup 10 (writer) and reads to hostgroup 20 (reader pool).',
          'Enable GTID (`gtid_mode = ON`) across all instances to allow seamless replica re-pointing without coordinate mismatches.',
        ];
        break;
      }

      case 'oracle': {
        port = 1521;
        readPort = 1521;
        syncProtocol = 'Synchronous Redo Transport (SYNC AFFIRM)';
        asyncProtocol = 'Asynchronous Redo Transport (ASYNC NOAFFIRM)';
        failoverMechanism = 'Oracle Data Guard Broker (FSFO) + Fast-Start Failover';
        rpo = '0 ms (Maximum Protection / Maximum Availability)';
        rto = '< 3 Seconds Fast-Start Failover';
        haConfigSnippet = `# Oracle Data Guard Broker Configuration (dgmgrl)
# 1. Connect to Broker
DGMGRL> CONNECT sys/OracleSecretPass@PRIMARY_DB

# 2. Configure Configuration & Protection Mode
DGMGRL> CREATE CONFIGURATION 'dg_cluster' AS PRIMARY DATABASE IS 'prod_db' CONNECT IDENTIFIER IS 'prod_db';
DGMGRL> ADD DATABASE 'standby_sync' AS CONNECT IDENTIFIER IS 'standby_sync' MAINTAINED AS PHYSICAL;
DGMGRL> EDIT CONFIGURATION SET PROTECTION MODE AS MAXAVAILABILITY;

# 3. Enable Fast-Start Failover (FSFO)
DGMGRL> ENABLE FAST_START FAILOVER;
DGMGRL> START OBSERVER /opt/oracle/admin/fsfo_observer.log;
DGMGRL> SHOW CONFIGURATION;`;

        failoverSimulationPlan = [
          { step: 1, title: 'Observer Heartbeat Timeout', action: 'Oracle FSFO Observer on third-party witness host detects primary unreachability.', durationMs: 1500 },
          { step: 2, title: 'Redo Verification & Sync Validation', action: 'Synchronous standby verifies all redo buffers are flushed and applied up to SCN.', durationMs: 800 },
          { step: 3, title: 'Fast-Start Failover Execution', action: 'Standby database opens read-write; changes database role to PRIMARY.', durationMs: 700 },
          { step: 4, title: 'Oracle SCAN Listener Redirect', action: 'Client Transparent Application Failover (TAF) redirects connections to new primary.', durationMs: 200 },
          { step: 5, title: 'Flashback Database Auto-Reinstatement', action: 'When failed primary reboots, Broker uses Flashback Database to rewind SCN and reinstate as standby.', durationMs: 2000 },
        ];

        expertRecommendations = [
          'Operate Oracle Data Guard in `MAXAVAILABILITY` mode with `SYNC AFFIRM` to deliver zero data loss with minimal commit latency impact.',
          'Run the Oracle Fast-Start Failover (FSFO) Observer in a separate cloud availability zone from both primary and standby.',
          'Enable Oracle Flashback Database on all nodes to enable 1-click automatic reinstatement of former primaries.',
        ];
        break;
      }

      case 'sqlserver': {
        port = 1433;
        readPort = 1433;
        syncProtocol = 'Synchronous Redo Log Stream (SAFETY FULL)';
        asyncProtocol = 'Asynchronous Redo Stream (SAFETY OFF)';
        failoverMechanism = 'Always On Availability Groups (WSFC / Pacemaker AG)';
        rpo = '0 ms (Synchronous-Commit Mode)';
        rto = '< 4 Seconds Automatic Failover';
        haConfigSnippet = `-- Microsoft SQL Server Always On Availability Group Script (T-SQL)
CREATE AVAILABILITY GROUP [AG_SQLPulse_Production]
WITH (
    AUTOMATED_BACKUP_PREFERENCE = SECONDARY,
    FAILURE_CONDITION_LEVEL = 3,
    HEALTH_CHECK_TIMEOUT = 30000,
    DB_FAILOVER = ON,
    DTC_SUPPORT = PER_DB
)
FOR DATABASE [production_db]
REPLICA ON 
    N'SQL-NODE-01' WITH (
        ENDPOINT_URL = N'TCP://10.0.1.10:5022',
        FAILOVER_MODE = AUTOMATIC,
        AVAILABILITY_MODE = SYNCHRONOUS_COMMIT,
        PRIMARY_ROLE (ALLOW_CONNECTIONS = READ_WRITE),
        SECONDARY_ROLE (ALLOW_CONNECTIONS = ALL)
    ),
    N'SQL-NODE-02' WITH (
        ENDPOINT_URL = N'TCP://10.0.1.11:5022',
        FAILOVER_MODE = AUTOMATIC,
        AVAILABILITY_MODE = SYNCHRONOUS_COMMIT,
        PRIMARY_ROLE (ALLOW_CONNECTIONS = READ_WRITE),
        SECONDARY_ROLE (ALLOW_CONNECTIONS = ALL)
    );

-- Add AG Virtual Network Name Listener:
ALTER AVAILABILITY GROUP [AG_SQLPulse_Production]
ADD LISTENER N'AG_LISTENER' (
    WITH IP ((N'10.0.1.100', N'255.255.255.0')), 
    PORT = 1433
);`;

        failoverSimulationPlan = [
          { step: 1, title: 'Cluster Quorum Loss on Primary', action: 'Windows Server Failover Cluster (WSFC) / Pacemaker loses lease on SQL Server service.', durationMs: 1800 },
          { step: 2, title: 'Synchronous Standby Promotion', action: 'Secondary node transitions role from SECONDARY to PRIMARY.', durationMs: 900 },
          { step: 3, title: 'Availability Group Listener Re-bind', action: 'Virtual Network Name (VNN) IP points immediately to promoted primary replica.', durationMs: 300 },
          { step: 4, title: 'Client MultiSubnetFailover Connection', action: 'ADO.NET / ODBC clients configured with `ApplicationIntent=ReadOnly` rewire.', durationMs: 250 },
          { step: 5, title: 'Automatic Seeding Re-attachment', action: 'Former master restarts and rejoins Availability Group as secondary replica via automatic seeding.', durationMs: 2200 },
        ];

        expertRecommendations = [
          'Always append `MultiSubnetFailover=True` and `ApplicationIntent=ReadOnly` in connection strings for sub-second client failover.',
          'Configure Read-Only Routing lists so the AG Listener automatically spreads read queries across secondary replicas.',
          'Maintain a Cloud Witness in Azure Blob or AWS S3 to prevent split-brain partition stalls in even-numbered clusters.',
        ];
        break;
      }

      case 'snowflake': {
        port = 443;
        readPort = 443;
        syncProtocol = 'Cross-Cloud Storage Replication';
        asyncProtocol = 'Metadata Micro-Partition Mirroring';
        failoverMechanism = 'Snowflake Multi-Cluster Shared Data & Business Continuity Failover Groups';
        rpo = '0 ms (Global Micro-Partition Consensus)';
        rto = '< 1 Second Instant Failover';
        haConfigSnippet = `-- Snowflake Business Continuity & Cross-Cloud Failover Groups
CREATE FAILOVER GROUP production_failover_group
  OBJECT_TYPES = USERS, ROLES, DATABASES, SHARES, NETWORK POLICIES
  ALLOWED_DATABASES = production_db
  ALLOWED_ACCOUNTS = aws_us_east_1.sqlpulse_acc, azure_eastus2.sqlpulse_acc
  REPLICATION_SCHEDULE = '10 MINUTE';

-- In the event of primary cloud outage, promote secondary account:
-- ALTER FAILOVER GROUP production_failover_group PRIMARY;`;

        failoverSimulationPlan = [
          { step: 1, title: 'Cloud Infrastructure Outage Detected', action: 'Health checks detect degradation in primary cloud region (AWS us-east-1).', durationMs: 500 },
          { step: 2, title: 'Failover Group Secondary Promotion', action: 'Execute `ALTER FAILOVER GROUP production_failover_group PRIMARY` in Azure account.', durationMs: 400 },
          { step: 3, title: 'Global Client Redirect via Connection URL', action: 'Snowflake Global Connection URL automatically routes queries to active account.', durationMs: 200 },
        ];

        expertRecommendations = [
          'Use Snowflake Client Redirect (Connection URLs) to decouple application code from specific cloud regions.',
          'Include Users, Roles, and Network Policies in Failover Groups to preserve security posture after cloud migration.',
        ];
        break;
      }

      case 'clickhouse': {
        port = 8123;
        readPort = 9000;
        syncProtocol = 'Keeper Raft Quorum Replication';
        asyncProtocol = 'ReplicatedMergeTree Part Fetch';
        failoverMechanism = 'ClickHouse Keeper + ReplicatedMergeTree (ZooKeeper Protocol)';
        rpo = '0 ms (Quorum insert with insert_quorum = 2)';
        rto = 'Zero-downtime Read/Write Mesh';
        haConfigSnippet = `<!-- ClickHouse Keeper Cluster Configuration -->
<clickhouse>
    <keeper_server>
        <tcp_port>9181</tcp_port>
        <server_id>1</server_id>
        <raft_configuration>
            <server><id>1</id><hostname>ch-node1</hostname><port>9234</port></server>
            <server><id>2</id><hostname>ch-node2</hostname><port>9234</port></server>
            <server><id>3</id><hostname>ch-node3</hostname><port>9234</port></server>
        </raft_configuration>
    </keeper_server>
</clickhouse>`;

        failoverSimulationPlan = [
          { step: 1, title: 'ClickHouse Node Degradation', action: 'Load balancer detects node-1 HTTP 8123 health check failure.', durationMs: 1000 },
          { step: 2, title: 'Keeper Raft Quorum Check', action: 'ClickHouse Keeper maintains raft consensus across remaining 2 nodes.', durationMs: 400 },
          { step: 3, title: 'Traffic Re-route', action: 'All client inserts and queries route to node-2 and node-3 ReplicatedMergeTree replicas.', durationMs: 200 },
        ];

        expertRecommendations = [
          'Replace Apache ZooKeeper with ClickHouse Keeper for lower RAM overhead and unified log management.',
          'Always configure `insert_quorum = 2` on mission-critical ingestion tables to guarantee durable replicas before client acknowledgment.',
        ];
        break;
      }

      case 'mongodb': {
        port = 27017;
        readPort = 27017;
        syncProtocol = 'Oplog Streaming (w: majority)';
        asyncProtocol = 'Secondary Asynchronous Oplog';
        failoverMechanism = 'MongoDB Multi-Member Replica Set (Raft-like Consensus)';
        rpo = '0 ms with w: "majority" Write Concern';
        rto = '< 4 Seconds Primary Election';
        haConfigSnippet = `// MongoDB Replica Set Initialization (rs.initiate)
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "mongo-primary.internal:27017", priority: 2 },
    { _id: 1, host: "mongo-sync-01.internal:27017", priority: 1.5 },
    { _id: 2, host: "mongo-async-01.internal:27017", priority: 1 },
    { _id: 3, host: "mongo-dr-tokyo.internal:27017", priority: 0, hidden: true }
  ],
  settings: {
    chainingAllowed: true,
    heartbeatTimeoutSecs: 2,
    catchUpTimeoutMillis: 5000
  }
});`;

        failoverSimulationPlan = [
          { step: 1, title: 'Primary Heartbeat Drops', action: 'Secondary nodes detect missing primary ping after 2000ms heartbeat window.', durationMs: 2000 },
          { step: 2, title: 'Replica Election Initiated', action: 'Secondary with highest oplog timestamp requests election votes.', durationMs: 900 },
          { step: 3, title: 'Primary Elected & Driver Notified', action: 'New primary transitions to PRIMARY state; MongoDB drivers update cluster topology in SDAM.', durationMs: 500 },
        ];

        expertRecommendations = [
          'Always use write concern `w: "majority"` to prevent rollback of committed documents during election events.',
          'Deploy replica sets across at least 3 distinct fault domains (availability zones) to ensure election quorum.',
        ];
        break;
      }

      case 'redis': {
        port = 6379;
        readPort = 6379;
        syncProtocol = 'In-Memory Stream Replication (PSYNC2)';
        asyncProtocol = 'Asynchronous Memory Buffer Sync';
        failoverMechanism = 'Redis Sentinel / Redis Cluster Sharding with Auto-Promotion';
        rpo = '< 15 ms (Asynchronous Stream Replication)';
        rto = '< 3 Seconds Sentinel Failover';
        haConfigSnippet = `# Redis Sentinel Configuration (sentinel.conf)
port 26379
sentinel monitor mymaster 10.0.1.10 6379 2
sentinel down-after-milliseconds mymaster 3000
sentinel failover-timeout mymaster 10000
sentinel parallel-syncs mymaster 1
sentinel auth-pass mymaster ProductionStrongKey!2026`;

        failoverSimulationPlan = [
          { step: 1, title: 'Subjective Down (SDOWN) Flagged', action: 'Sentinel fails to ping master for 3000ms.', durationMs: 3000 },
          { step: 2, title: 'Objective Down (ODOWN) Quorum', action: 'Multiple Sentinels agree master is unreachable.', durationMs: 500 },
          { step: 3, title: 'Leader Sentinel Promotion', action: 'Sentinel executes `SLAVEOF NO ONE` on the highest offset replica.', durationMs: 400 },
          { step: 4, title: 'Pub/Sub Reconfiguration Notification', action: 'Sentinels broadcast `+switch-master` to connected client connection pools.', durationMs: 150 },
        ];

        expertRecommendations = [
          'Run at least 3 Sentinel processes across different servers to avoid split-brain election deadlocks.',
          'Set `min-replicas-to-write 1` and `min-replicas-max-lag 10` in `redis.conf` to minimize data loss risk.',
        ];
        break;
      }

      case 'cassandra': {
        port = 9042;
        readPort = 9042;
        syncProtocol = 'Peer-to-Peer Gossip & Paxos Consensus';
        asyncProtocol = 'Inter-Datacenter Asynchronous Async Stream';
        failoverMechanism = 'Apache Cassandra / ScyllaDB Masterless Multi-DC Ring';
        rpo = '0 ms (LOCAL_QUORUM consistency)';
        rto = 'Zero Failover Downtime (Active-Active Mesh)';
        haConfigSnippet = `# Cassandra Multi-Region Gossip Snitch (cassandra.yaml)
cluster_name: 'ProductionCassandraMesh'
endpoint_snitch: GossipingPropertyFileSnitch
listen_address: 10.0.1.10
rpc_address: 10.0.1.10
broadcast_rpc_address: 10.0.1.10
seed_provider:
  - class_name: org.apache.cassandra.locator.SimpleSeedProvider
    parameters:
      - seeds: "10.0.1.10,10.0.2.10,10.0.3.10"`;

        failoverSimulationPlan = [
          { step: 1, title: 'Node Unavailability Detected via Phi Accrual', action: 'Gossip protocol marks failing node dead via Phi Accrual Failure Detector.', durationMs: 1000 },
          { step: 2, title: 'Coordinator Dynamic Query Re-routing', action: 'Client coordinators automatically re-route QUORUM reads and writes to surviving replicas.', durationMs: 100 },
          { step: 3, title: 'Hinted Handoff Accumulation', action: 'Surviving nodes store mutation hints to replay once the down node recovers.', durationMs: 50 },
        ];

        expertRecommendations = [
          'Always write and read at `LOCAL_QUORUM` consistency to guarantee strong consistency within the active region without cross-continent latency.',
          'Run regular `nodetool repair` routines to resolve data entropy across replicas.',
        ];
        break;
      }

      case 'sqlite': {
        port = 8080;
        readPort = 8080;
        syncProtocol = 'Litestream Real-Time WAL Streaming';
        asyncProtocol = 'S3 / Cloud Storage Micro-Replication';
        failoverMechanism = 'Litestream S3 Replication + Standby Auto-Restore';
        rpo = '< 1 Second (Continuous WAL Frame Sync)';
        rto = '< 2 Seconds (On-demand Hot Standby)';
        haConfigSnippet = `# Litestream Real-Time SQLite Replication (litestream.yml)
dbs:
  - path: /var/lib/sqlite/prod.db
    replicas:
      - type: s3
        bucket: production-sqlite-backups
        path: db
        region: us-east-1
        sync-interval: 1s`;

        failoverSimulationPlan = [
          { step: 1, title: 'Primary Host Failure', action: 'Application container terminates unexpectedly.', durationMs: 1500 },
          { step: 2, title: 'Standby Container Restore', action: 'Standby node executes `litestream restore` from S3 WAL stream.', durationMs: 1200 },
          { step: 3, title: 'Traffic Switch', action: 'DNS/Proxy routes HTTP requests to healthy standby instance.', durationMs: 300 },
        ];

        expertRecommendations = [
          'Enable SQLite WAL mode (`PRAGMA journal_mode = WAL;`) to allow concurrent reads while Litestream streams write frames.',
          'Set `sync-interval: 1s` in `litestream.yml` for sub-second Recovery Point Objectives.',
        ];
        break;
      }

      case 'postgres':
      default: {
        port = 5432;
        readPort = 5433;
        syncProtocol = 'Synchronous WAL Stream';
        asyncProtocol = 'Asynchronous Physical Stream';
        failoverMechanism = 'Patroni + DCS (etcd/Consul) + Raft Quorum';
        rpo = '0 ms (Zero Data Loss via Synchronous Commit)';
        rto = '< 8 Seconds Automatic Failover';
        haConfigSnippet = `# Patroni HA Cluster Definition (patroni.yml)
scope: pg-prod-cluster
namespace: /service
name: pg-node-01

etcd3:
  hosts:
    - 10.0.1.20:2379
    - 10.0.1.21:2379
    - 10.0.1.22:2379

restapi:
  listen: 0.0.0.0:8008
  connect_address: 10.0.1.10:8008

bootstrap:
  dcs:
    ttl: 30
    loop_wait: 10
    retry_timeout: 10
    maximum_lag_on_failover: 1048576
    synchronous_mode: true
    synchronous_mode_strict: false
    postgresql:
      use_pg_rewind: true
      parameters:
        wal_level: replica
        max_wal_senders: 10
        max_replication_slots: 10
        hot_standby: "on"
        wal_keep_size: 4096MB
        synchronous_commit: "on"
        synchronous_standby_names: 'FIRST 1 (pg-node-sync-*)'

postgresql:
  listen: 0.0.0.0:5432
  connect_address: 10.0.1.10:5432
  data_dir: /var/lib/postgresql/16/main
  bin_dir: /usr/lib/postgresql/16/bin
  pgpass: /var/lib/postgresql/.pgpass
  authentication:
    replication:
      username: replicator
      password: ReplicatorSuperSecretPass!2026
    superuser:
      username: postgres
      password: PostgresProductionAdmin!2026`;

        failoverSimulationPlan = [
          { step: 1, title: 'Primary Heartbeat Failure Detected', action: 'DCS (etcd / Keeper) detects missing primary heartbeat within loop_wait (10s threshold).', durationMs: 3000 },
          { step: 2, title: 'Leader Lock Lease Expiry & Quorum Vote', action: 'Sync Standby node initiates consensus election. Validates LSN position to guarantee zero data loss.', durationMs: 1500 },
          { step: 3, title: 'Standby Promotion to Primary Leader', action: 'Sync Standby executes promote command, switches from read-only to read-write mode.', durationMs: 800 },
          { step: 4, title: 'HAProxy / Routing DNS Healthcheck Update', action: 'HAProxy rewires master endpoint to the newly promoted leader. Healthchecks pass instantly.', durationMs: 400 },
          { step: 5, title: 'Former Master Re-integration via pg_rewind', action: 'When the old node recovers, pg_rewind syncs timeline divergencies and re-attaches it as a standby replica.', durationMs: 2500 },
        ];

        expertRecommendations = [
          'Always configure `synchronous_standby_names = FIRST 1 (...)` to achieve RPO=0 without paying latency penalties across more than one synchronous replica.',
          'Use connection poolers like PgBouncer in front of replicas with read/write splitting to prevent connection exhaustion during failover bursts.',
          'Deploy DCS nodes (etcd or Consul) across 3 independent availability zones to prevent split-brain partition locks.',
        ];
        break;
      }
    }

    const topologyDiagramMermaid = `flowchart TD
    Client["🌐 Client Apps / Microservices"]
    LB["⚖️ High Availability Proxy / VIP"]
    Client --> LB

    subgraph RegionA ["📍 ${primaryRegion} (Primary Quorum)"]
      P["🟢 Primary (${nodes[0].name})\\n[Read / Write Active]"]
      S1["🔵 Sync Standby (${nodes[1]?.name || 'Standby-1'})\\n[Lag: ${nodes[1]?.replicationLagMs || 2}ms | Quorum Vote]"]
    end

    subgraph RegionB ["📍 Cross-Region Read Pool"]
      A1["🟣 Async Replica (${nodes[2]?.name || 'Read-Pool-1'})\\n[Lag: ${nodes[2]?.replicationLagMs || 28}ms]"]
      A2["🟣 Async Replica (${nodes[3]?.name || 'Read-Pool-2'})\\n[Lag: ${nodes[3]?.replicationLagMs || 35}ms]"]
    end

    subgraph RegionDR ["📍 Disaster Recovery Zone (Cold DR)"]
      DR["❄️ DR Standby (${nodes[nodes.length - 1].name})\\n[Off-site Standby]"]
    end

    LB -->|Write Traffic (PORT ${port})| P
    LB -->|Read Traffic (PORT ${readPort} Pool)| S1
    LB -->|Read Traffic (PORT ${readPort} Pool)| A1
    LB -->|Read Traffic (PORT ${readPort} Pool)| A2

    P == ${syncProtocol} ==> S1
    P -. ${asyncProtocol} .-> A1
    P -. ${asyncProtocol} .-> A2
    P -. Cross-Region Archive .-> DR
`;

    return {
      engine: meta.id,
      engineName: meta.name,
      primaryRegion,
      failoverMechanism,
      totalNodesCount: nodes.length,
      readScalingFactor: `${(nodes.length - 1) * 1.5}x Read Throughput Amplification`,
      rpoEstimate: rpo,
      rtoEstimate: rto,
      nodes,
      topologyDiagramMermaid,
      haConfigSnippet,
      failoverSimulationPlan,
      expertRecommendations,
    };
  }
}
