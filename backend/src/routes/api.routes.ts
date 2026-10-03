import { Router } from 'express';
import {
  analyzePlan,
  lintMigration,
  adviseQuery,
  getSamples,
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
} from '../controllers/analyze.controller';
import { saveReport, getReportById, listRecentReports } from '../controllers/report.controller';

const router = Router();

// Core Analyzer Routes
router.post('/analyze/plan', analyzePlan);
router.post('/analyze/migration', lintMigration);
router.post('/analyze/query', adviseQuery);
router.get('/samples', getSamples);

// Polyglot Enterprise Engine Routes
router.post('/analyze/transpile', transpileSql);
router.post('/analyze/tune-config', tuneConfig);
router.post('/analyze/deadlock-simulate', simulateDeadlock);
router.post('/analyze/disaster-recovery', calculateDisasterRecovery);
router.post('/analyze/synthesize-query', synthesizeQuery);
router.post('/analyze/connect-hub', generateConnectHub);
router.post('/analyze/partition-plan', planPartitionStrategy);
router.post('/analyze/inspect-logs', inspectSlowLogs);
router.post('/analyze/bloat', analyzeBloat);
router.post('/analyze/replication', simulateReplicationTopology);
router.post('/analyze/security-rbac', generateSecurityRbac);
router.post('/analyze/mock-data', generateMockData);
router.post('/analyze/finops', calculateFinOps);
router.post('/analyze/index-doctor', auditIndexDoctor);
router.post('/analyze/pii-sanitizer', sanitizePii);
router.post('/analyze/query-rewriter', rewriteQuery);
router.post('/analyze/schema-diff', diffSchema);
router.post('/analyze/orm-profile', profileOrm);
router.post('/analyze/production-readiness', auditReadiness);
router.post('/analyze/chaos-simulate', simulateChaos);
router.post('/analyze/cdc-outbox', buildCdcOutbox);
router.post('/analyze/vector-tune', tuneVector);

// Report & Sharing Routes
router.post('/reports', saveReport);
router.get('/reports', listRecentReports);
router.get('/reports/:id', getReportById);

export default router;
