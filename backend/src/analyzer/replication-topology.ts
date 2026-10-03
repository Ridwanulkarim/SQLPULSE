import { DATABASE_CATALOG } from '../types/db-catalog.data';

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

export class ReplicationTopologyAnalyzer {
  public analyze(req: ReplicationTopologyRequest): ReplicationTopologyResult {
    const meta = getEngineMeta(req.engine);
    const norm = req.engine.toLowerCase();
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

    // Add DR Replica
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

    let failoverMechanism = 'Patroni + DCS (etcd/Consul) + Raft Quorum';
    let haConfigSnippet = '';
    let rpo = '0 ms (Zero Data Loss via Synchronous Commit)';
    let rto = '< 8 Seconds Automatic Failover';

    if (norm === 'mysql' || norm === 'mariadb') {
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
    } else if (norm === 'redis' || norm === 'valkey' || norm === 'dragonfly') {
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
    } else if (norm === 'mongodb') {
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
    } else if (norm === 'clickhouse') {
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
    } else {
      // Default: PostgreSQL + Patroni
      failoverMechanism = 'Patroni + etcd DCS + pg_auto_failover / HAProxy VIP';
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
    }

    const topologyDiagramMermaid = `flowchart TD
    Client["🌐 Client Apps / Microservices"]
    LB["⚖️ High Availability Proxy / VIP (HAProxy)"]
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
      DR["❄️ DR Standby (${nodes[nodes.length - 1].name})\\n[Off-site Hot Standby]"]
    end

    LB -->|Write Traffic (PORT 5432)| P
    LB -->|Read Traffic (PORT 5433 Pool)| S1
    LB -->|Read Traffic (PORT 5433 Pool)| A1
    LB -->|Read Traffic (PORT 5433 Pool)| A2

    P == Synchronous WAL Stream ==> S1
    P -. Asynchronous Physical Stream .-> A1
    P -. Asynchronous Physical Stream .-> A2
    P -. Cross-Region WAL Archive .-> DR
`;

    const failoverSimulationPlan = [
      {
        step: 1,
        title: 'Primary Heartbeat Failure Detected',
        action: 'DCS (etcd / Keeper) detects missing primary heartbeat within loop_wait (10s threshold).',
        durationMs: 3000,
      },
      {
        step: 2,
        title: 'Leader Lock Lease Expiry & Quorum Vote',
        action: 'Sync Standby node initiates consensus election. Validates LSN/GTID position to guarantee zero data loss.',
        durationMs: 1500,
      },
      {
        step: 3,
        title: 'Standby Promotion to Primary Leader',
        action: 'Sync Standby executes promote command, switches from read-only to read-write mode.',
        durationMs: 800,
      },
      {
        step: 4,
        title: 'HAProxy / Routing DNS Healthcheck Update',
        action: 'HAProxy rewires master endpoint to the newly promoted leader. Healthchecks pass instantly.',
        durationMs: 400,
      },
      {
        step: 5,
        title: 'Former Master Re-integration via pg_rewind',
        action: 'When the old node recovers, pg_rewind syncs timeline divergencies and re-attaches it as a standby replica.',
        durationMs: 2500,
      },
    ];

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
      expertRecommendations: [
        'Always configure `synchronous_standby_names = FIRST 1 (...)` to achieve RPO=0 without paying latency penalties across more than one synchronous replica.',
        'Use connection poolers like PgBouncer or ProxySQL in front of replicas with read/write splitting to prevent connection exhaustion during failover bursts.',
        'Deploy DCS nodes (etcd, Consul, or Keeper) across 3 independent availability zones to prevent split-brain partition locks.',
      ],
    };
  }
}
