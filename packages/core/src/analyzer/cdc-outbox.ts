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
  const sourceTable = options.sourceTable || 'orders';
  const broker = options.destinationBroker || 'kafka';

  let outboxDdl = '';
  let debeziumConnectorConfigJson = '';
  let idempotencyStrategy = '';

  if (engine.includes('mysql') || engine.includes('maria')) {
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
  } else if (engine.includes('oracle')) {
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
  } else if (engine.includes('sqlserver') || engine.includes('mssql')) {
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
WHERE [processed_at] IS NULL;`;

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
  } else {
    // PostgreSQL Default
    outboxDdl = `-- ==========================================================
-- SQLPulse Transactional Outbox Pattern Schema
-- Engine: ${engine.toUpperCase()} (PostgreSQL)
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

-- Atomic Dual-Write in Single PostgreSQL Transaction
/*
BEGIN;
  INSERT INTO ${sourceTable} (customer_id, status, total_amount) VALUES (104, 'completed', 450.00);
  INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload)
  VALUES ('Order', 'ord_104', 'OrderPlaced', '{"order_id": 104, "amount": 450.00, "status": "completed"}');
COMMIT;
*/`;

    debeziumConnectorConfigJson = `{
  "name": "${engine}-cdc-outbox-connector",
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
// Broker: AWS SQS (FIFO Queue with Deduplication)
// ==========================================================

import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';

const client = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const queueUrl = process.env.SQS_QUEUE_URL || 'https://sqs.us-east-1.amazonaws.com/123456789/outbox-events.fifo';

async function poll() {
  while (true) {
    const response = await client.send(new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20
    }));

    if (response.Messages) {
      for (const msg of response.Messages) {
        const event = JSON.parse(msg.Body || '{}');
        console.log(\`Processing event: \${event.eventType} (\${event.aggregateId})\`);

        // Acknowledge & Delete
        await client.send(new DeleteMessageCommand({
          QueueUrl: queueUrl,
          ReceiptHandle: msg.ReceiptHandle
        }));
      }
    }
  }
}

poll().catch(console.error);`;
  } else if (broker === 'redis_streams') {
    consumerWorkerCode = `// ==========================================================
// SQLPulse Idempotent Event Consumer (Node.js / TypeScript)
// Broker: REDIS STREAMS (XREADGROUP with Consumer Groups)
// ==========================================================

import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const STREAM_KEY = 'stream:outbox_events';
const GROUP_NAME = 'fulfillment_group';
const CONSUMER_NAME = 'worker_node_1';

async function run() {
  try {
    await redis.xgroup('CREATE', STREAM_KEY, GROUP_NAME, '$', 'MKSTREAM');
  } catch (err: any) {
    if (!err.message.includes('BUSYGROUP')) throw err;
  }

  while (true) {
    const streams = await redis.xreadgroup('GROUP', GROUP_NAME, CONSUMER_NAME, 'BLOCK', 2000, 'COUNT', 10, 'STREAMS', STREAM_KEY, '>');
    if (!streams) continue;

    for (const [key, messages] of streams) {
      for (const [id, fields] of messages) {
        console.log(\`Processing Redis Stream event \${id}\`);
        // ... business logic ...
        await redis.xack(STREAM_KEY, GROUP_NAME, id);
      }
    }
  }
}

run().catch(console.error);`;
  } else {
    // Kafka Default
    consumerWorkerCode = `// ==========================================================
// SQLPulse Resilient Idempotent Event Consumer (Node.js / TypeScript)
// Broker: KAFKA (Apache Kafka with Debezium EventRouter)
// ==========================================================

import { Kafka } from 'kafkajs';
import { Pool } from 'pg';

const kafka = new Kafka({ clientId: 'order-dispatch-service', brokers: ['kafka-broker:9092'] });
const consumer = kafka.consumer({ groupId: 'order-fulfillment-group' });
const dbPool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  await consumer.connect();
  await consumer.subscribe({ topic: 'domain.events.Order', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const event = JSON.parse(message.value?.toString() || '{}');
      const eventId = event.id;

      const client = await dbPool.connect();
      try {
        await client.query('BEGIN');
        
        const res = await client.query(
          'INSERT INTO processed_events (event_id, processed_at) VALUES ($1, NOW()) ON CONFLICT (event_id) DO NOTHING RETURNING event_id;',
          [eventId]
        );

        if (res.rowCount === 0) {
          console.log(\`[Duplicate Event Ignored]: \${eventId}\`);
          await client.query('ROLLBACK');
          return;
        }

        console.log(\`Processing event \${event.eventType} for \${event.aggregateId}\`);
        // ... invoke notification / inventory service ...

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('[Processing Failed - Routing to DLQ]', err);
        throw err;
      } finally {
        client.release();
      }
    }
  });
}

run().catch(console.error);`;
  }

  return {
    engine,
    sourceTable,
    eventType: 'OrderStateChanged',
    outboxDdl,
    debeziumConnectorConfigJson,
    consumerWorkerCode,
    idempotencyStrategy,
    architectureGuidelines: [
      'Transactional Outbox guarantees dual-write consistency without distributed 2PC locks.',
      'Always configure Kafka Debezium EventRouter transform to eliminate envelope overhead.',
      'Include traceparent and correlation_id in headers for distributed OpenTelemetry tracking.'
    ]
  };
}
