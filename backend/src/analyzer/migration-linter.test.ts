import { MigrationLinter } from './migration-linter';
import { SAMPLE_UNSAFE_MIGRATION } from '../samples/sample-data';

describe('MigrationLinter Engine Tests', () => {
  const linter = new MigrationLinter();

  test('should detect non-concurrent index creation and provide safe CONCURRENTLY fix', () => {
    const result = linter.lint(SAMPLE_UNSAFE_MIGRATION || '', 'postgres');

    expect(result.isSafeForProduction).toBe(false);
    expect(result.riskScore).toBeLessThan(70);

    const indexFinding = result.findings.find((f) => f.title.includes('Non-concurrent Index Creation'));
    expect(indexFinding).toBeDefined();
    expect(indexFinding?.safeAlternativeSql).toContain('CREATE INDEX CONCURRENTLY');
  });

  test('should pass safe migrations without critical errors', () => {
    const safeScript = `
      CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
      ALTER TABLE users ADD COLUMN bio TEXT;
    `;
    const result = linter.lint(safeScript);

    expect(result.isSafeForProduction).toBe(true);
    expect(result.riskScore).toBeGreaterThanOrEqual(90);
  });
});
