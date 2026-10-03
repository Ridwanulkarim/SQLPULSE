import { Request, Response } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4, validate as isValidUuid } from 'uuid';
import { reportRepository } from '../db/db';
import { PlanAnalyzer } from '@sqlpulse/core';
import { saveReportSchema } from '../validators/schemas';

const planAnalyzer = new PlanAnalyzer();

function timingSafeMatch(provided: string, expected: string): boolean {
  const bufA = Buffer.from(provided);
  const bufB = Buffer.from(expected);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export const saveReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = saveReportSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid report request payload',
        details: parseResult.error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
      });
      return;
    }

    const { title, raw_query, raw_plan } = parseResult.data;
    const analysisResult = planAnalyzer.analyze(raw_plan);
    const reportId = uuidv4();

    const saved = await reportRepository.saveReport({
      id: reportId,
      title: title || 'PostgreSQL Query Analysis',
      raw_query: raw_query || null,
      raw_plan: raw_plan,
      performance_score: analysisResult.performanceScore,
      total_cost: analysisResult.totalCost,
      execution_time_ms: analysisResult.executionTimeMs,
      planning_time_ms: analysisResult.planningTimeMs,
      total_memory_hits: analysisResult.totalMemoryHits,
      total_disk_reads: analysisResult.totalDiskReads,
      cache_hit_ratio: analysisResult.cacheHitRatioPercentage,
      bottlenecks: analysisResult.bottlenecks,
      recommendations: analysisResult.recommendations,
      graph: analysisResult.graph,
    });

    res.status(201).json({
      success: true,
      reportId,
      shareUrl: `/report/${reportId}`,
      data: saved,
    });
  } catch (err: any) {
    console.error('Failed to save report:', err);
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'production' ? 'Failed to save analysis report.' : err.message || 'Failed to save analysis report.',
    });
  }
};

export const getReportById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id || (!isValidUuid(id) && !id.startsWith('report_'))) {
      res.status(400).json({ success: false, error: 'Invalid report ID format. Must be a valid UUID permalink.' });
      return;
    }

    const reportAccessKey = process.env.REPORT_ACCESS_KEY;
    if (reportAccessKey && reportAccessKey.trim().length > 0) {
      const rawProvided = req.headers['x-report-key'];
      const providedKey = typeof rawProvided === 'string' ? rawProvided : null;
      if (!providedKey || !timingSafeMatch(providedKey, reportAccessKey)) {
        res.status(401).json({ success: false, error: 'Unauthorized: Valid report access key required via "x-report-key" header.' });
        return;
      }
    }

    const report = await reportRepository.getReportById(id);
    if (!report) {
      res.status(404).json({ success: false, error: `Report with ID "${id}" not found.` });
      return;
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (err: any) {
    console.error('Failed to fetch report:', err);
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'production' ? 'Failed to fetch analysis report.' : err.message || 'Failed to fetch analysis report.',
    });
  }
};

export const listRecentReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const requiredKey = process.env.ADMIN_API_KEY;

    if (!requiredKey || requiredKey.trim().length === 0) {
      res.status(403).json({
        success: false,
        error: 'Public report listing is disabled because ADMIN_API_KEY is not configured on the server.',
      });
      return;
    }

    const rawHeader = req.headers['x-admin-key'] || (typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    const adminKey = typeof rawHeader === 'string' ? rawHeader : null;

    if (!adminKey || !timingSafeMatch(adminKey, requiredKey)) {
      res.status(403).json({
        success: false,
        error: 'Access denied: Valid administrative credentials required to list saved reports.',
      });
      return;
    }

    const requestedLimit = Number(req.query.limit);
    const safeLimit = Math.min(50, Math.max(1, isNaN(requestedLimit) ? 10 : requestedLimit));
    const reports = await reportRepository.getRecentReports(safeLimit);

    res.json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (err: any) {
    console.error('Failed to list reports:', err);
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'production' ? 'Failed to list reports.' : err.message || 'Failed to list reports.',
    });
  }
};
