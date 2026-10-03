import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

export const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    })
  : null;

// In-memory fallback repository when running locally without active PostgreSQL connection
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
    if (pool) {
      const res = await pool.query(
        'SELECT id, title, performance_score, execution_time_ms, total_cost, created_at FROM analysis_reports ORDER BY created_at DESC LIMIT $1',
        [limit]
      );
      return res.rows;
    } else {
      return Array.from(inMemoryStore.values())
        .slice(0, limit)
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
};
