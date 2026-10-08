import {
  DatabaseEngine,
  PlanAnalysisResult,
  MigrationAnalysisResult,
} from '../types/plan.types';
import { DATABASE_CATALOG, getEngineMetadata } from '../types/db-catalog.data';
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
    const metadata = getEngineMetadata(engine);
    let result: PlanAnalysisResult;

    const nativePostgresEngines = [
      'postgres',
      'postgresql',
      'cockroachdb',
      'timescale',
      'timescaledb',
      'yugabyte',
      'yugabytedb',
      'amazon_aurora',
      'aurora_postgres',
      'aurora',
      'postgres_xl',
      'supabase',
      'neon',
    ];

    let isFallback = false;

    const norm = (engine || '').toLowerCase().trim();

    const isWideColumn =
      metadata.category === 'wide_column' ||
      norm.includes('cassandra') ||
      norm.includes('scylla') ||
      norm.includes('hbase') ||
      norm.includes('accumulo') ||
      (typeof plan === 'string' && /Tracing session|ALLOW FILTERING|ScyllaDB Trace/i.test(plan));

    const isRedis =
      metadata.category === 'keyvalue' ||
      norm.includes('redis') ||
      norm.includes('valkey') ||
      norm.includes('keydb') ||
      (typeof plan === 'string' && /SLOWLOG|SCAN 0|KEYS \*/i.test(plan));

    const isOlap =
      metadata.category === 'olap' ||
      norm.includes('clickhouse') ||
      norm.includes('snowflake') ||
      norm.includes('duckdb') ||
      norm.includes('bigquery') ||
      norm.includes('redshift') ||
      (typeof plan === 'string' && /ClickHouse Pipeline|Snowflake Profile|BigQuery Execution|DuckDB Physical/i.test(plan));

    const isSearchVector =
      metadata.category === 'vector' ||
      metadata.category === 'search' ||
      norm.includes('elastic') ||
      norm.includes('opensearch') ||
      norm.includes('solr') ||
      norm.includes('meili') ||
      (typeof plan === 'string' && /VectorScan|HNSW|FLAT|deep_pagination/i.test(plan)) ||
      (typeof plan === 'object' && plan && ('took' in plan || 'shards' in plan));

    const isGraph =
      metadata.category === 'graph' ||
      norm.includes('neo4j') ||
      norm.includes('graph') ||
      norm.includes('neptune') ||
      (typeof plan === 'string' && /Cypher Execution|MATCH \(|AllNodesScan/i.test(plan));

    const isTimeSeries =
      metadata.category === 'timeseries' ||
      norm.includes('influx') ||
      norm.includes('prometheus') ||
      norm.includes('dolphin') ||
      (typeof plan === 'string' && /PromQL|InfluxDB|DolphinDB/i.test(plan));

    const isDocument =
      metadata.category === 'document' ||
      metadata.category === 'baas_embedded' ||
      norm.includes('mongo') ||
      norm.includes('dynamo') ||
      norm.includes('couch') ||
      norm.includes('firestore');

    if (norm === 'mysql' || norm === 'mariadb' || norm === 'planetscale' || norm === 'percona') {
      result = this.mysqlAnalyzer.analyze(plan);
    } else if (norm === 'sqlite' || norm === 'turso' || norm === 'spatialite') {
      result = this.sqliteAnalyzer.analyze(plan);
    } else if (isWideColumn) {
      result = SpecializedAnalyzers.analyzeWideColumn(plan, engine);
    } else if (isRedis) {
      result = SpecializedAnalyzers.analyzeRedis(plan);
    } else if (isOlap) {
      result = SpecializedAnalyzers.analyzeOlap(plan, engine);
    } else if (isSearchVector) {
      result = SpecializedAnalyzers.analyzeSearchVector(plan, engine);
    } else if (isGraph) {
      result = SpecializedAnalyzers.analyzeGraph(plan, engine);
    } else if (isTimeSeries) {
      result = SpecializedAnalyzers.analyzeTimeSeries(plan, engine);
    } else if (isDocument) {
      if (typeof plan === 'string' && (plan.includes('DynamoDB') || plan.includes('ConsumedCapacity') || !plan.trim().startsWith('{'))) {
        result = SpecializedAnalyzers.analyzeDocumentText(plan, engine);
      } else {
        result = this.mongoAnalyzer.analyze(plan);
      }
    } else {
      const isJsonPlan =
        typeof plan === 'object' ||
        (typeof plan === 'string' && (plan.trim().startsWith('{') || plan.trim().startsWith('[')));

      if (isJsonPlan) {
        try {
          result = this.postgresAnalyzer.analyze(plan, engine);
          if (!nativePostgresEngines.includes(norm)) {
            isFallback = true;
          }
        } catch {
          result = SpecializedAnalyzers.analyzeRelationalText(plan, engine);
        }
      } else {
        result = SpecializedAnalyzers.analyzeRelationalText(plan, engine);
      }
    }

    if (isFallback) {
      const adaptSqlForDialect = (sql?: string): string | undefined => {
        if (!sql) return sql;
        const e = (engine || '').toLowerCase();
        if (e.includes('oracle')) {
          return sql.replace(/CREATE\s+INDEX\s+CONCURRENTLY(?:\s+IF\s+NOT\s+EXISTS)?\s+(\w+)\s+ON\s+(\w+)\s*\(([^)]+)\);?/gi, 'CREATE INDEX $1 ON $2($3) ONLINE;');
        }
        if (e.includes('mssql') || e.includes('sql_server') || e.includes('sqlserver') || e.includes('microsoft_sql_server')) {
          return sql.replace(/CREATE\s+INDEX\s+CONCURRENTLY(?:\s+IF\s+NOT\s+EXISTS)?\s+(\w+)\s+ON\s+(\w+)\s*\(([^)]+)\);?/gi, 'CREATE INDEX $1 ON $2($3) WITH (ONLINE = ON);');
        }
        if (e.includes('mysql') || e.includes('mariadb')) {
          return sql.replace(/CREATE\s+INDEX\s+CONCURRENTLY(?:\s+IF\s+NOT\s+EXISTS)?\s+(\w+)\s+ON\s+(\w+)\s*\(([^)]+)\);?/gi, 'CREATE INDEX $1 ON $2($3) ALGORITHM=INPLACE, LOCK=NONE;');
        }
        return sql.replace(/CREATE\s+INDEX\s+CONCURRENTLY(?:\s+IF\s+NOT\s+EXISTS)?/gi, 'CREATE INDEX /* verify dialect syntax */');
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
