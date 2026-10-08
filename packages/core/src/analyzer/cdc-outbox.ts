import { resolveEngineFamily, sanitizeSqlIdentifier } from './sql-utils';
import { getEngineProfile } from '../types/engine-profiles';

export interface CdcOutboxResult {
  engine: string;
  sourceTable: string;
  eventType: string;
  outboxDdl: string;
  debeziumConnectorConfigJson: string;
  consumerWorkerCode: string;
  idempotencyStrategy: string;
  architectureGuidelines: string[];
}

export function generateCdcOutboxArchitecture(options: {
  engine?: string;
  sourceTable?: string;
  destinationBroker?: 'kafka' | 'rabbitmq' | 'sqs' | 'redis_streams';
}): CdcOutboxResult {
  const engine = (options.engine || 'postgresql').toLowerCase();
  const profile = getEngineProfile(engine);
  const family = resolveEngineFamily(engine);
  const isPg = profile.isPostgresFamily;
  const sourceTable = sanitizeSqlIdentifier(options.sourceTable, 'orders');
  const broker = options.destinationBroker || 'kafka';

  let outboxDdl = '';
  let debeziumConnectorConfigJson = '';
  let idempotencyStrategy = '';

  switch (family) {
    case 'mysql': {
      outboxDdl = `-- ==========================================================
-- SQLPulse Transactional Outbox Pattern Schema
-- Engine: ${engine.toUpperCase()} (MySQL InnoDB)
-- ==========================================================

CREATE TABLE IF NOT EXISTS outbox_events (
    id VARCHAR(36) PRIMARY KEY,
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id VARCHAR(128) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    payload JSON NOT NULL,
    headers JSON NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    processed_at DATETIME(3) NULL,
    INDEX idx_outbox_unprocessed (created_at, processed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Atomic Dual-Write in Single MySQL Transaction
/*
START TRANSACTION;
  INSERT INTO ${sourceTable} (customer_id, status, total_amount) VALUES (104, 'completed', 450.00);
  INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload)
  VALUES (UUID(), 'Order', 'ord_104', 'OrderPlaced', JSON_OBJECT('order_id', 104, 'amount', 450.00, 'status', 'completed'));
COMMIT;
*/`;

      debeziumConnectorConfigJson = `{
  "name": "${engine}-cdc-outbox-connector",
  "config": {
    "connector.class": "io.debezium.connector.mysql.MySqlConnector",
    "tasks.max": "1",
    "database.hostname": "db.production.internal",
    "database.port": "3306",
    "database.user": "debezium_cdc_user",
    "database.password": "\${env:DB_PASSWORD}",
    "database.server.id": "184054",
    "database.server.name": "production_mysql",
    "database.include.list": "production_app",
    "table.include.list": "production_app.outbox_events",
    "include.schema.changes": "false",
    "transforms": "outbox",
    "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
    "transforms.outbox.route.topic.replacement": "domain.events.\${routedByValue}",
    "transforms.outbox.table.fields.additional.placement": "event_type:header:eventType",
    "transforms.outbox.route.by.field": "aggregate_type"
  }
}`;
      idempotencyStrategy = 'Unique event_id with INSERT IGNORE / ON DUPLICATE KEY UPDATE ledger in MySQL';
      break;
    }

    case 'oracle': {
      outboxDdl = `-- ==========================================================
-- SQLPulse Transactional Outbox Pattern Schema
-- Engine: ORACLE 19c / 21c / 23c
-- ==========================================================

CREATE TABLE outbox_events (
    id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
    aggregate_type VARCHAR2(64) NOT NULL,
    aggregate_id VARCHAR2(128) NOT NULL,
    event_type VARCHAR2(64) NOT NULL,
    payload CLOB CHECK (payload IS JSON) NOT NULL,
    headers CLOB CHECK (headers IS JSON),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE NULL
);

CREATE INDEX idx_outbox_unprocessed ON outbox_events (created_at, processed_at);

-- Atomic Dual-Write in Single Transaction
/*
INSERT INTO ${sourceTable} (customer_id, status, total_amount) VALUES (104, 'completed', 450.00);
INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload)
VALUES (SYS_GUID(), 'Order', 'ord_104', 'OrderPlaced', '{"order_id": 104, "amount": 450.00}');
COMMIT;
*/`;

      debeziumConnectorConfigJson = `{
  "name": "oracle-cdc-outbox-connector",
  "config": {
    "connector.class": "io.debezium.connector.oracle.OracleConnector",
    "tasks.max": "1",
    "database.hostname": "oracle-db.internal",
    "database.port": "1521",
    "database.user": "c##debezium",
    "database.password": "\${env:ORACLE_PWD}",
    "database.dbname": "ORCLCDB",
    "database.pdb.name": "ORCLPDB1",
    "database.server.name": "prod_oracle",
    "table.include.list": "APP_USER.OUTBOX_EVENTS",
    "database.connection.adapter": "logminer",
    "transforms": "outbox",
    "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
    "transforms.outbox.route.topic.replacement": "domain.events.\${routedByValue}"
  }
}`;
      idempotencyStrategy = 'Unique event_id with MERGE INTO idempotency ledger in Oracle';
      break;
    }

    case 'sqlserver': {
      outboxDdl = `-- ==========================================================
-- SQLPulse Transactional Outbox Pattern Schema
-- Engine: MICROSOFT SQL SERVER (T-SQL)
-- ==========================================================

CREATE TABLE [dbo].[outbox_events] (
    [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    [aggregate_type] NVARCHAR(64) NOT NULL,
    [aggregate_id] NVARCHAR(128) NOT NULL,
    [event_type] NVARCHAR(64) NOT NULL,
    [payload] NVARCHAR(MAX) NOT NULL,
    [headers] NVARCHAR(MAX) NULL,
    [created_at] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [processed_at] DATETIMEOFFSET NULL
);

CREATE NONCLUSTERED INDEX idx_outbox_unprocessed 
ON [dbo].[outbox_events] ([created_at]) 
WHERE [processed_at] IS NULL;

-- Enable CDC on SQL Server Table:
-- EXEC sys.sp_cdc_enable_table @source_schema = N'dbo', @source_name = N'outbox_events', @role_name = NULL;`;

      debeziumConnectorConfigJson = `{
  "name": "sqlserver-cdc-outbox-connector",
  "config": {
    "connector.class": "io.debezium.connector.sqlserver.SqlServerConnector",
    "tasks.max": "1",
    "database.hostname": "sqlserver-db.internal",
    "database.port": "1433",
    "database.user": "debezium_user",
    "database.password": "\${env:MSSQL_PWD}",
    "database.names": "production_app",
    "database.server.name": "prod_mssql",
    "table.include.list": "dbo.outbox_events",
    "transforms": "outbox",
    "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter"
  }
}`;
      idempotencyStrategy = 'Unique event_id with MERGE INTO idempotency ledger in T-SQL';
      break;
    }

    case 'mongodb': {
      outboxDdl = `// ==========================================================
// SQLPulse Transactional Outbox Pattern Schema
// Engine: MONGODB (Change Streams & Transaction Session)
// ==========================================================

db.createCollection("outbox_events", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["aggregateType", "aggregateId", "eventType", "payload", "createdAt"],
      properties: {
        aggregateType: { bsonType: "string" },
        aggregateId: { bsonType: "string" },
        eventType: { bsonType: "string" },
        payload: { bsonType: "object" },
        createdAt: { bsonType: "date" }
      }
    }
  }
});

db.outbox_events.createIndex({ createdAt: 1 });

// Atomic Dual-Write in Single MongoDB Multi-Document Transaction:
/*
const session = client.startSession();
session.startTransaction();
try {
  await db.orders.insertOne({ customerId: 104, status: "completed", totalAmount: 450.00 }, { session });
  await db.outbox_events.insertOne({
    aggregateType: "Order",
    aggregateId: "ord_104",
    eventType: "OrderPlaced",
    payload: { orderId: 104, amount: 450.00 },
    createdAt: new Date()
  }, { session });
  await session.commitTransaction();
} catch (e) {
  await session.abortTransaction();
}
*/`;

      debeziumConnectorConfigJson = `{
  "name": "mongodb-cdc-outbox-connector",
  "config": {
    "connector.class": "io.debezium.connector.mongodb.MongoDbConnector",
    "tasks.max": "1",
    "mongodb.connection.string": "mongodb://debezium:pwd@mongo1:27017,mongo2:27017/?replicaSet=rs0",
    "topic.prefix": "prod_mongo",
    "collection.include.list": "production_app.outbox_events",
    "capture.mode": "change_streams_update_lookup",
    "transforms": "outbox",
    "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
    "transforms.outbox.route.topic.replacement": "domain.events.\${routedByValue}"
  }
}`;
      idempotencyStrategy = 'Unique eventId with MongoDB { upsert: true } or unique index on idempotency collection';
      break;
    }

    case 'snowflake': {
      outboxDdl = `-- ==========================================================
-- SQLPulse CDC Architecture: Snowflake Streams & Tasks Pattern
-- Engine: SNOWFLAKE (Change Data Capture Stream)
-- ==========================================================

-- 1. Create Change Tracking Stream directly on Source Table
CREATE OR REPLACE STREAM ${sourceTable}_cdc_stream 
ON TABLE ${sourceTable}
APPEND_ONLY = FALSE;

-- 2. Create Destination Event Queue Table
CREATE OR REPLACE TABLE outbox_event_queue (
    event_id VARCHAR(36) DEFAULT UUID_STRING() PRIMARY KEY,
    aggregate_id VARCHAR(128),
    action VARCHAR(20),
    event_payload VARIANT,
    stream_emitted_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

-- 3. Automated Serverless Task to Process CDC Stream into Events
CREATE OR REPLACE TASK process_${sourceTable}_cdc_task
  WAREHOUSE = COMPUTE_WH
  SCHEDULE = '1 MINUTE'
  WHEN SYSTEM$STREAM_HAS_DATA('${sourceTable}_cdc_stream')
AS
INSERT INTO outbox_event_queue (aggregate_id, action, event_payload)
SELECT 
    ID, 
    METADATA$ACTION, 
    OBJECT_CONSTRUCT(*)
FROM ${sourceTable}_cdc_stream;

ALTER TASK process_${sourceTable}_cdc_task RESUME;`;

      debeziumConnectorConfigJson = `{
  "name": "snowflake-streaming-outbox",
  "config": {
    "connector.class": "com.snowflake.kafka.connector.SnowflakeSinkConnector",
    "tasks.max": "1",
    "snowflake.topic2table.map": "domain.events.orders:OUTBOX_EVENT_QUEUE",
    "buffer.count.records": "10000",
    "buffer.flush.time": "60"
  }
}`;
      idempotencyStrategy = 'Snowflake MERGE INTO idempotency table matching stream metadata transaction ID';
      break;
    }

    case 'clickhouse': {
      outboxDdl = `-- ==========================================================
-- SQLPulse CDC Architecture: ClickHouse Kafka Engine Table
-- Engine: CLICKHOUSE (Real-Time Analytical Streaming)
-- ==========================================================

-- 1. Outbox Kafka Target Engine
CREATE TABLE outbox_events_kafka (
    id UUID,
    aggregate_type LowCardinality(String),
    aggregate_id String,
    event_type LowCardinality(String),
    payload String,
    created_at DateTime64(3)
) ENGINE = Kafka
SETTINGS kafka_broker_list = 'kafka:9092',
         kafka_topic_list = 'domain.events.orders',
         kafka_group_name = 'clickhouse_outbox_group',
         kafka_format = 'JSONEachRow';

-- 2. Materialized View to Automatically Stream Outbox Events
CREATE MATERIALIZED VIEW mv_outbox_to_kafka TO outbox_events_kafka AS
SELECT 
    id, aggregate_type, aggregate_id, event_type, payload, created_at
FROM outbox_events;`;

      debeziumConnectorConfigJson = `{
  "name": "clickhouse-cdc-outbox",
  "config": {
    "description": "ClickHouse streams events directly to Kafka via native Kafka Engine or ClickHouse Connect."
  }
}`;
      idempotencyStrategy = 'ClickHouse ReplacingMergeTree engine deduplicating by event UUID';
      break;
    }

    case 'sqlite': {
      outboxDdl = `-- ==========================================================
-- SQLPulse Transactional Outbox Pattern Schema
-- Engine: SQLITE (Zero-Dependency Embedded CDC)
-- ==========================================================

CREATE TABLE IF NOT EXISTS outbox_events (
    id TEXT PRIMARY KEY,
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME NULL
);

CREATE INDEX IF NOT EXISTS idx_outbox_unprocessed 
ON outbox_events (created_at) WHERE processed_at IS NULL;

-- Atomic Single Transaction Dual-Write:
/*
BEGIN TRANSACTION;
  INSERT INTO ${sourceTable} (customer_id, status, total_amount) VALUES (104, 'completed', 450.00);
  INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload)
  VALUES (hex(randomblob(16)), 'Order', 'ord_104', 'OrderPlaced', json_object('order_id', 104, 'amount', 450.00));
COMMIT;
*/`;

      debeziumConnectorConfigJson = `{
  "name": "sqlite-litestream-cdc-connector",
  "config": {
    "type": "sqlite-wal-poller",
    "database.path": "/var/lib/sqlite/production.db",
    "poll.interval.ms": "500"
  }
}`;
      idempotencyStrategy = 'Unique event_id with SQLite INSERT OR IGNORE idempotency ledger';
      break;
    }

    case 'redis': {
      outboxDdl = `# ==========================================================
# SQLPulse Transactional Outbox Pattern: Redis Streams
# Engine: REDIS (In-Memory Atomic Multi/Exec Dual-Write)
# ==========================================================

# Atomic Dual-Write using MULTI / EXEC:
# 1. Start Transaction
MULTI

# 2. Write Domain State
HSET ${sourceTable}:104 customer_id 104 status completed amount 450.00

# 3. Emit Outbox Event to Redis Stream
XADD outbox_stream * aggregate_type Order aggregate_id ord_104 event_type OrderPlaced payload "{\\"order_id\\":104,\\"amount\\":450.00}"

# 4. Commit Atomically
EXEC

# Read via Consumer Group:
# XREADGROUP GROUP outbox_workers consumer_1 COUNT 10 BLOCK 2000 STREAMS outbox_stream >`;

      debeziumConnectorConfigJson = `{
  "name": "redis-streams-outbox-forwarder",
  "config": {
    "type": "redis-stream-consumer",
    "stream.key": "outbox_stream",
    "consumer.group": "cdc_bridge"
  }
}`;
      idempotencyStrategy = 'Redis SET key value NX (atomic set-if-not-exists) with TTL';
      break;
    }

    case 'cassandra': {
      outboxDdl = `-- ==========================================================
-- SQLPulse Transactional Outbox Pattern Schema
-- Engine: APACHE CASSANDRA / SCYLLADB (Commitlog CDC)
-- ==========================================================

CREATE TABLE IF NOT EXISTS production_ks.outbox_events (
    aggregate_type text,
    event_id timeuuid,
    aggregate_id text,
    event_type text,
    payload text,
    created_at timestamp,
    PRIMARY KEY ((aggregate_type), event_id)
) WITH CLUSTERING ORDER BY (event_id DESC)
  AND cdc = true;`;

      debeziumConnectorConfigJson = `{
  "name": "cassandra-cdc-connector",
  "config": {
    "connector.class": "io.debezium.connector.cassandra.CassandraConnector",
    "cassandra.config": "/etc/cassandra/cassandra.yaml",
    "cassandra.cdc.dir": "/var/lib/cassandra/cdc_raw",
    "table.include.list": "production_ks.outbox_events"
  }
}`;
      idempotencyStrategy = 'Cassandra lightweight transaction (IF NOT EXISTS) or idempotent upsert on event_id';
      break;
    }

    case 'generic':
    default: {
      if (isPg) {
        outboxDdl = `-- ==========================================================
-- SQLPulse Transactional Outbox Pattern Schema
-- Engine: ${profile.name} (PostgreSQL Family)
-- Ensures 100% Exactly-Once Event Emission with Zero Two-Phase Commits
-- ==========================================================

CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id VARCHAR(128) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    headers JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ NULL
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_outbox_unprocessed 
ON outbox_events (created_at ASC) 
WHERE processed_at IS NULL;

-- Atomic Dual-Write in Single Transaction
/*
BEGIN;
  INSERT INTO ${sourceTable} (customer_id, status, total_amount) VALUES (104, 'completed', 450.00);
  INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload)
  VALUES ('Order', 'ord_104', 'OrderPlaced', '{"order_id": 104, "amount": 450.00, "status": "completed"}');
COMMIT;
*/`;

        debeziumConnectorConfigJson = `{
  "name": "${profile.engineId}-cdc-outbox-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "tasks.max": "1",
    "plugin.name": "pgoutput",
    "database.hostname": "db.production.internal",
    "database.port": "5432",
    "database.user": "debezium_cdc_user",
    "database.password": "\${env:DB_PASSWORD}",
    "database.dbname": "production_app",
    "database.server.name": "production_cluster",
    "table.include.list": "public.outbox_events",
    "tombstones.on.delete": "false",
    "transforms": "outbox",
    "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
    "transforms.outbox.route.topic.replacement": "domain.events.\${routedByValue}",
    "transforms.outbox.table.fields.additional.placement": "event_type:header:eventType",
    "transforms.outbox.route.by.field": "aggregate_type",
    "slot.name": "debezium_outbox_slot",
    "publication.name": "dbz_outbox_publication",
    "publication.autocreate.mode": "filtered"
  }
}`;
        idempotencyStrategy = 'Unique event_id with PostgreSQL ON CONFLICT DO NOTHING idempotency ledger';
      } else if (family === 'embedded' || (family as string) === 'sqlite') {
        outboxDdl = `-- ==========================================================
-- SQLPulse Transactional Outbox Pattern Schema
-- Engine: ${profile.name} (Embedded SQLite)
-- ==========================================================

CREATE TABLE IF NOT EXISTS outbox_events (
    id TEXT PRIMARY KEY,
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    headers TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    processed_at TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_outbox_unprocessed 
ON outbox_events (created_at ASC) 
WHERE processed_at IS NULL;
`;
        debeziumConnectorConfigJson = `// Not applicable: Embedded SQLite does not have continuous transaction log CDC replication streams.
// Recommended: Application-level transaction event publisher or SQLite Session Extension.`;
        idempotencyStrategy = 'SQLite unique event_id with INSERT OR IGNORE idempotency ledger';
      } else {
        outboxDdl = `-- ==========================================================
-- SQLPulse Transactional Outbox Pattern Schema
-- Engine: ${profile.name} (Generic Engine)
-- ==========================================================

CREATE TABLE IF NOT EXISTS outbox_events (
    id VARCHAR(64) PRIMARY KEY,
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id VARCHAR(128) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    payload ${profile.syntax.jsonType === 'JSONB' ? 'JSON' : profile.syntax.jsonType} NOT NULL,
    headers VARCHAR(1024) DEFAULT '{}',
    created_at TIMESTAMP NOT NULL,
    processed_at TIMESTAMP NULL
);

${profile.onlineDdl.createIndexSql('idx_outbox_unprocessed', 'outbox_events', 'created_at ASC')}
`;
        debeziumConnectorConfigJson = `{
  "name": "${profile.engineId}-cdc-outbox-connector",
  "config": {
    "connector.class": "io.debezium.connector.jdbc.JdbcSinkConnector",
    "tasks.max": "1",
    "table.include.list": "outbox_events"
  }
}`;
        idempotencyStrategy = `Unique event_id with ${profile.name} primary key constraint or upsert deduplication`;
      }
      break;
    }
  }

  // Generate Broker-Specific Consumer Worker Code
  let consumerWorkerCode = '';

  if (broker === 'rabbitmq') {
    consumerWorkerCode = `// ==========================================================
// SQLPulse Idempotent Event Consumer (Node.js / TypeScript)
// Broker: RABBITMQ (AMQP 0-9-1)
// ==========================================================

import amqp from 'amqplib';

async function run() {
  const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672');
  const channel = await connection.createChannel();
  const queue = 'domain.events.orders';

  await channel.assertQueue(queue, { durable: true });
  await channel.prefetch(10);

  console.log('[*] Waiting for outbox events on RabbitMQ queue:', queue);

  channel.consume(queue, async (msg) => {
    if (!msg) return;
    const event = JSON.parse(msg.content.toString());
    const eventId = event.id;

    try {
      // 1. Idempotency Check & Atomic Domain Processing
      console.log(\`[Processing Event]: \${event.eventType} for \${event.aggregateId}\`);
      // ... invoke business logic ...

      channel.ack(msg);
    } catch (err) {
      console.error('[Error processing message, nacking with requeue]', err);
      channel.nack(msg, false, true);
    }
  });
}

run().catch(console.error);`;
  } else if (broker === 'sqs') {
    consumerWorkerCode = `// ==========================================================
// SQLPulse Idempotent Event Consumer (Node.js / TypeScript)
// Broker: AWS SQS (FIFO Queue with Deduplication ID)
// ==========================================================

import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';

const sqs = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const queueUrl = process.env.SQS_QUEUE_URL!;

async function pollQueue() {
  while (true) {
    const response = await sqs.send(new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20,
    }));

    if (response.Messages) {
      for (const msg of response.Messages) {
        const event = JSON.parse(msg.Body!);
        console.log(\`[Processing SQS]: \${event.eventType} (\${event.aggregateId})\`);

        // Execute Business Logic & Delete from Queue
        await sqs.send(new DeleteMessageCommand({
          QueueUrl: queueUrl,
          ReceiptHandle: msg.ReceiptHandle,
        }));
      }
    }
  }
}

pollQueue().catch(console.error);`;
  } else if (broker === 'redis_streams') {
    consumerWorkerCode = `// ==========================================================
// SQLPulse Idempotent Event Consumer (Node.js / TypeScript)
// Broker: REDIS STREAMS (XREADGROUP with Acknowledgment)
// ==========================================================

import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const STREAM_KEY = 'domain.events.orders';
const GROUP_NAME = 'billing_service_group';
const CONSUMER_NAME = 'worker_node_1';

async function startConsumer() {
  try {
    await redis.xgroup('CREATE', STREAM_KEY, GROUP_NAME, '$', 'MKSTREAM');
  } catch (err: any) {
    if (!err.message.includes('BUSYGROUP')) throw err;
  }

  console.log('[*] Redis Stream Consumer listening...');

  while (true) {
    const response: any = await redis.xreadgroup(
      'GROUP', GROUP_NAME, CONSUMER_NAME,
      'BLOCK', 5000,
      'COUNT', 10,
      'STREAMS', STREAM_KEY, '>'
    );

    if (response) {
      for (const [stream, messages] of response) {
        for (const [msgId, fields] of messages) {
          console.log(\`[Processing Redis Message \${msgId}]\`, fields);

          // Acknowledge after successful processing
          await redis.xack(STREAM_KEY, GROUP_NAME, msgId);
        }
      }
    }
  }
}

startConsumer().catch(console.error);`;
  } else {
    // Apache Kafka Default
    consumerWorkerCode = `// ==========================================================
// SQLPulse Idempotent Event Consumer (Node.js / TypeScript)
// Broker: APACHE KAFKA (kafka-node / kafkajs)
// ==========================================================

import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'sqlpulse-worker',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const consumer = kafka.consumer({ groupId: 'order-processing-workers' });

async function run() {
  await consumer.connect();
  await consumer.subscribe({ topic: 'domain.events.orders', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const event = JSON.parse(message.value?.toString() || '{}');
      const eventId = event.id || message.key?.toString();

      console.log(\`[Kafka Consumer - \${topic} / P\${partition}]: \${event.eventType} - ID: \${eventId}\`);
      
      // Idempotency: Verify eventId not in completed_events set before mutating state
    },
  });
}

run().catch(console.error);`;
  }

  return {
    engine,
    sourceTable,
    eventType: 'OrderPlaced',
    outboxDdl,
    debeziumConnectorConfigJson,
    consumerWorkerCode,
    idempotencyStrategy,
    architectureGuidelines: [
      'Transactional Outbox guarantees At-Least-Once event delivery across network and broker partitions.',
      'Always insert business domain entities and outbox events in the SAME database transaction.',
      'Debezium tailing the transaction log bypasses the polling performance penalties of traditional cron queries.',
      'Consumers MUST implement idempotency ledgers or deterministic deduplication keys.',
    ],
  };
}
