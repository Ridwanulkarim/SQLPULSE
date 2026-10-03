import {
  DatabaseEngine,
  PlanAnalysisResult,
  MigrationAnalysisResult,
  DATABASE_CATALOG,
} from '../types/plan.types';
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

    // Direct ID checks or Category fallback
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
      // Default to relational / PostgreSQL engine
      result = this.postgresAnalyzer.analyze(plan);
    }

    return {
      ...result,
      engine,
      engineMetadata: metadata,
    };
  }

  public lintMigration(engine: DatabaseEngine, sql: string): MigrationAnalysisResult {
    return this.migrationLinter.lint(sql, engine);
  }

  public adviseQuery(engine: DatabaseEngine, query: string): QueryAdvisorResult {
    return this.queryAdvisor.analyze(query, engine);
  }
}

