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
