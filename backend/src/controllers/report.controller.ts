import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { reportRepository } from '../db/db';
import { PlanAnalyzer } from '../analyzer/plan-analyzer';

const planAnalyzer = new PlanAnalyzer();

export const saveReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, raw_query, raw_plan } = req.body;

    if (!raw_plan) {
      res.status(400).json({ error: 'Missing required "raw_plan" in body.' });
      return;
    }

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
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to save analysis report.',
    });
  }
};

export const getReportById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
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
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch analysis report.',
    });
  }
};

export const listRecentReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Number(req.query.limit) || 10;
    const reports = await reportRepository.getRecentReports(limit);

    res.json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to list reports.',
    });
  }
};
