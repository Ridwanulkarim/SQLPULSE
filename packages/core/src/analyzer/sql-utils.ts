import { DATABASE_CATALOG, getEngineMetadata } from '../types/db-catalog.data';

/**
 * Utility functions for validating and sanitizing SQL identifiers.
 */

/**
 * Sanitizes an SQL identifier (table name, column name, index name) to prevent
 * accidental syntax corruption or identifier-based injection when generating DDL scripts.
 */
export function sanitizeSqlIdentifier(identifier: string = '', fallback: string = 'target_table'): string {
  if (!identifier || typeof identifier !== 'string') {
    return fallback;
  }
  // Trim and strip characters outside of standard alphanumeric and underscores
  const cleaned = identifier.trim().replace(/[^a-zA-Z0-9_.]/g, '');
  return cleaned.length > 0 ? cleaned : fallback;
}

/**
 * Safely quotes an SQL identifier for PostgreSQL / standard ANSI SQL.
 */
export function quoteIdentifier(identifier: string = '', fallback: string = 'target_table'): string {
  const safe = sanitizeSqlIdentifier(identifier, fallback);
  if (safe.includes('.')) {
    return safe
      .split('.')
      .map((part) => `"${part}"`)
      .join('.');
  }
  return `"${safe}"`;
}

export type EngineFamily =
  | 'postgres'
  | 'mysql'
  | 'oracle'
  | 'sqlserver'
  | 'snowflake'
  | 'clickhouse'
  | 'mongodb'
  | 'redis'
  | 'cassandra'
  | 'sqlite';

export function resolveEngineFamily(engineId: string): EngineFamily {
  const norm = (engineId || '').toLowerCase().trim();
  const meta = getEngineMetadata(norm);

  if (norm.includes('mysql') || norm.includes('maria') || norm === 'planetscale' || norm.includes('percona') || norm.includes('tidb') || norm.includes('singlestore') || norm.includes('aurora_mysql')) {
    return 'mysql';
  }
  if (norm.includes('oracle') || norm.includes('db2') || norm.includes('exadata')) {
    return 'oracle';
  }
  if (norm.includes('sqlserver') || norm.includes('mssql') || norm.includes('sql_server') || norm.includes('azure_sql') || norm.includes('sybase')) {
    return 'sqlserver';
  }
  if (norm.includes('snowflake')) {
    return 'snowflake';
  }
  if (norm.includes('clickhouse') || norm.includes('duckdb') || norm.includes('firebolt')) {
    return 'clickhouse';
  }
  if (meta.category === 'document' || norm.includes('mongo') || norm.includes('documentdb') || norm.includes('couch')) {
    return 'mongodb';
  }
  if (meta.category === 'keyvalue' || norm.includes('redis') || norm.includes('valkey') || norm.includes('keydb') || norm.includes('dragonfly') || norm.includes('memcached')) {
    return 'redis';
  }
  if (meta.category === 'wide_column' || norm.includes('cassandra') || norm.includes('scylla') || norm.includes('hbase') || norm.includes('accumulo')) {
    return 'cassandra';
  }
  if (norm.includes('sqlite') || norm.includes('turso') || norm.includes('libsql') || norm.includes('spatialite')) {
    return 'sqlite';
  }
  return 'postgres';
}
