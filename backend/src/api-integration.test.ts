import { saveReport, getReportById, listRecentReports } from './controllers/report.controller';
import { analyzePlan, lintMigration, transpileSql, tuneConfig } from './controllers/analyze.controller';
import { reportRepository } from './db/db';

function createMockReqRes(options: {
  body?: any;
  params?: Record<string, string>;
  query?: Record<string, any>;
  headers?: Record<string, string>;
} = {}) {
  const req: any = {
    body: options.body || {},
    params: options.params || {},
    query: options.query || {},
    headers: options.headers || {},
  };

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

  return { req, res };
}

describe('SQLPulse API Integration & Security Tests', () => {
  beforeEach(() => {
    reportRepository._clearInMemoryStore();
  });

  describe('Report Endpoints Security & Bounded Limits', () => {
    const validPlan = [
      {
        Plan: {
          'Node Type': 'Seq Scan',
          'Relation Name': 'users',
          'Total Cost': 120.0,
          'Plan Rows': 500,
          'Actual Total Time': 45.2,
          'Shared Hit Blocks': 20,
          'Shared Read Blocks': 15,
        },
      },
    ];

    it('saveReport creates report with UUID and returns 201', async () => {
      const { req, res } = createMockReqRes({
        body: {
          title: 'Production Users Table Query',
          raw_query: 'SELECT * FROM users WHERE active = true;',
          raw_plan: validPlan,
        },
      });

      await saveReport(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.data.success).toBe(true);
      expect(res.data.reportId).toBeDefined();
      expect(res.data.shareUrl).toContain('/report/');
      expect(res.data.data.performance_score).toBeGreaterThan(0);
    });

    it('saveReport validates and rejects missing raw_plan with 400', async () => {
      const { req, res } = createMockReqRes({
        body: {
          title: 'Empty Request',
        },
      });

      await saveReport(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.error).toContain('Invalid report request payload');
    });

    it('getReportById fetches saved report', async () => {
      const { req: saveReq, res: saveRes } = createMockReqRes({
        body: {
          title: 'Saved Report Test',
          raw_plan: validPlan,
        },
      });

      await saveReport(saveReq, saveRes);
      const reportId = saveRes.data.reportId;

      const { req: getReq, res: getRes } = createMockReqRes({
        params: { id: reportId },
      });

      await getReportById(getReq, getRes);

      expect(getRes.statusCode).toBe(200);
      expect(getRes.data.success).toBe(true);
      expect(getRes.data.data.id).toBe(reportId);
      expect(getRes.data.data.title).toBe('Saved Report Test');
    });

    it('getReportById returns 404 for non-existent report', async () => {
      const { req, res } = createMockReqRes({
        params: { id: '00000000-0000-0000-0000-000000000000' },
      });

      await getReportById(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.data.success).toBe(false);
    });

    it('getReportById returns 400 for invalid ID format', async () => {
      const { req, res } = createMockReqRes({
        params: { id: 'invalid_id_format!@#' },
      });

      await getReportById(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.success).toBe(false);
    });

    it('getReportById requires x-report-key header and rejects URL query parameter when REPORT_ACCESS_KEY is configured', async () => {
      process.env.REPORT_ACCESS_KEY = 'vault_secret_report_key_778';

      const reportId = 'report_secret_test_vault_123';
      await reportRepository.saveReport({
        id: reportId,
        title: 'Secret Protected Report',
        raw_plan: validPlan,
        performance_score: 95,
        total_cost: 10,
        execution_time_ms: 1,
        planning_time_ms: 1,
        total_memory_hits: 10,
        total_disk_reads: 0,
        cache_hit_ratio: 100,
        bottlenecks: [],
        recommendations: [],
        graph: { nodes: [], edges: [] },
      });

      // 1. Missing header -> 401
      const { req: noKeyReq, res: noKeyRes } = createMockReqRes({
        params: { id: reportId },
      });
      await getReportById(noKeyReq, noKeyRes);
      expect(noKeyRes.statusCode).toBe(401);
      expect(noKeyRes.data.error).toContain('x-report-key');

      // 2. URL query key -> rejected with 401 (URL query secrets not allowed)
      const { req: queryKeyReq, res: queryKeyRes } = createMockReqRes({
        params: { id: reportId },
        query: { key: 'vault_secret_report_key_778' },
      });
      await getReportById(queryKeyReq, queryKeyRes);
      expect(queryKeyRes.statusCode).toBe(401);

      // 3. Proper x-report-key HTTP header -> 200 OK
      const { req: headerKeyReq, res: headerKeyRes } = createMockReqRes({
        params: { id: reportId },
        headers: { 'x-report-key': 'vault_secret_report_key_778' },
      });
      await getReportById(headerKeyReq, headerKeyRes);
      expect(headerKeyRes.statusCode).toBe(200);
      expect(headerKeyRes.data.data.title).toBe('Secret Protected Report');

      delete process.env.REPORT_ACCESS_KEY;
    });

    it('listRecentReports returns 403 when ADMIN_API_KEY is not configured on server', async () => {
      delete process.env.ADMIN_API_KEY;
      const { req, res } = createMockReqRes({
        headers: { 'x-admin-key': 'attacker_provided_key' },
        query: { limit: 10 },
      });

      await listRecentReports(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.data.success).toBe(false);
      expect(res.data.error).toContain('ADMIN_API_KEY is not configured');
    });

    it('listRecentReports returns 403 when unauthenticated or wrong key is provided', async () => {
      process.env.ADMIN_API_KEY = 'secret_production_admin_key_99182';

      const { req: unauthReq, res: unauthRes } = createMockReqRes({
        query: { limit: 10 },
      });
      await listRecentReports(unauthReq, unauthRes);
      expect(unauthRes.statusCode).toBe(403);

      const { req: wrongReq, res: wrongRes } = createMockReqRes({
        headers: { 'x-admin-key': 'wrong_key_123' },
        query: { limit: 10 },
      });
      await listRecentReports(wrongReq, wrongRes);
      expect(wrongRes.statusCode).toBe(403);
      expect(wrongRes.data.error).toContain('Access denied');

      delete process.env.ADMIN_API_KEY;
    });

    it('listRecentReports accepts valid admin key via x-admin-key or Bearer token', async () => {
      process.env.ADMIN_API_KEY = 'secret_admin_token_4829';

      for (let i = 0; i < 5; i++) {
        await reportRepository.saveReport({
          id: `report_${i}`,
          title: `Report ${i}`,
          raw_plan: validPlan,
          performance_score: 80,
          total_cost: 100,
          execution_time_ms: 10,
        });
      }

      const { req: headerReq, res: headerRes } = createMockReqRes({
        headers: { 'x-admin-key': 'secret_admin_token_4829' },
        query: { limit: 1000000 },
      });
      await listRecentReports(headerReq, headerRes);
      expect(headerRes.statusCode).toBe(200);
      expect(headerRes.data.success).toBe(true);
      expect(headerRes.data.count).toBe(5);

      const { req: bearerReq, res: bearerRes } = createMockReqRes({
        headers: { authorization: 'Bearer secret_admin_token_4829' },
        query: { limit: 50 },
      });
      await listRecentReports(bearerReq, bearerRes);
      expect(bearerRes.statusCode).toBe(200);
      expect(bearerRes.data.count).toBe(5);

      delete process.env.ADMIN_API_KEY;
    });

    it('in-memory repository evicts oldest keys when exceeding 500 max capacity', async () => {
      for (let i = 0; i < 505; i++) {
        await reportRepository.saveReport({
          id: `report_${i}`,
          title: `Report ${i}`,
          raw_plan: validPlan,
          performance_score: 90,
          total_cost: 50,
          execution_time_ms: 5,
        });
      }

      const count = reportRepository._getInMemoryStoreSize();
      expect(count).toBeLessThanOrEqual(500);

      const oldest = await reportRepository.getReportById('report_0');
      expect(oldest).toBeNull();

      const newest = await reportRepository.getReportById('report_504');
      expect(newest).not.toBeNull();
    });
  });

  describe('Analyzer Endpoints & Zod Validation', () => {
    it('analyzePlan returns execution tree and bottlenecks', async () => {
      const rawPlan = [
        {
          Plan: {
            'Node Type': 'Seq Scan',
            'Relation Name': 'orders',
            'Total Cost': 500.0,
            'Plan Rows': 25000,
            'Actual Total Time': 120.5,
          },
        },
      ];

      const { req, res } = createMockReqRes({
        body: {
          engine: 'postgres',
          plan: rawPlan,
          query: 'SELECT * FROM orders;',
        },
      });

      analyzePlan(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.data.graph.nodes.length).toBeGreaterThan(0);
      expect(res.data.data.performanceScore).toBeDefined();
    });

    it('analyzePlan rejects invalid empty plan with 400', async () => {
      const { req, res } = createMockReqRes({
        body: {
          engine: 'postgres',
        },
      });

      analyzePlan(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.success).toBe(false);
    });

    it('lintMigration flags unsafe DDL locks', async () => {
      const { req, res } = createMockReqRes({
        body: {
          engine: 'postgres',
          sql: 'CREATE INDEX idx_users_email ON users(email);',
        },
      });

      lintMigration(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.data.findings.length).toBeGreaterThan(0);
    });

    it('transpileSql converts Oracle to PostgreSQL DDL', async () => {
      const { req, res } = createMockReqRes({
        body: {
          sourceEngine: 'oracle',
          targetEngine: 'postgres',
          sourceCode: 'CREATE TABLE emp (id NUMBER(10), name VARCHAR2(100), hire_dt DATE DEFAULT SYSDATE);',
        },
      });

      transpileSql(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.data.transpiledCode).toContain('BIGINT');
      expect(res.data.data.transpiledCode).toContain('CURRENT_TIMESTAMP');
    });

    it('tuneConfig generates tuned hardware parameters', async () => {
      const { req, res } = createMockReqRes({
        body: {
          engine: 'postgres',
          ramGb: 64,
          cpuCores: 16,
          storageType: 'nvme_ssd',
          workloadType: 'oltp_web',
          maxConnections: 500,
        },
      });

      tuneConfig(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.data.keyParameters.length).toBeGreaterThan(0);
    });
  });

  describe('HTTP Middleware & Server Error Handling', () => {
    it('returns 400 Bad Request instead of 500 when client sends malformed JSON', () => {
      const { jsonErrorHandler } = require('./app');
      const { req, res } = createMockReqRes();
      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const syntaxError = new SyntaxError('Unexpected token in JSON at position 10');
      (syntaxError as any).status = 400;

      jsonErrorHandler(syntaxError, req, res, next);

      expect(res.statusCode).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.error).toContain('Malformed JSON payload');
      expect(nextCalled).toBe(false);
    });

    it('passes normal errors to next middleware', () => {
      const { jsonErrorHandler } = require('./app');
      const { req, res } = createMockReqRes();
      let nextError: any = null;
      const next = (err?: any) => {
        nextError = err;
      };

      const runtimeError = new Error('Database connection timed out');
      jsonErrorHandler(runtimeError, req, res, next);

      expect(nextError).toBe(runtimeError);
    });

    it('returns 200 healthy status on GET /health', () => {
      const { healthHandler } = require('./app');
      const { req, res } = createMockReqRes();

      healthHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.status).toBe('healthy');
      expect(res.data.service).toBe('SQLPulse Engine');
    });

    it('rejects unknown engine ids with HTTP 400 across endpoints', () => {
      const { analyzePlan, lintMigration, profileOrm } = require('./controllers/analyze.controller');

      // 1. analyzePlan with unknown engine
      const { req: pReq, res: pRes } = createMockReqRes({
        body: {
          plan: '{"Plan": {"Node Type": "Seq Scan"}}',
          engine: 'non_existent_engine_9999',
        },
      });
      analyzePlan(pReq, pRes);
      expect(pRes.statusCode).toBe(400);
      expect(pRes.data.success).toBe(false);

      // 2. lintMigration with unknown engine
      const { req: mReq, res: mRes } = createMockReqRes({
        body: {
          sql: 'CREATE TABLE t (id INT);',
          engine: 'invented_fake_db',
        },
      });
      lintMigration(mReq, mRes);
      expect(mRes.statusCode).toBe(400);
      expect(mRes.data.success).toBe(false);

      // 3. profileOrm with unknown engine
      const { req: oReq, res: oRes } = createMockReqRes({
        body: {
          engine: 'totally_bogus_db',
          framework: 'prisma',
        },
      });
      profileOrm(oReq, oRes);
      expect(oRes.statusCode).toBe(400);
      expect(oRes.data.success).toBe(false);
    });
  });
});
