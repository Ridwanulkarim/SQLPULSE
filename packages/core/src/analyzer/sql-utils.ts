import { EngineFamily } from '../types/engine-profile';
import { resolveEngineFamily as resolveCanonicalFamily, getEngineProfile } from '../types/engine-profiles';

export { EngineFamily } from '../types/engine-profile';

/**
 * Utility functions for validating and sanitizing SQL identifiers.
 */

export function isValidIdentifier(identifier: string = ''): boolean {
  if (!identifier || typeof identifier !== 'string') return false;
  return /^[A-Za-z_][A-Za-z0-9_$]*$/.test(identifier.trim());
}

export function sanitizeSqlIdentifier(identifier: string = '', fallback: string = 'target_table'): string {
  if (!identifier || typeof identifier !== 'string') {
    return fallback;
  }
  const trimmed = identifier.trim();
  if (isValidIdentifier(trimmed)) {
    return trimmed;
  }
  const cleaned = trimmed.replace(/[^A-Za-z0-9_$]/g, '');
  if (cleaned.length === 0) return fallback;
  if (/^[0-9$]/.test(cleaned)) return `t_${cleaned}`;
  return cleaned;
}

export function quoteIdentifier(identifier: string = '', engineId: string = 'postgresql', fallback: string = 'target_table'): string {
  const safe = sanitizeSqlIdentifier(identifier, fallback);
  const profile = getEngineProfile(engineId);
  return profile.syntax.quoteIdentifier(safe);
}

export function resolveEngineFamily(engineId?: string): EngineFamily {
  const norm = (engineId || '').toLowerCase().trim();
  if (norm.includes('snowflake')) return 'snowflake';
  if (norm.includes('clickhouse')) return 'clickhouse';
  if (norm.includes('sqlite') || norm.includes('duckdb')) return 'sqlite';
  if (norm.includes('cassandra') || norm.includes('scylla')) return 'cassandra';
  if (norm.includes('mongo') || norm.includes('dynamo')) return 'mongodb';
  if (norm.includes('redis') || norm.includes('valkey') || norm.includes('keydb')) return 'redis';
  if (norm.includes('mysql') || norm.includes('maria')) return 'mysql';
  if (norm.includes('oracle')) return 'oracle';
  if (norm.includes('sqlserver') || norm.includes('mssql')) return 'sqlserver';
  const canonical = resolveCanonicalFamily(engineId);
  if (canonical === 'postgresql') return 'postgres';
  return canonical;
}
