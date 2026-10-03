import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

function getSslConfig() {
  if (process.env.NODE_ENV !== 'production' && !process.env.FORCE_DB_SSL) {
    return undefined;
  }
  if (process.env.DB_SSL_CA_PATH) {
    const fs = require('fs');
    return {
      ca: fs.readFileSync(process.env.DB_SSL_CA_PATH).toString(),
      rejectUnauthorized: true,
    };
  }
  if (process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false') {
    return { rejectUnauthorized: false };
  }
  return { rejectUnauthorized: true };
}

export const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: getSslConfig(),
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  : null;

const MAX_IN_MEMORY_REPORTS = 500;
const inMemoryStore = new Map<string, any>();

export const reportRepository = {
  async saveReport(reportData: any) {
    if (pool) {
      const query = `
        INSERT INTO analysis_reports (
          id, title, raw_query, raw_plan, performance_score,
          total_cost, execution_time_ms, planning_time_ms,
          total_memory_hits, total_disk_reads, cache_hit_ratio,
          bottlenecks, recommendations, graph
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        ) RETURNING *;
      `;
      const values = [
        reportData.id,
        reportData.title,
        reportData.raw_query || null,
        JSON.stringify(reportData.raw_plan),
        reportData.performance_score,
        reportData.total_cost,
        reportData.execution_time_ms,
        reportData.planning_time_ms,
        reportData.total_memory_hits,
        reportData.total_disk_reads,
        reportData.cache_hit_ratio,
        JSON.stringify(reportData.bottlenecks),
        JSON.stringify(reportData.recommendations),
        JSON.stringify(reportData.graph),
      ];
      const res = await pool.query(query, values);
      return res.rows[0];
    } else {
      if (inMemoryStore.size >= MAX_IN_MEMORY_REPORTS) {
        const oldestKey = inMemoryStore.keys().next().value;
        if (oldestKey) inMemoryStore.delete(oldestKey);
      }
      inMemoryStore.set(reportData.id, {
        ...reportData,
        created_at: new Date().toISOString(),
      });
      return inMemoryStore.get(reportData.id);
    }
  },

  async getReportById(id: string) {
    if (pool) {
      const res = await pool.query('SELECT * FROM analysis_reports WHERE id = $1', [id]);
      return res.rows[0] || null;
    } else {
      return inMemoryStore.get(id) || null;
    }
  },

  async getRecentReports(limit = 10) {
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
    if (pool) {
      const res = await pool.query(
        'SELECT id, title, performance_score, execution_time_ms, total_cost, created_at FROM analysis_reports ORDER BY created_at DESC LIMIT $1',
        [safeLimit]
      );
      return res.rows;
    } else {
      return Array.from(inMemoryStore.values())
        .slice(0, safeLimit)
        .map((r) => ({
          id: r.id,
          title: r.title,
          performance_score: r.performance_score,
          execution_time_ms: r.execution_time_ms,
          total_cost: r.total_cost,
          created_at: r.created_at,
        }));
    }
  },

  _clearInMemoryStore() {
    inMemoryStore.clear();
  },

  _getInMemoryStoreSize() {
    return inMemoryStore.size;
  },
};
