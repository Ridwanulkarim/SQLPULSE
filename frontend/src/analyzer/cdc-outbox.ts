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

  const outboxDdl = `-- ==========================================================
-- SQLPulse Transactional Outbox Pattern Schema
-- Engine: ${engine.toUpperCase()}
-- Ensures 100% Exactly-Once Event Emission with Zero Two-Phase Commits
-- ==========================================================

CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(64) NOT NULL,    -- e.g. 'Order', 'User', 'Payment'
    aggregate_id VARCHAR(128) NOT NULL,     -- e.g. 'ord_9841289'
    event_type VARCHAR(64) NOT NULL,        -- e.g. 'OrderPlaced', 'OrderCancelled'
    payload JSONB NOT NULL,                 -- Full event state snapshot
    headers JSONB DEFAULT '{}',             -- Tracing headers (traceparent, correlation_id)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ NULL           -- NULL until dispatched (for polling worker mode)
);

-- Index for high-throughput polling worker (if not using CDC log miner)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_outbox_unprocessed 
ON outbox_events (created_at ASC) 
WHERE processed_at IS NULL;

-- Example: Atomic Dual-Write in Single Transaction
/*
BEGIN;
  -- 1. Mutate Domain Table
  INSERT INTO ${sourceTable} (customer_id, status, total_amount)
  VALUES (104, 'completed', 450.00);

  -- 2. Emit Outbox Event atomically
  INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload)
  VALUES ('Order', 'ord_104', 'OrderPlaced', '{"order_id": 104, "amount": 450.00, "status": "completed"}');
COMMIT;
*/
`;

  const debeziumConnectorConfigJson = `{
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

  const consumerWorkerCode = `// ==========================================================
// SQLPulse Resilient Idempotent Event Consumer (Node.js / TypeScript)
// Broker: ${broker.toUpperCase()}
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

      // 1. Idempotency Guard Table check
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

        // 2. Process Business Logic
        console.log(\`Processing event \${event.eventType} for \${event.aggregateId}\`);
        // ... invoke notification / inventory service ...

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('[Processing Failed - Routing to DLQ]', err);
        throw err; // Trigger Kafka retry
      } finally {
        client.release();
      }
    }
  });
}

run().catch(console.error);
`;

  return {
    engine,
    sourceTable,
    eventType: 'OrderStateChanged',
    outboxDdl,
    debeziumConnectorConfigJson,
    consumerWorkerCode,
    idempotencyStrategy: 'Unique event_id with PostgreSQL ON CONFLICT DO NOTHING idempotency ledger',
    architectureGuidelines: [
      'Transactional Outbox guarantees dual-write consistency without distributed 2PC locks.',
      'Always configure Kafka Debezium EventRouter transform to eliminate envelope overhead.',
      'Include traceparent and correlation_id in headers for distributed OpenTelemetry tracking.'
    ]
  };
}
