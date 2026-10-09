import { DATABASE_CATALOG, getEngineProfile } from '@sqlpulse/core';
import {
  analyzePlan,
  lintMigration,
  adviseQuery,
  transpileSql,
  tuneConfig,
  simulateDeadlock,
  calculateDisasterRecovery,
  synthesizeQuery,
  generateConnectHub,
  planPartitionStrategy,
  inspectSlowLogs,
  analyzeBloat,
  simulateReplicationTopology,
  generateSecurityRbac,
  generateMockData,
  calculateFinOps,
  auditIndexDoctor,
  sanitizePii,
  rewriteQuery,
  diffSchema,
  profileOrm,
  auditReadiness,
  simulateChaos,
  buildCdcOutbox,
  tuneVector,
} from './controllers/analyze.controller';

function mockRes() {
  let statusCode = 200;
  let responseData: any = null;
  const res: any = {
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    json: (data: any) => {
      responseData = data;
      return res;
    },
    get statusCode() {
      return statusCode;
    },
    get data() {
      return responseData;
    },
  };
  return res;
}

const FORBIDDEN_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: 'provider = "postgresql"', regex: /provider\s*=\s*"postgresql"/i },
  { name: 'dialect: "postgresql"', regex: /dialect:\s*"postgresql"/i },
  { name: 'postgresql.conf', regex: /postgresql\.conf/i },
  { name: 'pgbackrest', regex: /pgbackrest/i },
  { name: 'shared_buffers', regex: /shared_buffers/i },
  { name: 'work_mem', regex: /work_mem/i },
  { name: 'autovacuum', regex: /autovacuum/i },
  { name: 'jsonb', regex: /\bjsonb\b/i },
  { name: 'INDEX CONCURRENTLY', regex: /INDEX\s+CONCURRENTLY/i },
  { name: 'postgresql://', regex: /postgresql:\/\//i },
  { name: 'pgvector', regex: /pgvector/i },
  { name: 'pg_*', regex: /\bpg_[a-z0-9_]+/i },
  { name: 'postgres', regex: /\bpostgres(?:ql)?\b/i },
];

const getTestCases = (engineId: string) => [
  {
    name: 'plan',
    run: () => {
      const res = mockRes();
      analyzePlan({ body: { engine: engineId, plan: [{ 'Node Type': 'Seq Scan', 'Relation Name': 'users' }] } } as any, res);
      return res;
    },
  },
  {
    name: 'migration',
    run: () => {
      const res = mockRes();
      lintMigration({ body: { engine: engineId, sql: 'ALTER TABLE users ADD COLUMN age INT;' } } as any, res);
      return res;
    },
  },
  {
    name: 'query-advise',
    run: () => {
      const res = mockRes();
      adviseQuery({ body: { engine: engineId, query: 'SELECT * FROM users WHERE id = 1;' } } as any, res);
      return res;
    },
  },
  {
    name: 'transpile',
    run: () => {
      const res = mockRes();
      transpileSql({ body: { sourceEngine: 'oracle', targetEngine: engineId, sourceCode: 'SELECT 1 FROM dual;' } } as any, res);
      return res;
    },
  },
  {
    name: 'config-tuner',
    run: () => {
      const res = mockRes();
      tuneConfig({ body: { engine: engineId } } as any, res);
      return res;
    },
  },
  {
    name: 'deadlock-simulate',
    run: () => {
      const res = mockRes();
      simulateDeadlock({ body: { engine: engineId } } as any, res);
      return res;
    },
  },
  {
    name: 'disaster-recovery',
    run: () => {
      const res = mockRes();
      calculateDisasterRecovery({ body: { engine: engineId } } as any, res);
      return res;
    },
  },
  {
    name: 'synthesize-query',
    run: () => {
      const res = mockRes();
      synthesizeQuery({ body: { targetEngine: engineId, prompt: 'Find active users' } } as any, res);
      return res;
    },
  },
  {
    name: 'connect-hub',
    run: () => {
      const res = mockRes();
      generateConnectHub({ body: { engine: engineId } } as any, res);
      return res;
    },
  },
  {
    name: 'partition-plan',
    run: () => {
      const res = mockRes();
      planPartitionStrategy({ body: { engine: engineId } } as any, res);
      return res;
    },
  },
  {
    name: 'inspect-logs',
    run: () => {
      const res = mockRes();
      inspectSlowLogs({ body: { engine: engineId } } as any, res);
      return res;
    },
  },
  {
    name: 'bloat',
    run: () => {
      const res = mockRes();
      analyzeBloat({ body: { engine: engineId } } as any, res);
      return res;
    },
  },
  {
    name: 'replication',
    run: () => {
      const res = mockRes();
      simulateReplicationTopology({ body: { engine: engineId } } as any, res);
      return res;
    },
  },
  {
    name: 'security-rbac',
    run: () => {
      const res = mockRes();
      generateSecurityRbac({ body: { engine: engineId } } as any, res);
      return res;
    },
  },
  {
    name: 'mock-data',
    run: () => {
      const res = mockRes();
      generateMockData({ body: { engine: engineId } } as any, res);
      return res;
    },
  },
  {
    name: 'finops',
    run: () => {
      const res = mockRes();
      calculateFinOps({ body: { engine: engineId } } as any, res);
      return res;
    },
  },
  {
    name: 'index-doctor',
    run: () => {
      const res = mockRes();
      auditIndexDoctor({ body: { engine: engineId } } as any, res);
      return res;
    },
  },
  {
    name: 'pii-sanitizer',
    run: () => {
      const res = mockRes();
      sanitizePii({ body: { engine: engineId } } as any, res);
      return res;
    },
  },
  {
    name: 'query-rewriter',
    run: () => {
      const res = mockRes();
      rewriteQuery({ body: { engine: engineId, query: 'SELECT * FROM users WHERE status = 1;' } } as any, res);
      return res;
    },
  },
  {
    name: 'schema-diff',
    run: () => {
      const res = mockRes();
      diffSchema({ body: { engine: engineId } } as any, res);
      return res;
    },
  },
  {
    name: 'orm-profile',
    run: () => {
      const res = mockRes();
      profileOrm({ body: { engine: engineId } } as any, res);
      return res;
    },
  },
  {
    name: 'production-readiness',
    run: () => {
      const res = mockRes();
      auditReadiness({ body: { engine: engineId } } as any, res);
      return res;
    },
  },
  {
    name: 'chaos-simulate',
    run: () => {
      const res = mockRes();
      simulateChaos({ body: { engine: engineId } } as any, res);
      return res;
    },
  },
  {
    name: 'cdc-outbox',
    run: () => {
      const res = mockRes();
      buildCdcOutbox({ body: { engine: engineId } } as any, res);
      return res;
    },
  },
  {
    name: 'vector-tune',
    run: () => {
      const res = mockRes();
      tuneVector({ body: { engine: engineId } } as any, res);
      return res;
    },
  },
];

describe('All 447 Engines Catalog x 25 Studios Verification', () => {
  it('DATABASE_CATALOG contains at least 447 engines', () => {
    expect(DATABASE_CATALOG.length).toBeGreaterThanOrEqual(447);
  });

  const nonPgEngines = DATABASE_CATALOG.filter((db) => {
    const profile = getEngineProfile(db.id);
    return !profile.isPostgresFamily;
  });

  it('identifies non-PostgreSQL engines correctly (> 400 engines)', () => {
    expect(nonPgEngines.length).toBeGreaterThan(400);
  });

  it('PostgreSQL output remains functional with native tooling and syntax', () => {
    const resBloat = mockRes();
    analyzeBloat({ body: { engine: 'postgresql', tableName: 'users' } } as any, resBloat);
    expect(resBloat.statusCode).toBe(200);
    expect(resBloat.data.data.maintenanceTuningDdl).toContain('autovacuum_vacuum_scale_factor');
    expect(resBloat.data.data.hygieneCheckQuery).toContain('pg_stat_user_tables');

    const resConnect = mockRes();
    generateConnectHub({ body: { engine: 'postgresql' } } as any, resConnect);
    expect(resConnect.statusCode).toBe(200);
    expect(resConnect.data.data.connectionUri).toContain('postgresql://');

    const resMigration = mockRes();
    lintMigration({ body: { engine: 'postgresql', sql: 'CREATE INDEX idx_users_email ON users(email);' } } as any, resMigration);
    expect(resMigration.statusCode).toBe(200);
    expect(resMigration.data.data.findings[0]?.safeAlternativeSql).toContain('CONCURRENTLY');

    const resTuner = mockRes();
    tuneConfig({ body: { engine: 'postgresql' } } as any, resTuner);
    expect(resTuner.statusCode).toBe(200);
    expect(resTuner.data.data.generatedConfigText).toContain('shared_buffers');
    expect(resTuner.data.data.generatedConfigText).toContain('work_mem');
  });

  it('all 447 engines return HTTP 200 without throwing across all 25 studios (11,175 checks)', () => {
    const failures: { engine: string; studio: string; status: number; error: string }[] = [];
    const notApplicableCounts: Record<string, number> = {};

    const studioNames = getTestCases('postgresql').map((t) => t.name);
    for (const name of studioNames) {
      notApplicableCounts[name] = 0;
    }

    for (const db of DATABASE_CATALOG) {
      const testCases = getTestCases(db.id);
      for (const tc of testCases) {
        try {
          const res = tc.run();
          if (res.statusCode !== 200 || !res.data || res.data.success === false) {
            failures.push({
              engine: db.id,
              studio: tc.name,
              status: res.statusCode,
              error: res.data?.error || 'Unknown failure',
            });
          } else {
            const jsonStr = JSON.stringify(res.data);
            const isNA =
              jsonStr.includes('Not Applicable') ||
              jsonStr.includes('Not applicable') ||
              jsonStr.includes('not supported natively') ||
              jsonStr.includes('"isApplicable":false');
            if (isNA) {
              notApplicableCounts[tc.name]++;
            }
          }
        } catch (err: any) {
          failures.push({
            engine: db.id,
            studio: tc.name,
            status: 500,
            error: err.message || 'Threw unhandled exception',
          });
        }
      }
    }

    // Print per-studio Not Applicable counts table
    console.log('\n=== PER-STUDIO NOT APPLICABLE REPORT (447 Engines) ===');
    console.log('| Studio ID | Total Engines | Applicable | Not Applicable |');
    console.log('| :--- | :---: | :---: | :---: |');
    for (const name of studioNames) {
      const na = notApplicableCounts[name] || 0;
      const app = DATABASE_CATALOG.length - na;
      console.log(`| ${name.padEnd(21)} | ${DATABASE_CATALOG.length} | ${String(app).padStart(4)} | ${String(na).padStart(4)} |`);
    }
    console.log('=====================================================\n');

    if (failures.length > 0) {
      console.error(`Total failures across 447 engines: ${failures.length}`);
      console.error('First 10 failures:', failures.slice(0, 10));
    }

    expect(failures).toHaveLength(0);
  }, 120000);

  it('no non-PostgreSQL engine leaks PostgreSQL tokens across any of the 25 studios', () => {
    const violations: { engine: string; studio: string; token: string; snippet: string }[] = [];

    for (const db of nonPgEngines) {
      const testCases = getTestCases(db.id);

      for (const tc of testCases) {
        try {
          const res = tc.run();
          const jsonStr = JSON.stringify(res.data);
          for (const pat of FORBIDDEN_PATTERNS) {
            const match = jsonStr.match(pat.regex);
            if (match) {
              const idx = match.index || 0;
              const snippet = jsonStr.substring(Math.max(0, idx - 40), Math.min(jsonStr.length, idx + 40));
              violations.push({
                engine: db.id,
                studio: tc.name,
                token: pat.name,
                snippet,
              });
            }
          }
        } catch (err: any) {
          violations.push({
            engine: db.id,
            studio: tc.name,
            token: 'EXCEPTION',
            snippet: err.message,
          });
        }
      }
    }

    if (violations.length > 0) {
      const summary: Record<string, number> = {};
      for (const v of violations) {
        const k = `${v.studio} -> ${v.token}`;
        summary[k] = (summary[k] || 0) + 1;
      }
      console.error('Violations summary:', summary);
      console.error('First 10 violations:', violations.slice(0, 10));
    }

    expect(violations).toHaveLength(0);
  }, 120000);

  it('SQL Server planCommand and dropIndexSql adhere strictly to official documentation', () => {
    const profile = getEngineProfile('sqlserver');
    // planCommand must emit separate batches using GO because SET SHOWPLAN_XML must be the only statement in a batch
    expect(profile.planCommand).toContain('SET SHOWPLAN_XML ON;\nGO');
    expect(profile.planCommand).toContain('GO\nSET SHOWPLAN_XML OFF;\nGO');

    // dropIndexSql must not use WITH (ONLINE = ON) for nonclustered indexes (ONLINE on DROP applies only to clustered indexes)
    const dropSql = profile.onlineDdl.dropIndexSql('idx_users_email', 'users');
    expect(dropSql).toBe('DROP INDEX idx_users_email ON users;');
    expect(dropSql).not.toContain('WITH (ONLINE = ON)');

    // createIndexSql uses WITH (ONLINE = ON)
    const createSql = profile.onlineDdl.createIndexSql('idx_users_email', 'users', 'email');
    expect(createSql).toContain('WITH (ONLINE = ON)');
  });

  it('Snowflake and BigQuery have authentic cloud managed controls without invented config files or logs', () => {
    const snow = getEngineProfile('snowflake');
    expect(snow.memoryParams.configFile).toContain('Managed Cloud Service');
    expect(snow.backup.walOrLogName).toContain('Time Travel');
    expect(snow.backup.walOrLogName).not.toContain('Commit Log / Append Parts');
    expect(snow.backup.walOrLogName).not.toContain('WAL');

    const bq = getEngineProfile('google_bigquery');
    expect(bq.memoryParams.configFile).toContain('Serverless Cloud Service');
    expect(bq.backup.walOrLogName).toContain('Time Travel');
    expect(bq.backup.walOrLogName).not.toContain('Commit Log / Append Parts');
    expect(bq.backup.walOrLogName).not.toContain('WAL');
  });

  it('ClickHouse and Columnar OLAP have authentic MergeTree immutable parts without invented commit logs', () => {
    const ch = getEngineProfile('clickhouse');
    expect(ch.backup.walOrLogName).toContain('Immutable Columnar Data Parts (MergeTree)');
    expect(ch.backup.walOrLogName).not.toContain('Commit Log');
    expect(ch.backup.walOrLogName).not.toContain('Append Parts');
  });

  it('every vendor profile command has an official doc-URL comment or an UNVERIFIED marker', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.resolve(__dirname, '../../packages/core/src/types/engine-profiles.ts');
    const sourceCode = fs.readFileSync(filePath, 'utf-8');

    const bases = [
      'POSTGRES_FAMILY_BASE',
      'MYSQL_FAMILY_BASE',
      'ORACLE_BASE',
      'SQL_SERVER_BASE',
      'DB2_BASE',
      'SAP_HANA_BASE',
      'EMBEDDED_BASE',
      'COLUMNAR_OLAP_BASE',
      'WIDE_COLUMN_BASE',
      'DOCUMENT_BASE',
      'KEYVALUE_BASE',
      'GRAPH_BASE',
      'VECTOR_BASE',
      'SEARCH_BASE',
      'TIMESERIES_BASE',
      'GENERIC_BASE',
    ];

    const commandKeys = [
      'statsCommand',
      'spaceReclaimCommand',
      'planCommand',
      'createIndexSql',
      'dropIndexSql',
      'commandTemplate',
    ];

    const missingDocs: string[] = [];

    for (const base of bases) {
      const baseIdx = sourceCode.indexOf(`const ${base}:`);
      expect(baseIdx).toBeGreaterThan(-1);
      let nextBaseIdx = sourceCode.indexOf('\nconst ', baseIdx + 20);
      if (nextBaseIdx === -1) {
        nextBaseIdx = sourceCode.indexOf('\nexport function', baseIdx + 20);
      }
      const baseSlice = sourceCode.substring(baseIdx, nextBaseIdx > -1 ? nextBaseIdx : undefined);

      const lines = baseSlice.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const cmdKey of commandKeys) {
          const regex = new RegExp(`^\\s*${cmdKey}:`);
          if (regex.test(line)) {
            const preceding = lines.slice(Math.max(0, i - 4), i).join('\n');
            const hasDoc = /https?:\/\//i.test(preceding) || /UNVERIFIED/i.test(preceding);
            if (!hasDoc) {
              missingDocs.push(`${base} -> ${cmdKey} (line: ${line.trim()})`);
            }
          }
        }
      }
    }

    if (missingDocs.length > 0) {
      console.error('Commands missing doc URL or UNVERIFIED marker:', missingDocs);
    }
    expect(missingDocs).toHaveLength(0);
  });

  it('formats multi-column indexes correctly with 2+ columns across non-relational engines', () => {
    const mongo = getEngineProfile('mongodb');
    const mongoSql = mongo.onlineDdl.createIndexSql('idx_users', 'users', 'col_a, col_b');
    expect(mongoSql).toContain('"col_a": 1, "col_b": 1');
    expect(mongoSql).not.toContain('{ col_a, col_b: 1 }');

    const neo = getEngineProfile('neo4j');
    const neoSql = neo.onlineDdl.createIndexSql('idx_node', 'User', 'col_a, col_b');
    expect(neoSql).toContain('ON (n.col_a, n.col_b)');
    expect(neoSql).not.toContain('ON (n.col_a, col_b)');

    const es = getEngineProfile('elasticsearch');
    const esSql = es.onlineDdl.createIndexSql('idx_es', 'users', 'col_a, col_b');
    expect(esSql).toContain('"col_a": { "type": "keyword" }');
    expect(esSql).toContain('"col_b": { "type": "keyword" }');

    const redis = getEngineProfile('redis');
    const redisSql = redis.onlineDdl.createIndexSql('idx_red', 'users', 'col_a, col_b');
    expect(redisSql).toContain('SCHEMA col_a TEXT col_b TEXT');

    const qdb = getEngineProfile('questdb');
    const qdbSql = qdb.onlineDdl.createIndexSql('idx_qdb', 'users', 'col_a, col_b');
    expect(qdbSql).toContain('ALTER TABLE users ALTER COLUMN col_a ADD INDEX;');
    expect(qdbSql).toContain('ALTER TABLE users ALTER COLUMN col_b ADD INDEX;');
  });

  it('isolates lead-engine commands from non-lead engines across all families', () => {
    // Vector family: Pinecone, Qdrant, Weaviate, Chroma must NOT receive milvus-backup
    for (const vEngine of ['pinecone', 'qdrant', 'weaviate', 'chroma']) {
      const prof = getEngineProfile(vEngine);
      expect(prof.backup.tool).not.toContain('milvus-backup');
      const ddl = prof.onlineDdl.createIndexSql('idx', 'items', 'vector');
      expect(ddl).not.toContain('milvus');
    }

    // Key-value family: Memcached, etcd must NOT receive Redis BGSAVE or FT.CREATE
    for (const kvEngine of ['memcached', 'etcd']) {
      const prof = getEngineProfile(kvEngine);
      expect(prof.backup.tool).not.toContain('BGSAVE');
      const ddl = prof.onlineDdl.createIndexSql('idx', 'cache', 'key, val');
      expect(ddl).not.toContain('FT.CREATE');
    }

    // Document family: DynamoDB, Cosmos DB, Firestore must NOT receive mongodump
    for (const docEngine of ['amazon_dynamodb', 'microsoft_azure_cosmos_db', 'google_cloud_firestore']) {
      const prof = getEngineProfile(docEngine);
      expect(prof.backup.tool).not.toContain('mongodump');
      const ddl = prof.onlineDdl.createIndexSql('idx', 'items', 'pk, sk');
      expect(ddl).not.toContain('createIndex(');
    }

    // Columnar / OLAP: Snowflake, Redshift, BigQuery, Databricks, Trino, Presto, Hive must NOT receive ClickHouse commands
    for (const olapEngine of ['snowflake', 'amazon_redshift', 'google_bigquery', 'databricks', 'trino', 'presto', 'apache_hive']) {
      const prof = getEngineProfile(olapEngine);
      expect(prof.backup.tool).not.toContain('clickhouse-backup');
      const ddl = prof.onlineDdl.createIndexSql('idx', 'events', 'ts, user_id');
      expect(ddl).not.toContain('ADD PROJECTION');
    }

    // Wide column: HBase must NOT receive Cassandra nodetool or SASI
    const hbase = getEngineProfile('apache_hbase');
    expect(hbase.backup.tool).not.toContain('nodetool');
    const hbaseDdl = hbase.onlineDdl.createIndexSql('idx', 'tbl', 'col');
    expect(hbaseDdl).not.toContain('SASIIndex');

    // Couchbase must NOT receive Cassandra nodetool, SASI, or port 9042
    const couchbase = getEngineProfile('couchbase');
    expect(couchbase.backup.tool).not.toContain('nodetool');
    expect(couchbase.connection.defaultPort).toBe(8091);

    // Bloomberg Comdb2 must NOT receive IBM Db2 commands
    const comdb2 = getEngineProfile('comdb2');
    expect(comdb2.backup.tool).not.toContain('db2 backup');
    expect(comdb2.systemViews.locks).not.toContain('db2pd');
    expect(comdb2.connection.defaultPort).toBe(5105);

    // Embedded: DuckDB must NOT receive SQLite VACUUM INTO or AUTOINCREMENT
    const duckdb = getEngineProfile('duckdb');
    expect(duckdb.backup.tool).not.toContain('VACUUM INTO');
    expect(duckdb.syntax.identityColumn).not.toContain('AUTOINCREMENT');

    // Time-series: QuestDB, Prometheus, VictoriaMetrics must NOT receive influx backup
    for (const tsEngine of ['questdb', 'prometheus', 'victoriametrics']) {
      const prof = getEngineProfile(tsEngine);
      expect(prof.backup.tool).not.toContain('influx backup');
    }

    // Search: Splunk and Algolia must NOT receive Elasticsearch PUT / mapping
    for (const sEngine of ['splunk', 'algolia']) {
      const prof = getEngineProfile(sEngine);
      const ddl = prof.onlineDdl.createIndexSql('idx', 'logs', 'col');
      expect(ddl).not.toContain('PUT /logs/_mapping');
    }
  });

  it('configures accurate default ports for specialized and cloud engines', () => {
    const expectedPorts: Record<string, number> = {
      snowflake: 443,
      google_bigquery: 443,
      amazon_redshift: 5439,
      databricks: 443,
      duckdb: 0,
      amazon_dynamodb: 443,
      microsoft_azure_cosmos_db: 443,
      google_cloud_firestore: 443,
      couchbase: 8091,
      memcached: 11211,
      etcd: 2379,
      pinecone: 443,
      qdrant: 6333,
      weaviate: 8080,
      chroma: 8000,
      questdb: 9000,
      prometheus: 9090,
      victoriametrics: 8428,
      apache_hbase: 16010,
      amazon_neptune: 8182,
      tigergraph: 14240,
      splunk: 8089,
      algolia: 443,
      comdb2: 5105,
      trino: 8080,
      presto: 8080,
      apache_hive: 10000,
      amazon_keyspaces: 9142,
    };

    for (const [engine, port] of Object.entries(expectedPorts)) {
      const prof = getEngineProfile(engine);
      expect(prof.connection.defaultPort).toBe(port);
    }
  });

  it('guarantees no spaceReclaimCommand across all 447 engines performs destructive data deletion', () => {
    const dangerousRegex = /flush_all|TRUNCATE|clear_objects|clean eventdata|delete_all|DROP\s+(?:TABLE|DATABASE)|DELETE\s+FROM/i;
    const violations: { engine: string; command: string }[] = [];
    for (const item of DATABASE_CATALOG) {
      const prof = getEngineProfile(item.id);
      const cmd = prof.maintenance?.spaceReclaimCommand || '';
      if (dangerousRegex.test(cmd)) {
        violations.push({ engine: item.id, command: cmd });
      }
    }
    expect(violations).toHaveLength(0);
  });

  it('ensures generic fallback engines do not receive runnable backup_tool or MySQL table commands', () => {
    for (const item of DATABASE_CATALOG) {
      const prof = getEngineProfile(item.id);
      if (prof.family === 'generic') {
        const backupCmd = prof.backup.commandTemplate(item.id, '/bk');
        expect(backupCmd).not.toContain('backup_tool --database=');
        expect(prof.maintenance.statsCommand).not.toBe('ANALYZE TABLE {table};');
        expect(prof.maintenance.spaceReclaimCommand).not.toBe('OPTIMIZE TABLE {table};');
      }
    }
  });

  it('verifies that lead-engine backup commands are strictly isolated to lead and compatible engines', () => {
    const leadPatterns = [
      { pattern: /clickhouse-backup/i, allowed: new Set(['clickhouse', 'altinity_clickhouse']) },
      { pattern: /\bBGSAVE\b/i, allowed: new Set(['redis', 'valkey', 'keydb', 'dragonfly']) },
      { pattern: /neo4j-admin/i, allowed: new Set(['neo4j']) },
      { pattern: /influx\s+backup/i, allowed: new Set(['influxdb']) },
      { pattern: /milvus-backup/i, allowed: new Set(['milvus', 'zilliz']) },
      { pattern: /mongodump/i, allowed: new Set(['mongodb', 'amazon_documentdb', 'percona_server_for_mongodb']) },
      { pattern: /PUT\s+\/_snapshot/i, allowed: new Set(['elasticsearch', 'opensearch']) },
      { pattern: /nodetool/i, allowed: new Set(['apache_cassandra', 'scylladb', 'datastax_enterprise', 'elassandra']) },
    ];

    for (const item of DATABASE_CATALOG) {
      const prof = getEngineProfile(item.id);
      const backupTool = prof.backup.tool;
      const backupCmd = prof.backup.commandTemplate(item.id, '/bk');
      const text = `${backupTool} ${backupCmd}`;

      for (const { pattern, allowed } of leadPatterns) {
        if (pattern.test(text) && !allowed.has(item.id)) {
          throw new Error(`Engine ${item.id} received forbidden lead backup tool/command matching ${pattern}: "${text}"`);
        }
      }
    }
  });

  it('verifies accurate configurations and ports for the 29 newly overridden non-SQL engines', () => {
    const newlyOverriddenExpected: Record<string, { port: number; backupTool: string }> = {
      teradata: { port: 1025, backupTool: 'Teradata DSA' },
      vertica: { port: 5433, backupTool: 'Vertica vbr' },
      apache_impala: { port: 21050, backupTool: 'DistCp' },
      apache_druid: { port: 8888, backupTool: 'Druid Deep Storage' },
      starrocks: { port: 9030, backupTool: 'StarRocks BACKUP SNAPSHOT' },
      apache_pinot: { port: 8099, backupTool: 'Pinot Deep Storage' },
      apache_doris: { port: 9030, backupTool: 'Apache Doris BACKUP SNAPSHOT' },
      aerospike: { port: 3000, backupTool: 'asbackup' },
      hazelcast: { port: 5701, backupTool: 'Hazelcast Hot Restart' },
      rocksdb: { port: 0, backupTool: 'RocksDB BackupEngine' },
      leveldb: { port: 0, backupTool: 'LevelDB File Copy' },
      riak_kv: { port: 8087, backupTool: 'riak-admin backup' },
      janusgraph: { port: 8182, backupTool: 'JanusGraph Storage Backend' },
      orientdb: { port: 2424, backupTool: 'OrientDB Console BACKUP' },
      memgraph: { port: 7687, backupTool: 'Memgraph CREATE SNAPSHOT' },
      apache_jena_tdb: { port: 3030, backupTool: 'tdb2.tdbbackup' },
      tdengine: { port: 6030, backupTool: 'taosdump' },
      opentsdb: { port: 4242, backupTool: 'HBase Snapshot' },
      rrdtool: { port: 0, backupTool: 'rrdtool dump' },
      dolphindb: { port: 8848, backupTool: 'DolphinDB backup' },
      vespa: { port: 8080, backupTool: 'vespa-visit' },
      vald: { port: 8080, backupTool: 'Vald Agent PVC Snapshot' },
      apache_solr: { port: 8983, backupTool: 'Solr Collections API' },
      meilisearch: { port: 7700, backupTool: 'Meilisearch Dump API' },
      typesense: { port: 8108, backupTool: 'Typesense Snapshot API' },
      couchdb: { port: 5984, backupTool: 'CouchDB Continuous Replication' },
      rethinkdb: { port: 28015, backupTool: 'rethinkdb dump' },
      ravendb: { port: 8080, backupTool: 'RavenDB Periodic Backup API' },
      apache_accumulo: { port: 9995, backupTool: 'Accumulo Table Clone' },
    };

    for (const [engine, expected] of Object.entries(newlyOverriddenExpected)) {
      const prof = getEngineProfile(engine);
      expect(prof.connection.defaultPort).toBe(expected.port);
      expect(prof.backup.tool).toContain(expected.backupTool);
      expect(prof.maintenance.statsCommand).toBeDefined();
      expect(prof.maintenance.spaceReclaimCommand).toBeDefined();
    }
  });
});


