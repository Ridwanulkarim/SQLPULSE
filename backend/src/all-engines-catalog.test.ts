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
];

describe('All 447 Engines Catalog x 25 Studios Leak Verification', () => {
  // Ensure the catalog contains all 447 database engines
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
    expect(resBloat.data.data.maintenanceTuningDdl).toContain('autovacuum_vacuum_scale_factor');
    expect(resBloat.data.data.hygieneCheckQuery).toContain('pg_stat_user_tables');

    const resConnect = mockRes();
    generateConnectHub({ body: { engine: 'postgresql' } } as any, resConnect);
    expect(resConnect.data.data.connectionUri).toContain('postgresql://');

    const resMigration = mockRes();
    lintMigration({ body: { engine: 'postgresql', sql: 'CREATE INDEX idx_users_email ON users(email);' } } as any, resMigration);
    expect(resMigration.data.data.findings[0]?.safeAlternativeSql).toContain('CONCURRENTLY');

    const resTuner = mockRes();
    tuneConfig({ body: { engine: 'postgresql' } } as any, resTuner);
    expect(resTuner.data.data.generatedConfigText).toContain('shared_buffers');
    expect(resTuner.data.data.generatedConfigText).toContain('work_mem');
  });

  it('no non-PostgreSQL engine leaks PostgreSQL tokens across any of the 25 studios', () => {
    const violations: { engine: string; studio: string; token: string; snippet: string }[] = [];

    for (const db of nonPgEngines) {
      const testCases: { name: string; run: () => any }[] = [
        {
          name: 'plan',
          run: () => {
            const res = mockRes();
            analyzePlan({ body: { engine: db.id, plan: [{ 'Node Type': 'Seq Scan', 'Relation Name': 'users' }] } } as any, res);
            return res.data;
          },
        },
        {
          name: 'migration',
          run: () => {
            const res = mockRes();
            lintMigration({ body: { engine: db.id, sql: 'ALTER TABLE users ADD COLUMN age INT;' } } as any, res);
            return res.data;
          },
        },
        {
          name: 'query-advise',
          run: () => {
            const res = mockRes();
            adviseQuery({ body: { engine: db.id, query: 'SELECT * FROM users WHERE id = 1;' } } as any, res);
            return res.data;
          },
        },
        {
          name: 'transpile',
          run: () => {
            const res = mockRes();
            transpileSql({ body: { sourceEngine: 'oracle', targetEngine: db.id, sourceCode: 'SELECT 1 FROM dual;' } } as any, res);
            return res.data;
          },
        },
        {
          name: 'config-tuner',
          run: () => {
            const res = mockRes();
            tuneConfig({ body: { engine: db.id } } as any, res);
            return res.data;
          },
        },
        {
          name: 'deadlock-simulate',
          run: () => {
            const res = mockRes();
            simulateDeadlock({ body: { engine: db.id } } as any, res);
            return res.data;
          },
        },
        {
          name: 'disaster-recovery',
          run: () => {
            const res = mockRes();
            calculateDisasterRecovery({ body: { engine: db.id } } as any, res);
            return res.data;
          },
        },
        {
          name: 'synthesize-query',
          run: () => {
            const res = mockRes();
            synthesizeQuery({ body: { targetEngine: db.id, prompt: 'Find active users' } } as any, res);
            return res.data;
          },
        },
        {
          name: 'connect-hub',
          run: () => {
            const res = mockRes();
            generateConnectHub({ body: { engine: db.id } } as any, res);
            return res.data;
          },
        },
        {
          name: 'partition-plan',
          run: () => {
            const res = mockRes();
            planPartitionStrategy({ body: { engine: db.id } } as any, res);
            return res.data;
          },
        },
        {
          name: 'inspect-logs',
          run: () => {
            const res = mockRes();
            inspectSlowLogs({ body: { engine: db.id } } as any, res);
            return res.data;
          },
        },
        {
          name: 'bloat',
          run: () => {
            const res = mockRes();
            analyzeBloat({ body: { engine: db.id } } as any, res);
            return res.data;
          },
        },
        {
          name: 'replication',
          run: () => {
            const res = mockRes();
            simulateReplicationTopology({ body: { engine: db.id } } as any, res);
            return res.data;
          },
        },
        {
          name: 'security-rbac',
          run: () => {
            const res = mockRes();
            generateSecurityRbac({ body: { engine: db.id } } as any, res);
            return res.data;
          },
        },
        {
          name: 'mock-data',
          run: () => {
            const res = mockRes();
            generateMockData({ body: { engine: db.id } } as any, res);
            return res.data;
          },
        },
        {
          name: 'finops',
          run: () => {
            const res = mockRes();
            calculateFinOps({ body: { engine: db.id } } as any, res);
            return res.data;
          },
        },
        {
          name: 'index-doctor',
          run: () => {
            const res = mockRes();
            auditIndexDoctor({ body: { engine: db.id } } as any, res);
            return res.data;
          },
        },
        {
          name: 'pii-sanitizer',
          run: () => {
            const res = mockRes();
            sanitizePii({ body: { engine: db.id } } as any, res);
            return res.data;
          },
        },
        {
          name: 'query-rewriter',
          run: () => {
            const res = mockRes();
            rewriteQuery({ body: { engine: db.id, query: 'SELECT * FROM users WHERE status = 1;' } } as any, res);
            return res.data;
          },
        },
        {
          name: 'schema-diff',
          run: () => {
            const res = mockRes();
            diffSchema({ body: { engine: db.id } } as any, res);
            return res.data;
          },
        },
        {
          name: 'orm-profile',
          run: () => {
            const res = mockRes();
            profileOrm({ body: { engine: db.id } } as any, res);
            return res.data;
          },
        },
        {
          name: 'production-readiness',
          run: () => {
            const res = mockRes();
            auditReadiness({ body: { engine: db.id } } as any, res);
            return res.data;
          },
        },
        {
          name: 'chaos-simulate',
          run: () => {
            const res = mockRes();
            simulateChaos({ body: { engine: db.id } } as any, res);
            return res.data;
          },
        },
        {
          name: 'cdc-outbox',
          run: () => {
            const res = mockRes();
            buildCdcOutbox({ body: { engine: db.id } } as any, res);
            return res.data;
          },
        },
        {
          name: 'vector-tune',
          run: () => {
            const res = mockRes();
            tuneVector({ body: { engine: db.id } } as any, res);
            return res.data;
          },
        },
      ];

      for (const tc of testCases) {
        try {
          const out = tc.run();
          const jsonStr = JSON.stringify(out);
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
});
