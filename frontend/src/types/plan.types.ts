import { DATABASE_CATALOG } from './db-catalog.data';
export * from './index';

export interface PostgresPlanNode {
  'Node Type': string;
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

export { DATABASE_CATALOG };
