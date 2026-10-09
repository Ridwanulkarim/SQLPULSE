import { DATABASE_CATALOG, getEngineMetadata } from '../types/db-catalog.data';
import { getEngineProfile, resolveEngineFamily } from '../types/engine-profiles';
import { EngineFamily } from '../types/engine-profile';

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
    const profile = getEngineProfile(req.engine);
    const family = resolveEngineFamily(req.engine);
    const isPg = profile.isPostgresFamily;
    const primaryRegion = req.primaryRegion || 'us-east-1 (N. Virginia)';
    const syncCount = req.syncReplicasCount !== undefined ? req.syncReplicasCount : 1;
    const asyncCount = req.asyncReplicasCount !== undefined ? req.asyncReplicasCount : 2;
    const rtt = req.networkRttMs || 15;

    const nodes: TopologyNode[] = [
      {
        id: 'node-primary-1',
        name: `${profile.name} Primary-01`,
        role: 'primary',
        region: primaryRegion,
        status: 'healthy',
        replicationLagMs: 0,
        readCapacityQps: 12500,
        writeCapacityQps: 8500,
        quorumVote: true,
      },
    ];

    for (let i = 1; i <= syncCount; i++) {
      nodes.push({
        id: `node-sync-${i}`,
        name: `${profile.name} Sync-Standby-0${i}`,
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
        name: `${profile.name} Async-ReadPool-0${j}`,
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
      name: `${profile.name} Cold-DR-Standby`,
      role: 'dr_replica',
      region: 'ap-northeast-1 (Tokyo)',
      status: 'standby',
      replicationLagMs: Math.round(rtt * 4.2),
      readCapacityQps: 8000,
      writeCapacityQps: 0,
      quorumVote: false,
    });

    let port = profile.connection.defaultPort || 5000;
    let readPort = port > 0 ? port + 1 : 0;
    let syncProtocol = 'Synchronous Transaction Stream';
    let asyncProtocol = 'Asynchronous Physical Stream';
    let failoverMechanism = profile.replication.failoverManager;
    let rpo = '0 ms (Zero Data Loss via Synchronous Commit)';
    let rto = '< 10 Seconds Automatic Failover';
    let haConfigSnippet = profile.replication.syncReplicaConfig;
    let failoverSimulationPlan: { step: number; title: string; action: string; durationMs: number }[] = [];
    let expertRecommendations: string[] = [];

    if (isPg) {
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
  connect_address: 10.0.1.10:5432`;

      failoverSimulationPlan = [
        { step: 1, title: 'Heartbeat Lease Expiry', action: 'DCS (etcd) marks master lease dead after 10s of missed heartbeats.', durationMs: 2100 },
        { step: 2, title: 'Leader Election', action: 'Synchronous Standby-01 validates WAL flush LSN and claims leader key in etcd.', durationMs: 800 },
        { step: 3, title: 'Promotion & Trigger', action: 'Patroni promotes Standby-01 to read-write primary mode.', durationMs: 1400 },
        { step: 4, title: 'Traffic Rerouting', action: 'HAProxy / PgBouncer routes port 5432 traffic to new master IP.', durationMs: 250 },
        { step: 5, title: 'Replica Re-attachment', action: 'Async replicas reconnect to promoted master via replication slots.', durationMs: 1900 },
      ];

      expertRecommendations = [
        'Enforce `synchronous_mode_strict: false` in Patroni to avoid freezing write traffic if all standby nodes crash simultaneously.',
        'Colocate synchronous standbys in separate Availability Zones within the same region (RTT < 1.5ms) to keep sync commit overhead under 2ms.',
        'Deploy PgBouncer in front of replicas with connection pooling to absorb query spikes.',
      ];
    } else {
      switch (family) {
        case 'mysql': {
          port = 3306;
          readPort = 3307;
          syncProtocol = 'Semi-Synchronous Replication (rpl_semi_sync)';
          asyncProtocol = 'Asynchronous GTID Binlog Stream';
          failoverMechanism = 'MySQL Group Replication (InnoDB Cluster) / Orchestrator + ProxySQL Routing';
          rpo = '0 ms (Lossless Semi-Sync / rpl_semi_sync_master_wait_point = AFTER_SYNC)';
          rto = '< 12 Seconds Automated Topology Mutation';
          haConfigSnippet = `# MySQL Semi-Synchronous Replication
[mysqld]
server-id = 101
gtid_mode = ON
enforce_gtid_consistency = ON
binlog_format = ROW
binlog_row_image = FULL
plugin-load-add = semisync_master.so;semisync_slave.so
rpl_semi_sync_master_enabled = 1
rpl_semi_sync_master_timeout = 2000
rpl_semi_sync_master_wait_for_slave_count = 1
rpl_semi_sync_master_wait_point = AFTER_SYNC
rpl_semi_sync_slave_enabled = 1`;

          failoverSimulationPlan = [
            { step: 1, title: 'Orchestrator Detects Master Dead', action: 'Failed health probes confirm primary instance crash.', durationMs: 2200 },
            { step: 2, title: 'GTID Analysis & Candidate Selection', action: 'Orchestrator picks the most advanced replica based on executed GTID set.', durationMs: 600 },
            { step: 3, title: 'Topology Realignment', action: 'Execute `CHANGE MASTER TO` on secondary nodes to follow promoted node.', durationMs: 1800 },
            { step: 4, title: 'ProxySQL Hostgroup Switch', action: 'ProxySQL updates `mysql_servers` writer hostgroup to new primary IP.', durationMs: 200 },
          ];

          expertRecommendations = [
            'Always set `rpl_semi_sync_master_wait_point = AFTER_SYNC` to eliminate phantom reads on primary crashes.',
            'Ensure all database tables have explicit Primary Keys to maintain fast row-based replication apply speed.',
          ];
          break;
        }

        case 'oracle': {
          port = 1521;
          readPort = 1521;
          syncProtocol = 'Data Guard ASYNC / SYNC LGWR Transport';
          asyncProtocol = 'Archived Redo Log Transfer';
          failoverMechanism = 'Oracle Data Guard Fast-Start Failover (FSFO)';
          rpo = '0 ms (Maximum Protection / Maximum Availability)';
          rto = '< 30 Seconds Automated Failover';
          haConfigSnippet = `-- Oracle Data Guard Broker Configuration
DGMGRL> CREATE CONFIGURATION 'dg_prod' AS PRIMARY DATABASE IS 'prod_prim' CONNECT IDENTIFIER IS 'prod_prim';
DGMGRL> ADD DATABASE 'prod_sync' AS CONNECT IDENTIFIER IS 'prod_sync' MAINTAINED AS PHYSICAL;
DGMGRL> EDIT CONFIGURATION SET PROTECTION MODE AS MAXAVAILABILITY;
DGMGRL> ENABLE FAST_START FAILOVER;`;

          failoverSimulationPlan = [
            { step: 1, title: 'Data Guard Observer Heartbeat Loss', action: 'Observer process detects primary unreachability.', durationMs: 3000 },
            { step: 2, title: 'Fast-Start Failover Initiation', action: 'Broker validates standby redo apply status and issues failover command.', durationMs: 2500 },
            { step: 3, title: 'Physical Standby Transition', action: 'Standby database opens in READ WRITE mode as new primary.', durationMs: 3500 },
            { step: 4, title: 'OCI / Client TNS Alias Failover', action: 'Client connection pool switches to new primary via transparent failover.', durationMs: 400 },
          ];

          expertRecommendations = [
            'Deploy the Data Guard Observer in a third cloud failure domain to prevent split-brain partition false-positives.',
            'Enable Active Data Guard to offload reporting and backup workloads while keeping recovery active.',
          ];
          break;
        }

        case 'sqlserver': {
          port = 1433;
          readPort = 1433;
          syncProtocol = 'Synchronous Commit (Always On AG)';
          asyncProtocol = 'Asynchronous-Commit Mode (Log Block Streaming)';
          failoverMechanism = 'Always On Availability Groups (WSFC / Pacemaker)';
          rpo = '0 ms (Synchronous Commit Mode)';
          rto = '< 10 Seconds Automatic Failover';
          haConfigSnippet = `-- SQL Server Always On AG Definition
CREATE AVAILABILITY GROUP [AG_PRODUCTION]
WITH (AUTOMATED_BACKUP_PREFERENCE = SECONDARY, FAILURE_CONDITION_LEVEL = 3, HEALTH_CHECK_TIMEOUT = 30000)
FOR DATABASE [production_db]
REPLICA ON
  N'SQL-NODE-01' WITH (ENDPOINT_URL = N'TCP://10.0.1.10:5022', AVAILABILITY_MODE = SYNCHRONOUS_COMMIT, FAILOVER_MODE = AUTOMATIC),
  N'SQL-NODE-02' WITH (ENDPOINT_URL = N'TCP://10.0.1.11:5022', AVAILABILITY_MODE = SYNCHRONOUS_COMMIT, FAILOVER_MODE = AUTOMATIC);`;

          failoverSimulationPlan = [
            { step: 1, title: 'Cluster Quorum Loss on Primary', action: 'Failover cluster detects service termination.', durationMs: 1800 },
            { step: 2, title: 'Synchronous Standby Promotion', action: 'Secondary replica transitions role from SECONDARY to PRIMARY.', durationMs: 900 },
            { step: 3, title: 'AG Listener Re-bind', action: 'Virtual Network Name IP points immediately to promoted primary replica.', durationMs: 300 },
          ];

          expertRecommendations = [
            'Always specify `MultiSubnetFailover=True` in connection strings for sub-second client failover.',
            'Maintain a Cloud Witness in Azure Blob or AWS S3 to prevent quorum stalls in even-node clusters.',
          ];
          break;
        }

        case 'db2': {
          port = 50000;
          readPort = 50000;
          syncProtocol = 'HADR NEARSYNC / SYNC';
          asyncProtocol = 'HADR SUPERASYNC';
          failoverMechanism = 'IBM DB2 HADR with Tivoli SA / Pacemaker';
          rpo = '0 ms (HADR SYNC)';
          rto = '< 15 Seconds Automated Takeover';
          haConfigSnippet = `-- IBM DB2 HADR Configuration
UPDATE DB CFG FOR production_db USING HADR_LOCAL_HOST 10.0.1.10;
UPDATE DB CFG FOR production_db USING HADR_REMOTE_HOST 10.0.1.11;
UPDATE DB CFG FOR production_db USING HADR_SYNCMODE NEARSYNC;
UPDATE DB CFG FOR production_db USING HADR_PEER_WINDOW 120;`;

          failoverSimulationPlan = [
            { step: 1, title: 'Primary Instance Heartbeat Failure', action: 'Cluster automation detects primary loss.', durationMs: 2000 },
            { step: 2, title: 'HADR Takeover Command', action: 'Standby executes `TAKEOVER HADR ON DB production_db`.', durationMs: 1500 },
            { step: 3, title: 'Client Reroute via ACR', action: 'Automatic Client Reroute points JDBC drivers to new primary.', durationMs: 500 },
          ];

          expertRecommendations = [
            'Configure Automatic Client Reroute (ACR) on DB2 client profiles for seamless connection handoff.',
            'Set `HADR_PEER_WINDOW` to at least 120 seconds to prevent data loss during brief network stalls.',
          ];
          break;
        }

        case 'sap_hana': {
          port = 39015;
          readPort = 39015;
          syncProtocol = 'HANA System Replication (HSR SYNC / SYNCMEM)';
          asyncProtocol = 'HSR ASYNC';
          failoverMechanism = 'SAP HANA System Replication (HSR) + Host Auto-Failover';
          rpo = '0 ms (SYNCMEM In-Memory Replication)';
          rto = '< 30 Seconds Pre-Loaded In-Memory Takeover';
          haConfigSnippet = `# SAP HANA System Replication (HSR)
hdbnsutil -sr_enable --name=SITE_PRIMARY
hdbnsutil -sr_register --remoteHost=hana-node-02 --remoteInstance=00 --replicationMode=syncmem --operationMode=logreplay --name=SITE_SECONDARY`;

          failoverSimulationPlan = [
            { step: 1, title: 'HSR Heartbeat Timeout', action: 'SUSE Linux Enterprise HA / Pacemaker flags primary failure.', durationMs: 2500 },
            { step: 2, title: 'HSR Takeover Execution', action: 'Standby runs `hdbnsutil -sr_takeover`. Data is already in memory.', durationMs: 1200 },
            { step: 3, title: 'Virtual IP Takeover', action: 'Floating IP shifts to secondary HANA node.', durationMs: 300 },
          ];

          expertRecommendations = [
            'Use operation mode `logreplay` for fastest RTO as redo logs are continuously applied to in-memory tables.',
            'Deploy stonith/fencing mechanisms in Linux cluster to avoid split-brain scenarios.',
          ];
          break;
        }

        case 'columnar_olap': {
          if (profile.engineId === 'snowflake' || profile.name.toLowerCase().includes('snowflake')) {
            port = 443;
            readPort = 443;
            syncProtocol = 'Cross-Cloud Storage Replication';
            asyncProtocol = 'Metadata Micro-Partition Mirroring';
            failoverMechanism = 'Snowflake Multi-Cluster Shared Data & Business Continuity Failover Groups';
            rpo = '0 ms (Global Micro-Partition Consensus)';
            rto = '< 1 Second Instant Failover';
            haConfigSnippet = `-- Snowflake Failover Group Definition
CREATE FAILOVER GROUP production_failover_group
  OBJECT_TYPES = USERS, ROLES, DATABASES, SHARES, NETWORK POLICIES
  ALLOWED_DATABASES = production_db
  ALLOWED_ACCOUNTS = aws_us_east_1.sqlpulse_acc, azure_eastus2.sqlpulse_acc
  REPLICATION_SCHEDULE = '10 MINUTE';`;

            failoverSimulationPlan = [
              { step: 1, title: 'Cloud Infrastructure Degradation', action: 'Health checks detect outage in primary cloud region.', durationMs: 500 },
              { step: 2, title: 'Failover Group Promotion', action: 'Execute `ALTER FAILOVER GROUP production_failover_group PRIMARY` in target account.', durationMs: 400 },
              { step: 3, title: 'Global Connection URL Redirect', action: 'Snowflake client connection URL routes traffic to active region.', durationMs: 200 },
            ];

            expertRecommendations = [
              'Use Snowflake Global Connection URLs to decouple applications from specific cloud regions.',
              'Include RBAC roles and network policies in failover groups to retain security posture post-failover.',
            ];
          } else {
            port = 8123;
            readPort = 9000;
            syncProtocol = 'Keeper Raft Quorum Replication';
            asyncProtocol = 'ReplicatedMergeTree Part Fetch';
            failoverMechanism = 'ClickHouse Keeper + ReplicatedMergeTree (ZooKeeper Protocol)';
            rpo = '0 ms (Quorum insert with insert_quorum = 2)';
            rto = 'Zero-downtime Read/Write Mesh';
            haConfigSnippet = `<!-- ClickHouse Keeper Cluster Configuration -->
<keeper_server>
    <tcp_port>9181</tcp_port>
    <server_id>1</server_id>
    <raft_configuration>
        <server><id>1</id><hostname>ch-node-01</hostname><port>9234</port></server>
        <server><id>2</id><hostname>ch-node-02</hostname><port>9234</port></server>
        <server><id>3</id><hostname>ch-node-03</hostname><port>9234</port></server>
    </raft_configuration>
</keeper_server>`;

            failoverSimulationPlan = [
              { step: 1, title: 'Keeper Detects Dead Node', action: 'ClickHouse Keeper consensus flags unavailable replica.', durationMs: 600 },
              { step: 2, title: 'Load Balancer Reroute', action: 'HTTP port 8123 load balancer drops crashed node from round-robin pool.', durationMs: 200 },
              { step: 3, title: 'Distributed Inserts Continue', action: 'Write queries continue on remaining quorum nodes with zero interruption.', durationMs: 100 },
            ];

            expertRecommendations = [
              'Run ClickHouse Keeper in a 3-node Raft quorum across distinct availability zones.',
              'Use `ReplicatedMergeTree` engine for all production analytics tables.',
            ];
          }
          break;
        }

        case 'wide_column': {
          port = 9042;
          readPort = 9042;
          syncProtocol = 'NetworkTopologyStrategy Gossip Mesh';
          asyncProtocol = 'Hinted Handoff / Read Repair';
          failoverMechanism = 'Peer-to-Peer Ring Architecture & Tunable Consistency';
          rpo = '0 ms (Write consistency QUORUM or LOCAL_QUORUM)';
          rto = 'Zero-Downtime Instant Node Masking';
          haConfigSnippet = `# Cassandra Multi-DC Ring Keyspace
CREATE KEYSPACE production_keyspace WITH replication = {
    'class': 'NetworkTopologyStrategy',
    'us-east-1': 3,
    'eu-central-1': 3
};`;

          failoverSimulationPlan = [
            { step: 1, title: 'Gossip Failure Detector', action: 'Phi Accrual Failure Detector marks crashed Cassandra node down.', durationMs: 1500 },
            { step: 2, title: 'Driver Token-Aware Reroute', action: 'Cassandra driver redirects writes to surviving replica endpoints in hash ring.', durationMs: 50 },
            { step: 3, title: 'Hinted Handoff Buffer', action: 'Surviving coordinators store write mutations as hints until node recovers.', durationMs: 100 },
          ];

          expertRecommendations = [
            'Use LOCAL_QUORUM consistency for both reads and writes to guarantee strong consistency with low latency.',
            'Run `nodetool repair -pr` weekly to heal partition divergence across nodes.',
          ];
          break;
        }

        case 'document': {
          port = 27017;
          readPort = 27017;
          syncProtocol = 'MongoDB Replica Set Heartbeat & Oplog Pull';
          asyncProtocol = 'Secondary Oplog Tail';
          failoverMechanism = 'Replica Set Internal Election (Raft-like Consensus)';
          rpo = '0 ms (Majority Write Concern: w: "majority", j: true)';
          rto = '< 5 Seconds Automated Primary Election';
          haConfigSnippet = `// MongoDB Replica Set Topology
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "mongo-node-01:27017", priority: 2 },
    { _id: 1, host: "mongo-node-02:27017", priority: 1 },
    { _id: 2, host: "mongo-node-03:27017", priority: 1 }
  ]
});`;

          failoverSimulationPlan = [
            { step: 1, title: 'Primary Heartbeat Dropout', action: 'Secondaries detect missed heartbeats (> 10s electionTimeoutMillis).', durationMs: 1200 },
            { step: 2, title: 'Election Protocol Trigger', action: 'Eligible secondary requests votes from replica set quorum.', durationMs: 600 },
            { step: 3, title: 'Primary Promotion', action: 'Candidate receives majority votes and assumes primary role.', durationMs: 800 },
          ];

          expertRecommendations = [
            'Always deploy an odd number of voting replica set members (min 3) across distinct availability zones.',
            'Specify write concern `w: "majority"` to prevent rollback of committed writes on failover.',
          ];
          break;
        }

        case 'keyvalue': {
          port = 6379;
          readPort = 6380;
          syncProtocol = 'Redis In-Memory Replication Stream';
          asyncProtocol = 'PSYNC Replication Backlog';
          failoverMechanism = 'Redis Sentinel Quorum Failover / Redis Cluster';
          rpo = 'Near-Zero (< 50ms in-flight replication buffer)';
          rto = '< 4 Seconds Sentinel Failover';
          haConfigSnippet = `# Redis Sentinel HA Definition (sentinel.conf)
sentinel monitor mymaster 10.0.1.10 6379 2
sentinel down-after-milliseconds mymaster 3000
sentinel failover-timeout mymaster 10000
sentinel parallel-syncs mymaster 1`;

          failoverSimulationPlan = [
            { step: 1, title: 'Sentinel Flags Subjective Down (sdown)', action: 'Sentinel nodes detect unresponsive master ping.', durationMs: 1100 },
            { step: 2, title: 'Objective Down (odown) Quorum', action: 'Majority sentinels agree master is unavailable.', durationMs: 500 },
            { step: 3, title: 'Leader Sentinel Failover', action: 'Leader sentinel issues `REPLICAOF NO ONE` to chosen replica.', durationMs: 900 },
          ];

          expertRecommendations = [
            'Deploy a minimum of 3 Sentinel processes across independent availability zones.',
            'Configure `min-replicas-to-write 1` and `min-replicas-max-lag 5` to protect against split-brain writes.',
          ];
          break;
        }

        case 'embedded': {
          port = 0;
          readPort = 0;
          syncProtocol = 'File-level WAL Frame Streaming';
          asyncProtocol = 'Litestream / LiteFS S3 Stream';
          failoverMechanism = 'Not applicable: Embedded single-process databases do not provide native multi-node network replication daemons. Litestream / LiteFS is used for continuous stream backup.';
          rpo = '< 1 Second (WAL stream replication)';
          rto = '< 5 Seconds Process Container Restart';
          haConfigSnippet = `# Litestream Configuration (litestream.yml)
dbs:
  - path: /var/lib/sqlite/prod.db
    replicas:
      - type: s3
        bucket: production-sqlite-backups
        path: db
        region: us-east-1
        sync-interval: 1s`;

          failoverSimulationPlan = [
            { step: 1, title: 'Process Crash Detected', action: 'Application container terminates unexpectedly.', durationMs: 1000 },
            { step: 2, title: 'Standby Container Initialization', action: 'Standby container downloads latest SQLite file and restores WAL.', durationMs: 1200 },
            { step: 3, title: 'Traffic Cutover', action: 'Load balancer redirects incoming requests to active standby pod.', durationMs: 300 },
          ];

          expertRecommendations = [
            'Enable SQLite WAL mode (`PRAGMA journal_mode = WAL;`) for concurrent read access during frame streaming.',
            'Use Litestream with a 1-second sync interval for minimal Recovery Point Objective.',
          ];
          break;
        }

        case 'graph':
        case 'vector':
        case 'search':
        case 'timeseries':
        case 'generic':
        default: {
          port = profile.connection.defaultPort || 5000;
          readPort = port > 0 ? port + 1 : 0;
          syncProtocol = 'Consensus-Based Leader-Follower Protocol';
          asyncProtocol = 'Streaming Journal / Snapshot Catch-up';
          failoverMechanism = profile.replication.failoverManager;
          rpo = '0 ms (Quorum Replicated Log)';
          rto = '< 15 Seconds Automated Leadership Transition';
          haConfigSnippet = profile.replication.syncReplicaConfig;

          failoverSimulationPlan = [
            { step: 1, title: 'Leader Failure Detected', action: 'Heartbeat timeout triggers new leader election across surviving nodes.', durationMs: 2000 },
            { step: 2, title: 'Quorum Agreement & Role Switch', action: 'New leader elected via cluster consensus and promoted to active write state.', durationMs: 1200 },
            { step: 3, title: 'Client Routing Update', action: 'Client drivers reconnect to active node endpoints.', durationMs: 400 },
          ];

          expertRecommendations = [
            `Deploy ${profile.name} across at least 3 failure domains to satisfy consensus quorum requirements.`,
            'Ensure cluster nodes maintain synchronized clocks (NTP/Chrony) to prevent lease validation drift.',
          ];
          break;
        }
      }
    }

    const totalNodesCount = nodes.length;
    const readScalingFactor = `${(totalNodesCount * 0.95).toFixed(1)}x Baseline Read Throughput`;

    const topologyDiagramMermaid = `graph TD
  Client[Application Layer / Clients] --> LB[Connection Pool / Load Balancer]
  LB -->|Writes & Reads PORT ${port}| NodeP["${profile.name} Primary (${primaryRegion})"]
  NodeP -.->|Sync Replication| NodeS["${profile.name} Sync Standby (us-east-1 AZ-b)"]
  NodeP -.->|Async Replication| NodeA1["${profile.name} Async Replica (eu-central-1)"]
  NodeP -.->|Async Replication| NodeA2["${profile.name} Async Replica (ap-southeast-1)"]
  NodeP -.->|Disaster Recovery Stream| NodeDR["${profile.name} Cold DR (ap-northeast-1)"]
  LB -.->|Read Traffic PORT ${readPort}| NodeS
  LB -.->|Read Traffic PORT ${readPort}| NodeA1
  LB -.->|Read Traffic PORT ${readPort}| NodeA2`;

    return {
      engine: req.engine,
      engineName: profile.name,
      primaryRegion,
      failoverMechanism,
      totalNodesCount,
      readScalingFactor,
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
