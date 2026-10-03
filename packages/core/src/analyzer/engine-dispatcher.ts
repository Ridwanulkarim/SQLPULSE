import {
  DatabaseEngine,
  PlanAnalysisResult,
  MigrationAnalysisResult,
} from '../types/plan.types';
import { DATABASE_CATALOG } from '../types/db-catalog.data';
import { PlanAnalyzer as PostgresPlanAnalyzer } from './plan-analyzer';
import { MigrationLinter as PostgresMigrationLinter } from './migration-linter';
import { MySQLAnalyzer } from './mysql-analyzer';
import { SQLiteAnalyzer } from './sqlite-analyzer';
import { MongoDBAnalyzer } from './mongodb-analyzer';
import { SpecializedAnalyzers } from './specialized-analyzers';
import { QueryAdvisor, QueryAdvisorResult } from './query-advisor';

export class MultiEngineDispatcher {
  private postgresAnalyzer = new PostgresPlanAnalyzer();
  private migrationLinter = new PostgresMigrationLinter();
  private mysqlAnalyzer = new MySQLAnalyzer();
  private sqliteAnalyzer = new SQLiteAnalyzer();
  private mongoAnalyzer = new MongoDBAnalyzer();
  private queryAdvisor = new QueryAdvisor();

  public analyzePlan(engine: DatabaseEngine, plan: any): PlanAnalysisResult {
    const metadata = DATABASE_CATALOG.find((d) => d.id === engine) || DATABASE_CATALOG[0];
    let result: PlanAnalysisResult;

    const nativePostgresEngines = [
      'postgres',
      'postgresql',
      'cockroachdb',
      'timescale',
      'timescaledb',
      'yugabyte',
      'supabase',
      'neon',
      'aurora_postgres',
    ];

    let isFallback = false;

    if (engine === 'mysql' || engine === 'mariadb' || engine === 'planetscale' || engine === 'percona') {
      result = this.mysqlAnalyzer.analyze(plan);
    } else if (engine === 'sqlite' || engine === 'turso' || engine === 'spatialite') {
      result = this.sqliteAnalyzer.analyze(plan);
    } else if (
      metadata.category === 'document' ||
      metadata.category === 'baas_embedded' ||
      engine === 'mongodb' ||
      engine === 'couchdb' ||
      engine === 'couchbase' ||
      engine === 'ravendb' ||
      engine === 'rethinkdb'
    ) {
      result = this.mongoAnalyzer.analyze(plan);
    } else if (metadata.category === 'keyvalue') {
      result = SpecializedAnalyzers.analyzeRedis(plan);
    } else if (metadata.category === 'vector' || metadata.category === 'search') {
      result = SpecializedAnalyzers.analyzeSearchVector(plan, engine);
    } else if (metadata.category === 'graph') {
      result = SpecializedAnalyzers.analyzeGraph(plan, engine);
    } else if (metadata.category === 'timeseries') {
      result = SpecializedAnalyzers.analyzeTimeSeries(plan, engine);
    } else if (metadata.category === 'wide_column') {
      result = SpecializedAnalyzers.analyzeWideColumn(plan, engine);
    } else {
      result = this.postgresAnalyzer.analyze(plan);
      if (!nativePostgresEngines.includes(engine.toLowerCase())) {
        isFallback = true;
      }
    }

    if (isFallback) {
      const adaptSqlForDialect = (sql?: string): string | undefined => {
        if (!sql) return sql;
        const e = engine.toLowerCase();
        if (e.includes('oracle')) {
          return sql.replace(/CREATE\s+INDEX\s+CONCURRENTLY\s+(\w+)\s+ON\s+(\w+)\s*\(([^)]+)\);?/gi, 'CREATE INDEX $1 ON $2($3) ONLINE;');
        }
        if (e.includes('mssql') || e.includes('sql_server') || e.includes('sqlserver')) {
          return sql.replace(/CREATE\s+INDEX\s+CONCURRENTLY\s+(\w+)\s+ON\s+(\w+)\s*\(([^)]+)\);?/gi, 'CREATE INDEX $1 ON $2($3) WITH (ONLINE = ON);');
        }
        if (e.includes('mysql') || e.includes('mariadb')) {
          return sql.replace(/CREATE\s+INDEX\s+CONCURRENTLY\s+(\w+)\s+ON\s+(\w+)\s*\(([^)]+)\);?/gi, 'CREATE INDEX $1 ON $2($3) ALGORITHM=INPLACE, LOCK=NONE;');
        }
        return sql.replace(/CREATE\s+INDEX\s+CONCURRENTLY/gi, 'CREATE INDEX /* verify dialect syntax */');
      };

      const adaptedBottlenecks = result.bottlenecks.map((b) => ({
        ...b,
        suggestedSql: adaptSqlForDialect(b.suggestedSql),
      }));

      const adaptedRecommendations = result.recommendations.map((r) => ({
        ...r,
        suggestedSql: adaptSqlForDialect(r.suggestedSql),
      }));

      return {
        ...result,
        engine,
        engineMetadata: metadata,
        isFallbackAnalysis: true,
        fallbackNotice: `A dedicated native execution plan parser for ${metadata.name} is in preview. The plan metrics and recommendations below use generic relational heuristics — verify dialect syntax and indexing hints with ${metadata.name} documentation.`,
        bottlenecks: adaptedBottlenecks,
        recommendations: adaptedRecommendations,
      };
    }

    return {
      ...result,
      engine,
      engineMetadata: metadata,
      isFallbackAnalysis: false,
    };
  }

  public lintMigration(engine: DatabaseEngine, sql: string): MigrationAnalysisResult {
    return this.migrationLinter.lint(sql, engine);
  }

  public adviseQuery(engine: DatabaseEngine, query: string): QueryAdvisorResult {
    return this.queryAdvisor.analyze(query, engine);
  }
}
