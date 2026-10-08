export type EngineFamily =
  | 'postgresql'
  | 'mysql'
  | 'oracle'
  | 'sqlserver'
  | 'db2'
  | 'sap_hana'
  | 'embedded'
  | 'columnar_olap'
  | 'wide_column'
  | 'document'
  | 'keyvalue'
  | 'graph'
  | 'vector'
  | 'search'
  | 'timeseries'
  | 'generic'
  | 'postgres'
  | 'sqlite'
  | 'snowflake'
  | 'clickhouse'
  | 'mongodb'
  | 'redis'
  | 'cassandra';

export type EngineDialect =
  | 'postgresql'
  | 'mysql'
  | 'oracle'
  | 'sqlserver'
  | 'db2'
  | 'hana'
  | 'sqlite'
  | 'duckdb'
  | 'columnar_olap'
  | 'cql'
  | 'nosql_document'
  | 'keyvalue'
  | 'cypher'
  | 'vector'
  | 'search'
  | 'timeseries'
  | 'generic_sql';

export type StudioId =
  | 'plan'
  | 'migration'
  | 'query-advise'
  | 'transpile'
  | 'config-tuner'
  | 'deadlock-simulate'
  | 'disaster-recovery'
  | 'synthesize-query'
  | 'connect-hub'
  | 'partition-plan'
  | 'inspect-logs'
  | 'bloat'
  | 'replication'
  | 'security-rbac'
  | 'mock-data'
  | 'finops'
  | 'index-doctor'
  | 'pii-sanitizer'
  | 'query-rewriter'
  | 'schema-diff'
  | 'orm-profile'
  | 'production-readiness'
  | 'chaos-simulate'
  | 'cdc-outbox'
  | 'vector-tune';

export type StudioCapability = 'native' | 'adapted' | 'unsupported';

export interface EngineProfile {
  engineId: string;
  name: string;
  family: EngineFamily;
  dialect: EngineDialect;
  isPostgresFamily: boolean;
  description: string;
  capabilities: Record<StudioId, StudioCapability>;
  unsupportedReason?: Partial<Record<StudioId, string>>;

  memoryParams: {
    sharedBufferParam: string;
    workMemParam: string;
    cacheParam: string;
    configFile: string;
  };

  maintenance: {
    statsCommand: string;
    spaceReclaimCommand: string;
    spaceReclaimConcept: string;
    tuningDdlTemplate: (table: string, sizeGb?: number) => string;
  };

  planCommand: string;

  onlineDdl: {
    createIndexSql: (indexName: string, tableName: string, columns: string) => string;
    dropIndexSql: (indexName: string, tableName?: string) => string;
    rollbackDropIndexSql: (indexName: string, tableName: string, columns: string) => string;
    supportsConcurrent: boolean;
    onlineClause: string;
  };

  systemViews: {
    slowQueries: string;
    activeSessions: string;
    locks: string;
  };

  backup: {
    tool: string;
    walOrLogName: string;
    commandTemplate: (db: string, path: string) => string;
  };

  replication: {
    mechanism: string;
    failoverManager: string;
    syncReplicaConfig: string;
  };

  syntax: {
    identityColumn: string;
    rowLimit: (n: number, offset?: number) => string;
    jsonType: string;
    quoteIdentifier: (id: string) => string;
  };

  auth: {
    model: string;
    createUserSql: (user: string) => string;
    grantPermissionsSql: (user: string, table: string) => string;
  };

  vector: {
    guidance: string;
    supportedIndexTypes: string[];
    sampleIndexDdl?: (indexName: string, tableName: string, column: string, dimension: number) => string;
  };

  connection: {
    scheme: string;
    defaultPort: number;
    sampleUri: string;
  };

  ormAdvice: {
    batchSizeRecommendation: number;
    bulkInsertSyntax: string;
    connectionPoolingGuidance: string;
  };
}
