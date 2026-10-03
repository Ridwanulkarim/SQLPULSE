import { DATABASE_CATALOG } from './db-catalog.data';

export type DatabaseCategory =
  | 'relational'
  | 'olap'
  | 'document'
  | 'keyvalue'
  | 'vector'
  | 'search'
  | 'graph'
  | 'timeseries'
  | 'wide_column'
  | 'baas_embedded'
  | 'geo_spatial'
  | 'streaming_ledger';

export type DatabaseEngine = string;

export interface DatabaseEngineMetadata {
  id: DatabaseEngine;
  name: string;
  category: DatabaseCategory;
  categoryLabel: string;
  icon: string;
  commandHint: string;
  description: string;
  rank?: number;
  popularityScore?: number;
}

export { DATABASE_CATALOG };

export type NodeTypeName = string;

export interface PostgresPlanNode {
  'Node Type': NodeTypeName;
  'Relation Name'?: string;
  'Total Cost': number;
  'Plan Rows': number;
  'Actual Total Time'?: number;
  'Actual Rows'?: number;
  'Filter'?: string;
  'Rows Removed by Filter'?: number;
  'Shared Hit Blocks'?: number;
  'Shared Read Blocks'?: number;
  'Plans'?: PostgresPlanNode[];
  [key: string]: any;
}

export interface PostgresExplainOutput {
  Plan: PostgresPlanNode;
  'Planning Time'?: number;
  'Execution Time'?: number;
  [key: string]: any;
}

export type SeverityLevel = 'CRITICAL' | 'WARNING' | 'INFO' | 'OPTIMAL';

export interface BottleneckFinding {
  id: string;
  nodeType: string;
  relationName?: string;
  severity: SeverityLevel;
  title: string;
  description: string;
  metricLabel: string;
  metricValue: string | number;
  recommendation: string;
  suggestedSql?: string;
}

export interface GraphNodeData {
  id: string;
  nodeType: string;
  relationName?: string;
  totalCost: number;
  actualTotalTimeMs?: number;
  costPercentage: number;
  timePercentage: number;
  actualRows?: number;
  planRows: number;
  rowsRemovedByFilter?: number;
  sharedHitBlocks: number;
  sharedReadBlocks: number;
  isBottleneck: boolean;
  severity: SeverityLevel;
  details: Record<string, any>;
}

export interface GraphEdgeData {
  id: string;
  source: string;
  target: string;
}

export interface PlanAnalysisResult {
  engine?: DatabaseEngine;
  engineMetadata?: DatabaseEngineMetadata;
  performanceScore: number;
  executionTimeMs: number;
  planningTimeMs: number;
  totalCost: number;
  totalMemoryHits: number;
  totalDiskReads: number;
  cacheHitRatioPercentage: number;
  bottlenecks: BottleneckFinding[];
  recommendations: Array<{
    category: string;
    title: string;
    description: string;
    suggestedSql?: string;
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  graph: {
    nodes: GraphNodeData[];
    edges: GraphEdgeData[];
  };
}

export interface MigrationSafetyCheck {
  id: string;
  severity: SeverityLevel;
  title: string;
  reason: string;
  unsafeSql: string;
  safeAlternativeSql: string;
  lockLevel: string;
}

export interface MigrationAnalysisResult {
  engine?: DatabaseEngine;
  isSafeForProduction: boolean;
  totalStatements: number;
  riskScore: number;
  findings: MigrationSafetyCheck[];
}
