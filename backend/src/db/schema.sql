-- SQLPulse Database Schema for PostgreSQL
-- Run this on your Render PostgreSQL instance

CREATE TABLE IF NOT EXISTS analysis_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) DEFAULT 'Untitled Query Analysis',
    raw_query TEXT,
    raw_plan JSONB NOT NULL,
    performance_score INT CHECK (performance_score BETWEEN 0 AND 100),
    total_cost NUMERIC,
    execution_time_ms NUMERIC,
    planning_time_ms NUMERIC,
    total_memory_hits BIGINT DEFAULT 0,
    total_disk_reads BIGINT DEFAULT 0,
    cache_hit_ratio NUMERIC(5,2) DEFAULT 100.00,
    bottlenecks JSONB NOT NULL DEFAULT '[]',
    recommendations JSONB NOT NULL DEFAULT '[]',
    graph JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reports_created_at ON analysis_reports (created_at DESC);
