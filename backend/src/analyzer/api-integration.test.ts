import { saveReport, getReportById, listRecentReports } from '../controllers/report.controller';
import { analyzePlan, lintMigration, transpileSql, tuneConfig } from '../controllers/analyze.controller';
import { reportRepository } from '../db/db';

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

    it('listRecentReports caps pagination limit at 50', async () => {
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

      const { req, res } = createMockReqRes({
        query: { limit: 1000000 },
      });

      await listRecentReports(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.count).toBeLessThanOrEqual(50);
      expect(res.data.data.length).toBe(5);
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
});
