import { DATABASE_CATALOG } from '../types/db-catalog.data';

export interface DeadlockSimulationRequest {
  engine: string;
  scenarioId?: string;
  txASql?: string;
  txBSql?: string;
}

export interface TimelineStep {
  stepIndex: number;
  timeSec: number;
  txAState: {
    statement: string;
    status: 'IDLE' | 'EXECUTED' | 'ACQUIRED_LOCK' | 'WAITING' | 'DEADLOCK_VICTIM' | 'COMMITTED';
    lockHeld?: string;
    lockWaiting?: string;
  };
  txBState: {
    statement: string;
    status: 'IDLE' | 'EXECUTED' | 'ACQUIRED_LOCK' | 'WAITING' | 'DEADLOCK_VICTIM' | 'COMMITTED';
    lockHeld?: string;
    lockWaiting?: string;
  };
  activeLocks: {
    resource: string;
    heldByTx: string;
    waitingTx: string[];
    lockMode: 'ExclusiveLock' | 'ShareLock' | 'GapLock' | 'IntentionLock' | 'DistributedToken';
  }[];
  explanation: string;
  hasCycleDetected: boolean;
}

export interface DeadlockRemedy {
  title: string;
  type: 'deterministic_order' | 'skip_locked' | 'lock_timeout' | 'optimistic_version' | 'batch_atomic';
  codeSnippet: string;
  explanation: string;
}

export interface DeadlockSimulationResult {
  engine: string;
  engineName: string;
  scenarioId: string;
  scenarioTitle: string;
  hasDeadlock: boolean;
  deadlockDetectedAtStep: number | null;
  waitForCycle: { fromTx: string; toTx: string; resource: string; reason: string }[];
  steps: TimelineStep[];
  rootCause: string;
  remedies: DeadlockRemedy[];
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

export class DeadlockSimulator {
  public simulate(req: DeadlockSimulationRequest): DeadlockSimulationResult {
    const meta = getEngineMeta(req.engine);
    const scenario = req.scenarioId || 'circular_row_locks';

    switch (scenario) {
      case 'inventory_oversell':
        return this.simulateInventoryOversell(meta);
      case 'gap_locks_range':
        return this.simulateGapLockDeadlock(meta);
      case 'fk_cascade_escalation':
        return this.simulateFkCascade(meta);
      case 'distributed_lock_race':
        return this.simulateDistributedLockRace(meta);
      case 'circular_row_locks':
      default:
        return this.simulateCircularRowLocks(meta);
    }
  }

  private simulateCircularRowLocks(meta: any): DeadlockSimulationResult {
    const isMongo = meta.category === 'document';
    const isNeo = meta.category === 'graph';

    const txA1 = isMongo ? 'db.orders.updateOne({ _id: 101 }, { $set: { status: "processing" } })' : isNeo ? 'MATCH (o:Order {id: 101}) SET o.status = "processing"' : 'UPDATE orders SET status = \'processing\' WHERE id = 101;';
    const txB1 = isMongo ? 'db.accounts.updateOne({ _id: 942 }, { $inc: { balance: -50 } })' : isNeo ? 'MATCH (a:Account {id: 942}) SET a.balance = a.balance - 50' : 'UPDATE accounts SET balance = balance - 50 WHERE id = 942;';
    const txA2 = isMongo ? 'db.accounts.updateOne({ _id: 942 }, { $set: { last_active: new Date() } })' : isNeo ? 'MATCH (a:Account {id: 942}) SET a.last_active = timestamp()' : 'UPDATE accounts SET last_active = NOW() WHERE id = 942;';
    const txB2 = isMongo ? 'db.orders.updateOne({ _id: 101 }, { $set: { payment_received: true } })' : isNeo ? 'MATCH (o:Order {id: 101}) SET o.payment_received = true' : 'UPDATE orders SET payment_received = true WHERE id = 101;';

    const steps: TimelineStep[] = [
      {
        stepIndex: 1,
        timeSec: 0.0,
        txAState: { statement: 'BEGIN TRANSACTION;', status: 'EXECUTED' },
        txBState: { statement: 'BEGIN TRANSACTION;', status: 'EXECUTED' },
        activeLocks: [],
        explanation: 'Both Transaction A and Transaction B start concurrent transactional scopes.',
        hasCycleDetected: false,
      },
      {
        stepIndex: 2,
        timeSec: 0.2,
        txAState: { statement: txA1, status: 'ACQUIRED_LOCK', lockHeld: 'Row ExclusiveLock (orders #101)' },
        txBState: { statement: '-- Idle waiting', status: 'IDLE' },
        activeLocks: [
          { resource: 'orders:id=101', heldByTx: 'Tx A', waitingTx: [], lockMode: 'ExclusiveLock' },
        ],
        explanation: 'Tx A acquires Exclusive Row Lock on orders #101.',
        hasCycleDetected: false,
      },
      {
        stepIndex: 3,
        timeSec: 0.4,
        txAState: { statement: '-- Idle (evaluating business logic)', status: 'IDLE', lockHeld: 'Row ExclusiveLock (orders #101)' },
        txBState: { statement: txB1, status: 'ACQUIRED_LOCK', lockHeld: 'Row ExclusiveLock (accounts #942)' },
        activeLocks: [
          { resource: 'orders:id=101', heldByTx: 'Tx A', waitingTx: [], lockMode: 'ExclusiveLock' },
          { resource: 'accounts:id=942', heldByTx: 'Tx B', waitingTx: [], lockMode: 'ExclusiveLock' },
        ],
        explanation: 'Tx B acquires Exclusive Row Lock on accounts #942.',
        hasCycleDetected: false,
      },
      {
        stepIndex: 4,
        timeSec: 0.6,
        txAState: { statement: txA2, status: 'WAITING', lockHeld: 'orders #101', lockWaiting: 'accounts #942' },
        txBState: { statement: '-- Idle', status: 'IDLE', lockHeld: 'accounts #942' },
        activeLocks: [
          { resource: 'orders:id=101', heldByTx: 'Tx A', waitingTx: [], lockMode: 'ExclusiveLock' },
          { resource: 'accounts:id=942', heldByTx: 'Tx B', waitingTx: ['Tx A'], lockMode: 'ExclusiveLock' },
        ],
        explanation: 'Tx A attempts to update accounts #942. It is BLOCKED by Tx B and enters lock sleep queue.',
        hasCycleDetected: false,
      },
      {
        stepIndex: 5,
        timeSec: 0.8,
        txAState: { statement: txA2, status: 'DEADLOCK_VICTIM', lockHeld: 'orders #101', lockWaiting: 'accounts #942' },
        txBState: { statement: txB2, status: 'WAITING', lockHeld: 'accounts #942', lockWaiting: 'orders #101' },
        activeLocks: [
          { resource: 'orders:id=101', heldByTx: 'Tx A', waitingTx: ['Tx B'], lockMode: 'ExclusiveLock' },
          { resource: 'accounts:id=942', heldByTx: 'Tx B', waitingTx: ['Tx A'], lockMode: 'ExclusiveLock' },
        ],
        explanation: 'CRITICAL DEADLOCK DETECTED! Tx B requests lock on orders #101 (held by Tx A), while Tx A is waiting on accounts #942 (held by Tx B). Database engine deadlock detector aborts Tx A as victim!',
        hasCycleDetected: true,
      },
    ];

    const remedies: DeadlockRemedy[] = [
      {
        title: '1. Deterministic Resource Ordering (Global Mutex Order)',
        type: 'deterministic_order',
        codeSnippet: `-- Always lock resources in alphabetical / ascending ID order:
-- Tx A & Tx B both lock 'accounts' first, then 'orders':
BEGIN;
SELECT * FROM accounts WHERE id = 942 FOR UPDATE;
SELECT * FROM orders WHERE id = 101 FOR UPDATE;
UPDATE accounts SET balance = balance - 50 WHERE id = 942;
UPDATE orders SET status = 'processing' WHERE id = 101;
COMMIT;`,
        explanation: 'Enforcing a strict ascending order of lock acquisition mathematically eliminates cycle loops in the Wait-For Graph.',
      },
      {
        title: '2. Low Lock Timeout with Exponential Backoff',
        type: 'lock_timeout',
        codeSnippet: meta.id === 'postgres' ? `SET LOCAL lock_timeout = '2000ms';` : meta.id === 'mysql' ? `SET innodb_lock_wait_timeout = 2;` : `SET LOCK_TIMEOUT 2000;`,
        explanation: 'Fails fast instead of hanging connection threads indefinitely, allowing client application to retry with jitter.',
      },
      {
        title: '3. Optimistic Concurrency Control (Version Stamp)',
        type: 'optimistic_version',
        codeSnippet: `UPDATE orders 
SET status = 'processing', version = version + 1 
WHERE id = 101 AND version = 4;
-- If row_count == 0, retry transaction from fresh state.`,
        explanation: 'Avoids heavy pessimistic locks entirely by doing atomic Compare-And-Swap on an incrementing version column.',
      },
    ];

    return {
      engine: meta.id,
      engineName: meta.name,
      scenarioId: 'circular_row_locks',
      scenarioTitle: 'Classic Circular Row Lock Deadlock (Order ➔ Account vs Account ➔ Order)',
      hasDeadlock: true,
      deadlockDetectedAtStep: 5,
      waitForCycle: [
        { fromTx: 'Tx A', toTx: 'Tx B', resource: 'accounts:id=942', reason: 'Tx A is blocked waiting for ExclusiveLock held by Tx B' },
        { fromTx: 'Tx B', toTx: 'Tx A', resource: 'orders:id=101', reason: 'Tx B is blocked waiting for ExclusiveLock held by Tx A' },
      ],
      steps,
      rootCause: `Asymmetric lock acquisition order between concurrent transactions. Tx A acquired orders #101 then requested accounts #942; Tx B acquired accounts #942 then requested orders #101, creating an unsolvable circular dependency in ${meta.name}'s lock manager.`,
      remedies,
    };
  }

  private simulateInventoryOversell(meta: any): DeadlockSimulationResult {
    const steps: TimelineStep[] = [
      {
        stepIndex: 1,
        timeSec: 0.0,
        txAState: { statement: 'BEGIN;', status: 'EXECUTED' },
        txBState: { statement: 'BEGIN;', status: 'EXECUTED' },
        activeLocks: [],
        explanation: 'Two concurrent shoppers attempt to checkout the last item in stock (sku: "PROD-99", stock: 1).',
        hasCycleDetected: false,
      },
      {
        stepIndex: 2,
        timeSec: 0.1,
        txAState: { statement: 'SELECT stock FROM inventory WHERE sku = \'PROD-99\'; -- Sees 1', status: 'EXECUTED' },
        txBState: { statement: 'SELECT stock FROM inventory WHERE sku = \'PROD-99\'; -- Sees 1', status: 'EXECUTED' },
        activeLocks: [],
        explanation: 'Both transactions read stock = 1 simultaneously without row locking (MVCC Non-locking Read).',
        hasCycleDetected: false,
      },
      {
        stepIndex: 3,
        timeSec: 0.3,
        txAState: { statement: 'UPDATE inventory SET stock = stock - 1 WHERE sku = \'PROD-99\';', status: 'ACQUIRED_LOCK', lockHeld: 'ExclusiveLock (sku: PROD-99)' },
        txBState: { statement: '-- preparing update', status: 'IDLE' },
        activeLocks: [
          { resource: 'inventory:sku=PROD-99', heldByTx: 'Tx A', waitingTx: [], lockMode: 'ExclusiveLock' },
        ],
        explanation: 'Tx A deducts inventory (stock becomes 0) and commits.',
        hasCycleDetected: false,
      },
      {
        stepIndex: 4,
        timeSec: 0.5,
        txAState: { statement: 'COMMIT;', status: 'COMMITTED' },
        txBState: { statement: 'UPDATE inventory SET stock = stock - 1 WHERE sku = \'PROD-99\';', status: 'EXECUTED' },
        activeLocks: [],
        explanation: 'Tx B executes update without verifying remaining stock! Stock drops to -1 (INVENTORY OVERSELL BUG).',
        hasCycleDetected: false,
      },
    ];

    return {
      engine: meta.id,
      engineName: meta.name,
      scenarioId: 'inventory_oversell',
      scenarioTitle: 'High-Concurrency Inventory Oversell (Race Condition & Lost Update)',
      hasDeadlock: false,
      deadlockDetectedAtStep: null,
      waitForCycle: [],
      steps,
      rootCause: `Non-locking SELECT followed by decoupled UPDATE creates a classic Time-of-Check to Time-of-Use (TOCTOU) race condition, resulting in negative stock overselling.`,
      remedies: [
        {
          title: '1. Atomic Conditional Check in UPDATE',
          type: 'batch_atomic',
          codeSnippet: `UPDATE inventory 
SET stock = stock - 1 
WHERE sku = 'PROD-99' AND stock >= 1;
-- If AffectedRows == 0, abort and notify user "Item Sold Out".`,
          explanation: 'Guarantees atomicity directly inside the database write engine without locks.',
        },
        {
          title: '2. Pessimistic Row Lock (SELECT FOR UPDATE)',
          type: 'deterministic_order',
          codeSnippet: `BEGIN;
SELECT stock FROM inventory WHERE sku = 'PROD-99' FOR UPDATE;
-- Checks stock in isolated mutex
UPDATE inventory SET stock = stock - 1 WHERE sku = 'PROD-99';
COMMIT;`,
          explanation: 'Forces competing transactions to wait until the first buyer finishes checkout.',
        },
      ],
    };
  }

  private simulateGapLockDeadlock(meta: any): DeadlockSimulationResult {
    const steps: TimelineStep[] = [
      {
        stepIndex: 1,
        timeSec: 0.0,
        txAState: { statement: 'BEGIN;', status: 'EXECUTED' },
        txBState: { statement: 'BEGIN;', status: 'EXECUTED' },
        activeLocks: [],
        explanation: 'InnoDB Repeatable Read transaction isolation initiates Gap Locking on missing index keys.',
        hasCycleDetected: false,
      },
      {
        stepIndex: 2,
        timeSec: 0.2,
        txAState: { statement: 'SELECT * FROM users WHERE id = 15 FOR UPDATE; -- (Row 15 does not exist)', status: 'ACQUIRED_LOCK', lockHeld: 'Gap Lock (10, 20)' },
        txBState: { statement: '-- Idle', status: 'IDLE' },
        activeLocks: [
          { resource: 'users:gap(10, 20)', heldByTx: 'Tx A', waitingTx: [], lockMode: 'GapLock' },
        ],
        explanation: 'Tx A acquires Gap Lock on range (10, 20) to prevent phantom inserts.',
        hasCycleDetected: false,
      },
      {
        stepIndex: 3,
        timeSec: 0.4,
        txAState: { statement: '-- Idle', status: 'IDLE', lockHeld: 'Gap Lock (10, 20)' },
        txBState: { statement: 'SELECT * FROM users WHERE id = 18 FOR UPDATE; -- (Row 18 does not exist)', status: 'ACQUIRED_LOCK', lockHeld: 'Gap Lock (10, 20)' },
        activeLocks: [
          { resource: 'users:gap(10, 20)', heldByTx: 'Tx A, Tx B', waitingTx: [], lockMode: 'GapLock' },
        ],
        explanation: 'Gap Locks are compatible! Both Tx A and Tx B hold overlapping Gap Lock on (10, 20).',
        hasCycleDetected: false,
      },
      {
        stepIndex: 4,
        timeSec: 0.6,
        txAState: { statement: 'INSERT INTO users (id, name) VALUES (15, \'Alice\');', status: 'WAITING', lockHeld: 'Gap Lock', lockWaiting: 'Insert Intention Lock (Tx B gap)' },
        txBState: { statement: 'INSERT INTO users (id, name) VALUES (18, \'Bob\');', status: 'DEADLOCK_VICTIM', lockHeld: 'Gap Lock', lockWaiting: 'Insert Intention Lock (Tx A gap)' },
        activeLocks: [
          { resource: 'users:gap(10,20)', heldByTx: 'Tx A, Tx B', waitingTx: ['Tx A', 'Tx B'], lockMode: 'IntentionLock' },
        ],
        explanation: 'DEADLOCK! Both transactions try to INSERT into the same gap. Insert Intention Lock is blocked by the other\'s Gap Lock!',
        hasCycleDetected: true,
      },
    ];

    return {
      engine: meta.id,
      engineName: meta.name,
      scenarioId: 'gap_locks_range',
      scenarioTitle: 'MySQL / InnoDB Phantom Gap Lock & Insert Intention Deadlock',
      hasDeadlock: true,
      deadlockDetectedAtStep: 4,
      waitForCycle: [
        { fromTx: 'Tx A', toTx: 'Tx B', resource: 'gap(10,20)', reason: 'Tx A Insert Intention Lock blocked by Tx B Gap Lock' },
        { fromTx: 'Tx B', toTx: 'Tx A', resource: 'gap(10,20)', reason: 'Tx B Insert Intention Lock blocked by Tx A Gap Lock' },
      ],
      steps,
      rootCause: `In MySQL Repeatable Read isolation, SELECT FOR UPDATE on non-existent records acquires Gap Locks. When both transactions attempt to insert into that same gap, their insert intention locks mutually block each other.`,
      remedies: [
        {
          title: '1. Switch to READ COMMITTED Isolation Level',
          type: 'lock_timeout',
          codeSnippet: `SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;`,
          explanation: 'Disables Gap Locking entirely for searches, preventing gap deadlocks.',
        },
        {
          title: '2. Use INSERT ... ON DUPLICATE KEY UPDATE / UPSERT',
          type: 'batch_atomic',
          codeSnippet: `INSERT INTO users (id, name) VALUES (15, 'Alice') 
ON DUPLICATE KEY UPDATE name = VALUES(name);`,
          explanation: 'Atomic single-statement UPSERT avoids preceding non-existent row lookups.',
        },
      ],
    };
  }

  private simulateFkCascade(meta: any): DeadlockSimulationResult {
    return {
      engine: meta.id,
      engineName: meta.name,
      scenarioId: 'fk_cascade_escalation',
      scenarioTitle: 'Foreign Key Cascade Table Lock Escalation',
      hasDeadlock: true,
      deadlockDetectedAtStep: 4,
      waitForCycle: [
        { fromTx: 'Tx A (DELETE parent)', toTx: 'Tx B (INSERT child)', resource: 'orders_items table lock', reason: 'Cascade lock escalation' },
      ],
      steps: [
        {
          stepIndex: 1,
          timeSec: 0.0,
          txAState: { statement: 'BEGIN;', status: 'EXECUTED' },
          txBState: { statement: 'BEGIN;', status: 'EXECUTED' },
          activeLocks: [],
          explanation: 'Parent table orders has ON DELETE CASCADE to child order_items without an index on order_items(order_id).',
          hasCycleDetected: false,
        },
        {
          stepIndex: 2,
          timeSec: 0.2,
          txAState: { statement: 'DELETE FROM orders WHERE id = 500;', status: 'ACQUIRED_LOCK', lockHeld: 'Table ShareLock (order_items)' },
          txBState: { statement: 'INSERT INTO order_items (order_id, item) VALUES (12, \'Gadget\');', status: 'WAITING', lockWaiting: 'order_items' },
          activeLocks: [
            { resource: 'order_items', heldByTx: 'Tx A', waitingTx: ['Tx B'], lockMode: 'ExclusiveLock' },
          ],
          explanation: 'Due to missing foreign key index, Postgres/Oracle must lock the ENTIRE child table to scan for cascading records!',
          hasCycleDetected: true,
        },
      ],
      rootCause: 'Missing index on foreign key referencing column forces a full table scan and table-level lock escalation during cascading deletes.',
      remedies: [
        {
          title: '1. Index Foreign Key Columns',
          type: 'deterministic_order',
          codeSnippet: `CREATE INDEX CONCURRENTLY idx_order_items_order_id ON order_items(order_id);`,
          explanation: 'Allows the database to look up matching child rows via index seek rather than acquiring a full table lock.',
        },
      ],
    };
  }

  private simulateDistributedLockRace(meta: any): DeadlockSimulationResult {
    return {
      engine: meta.id,
      engineName: meta.name,
      scenarioId: 'distributed_lock_race',
      scenarioTitle: 'Distributed Lock Lease Expiry & GC Pause Race Condition (Redlock)',
      hasDeadlock: false,
      deadlockDetectedAtStep: null,
      waitForCycle: [],
      steps: [
        {
          stepIndex: 1,
          timeSec: 0.0,
          txAState: { statement: 'SET lock:billing_job token_A NX PX 5000', status: 'ACQUIRED_LOCK', lockHeld: 'Distributed Lease (5000ms)' },
          txBState: { statement: '-- Waiting on lock', status: 'IDLE' },
          activeLocks: [{ resource: 'lock:billing_job', heldByTx: 'Worker A', waitingTx: ['Worker B'], lockMode: 'DistributedToken' }],
          explanation: 'Worker A acquires distributed lock with 5-second TTL.',
          hasCycleDetected: false,
        },
        {
          stepIndex: 2,
          timeSec: 5.5,
          txAState: { statement: '-- Paused in Stop-The-World GC (5.5s pause)', status: 'WAITING' },
          txBState: { statement: 'SET lock:billing_job token_B NX PX 5000 -> OK', status: 'ACQUIRED_LOCK', lockHeld: 'Distributed Lease (Worker B)' },
          activeLocks: [{ resource: 'lock:billing_job', heldByTx: 'Worker B', waitingTx: [], lockMode: 'DistributedToken' }],
          explanation: 'Worker A paused during Java GC / network hiccup. Redis auto-expired the lock TTL. Worker B acquires lock!',
          hasCycleDetected: false,
        },
        {
          stepIndex: 3,
          timeSec: 6.0,
          txAState: { statement: 'Worker A wakes up and writes to storage (ASSUMING IT STILL HAS THE LOCK!)', status: 'EXECUTED' },
          txBState: { statement: 'Worker B writes to storage concurrently!', status: 'EXECUTED' },
          activeLocks: [],
          explanation: 'SPLIT-BRAIN CONCURRENCY CORRUPTION! Both workers wrote to storage simultaneously.',
          hasCycleDetected: false,
        },
      ],
      rootCause: 'Distributed locks without fencing tokens fail when client processes pause (GC, CPU starvation, network latency) beyond the lock lease TTL.',
      remedies: [
        {
          title: '1. Fencing Tokens (Monotonically Increasing Version)',
          type: 'optimistic_version',
          codeSnippet: `-- Storage layer validates that the token is >= highest token seen:
UPDATE account_balances 
SET amount = 1000, last_fencing_token = 42 
WHERE account_id = 1 AND last_fencing_token < 42;`,
          explanation: 'Ensures outdated zombie workers are rejected at the storage layer even if lock TTL expired.',
        },
      ],
    };
  }
}
