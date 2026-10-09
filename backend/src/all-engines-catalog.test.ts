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
});
