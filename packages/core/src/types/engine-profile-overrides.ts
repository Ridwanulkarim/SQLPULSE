import type { EngineProfile } from './engine-profile';
import { splitColumns } from './engine-profiles';

// -------------------------------------------------------------
// Engine-Specific Custom Overrides (Isolated per engine)
// -------------------------------------------------------------

export function getEngineSpecificOverride(canonical: string): Partial<EngineProfile> | null {
  switch (canonical) {
    case 'snowflake':
      return {
        connection: {
          scheme: 'snowflake://',
          defaultPort: 443,
          sampleUri: 'snowflake://app_user:password@myaccount.snowflakecomputing.com:443/PROD_DB?warehouse=COMPUTE_WH&role=SYSADMIN',
        },
        memoryParams: {
          sharedBufferParam: 'Virtual Warehouse Size (X-Small to 6X-Large)',
          workMemParam: 'STATEMENT_TIMEOUT_IN_SECONDS',
          cacheParam: 'Result Cache & Local SSD Cache',
          configFile: 'Managed Cloud Service (No OS Configuration File)',
        },
        maintenance: {
          // Doc: https://docs.snowflake.com/en/sql-reference/sql/show-tables
          statsCommand: "-- Automatic background metadata and clustering statistics collection;\nSHOW TABLES LIKE '{table}';",
          // Doc: https://docs.snowflake.com/en/sql-reference/sql/alter-table
          spaceReclaimCommand: '-- Automatic continuous micro-partition clustering (No manual VACUUM);\nALTER TABLE {table} RECLUSTER;',
          spaceReclaimConcept: 'Automatic Continuous Micro-Partition Clustering & Time Travel Pruning (No Manual VACUUM)',
          tuningDdlTemplate: (table) =>
            '-- Snowflake Table Clustering Maintenance for ' + table + '\nALTER TABLE ' + table + ' CLUSTER BY (created_at);\n',
        },
        // Doc: https://docs.snowflake.com/en/sql-reference/sql/explain
        planCommand: 'EXPLAIN USING JSON <QUERY>;',
        onlineDdl: {
          // Doc: https://docs.snowflake.com/en/sql-reference/sql/alter-table
          createIndexSql: (idx, tbl, cols) =>
            '-- Snowflake uses Clustering Keys rather than secondary indexes:\nALTER TABLE ' + tbl + ' CLUSTER BY (' + splitColumns(cols).join(', ') + ');',
          // Doc: https://docs.snowflake.com/en/sql-reference/sql/alter-table
          dropIndexSql: (idx, tbl = '{table}') => 'ALTER TABLE ' + tbl + ' DROP CLUSTERING KEY;',
          rollbackDropIndexSql: (idx, tbl = '{table}', cols) =>
            'ALTER TABLE ' + tbl + ' CLUSTER BY (' + splitColumns(cols).join(', ') + ');',
          supportsConcurrent: true,
          onlineClause: 'ONLINE',
        },
        backup: {
          tool: 'Snowflake Time Travel & Fail-safe',
          walOrLogName: 'Micro-Partition Versioning & Time Travel',
          // Doc: https://docs.snowflake.com/en/user-guide/data-time-travel
          commandTemplate: (db) => 'CREATE DATABASE ' + db + '_backup CLONE ' + db + ';',
        },
        syntax: {
          identityColumn: 'NUMBER AUTOINCREMENT PRIMARY KEY',
          rowLimit: (n, offset = 0) => (offset > 0 ? `LIMIT ${n} OFFSET ${offset}` : `LIMIT ${n}`),
          jsonType: 'VARIANT',
          quoteIdentifier: (id) => `"${id.toUpperCase()}"`,
        },
      };

    case 'google_bigquery':
      return {
        connection: {
          scheme: 'bigquery://',
          defaultPort: 443,
          sampleUri: 'bigquery://bigquery.googleapis.com:443/projects/my-gcp-project/datasets/prod_dataset',
        },
        memoryParams: {
          sharedBufferParam: 'Slots / Reservations',
          workMemParam: 'Maximum Slot Allocation per Project',
          cacheParam: 'Serverless Managed Memory',
          configFile: 'Serverless Cloud Service (No OS Configuration File)',
        },
        maintenance: {
          // Doc: https://cloud.google.com/bigquery/docs/information-schema-jobs-by-project
          statsCommand: "-- BigQuery calculates column statistics automatically on data ingestion;\nSELECT * FROM `{table}` LIMIT 0;",
          // Doc: https://cloud.google.com/bigquery/docs/managing-partitioned-tables#partition-expiration
          spaceReclaimCommand: '-- Automatic partition and table lifecycle expiration (No manual VACUUM);\nALTER TABLE `{table}` SET OPTIONS (partition_expiration_days = 90);',
          spaceReclaimConcept: 'Automatic Partition Expiration & Long-Term Storage Tiering (No Manual VACUUM)',
          tuningDdlTemplate: (table) =>
            '-- BigQuery Partition & Lifecycle Sizing for ' + table + '\nALTER TABLE `' + table + '` SET OPTIONS (partition_expiration_days = 90);',
        },
        // Doc: https://cloud.google.com/bigquery/docs/information-schema-jobs-by-project
        planCommand: 'EXPLAIN <QUERY>;',
        onlineDdl: {
          // Doc: https://cloud.google.com/bigquery/docs/search-index
          createIndexSql: (idx, tbl, cols) =>
            'CREATE SEARCH INDEX `' + idx + '` ON `' + tbl + '`(' + splitColumns(cols).join(', ') + ');',
          // Doc: https://cloud.google.com/bigquery/docs/search-index
          dropIndexSql: (idx, tbl = '{table}') => 'DROP SEARCH INDEX `' + idx + '` ON `' + tbl + '`;',
          rollbackDropIndexSql: (idx, tbl = '{table}', cols) =>
            'CREATE SEARCH INDEX `' + idx + '` ON `' + tbl + '`(' + splitColumns(cols).join(', ') + ');',
          supportsConcurrent: true,
          onlineClause: 'ONLINE',
        },
        backup: {
          tool: 'BigQuery Time Travel & Table Snapshots',
          walOrLogName: '7-Day Continuous Time Travel History',
          // Doc: https://cloud.google.com/bigquery/docs/table-snapshots-create
          commandTemplate: (db) => 'CREATE SNAPSHOT TABLE `' + db + '_snapshot` CLONE `' + db + '`;',
        },
        syntax: {
          identityColumn: 'INT64',
          rowLimit: (n, offset = 0) => (offset > 0 ? `LIMIT ${n} OFFSET ${offset}` : `LIMIT ${n}`),
          jsonType: 'JSON',
          quoteIdentifier: (id) => '`' + id + '`',
        },
      };

    case 'amazon_redshift':
      return {
        connection: {
          scheme: 'redshift://',
          defaultPort: 5439,
          sampleUri: 'redshift://awsuser:password@redshift-cluster.xyz.us-east-1.redshift.amazonaws.com:5439/dev',
        },
        memoryParams: {
          sharedBufferParam: 'wlm_query_slot_count',
          workMemParam: 'max_concurrency_scaling_clusters',
          cacheParam: 'Redshift Managed Buffer Cache',
          configFile: 'Redshift Parameter Group',
        },
        maintenance: {
          // Doc: https://docs.aws.amazon.com/redshift/latest/dg/r_ANALYZE.html
          statsCommand: 'ANALYZE {table};',
          // Doc: https://docs.aws.amazon.com/redshift/latest/dg/r_VACUUM_command.html
          spaceReclaimCommand: 'VACUUM FULL {table};',
          spaceReclaimConcept: 'Redshift Block Re-sorting & Deleted Row Reclamation via VACUUM',
          tuningDdlTemplate: (table) =>
            '-- Redshift Table Maintenance\nVACUUM FULL ' + table + ';\nANALYZE ' + table + ';',
        },
        // Doc: https://docs.aws.amazon.com/redshift/latest/dg/r_EXPLAIN.html
        planCommand: 'EXPLAIN <QUERY>;',
        onlineDdl: {
          // Doc: https://docs.aws.amazon.com/redshift/latest/dg/r_ALTER_TABLE.html
          createIndexSql: (idx, tbl, cols) =>
            '-- Redshift organizes columnar data using SORTKEY and DISTSTYLE:\nALTER TABLE ' + tbl + ' ALTER SORTKEY (' + splitColumns(cols).join(', ') + ');',
          // Doc: https://docs.aws.amazon.com/redshift/latest/dg/r_ALTER_TABLE.html
          dropIndexSql: (idx, tbl = '{table}') => 'ALTER TABLE ' + tbl + ' ALTER SORTKEY NONE;',
          rollbackDropIndexSql: (idx, tbl = '{table}', cols) =>
            'ALTER TABLE ' + tbl + ' ALTER SORTKEY (' + splitColumns(cols).join(', ') + ');',
          supportsConcurrent: true,
          onlineClause: 'ONLINE',
        },
        backup: {
          tool: 'Amazon Redshift Automated & Manual Cluster Snapshots',
          walOrLogName: 'Redshift S3 Replicated Commit Log',
          // Doc: https://docs.aws.amazon.com/redshift/latest/mgmt/working-with-snapshots.html
          commandTemplate: (db, path) =>
            'aws redshift create-cluster-snapshot --cluster-identifier ' + (db || 'redshift-cluster') + ' --snapshot-identifier bkp_' + Date.now(),
        },
        syntax: {
          identityColumn: 'BIGINT IDENTITY(1,1) PRIMARY KEY',
          rowLimit: (n, offset = 0) => (offset > 0 ? `LIMIT ${n} OFFSET ${offset}` : `LIMIT ${n}`),
          jsonType: 'SUPER',
          quoteIdentifier: (id) => `"${id}"`,
        },
      };

    case 'databricks':
      return {
        connection: {
          scheme: 'databricks://',
          defaultPort: 443,
          sampleUri: 'databricks://token:dapi...abc@adb-123.4.azuredatabricks.net:443/sql/1.0/warehouses/abc',
        },
        memoryParams: {
          sharedBufferParam: 'spark.sql.shuffle.partitions',
          workMemParam: 'spark.driver.memory',
          cacheParam: 'Delta Lake Cache / Disk Cache',
          configFile: 'spark-defaults.conf / Cluster Config',
        },
        maintenance: {
          // Doc: https://docs.databricks.com/en/sql/language-manual/sql-ref-syntax-aux-analyze-table.html
          statsCommand: 'ANALYZE TABLE {table} COMPUTE STATISTICS FOR ALL COLUMNS;',
          // Doc: https://docs.databricks.com/en/sql/language-manual/delta-vacuum.html
          spaceReclaimCommand: 'VACUUM {table} RETAIN 168 HOURS;',
          spaceReclaimConcept: 'Delta Lake File Compaction (OPTIMIZE) & Snapshot File Deletion (VACUUM)',
          tuningDdlTemplate: (table) =>
            '-- Databricks Delta Lake Optimization & Compaction\nOPTIMIZE ' + table + ' ZORDER BY (created_at);\nVACUUM ' + table + ' RETAIN 168 HOURS;',
        },
        // Doc: https://docs.databricks.com/en/sql/language-manual/sql-ref-syntax-qry-explain.html
        planCommand: 'EXPLAIN EXTENDED <QUERY>;',
        onlineDdl: {
          // Doc: https://docs.databricks.com/en/sql/language-manual/delta-optimize.html
          createIndexSql: (idx, tbl, cols) =>
            'OPTIMIZE ' + tbl + ' ZORDER BY (' + splitColumns(cols).join(', ') + ');',
          // Doc: https://docs.databricks.com/en/sql/language-manual/delta-optimize.html
          dropIndexSql: (idx, tbl = '{table}') =>
            '-- Delta Lake clusters data via Z-ORDER without separate secondary indexes;\nOPTIMIZE ' + tbl + ';',
          rollbackDropIndexSql: (idx, tbl = '{table}', cols) =>
            'OPTIMIZE ' + tbl + ' ZORDER BY (' + splitColumns(cols).join(', ') + ');',
          supportsConcurrent: true,
          onlineClause: 'ONLINE',
        },
        backup: {
          tool: 'Databricks Delta Deep Clone / Cloud Object Versioning',
          walOrLogName: 'Delta Lake Transaction Log (_delta_log)',
          // Doc: https://docs.databricks.com/en/delta/clone.html
          commandTemplate: (table, path) => 'CREATE TABLE ' + table + '_backup DEEP CLONE ' + table + ';',
        },
        syntax: {
          identityColumn: 'BIGINT GENERATED ALWAYS AS IDENTITY',
          rowLimit: (n, offset = 0) => (offset > 0 ? `LIMIT ${n} OFFSET ${offset}` : `LIMIT ${n}`),
          jsonType: 'STRING',
          quoteIdentifier: (id) => '`' + id + '`',
        },
      };

    case 'trino':
      return {
        connection: {
          scheme: 'trino://',
          defaultPort: 8080,
          sampleUri: 'trino://user@trino-coordinator.internal:8080/hive/default',
        },
        memoryParams: {
          sharedBufferParam: 'query.max-memory',
          workMemParam: 'query.max-total-memory-per-node',
          cacheParam: 'Trino JVM Heap & Connector Cache',
          configFile: 'config.properties / jvm.config',
        },
        maintenance: {
          // Doc: https://trino.io/docs/current/sql/analyze.html
          statsCommand: 'ANALYZE {table};',
          // Doc: https://trino.io/docs/current/
          spaceReclaimCommand: '-- Trino delegates storage reclamation to connector (Iceberg/Delta VACUUM / OPTIMIZE);\nALTER TABLE {table} EXECUTE optimize;',
          spaceReclaimConcept: 'Underlying Connector (Iceberg/Delta) File Optimization & Snapshot Pruning',
          tuningDdlTemplate: (table) => '-- Trino Table Statistics Collection\nANALYZE ' + table + ';',
        },
        // Doc: https://trino.io/docs/current/sql/explain.html
        planCommand: 'EXPLAIN (TYPE DISTRIBUTED) <QUERY>;',
        onlineDdl: {
          // Doc: https://trino.io/docs/current/
          createIndexSql: () => '-- Trino does not support secondary indexes; partitioning/sorting is defined in CREATE TABLE WITH (...);',
          // Doc: https://trino.io/docs/current/
          dropIndexSql: () => '-- Not applicable: Trino does not maintain secondary indexes.',
          rollbackDropIndexSql: () => '-- Not applicable',
          supportsConcurrent: false,
          onlineClause: 'NONE',
        },
        backup: {
          tool: 'Underlying Storage Snapshot / Iceberg Table Snapshot',
          walOrLogName: 'Connector Storage Logs (Iceberg/Delta Metadata)',
          // Doc: https://trino.io/docs/current/
          commandTemplate: () => '# Trino is a stateless query engine. Back up underlying object storage or catalog.',
        },
      };

    case 'presto':
      return {
        connection: {
          scheme: 'presto://',
          defaultPort: 8080,
          sampleUri: 'presto://user@presto-coordinator.internal:8080/hive/default',
        },
        memoryParams: {
          sharedBufferParam: 'query.max-memory',
          workMemParam: 'query.max-memory-per-node',
          cacheParam: 'Presto Memory Pool',
          configFile: 'config.properties',
        },
        maintenance: {
          // Doc: https://prestodb.io/docs/current/sql/explain.html
          statsCommand: 'ANALYZE {table};',
          // Doc: https://prestodb.io/docs/current/
          spaceReclaimCommand: '-- Storage maintenance handled by underlying storage format',
          spaceReclaimConcept: 'Underlying Connector Storage Compaction',
          tuningDdlTemplate: (table) => 'ANALYZE ' + table + ';',
        },
        // Doc: https://prestodb.io/docs/current/sql/explain.html
        planCommand: 'EXPLAIN (TYPE DISTRIBUTED) <QUERY>;',
        onlineDdl: {
          // Doc: https://prestodb.io/docs/current/
          createIndexSql: () => '-- Presto does not support secondary indexes; layout is defined in CREATE TABLE WITH (...);',
          // Doc: https://prestodb.io/docs/current/
          dropIndexSql: () => '-- Not applicable',
          rollbackDropIndexSql: () => '-- Not applicable',
          supportsConcurrent: false,
          onlineClause: 'NONE',
        },
        backup: {
          tool: 'Connector Object Storage Backup',
          walOrLogName: 'Storage Metadata Logs',
          // Doc: https://prestodb.io/docs/current/
          commandTemplate: () => '# Presto is a stateless query engine. Back up underlying storage.',
        },
      };

    case 'apache_hive':
      return {
        connection: {
          scheme: 'hive://',
          defaultPort: 10000,
          sampleUri: 'hive://app:secret@hiveserver2.internal:10000/default',
        },
        memoryParams: {
          sharedBufferParam: 'hive.tez.container.size',
          workMemParam: 'hive.auto.convert.join.noconditionaltask.size',
          cacheParam: 'Tez / MapReduce Container Memory',
          configFile: 'hive-site.xml',
        },
        maintenance: {
          // Doc: https://cwiki.apache.org/confluence/display/Hive/StatsDev
          statsCommand: 'ANALYZE TABLE {table} COMPUTE STATISTICS FOR COLUMNS;',
          // Doc: https://cwiki.apache.org/confluence/display/Hive/LanguageManual+DDL
          spaceReclaimCommand: 'ALTER TABLE {table} CONCATENATE;',
          spaceReclaimConcept: 'ORC / RCFile Small File Concatenation & Partition Archiving',
          tuningDdlTemplate: (table) =>
            '-- Hive Table Column Statistics & Compaction\nANALYZE TABLE ' + table + ' COMPUTE STATISTICS FOR COLUMNS;\nALTER TABLE ' + table + ' CONCATENATE;',
        },
        // Doc: https://cwiki.apache.org/confluence/display/Hive/LanguageManual+Explain
        planCommand: 'EXPLAIN EXTENDED <QUERY>;',
        onlineDdl: {
          // Doc: https://cwiki.apache.org/confluence/display/Hive/LanguageManual+Indexing
          createIndexSql: (idx, tbl, cols) =>
            'CREATE INDEX ' + idx + ' ON TABLE ' + tbl + ' (' + splitColumns(cols).join(', ') + ") AS 'COMPACT' WITH DEFERRED REBUILD;",
          // Doc: https://cwiki.apache.org/confluence/display/Hive/LanguageManual+Indexing
          dropIndexSql: (idx, tbl = '{table}') => 'DROP INDEX IF EXISTS ' + idx + ' ON ' + tbl + ';',
          rollbackDropIndexSql: (idx, tbl = '{table}', cols) =>
            'CREATE INDEX ' + idx + ' ON TABLE ' + tbl + ' (' + splitColumns(cols).join(', ') + ") AS 'COMPACT' WITH DEFERRED REBUILD;",
          supportsConcurrent: false,
          onlineClause: 'NONE',
        },
        backup: {
          tool: 'Hive EXPORT TABLE / DistCp',
          walOrLogName: 'HDFS EditLog / Transaction Log',
          // Doc: https://cwiki.apache.org/confluence/display/Hive/LanguageManual+ImportExport
          commandTemplate: (tbl, path) =>
            'EXPORT TABLE ' + (tbl || 'my_table') + " TO '" + (path || 'hdfs:///backup/my_table') + "';",
        },
      };

    case 'duckdb':
      return {
        connection: {
          scheme: 'duckdb://',
          defaultPort: 0,
          sampleUri: 'duckdb:///path/to/analytics.duckdb',
        },
        memoryParams: {
          sharedBufferParam: "PRAGMA max_memory='8GB';",
          workMemParam: 'PRAGMA threads=4;',
          cacheParam: 'DuckDB Buffer Manager Cache',
          configFile: 'duckdbrc / In-process config',
        },
        maintenance: {
          // Doc: https://duckdb.org/docs/sql/statements/vacuum.html
          statsCommand: 'ANALYZE {table};',
          // Doc: https://duckdb.org/docs/sql/statements/vacuum.html
          spaceReclaimCommand: 'CHECKPOINT; VACUUM;',
          spaceReclaimConcept: 'DuckDB WAL Checkpointing & Row Group Compaction',
          tuningDdlTemplate: (table) =>
            '-- DuckDB WAL Checkpointing & Space Compaction\nCHECKPOINT;\nVACUUM;\nANALYZE ' + table + ';',
        },
        // Doc: https://duckdb.org/docs/guides/performance/explain.html
        planCommand: 'EXPLAIN ANALYZE <QUERY>;',
        onlineDdl: {
          // Doc: https://duckdb.org/docs/sql/indexes.html
          createIndexSql: (idx, tbl, cols) =>
            'CREATE INDEX ' + idx + ' ON ' + tbl + ' (' + splitColumns(cols).join(', ') + ');',
          // Doc: https://duckdb.org/docs/sql/indexes.html
          dropIndexSql: (idx) => 'DROP INDEX ' + idx + ';',
          rollbackDropIndexSql: (idx, tbl, cols) =>
            'CREATE INDEX ' + idx + ' ON ' + tbl + ' (' + splitColumns(cols).join(', ') + ');',
          supportsConcurrent: false,
          onlineClause: 'NONE',
        },
        syntax: {
          identityColumn: 'BIGINT PRIMARY KEY',
          rowLimit: (n, offset = 0) => (offset > 0 ? `LIMIT ${n} OFFSET ${offset}` : `LIMIT ${n}`),
          jsonType: 'JSON',
          quoteIdentifier: (id) => `"${id}"`,
        },
        backup: {
          tool: 'DuckDB EXPORT DATABASE / File Copy',
          walOrLogName: 'DuckDB Write-Ahead Log (.wal file)',
          // Doc: https://duckdb.org/docs/sql/statements/export_database.html
          commandTemplate: (db, path) =>
            "EXPORT DATABASE '" + (path || './duckdb_backup') + "' (FORMAT PARQUET);",
        },
      };

    case 'amazon_dynamodb':
      return {
        connection: {
          scheme: 'dynamodb://',
          defaultPort: 443,
          sampleUri: 'dynamodb://dynamodb.us-east-1.amazonaws.com:443',
        },
        memoryParams: {
          sharedBufferParam: 'Provisioned RCU/WCU or On-Demand',
          workMemParam: 'DynamoDB Accelerator (DAX) Cluster Size',
          cacheParam: 'DAX In-Memory Cache',
          configFile: 'AWS CloudFormation / Terraform Managed',
        },
        maintenance: {
          // Doc: https://docs.aws.amazon.com/cli/latest/reference/dynamodb/describe-table.html
          statsCommand: 'aws dynamodb describe-table --table-name {table}',
          // Doc: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html
          spaceReclaimCommand: '-- DynamoDB automatically manages storage and TTL item expiration;\naws dynamodb update-time-to-live --table-name {table} --time-to-live-specification "Enabled=true,AttributeName=ttl"',
          spaceReclaimConcept: 'Serverless Auto-Partitioning & Automated TTL Item Purging',
          tuningDdlTemplate: (table) =>
            '# Check DynamoDB Table Item Count & Size\naws dynamodb describe-table --table-name ' + table,
        },
        // Doc: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.html
        planCommand: '-- DynamoDB Query/Scan consumption profiling via ReturnConsumedCapacity=TOTAL',
        onlineDdl: {
          // Doc: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GSI.html
          createIndexSql: (idx, tbl, cols) =>
            'aws dynamodb update-table --table-name ' + tbl + ' --global-secondary-index-updates \'[{"Create": {"IndexName": "' + idx + '", "KeySchema": [{"AttributeName": "' + (splitColumns(cols)[0] || 'pk') + '", "KeyType": "HASH"}], "Projection": {"ProjectionType": "ALL"}}}]\'',
          // Doc: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GSI.html
          dropIndexSql: (idx, tbl = '{table}') =>
            'aws dynamodb update-table --table-name ' + tbl + ' --global-secondary-index-updates \'[{"Delete": {"IndexName": "' + idx + '"}}]\'',
          rollbackDropIndexSql: (idx, tbl = '{table}', cols) =>
            'aws dynamodb update-table --table-name ' + tbl + ' --global-secondary-index-updates \'[{"Create": {"IndexName": "' + idx + '", "KeySchema": [{"AttributeName": "' + (splitColumns(cols)[0] || 'pk') + '", "KeyType": "HASH"}], "Projection": {"ProjectionType": "ALL"}}}]\'',
          supportsConcurrent: true,
          onlineClause: 'ASYNC',
        },
        backup: {
          tool: 'DynamoDB Point-in-Time Recovery (PITR) & On-Demand Backup',
          walOrLogName: 'DynamoDB Continuous Event Streams / PITR Logs',
          // Doc: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/BackupRestore.html
          commandTemplate: (table, path) =>
            'aws dynamodb create-backup --table-name ' + (table || 'MyTable') + ' --backup-name bkp_' + Date.now(),
        },
      };

    case 'microsoft_azure_cosmos_db':
      return {
        connection: {
          scheme: 'cosmosdb://',
          defaultPort: 443,
          sampleUri: 'cosmosdb://account.documents.azure.com:443',
        },
        memoryParams: {
          sharedBufferParam: 'Provisioned RU/s / Autoscale RU/s',
          workMemParam: 'Query Request Charge (RU)',
          cacheParam: 'Cosmos DB Dedicated Gateway In-Memory Cache',
          configFile: 'Azure Resource Manager / Bicep Managed',
        },
        maintenance: {
          // Doc: https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/query-metrics
          statsCommand: 'az cosmosdb sql container show --resource-group rg --account-name acct --database-name db --name {table}',
          // Doc: https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/time-to-live
          spaceReclaimCommand: '-- Cosmos DB automatically compacts and purges expired TTL items;\naz cosmosdb sql container update --account-name acct --database-name db --name {table} --ttl 7776000',
          spaceReclaimConcept: 'Log-Structured Inverted Index Compaction & Native TTL Purging',
          tuningDdlTemplate: (table) =>
            '-- Cosmos DB Container Index Policy\n-- Review indexingPolicy includedPaths / excludedPaths',
        },
        // Doc: https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/query-metrics
        planCommand: '-- Inspect Cosmos DB x-ms-documentdb-query-metrics response header',
        onlineDdl: {
          // Doc: https://learn.microsoft.com/en-us/azure/cosmos-db/index-policy
          createIndexSql: (idx, tbl, cols) =>
            '// Cosmos DB updates indexingPolicy paths asynchronously:\n{\n  "indexingMode": "consistent",\n  "includedPaths": [' + splitColumns(cols).map(c => '{"path": "/' + c + '/?"}').join(', ') + ']\n}',
          // Doc: https://learn.microsoft.com/en-us/azure/cosmos-db/index-policy
          dropIndexSql: (idx, tbl = '{table}') => '// Update indexingPolicy to move path to excludedPaths',
          rollbackDropIndexSql: (idx, tbl = '{table}', cols) => '// Re-add path to includedPaths',
          supportsConcurrent: true,
          onlineClause: 'ASYNC',
        },
        backup: {
          tool: 'Azure Cosmos DB Continuous Backup (PITR)',
          walOrLogName: 'Cosmos DB Continuous Change Feed Log',
          // Doc: https://learn.microsoft.com/en-us/azure/cosmos-db/continuous-backup-restore-introduction
          commandTemplate: (db, path) =>
            'az cosmosdb sql database show --account-name $ACCOUNT --name ' + (db || 'CosmosDB'),
        },
      };

    case 'google_cloud_firestore':
      return {
        connection: {
          scheme: 'firestore://',
          defaultPort: 443,
          sampleUri: 'firestore://firestore.googleapis.com:443/projects/my-project/databases/(default)',
        },
        memoryParams: {
          sharedBufferParam: 'Serverless Operations (Reads/Writes/Deletes)',
          workMemParam: 'Query Latency Budget',
          cacheParam: 'Client-side Offline Cache',
          configFile: 'firestore.indexes.json / gcloud config',
        },
        maintenance: {
          // Doc: https://cloud.google.com/firestore/docs/cli-reference
          statsCommand: 'gcloud firestore operations list',
          // Doc: https://cloud.google.com/firestore/docs/ttl
          spaceReclaimCommand: '-- Automatic storage reclamation and TTL field deletion;\ngcloud firestore fields ttls update ttl_field --collection-group={table} --enable-ttl',
          spaceReclaimConcept: 'Spanner-backed Storage Compaction & Automated TTL Deletion',
          tuningDdlTemplate: (table) =>
            '# View Firestore Collection Group Indexes\ngcloud firestore indexes composite list --collection-group=' + table,
        },
        // Doc: https://cloud.google.com/firestore/docs/query-data/explain-analyze
        planCommand: '// Firestore explain query: query.explain({ analyze: true });',
        onlineDdl: {
          // Doc: https://cloud.google.com/firestore/docs/cli-reference#gcloud_firestore_indexes_composite_create
          createIndexSql: (idx, tbl, cols) =>
            'gcloud firestore indexes composite create --collection-group=' + tbl + ' ' + splitColumns(cols).map(c => '--field-config field-path=' + c + ',order=ascending').join(' '),
          // Doc: https://cloud.google.com/firestore/docs/cli-reference
          dropIndexSql: (idx, tbl = '{table}') => 'gcloud firestore indexes composite delete ' + idx,
          rollbackDropIndexSql: (idx, tbl = '{table}', cols) =>
            'gcloud firestore indexes composite create --collection-group=' + tbl + ' ' + splitColumns(cols).map(c => '--field-config field-path=' + c + ',order=ascending').join(' '),
          supportsConcurrent: true,
          onlineClause: 'ASYNC',
        },
        backup: {
          tool: 'Firestore Managed Export / PITR',
          walOrLogName: 'Firestore Continuous PITR Log',
          // Doc: https://cloud.google.com/firestore/docs/manage-data/export-import
          commandTemplate: (db, path) => 'gcloud firestore export gs://' + (path || 'firestore-backup-bucket'),
        },
      };

    case 'couchbase':
      return {
        connection: {
          scheme: 'couchbase://',
          defaultPort: 8091,
          sampleUri: 'couchbase://app_user:password@couchbase-node.internal:8091/travel-sample',
        },
        memoryParams: {
          sharedBufferParam: 'dataServiceQuota',
          workMemParam: 'indexServiceQuota',
          cacheParam: 'Couchbase Managed Memory Quota',
          configFile: 'couchbase-cli / Web UI',
        },
        maintenance: {
          // Doc: https://docs.couchbase.com/server/current/cli/cbcli/couchbase-cli-bucket-status.html
          statsCommand: 'couchbase-cli bucket-status -c localhost:8091 -u $CB_USER -p $CB_PASS --bucket {table}',
          // Doc: https://docs.couchbase.com/server/current/cli/cbcli/couchbase-cli-bucket-compact.html
          spaceReclaimCommand: 'couchbase-cli bucket-compact -c localhost:8091 -u $CB_USER -p $CB_PASS --bucket {table}',
          spaceReclaimConcept: 'Couchbase Append-Only Couchstore Compaction & Magma Defragmentation',
          tuningDdlTemplate: (table) =>
            '# Couchbase Bucket Compaction\ncouchbase-cli bucket-compact -c localhost:8091 -u $CB_USER -p $CB_PASS --bucket ' + table,
        },
        // Doc: https://docs.couchbase.com/server/current/n1ql/n1ql-language-reference/explain.html
        planCommand: 'EXPLAIN <QUERY>;',
        onlineDdl: {
          // Doc: https://docs.couchbase.com/server/current/n1ql/n1ql-language-reference/createindex.html
          createIndexSql: (idx, tbl, cols) =>
            'CREATE INDEX ' + idx + ' ON `' + tbl + '`(' + splitColumns(cols).join(', ') + ');',
          // Doc: https://docs.couchbase.com/server/current/n1ql/n1ql-language-reference/dropindex.html
          dropIndexSql: (idx, tbl = '{table}') => 'DROP INDEX `' + tbl + '`.' + idx + ';',
          rollbackDropIndexSql: (idx, tbl = '{table}', cols) =>
            'CREATE INDEX ' + idx + ' ON `' + tbl + '`(' + splitColumns(cols).join(', ') + ');',
          supportsConcurrent: true,
          onlineClause: 'ONLINE',
        },
        backup: {
          tool: 'cbbackupmgr',
          walOrLogName: 'Couchbase DCP (Database Change Protocol) Stream',
          // Doc: https://docs.couchbase.com/server/current/backup-restore/cbbackupmgr.html
          commandTemplate: (bucket, path) =>
            'cbbackupmgr backup --archive "' + (path || '/backups') + '" --repo repo_' + Date.now() + ' --cluster couchbase://127.0.0.1',
        },
      };

    case 'memcached':
      return {
        connection: {
          scheme: 'memcached://',
          defaultPort: 11211,
          sampleUri: 'memcached://127.0.0.1:11211',
        },
        memoryParams: {
          sharedBufferParam: '-m (Maximum RAM in MB, default 64)',
          workMemParam: '-c (Max simultaneous connections, default 1024)',
          cacheParam: 'Memcached Slab Allocator & Page Cache',
          configFile: '/etc/memcached.conf',
        },
        maintenance: {
          // Doc: https://github.com/memcached/memcached/wiki/Commands#stats
          statsCommand: 'echo "stats" | nc 127.0.0.1 11211',
          // Doc: https://github.com/memcached/memcached/wiki/Commands#flush_all
          spaceReclaimCommand: 'echo "flush_all" | nc 127.0.0.1 11211',
          spaceReclaimConcept: 'Slab Allocator Chunk Reuse & LRU Cache Eviction',
          tuningDdlTemplate: (table) =>
            '# Inspect Memcached Slab Allocator Statistics\necho "stats slabs" | nc 127.0.0.1 11211\necho "stats items" | nc 127.0.0.1 11211',
        },
        // Doc: https://github.com/memcached/memcached/wiki/Commands#stats
        planCommand: 'echo "stats slabs" | nc 127.0.0.1 11211',
        onlineDdl: {
          // Doc: https://memcached.org/about
          createIndexSql: () => '-- Not applicable: Memcached is an in-memory key-value cache without secondary indexes;',
          // Doc: https://memcached.org/about
          dropIndexSql: () => '-- Not applicable: Memcached does not support secondary indexes;',
          rollbackDropIndexSql: () => '-- Not applicable',
          supportsConcurrent: false,
          onlineClause: 'NONE',
        },
        backup: {
          tool: 'Memcached In-Memory Cache (Ephemeral - No Native Disk Backup)',
          walOrLogName: 'None (Pure RAM Cache with LRU Eviction)',
          // Doc: https://memcached.org/about
          commandTemplate: () => '# Not applicable: Memcached does not persist data to disk. Back up your primary backing data store.',
        },
      };

    case 'etcd':
      return {
        connection: {
          scheme: 'etcd://',
          defaultPort: 2379,
          sampleUri: 'etcd://127.0.0.1:2379',
        },
        memoryParams: {
          sharedBufferParam: '--quota-backend-bytes (Storage quota, e.g. 8GB)',
          workMemParam: '--auto-compaction-retention',
          cacheParam: 'etcd bbolt Memory Map Cache',
          configFile: '/etc/etcd/etcd.conf.yml',
        },
        maintenance: {
          // Doc: https://etcd.io/docs/v3.5/op-guide/maintenance/#endpoint-status
          statsCommand: 'etcdctl endpoint status --write-out=table',
          // Doc: https://etcd.io/docs/v3.5/op-guide/maintenance/#defragmentation
          spaceReclaimCommand: 'REV=$(etcdctl endpoint status --write-out="json" | grep -o \'"revision":[0-9]*\' | head -1 | cut -d: -f2); etcdctl compact $REV; etcdctl defrag;',
          spaceReclaimConcept: 'MVCC Revision Compaction & bbolt Backend Defragmentation',
          tuningDdlTemplate: (table) =>
            '# etcd MVCC Compaction & Disk Defragmentation\nREV=$(etcdctl endpoint status --write-out="json" | grep -o \'"revision":[0-9]*\' | head -1 | cut -d: -f2)\netcdctl compact $REV\netcdctl defrag',
        },
        // Doc: https://etcd.io/docs/v3.5/op-guide/maintenance/
        planCommand: 'etcdctl get "" --prefix --keys-only --limit=10',
        onlineDdl: {
          // Doc: https://etcd.io/docs/v3.5/
          createIndexSql: () => '-- Not applicable: etcd uses B-tree MVCC key indexing natively for all keys;',
          // Doc: https://etcd.io/docs/v3.5/
          dropIndexSql: () => '-- Not applicable: etcd keys are removed via etcdctl del <key>',
          rollbackDropIndexSql: () => '-- Not applicable',
          supportsConcurrent: false,
          onlineClause: 'NONE',
        },
        backup: {
          tool: 'etcdctl snapshot save',
          walOrLogName: 'etcd Raft WAL (write-ahead log)',
          // Doc: https://etcd.io/docs/v3.5/op-guide/maintenance/#snapshot-backup
          commandTemplate: (db, path) => 'etcdctl snapshot save "' + (path || '/var/lib/etcd/snapshot.db') + '"',
        },
      };

    case 'pinecone':
      return {
        connection: {
          scheme: 'pinecone://',
          defaultPort: 443,
          sampleUri: 'pinecone://api.pinecone.io:443',
        },
        memoryParams: {
          sharedBufferParam: 'Serverless Read Units (sRU) / Pod Size',
          workMemParam: 'Index Dimension & Metric',
          cacheParam: 'Managed Cloud Vector Cache',
          configFile: 'Pinecone Console / Index Spec',
        },
        maintenance: {
          // Doc: https://docs.pinecone.io/guides/indexes/manage-indexes#get-index-statistics
          statsCommand: 'index.describe_index_stats()',
          // Doc: https://docs.pinecone.io/guides/indexes/manage-indexes
          spaceReclaimCommand: '-- Automatic vector segment garbage collection;\nindex.delete(delete_all=True, namespace="old_data")',
          spaceReclaimConcept: 'Serverless Vector Segment Garbage Collection & Shard Rebalancing',
          tuningDdlTemplate: (table) =>
            '# Pinecone Index Sizing & Statistics\nimport pinecone\npc = pinecone.Pinecone()\nindex = pc.Index(\'' + table + '\')\nprint(index.describe_index_stats())',
        },
        // Doc: https://docs.pinecone.io/guides/indexes/manage-indexes
        planCommand: 'index.query(vector=[...], top_k=10, include_metadata=True)',
        onlineDdl: {
          // Doc: https://docs.pinecone.io/guides/indexes/create-an-index
          createIndexSql: (idx, tbl) =>
            'pc.create_index(name="' + (idx || tbl) + '", dimension=1536, metric="cosine", spec=pinecone.ServerlessSpec(cloud="aws", region="us-east-1"))',
          // Doc: https://docs.pinecone.io/guides/indexes/manage-indexes#delete-an-index
          dropIndexSql: (idx) => 'pc.delete_index(name="' + idx + '")',
          rollbackDropIndexSql: (idx) => 'pc.create_index(name="' + idx + '", dimension=1536, metric="cosine")',
          supportsConcurrent: true,
          onlineClause: 'ASYNC',
        },
        backup: {
          tool: 'Pinecone Cloud Backups & Collection Snapshots',
          walOrLogName: 'Managed Vector Ingestion Journal',
          // Doc: https://docs.pinecone.io/guides/indexes/manage-indexes#create-a-collection-from-an-index
          commandTemplate: (coll, path) =>
            'pc.create_collection(name="coll_bkp_' + Date.now() + '", source="' + (coll || 'my-index') + '")',
        },
      };

    case 'qdrant':
      return {
        connection: {
          scheme: 'qdrant://',
          defaultPort: 6333,
          sampleUri: 'qdrant://localhost:6333',
        },
        memoryParams: {
          sharedBufferParam: 'indexing_threshold_kb',
          workMemParam: 'memmap_threshold_kb',
          cacheParam: 'Qdrant In-Memory Vector Cache',
          configFile: 'config.yaml',
        },
        maintenance: {
          // Doc: https://qdrant.tech/documentation/concepts/collections/#collection-info
          statsCommand: 'GET /collections/{table}',
          // Doc: https://qdrant.tech/documentation/concepts/indexing/#optimizer
          spaceReclaimCommand: 'POST /collections/{table}/index',
          spaceReclaimConcept: 'HNSW Graph Segment Optimization & Deleted Vector Vacuuming',
          tuningDdlTemplate: (table) =>
            '# Trigger Qdrant Collection Optimization\ncurl -X POST "http://localhost:6333/collections/' + table + '/index"',
        },
        // Doc: https://qdrant.tech/documentation/concepts/search/
        planCommand: 'POST /collections/{table}/points/search { "vector": [...], "limit": 10 }',
        onlineDdl: {
          // Doc: https://qdrant.tech/documentation/concepts/indexing/#payload-index
          createIndexSql: (idx, tbl, cols) =>
            'PUT /collections/' + tbl + '/index\n{\n  "field_name": "' + (splitColumns(cols)[0] || 'category') + '",\n  "field_schema": "keyword"\n}',
          // Doc: https://qdrant.tech/documentation/concepts/indexing/#delete-index
          dropIndexSql: (idx, tbl = '{table}') => 'DELETE /collections/' + tbl + '/index/' + idx,
          rollbackDropIndexSql: (idx, tbl = '{table}', cols) =>
            'PUT /collections/' + tbl + '/index\n{\n  "field_name": "' + (splitColumns(cols)[0] || 'category') + '",\n  "field_schema": "keyword"\n}',
          supportsConcurrent: true,
          onlineClause: 'ASYNC',
        },
        backup: {
          tool: 'Qdrant Collection Snapshots API',
          walOrLogName: 'Qdrant Write-Ahead Log (WAL)',
          // Doc: https://qdrant.tech/documentation/concepts/snapshots/
          commandTemplate: (coll, path) => 'POST /collections/' + (coll || 'collection') + '/snapshots',
        },
      };

    case 'weaviate':
      return {
        connection: {
          scheme: 'weaviate://',
          defaultPort: 8080,
          sampleUri: 'weaviate://localhost:8080',
        },
        memoryParams: {
          sharedBufferParam: 'LIMIT_RESOURCES',
          workMemParam: 'QUERY_MAXIMUM_RESULTS',
          cacheParam: 'HNSW Vector Memory Cache',
          configFile: 'weaviate.conf.json / docker-compose.yml',
        },
        maintenance: {
          // Doc: https://weaviate.io/developers/weaviate/api/rest#tag/nodes/get/nodes
          statsCommand: 'GET /v1/nodes',
          // Doc: https://weaviate.io/developers/weaviate/manage-data/collections
          spaceReclaimCommand: '-- Automatic segment compaction and LSM-tree Tombstone cleanup;\nPOST /v1/schema/{table}/shards',
          spaceReclaimConcept: 'LSM Store Segment Compaction & Tombstone Cycle Cleanup',
          tuningDdlTemplate: (table) => '# Check Weaviate Shard Status\ncurl http://localhost:8080/v1/schema/' + table + '/shards',
        },
        // Doc: https://weaviate.io/developers/weaviate/api/graphql
        planCommand: 'GET /v1/graphql (explore/explain GraphQL queries)',
        onlineDdl: {
          // Doc: https://weaviate.io/developers/weaviate/manage-data/collections
          createIndexSql: (idx, tbl, cols) =>
            '// Weaviate configures property indexing in class definition schema:\nPUT /v1/schema/' + tbl + '/properties\n{\n  "dataType": ["text"],\n  "name": "' + (splitColumns(cols)[0] || 'property') + '",\n  "indexFilterable": true,\n  "indexSearchable": true\n}',
          // Doc: https://weaviate.io/developers/weaviate/manage-data/collections
          dropIndexSql: (idx, tbl = '{table}') => '// Property indexes in Weaviate are immutable; re-create class schema to remove.',
          rollbackDropIndexSql: (idx, tbl = '{table}', cols) => '// Re-add property in class definition',
          supportsConcurrent: false,
          onlineClause: 'NONE',
        },
        backup: {
          tool: 'Weaviate Backup API (Filesystem / S3 / GCS)',
          walOrLogName: 'Weaviate Raft Journal & LSM WAL',
          // Doc: https://weaviate.io/developers/weaviate/configuration/backups
          commandTemplate: (coll, path) =>
            'POST /v1/backups/filesystem { "id": "bkp_' + Date.now() + '", "include": ["' + (coll || 'Article') + '"] }',
        },
      };

    case 'chroma':
      return {
        connection: {
          scheme: 'chroma://',
          defaultPort: 8000,
          sampleUri: 'chroma://localhost:8000',
        },
        memoryParams: {
          sharedBufferParam: 'chroma_segment_cache_policy',
          workMemParam: 'persist_directory',
          cacheParam: 'DuckDB/SQLite In-Memory Segment Cache',
          configFile: 'chroma.sqlite3 / server config',
        },
        maintenance: {
          // Doc: https://docs.trychroma.com/reference/py-collection#count
          statsCommand: 'collection.count()',
          // Doc: https://docs.trychroma.com/guides
          spaceReclaimCommand: '-- Chroma persists via SQLite & hnswlib segments; compaction happens on client.persist()',
          spaceReclaimConcept: 'hnswlib Segment Index Rebuilding & SQLite Vacuum',
          tuningDdlTemplate: (table) =>
            'import chromadb\nclient = chromadb.HttpClient()\ncoll = client.get_collection(\'' + table + '\')\nprint(coll.count())',
        },
        // Doc: https://docs.trychroma.com/guides
        planCommand: 'collection.query(query_texts=["..."], n_results=10)',
        onlineDdl: {
          // Doc: https://docs.trychroma.com/guides
          createIndexSql: (idx, tbl) =>
            'client.create_collection(name="' + (idx || tbl) + '", metadata={"hnsw:space": "cosine"})',
          // Doc: https://docs.trychroma.com/guides
          dropIndexSql: (idx) => 'client.delete_collection(name="' + idx + '")',
          rollbackDropIndexSql: (idx) => 'client.create_collection(name="' + idx + '", metadata={"hnsw:space": "cosine"})',
          supportsConcurrent: false,
          onlineClause: 'NONE',
        },
        backup: {
          tool: 'Chroma Persist Directory Snapshot / Tar Archive',
          walOrLogName: 'Chroma WAL / SQLite Journal',
          // Doc: https://docs.trychroma.com/deployment/overview
          commandTemplate: (db, path) => 'tar -czf "' + (path || 'chroma_backup.tar.gz') + '" /chroma/chroma',
        },
      };

    case 'questdb':
      return {
        connection: {
          scheme: 'questdb://',
          defaultPort: 9000,
          sampleUri: 'questdb://admin:quest@localhost:9000/qdb',
        },
        memoryParams: {
          sharedBufferParam: 'cairo.max.uncommitted.rows',
          workMemParam: 'shared.worker.count',
          cacheParam: 'Cairo Column Memory Mapped Cache',
          configFile: 'questdb-server.conf',
        },
        maintenance: {
          // Doc: https://questdb.io/docs/reference/sql/show-columns/
          statsCommand: "SELECT * FROM table_columns('{table}');",
          // Doc: https://questdb.io/docs/reference/sql/alter-table-drop-partition/
          spaceReclaimCommand: "ALTER TABLE {table} DROP PARTITION LIST '2023-01-01';",
          spaceReclaimConcept: 'Time Partition Directory Pruning & Append-Only Block Reclaims',
          tuningDdlTemplate: (table) =>
            '-- QuestDB Partition Management\nALTER TABLE ' + table + " DROP PARTITION WHERE timestamp < dateadd('d', -90, now());",
        },
        // Doc: https://questdb.io/docs/reference/sql/explain/
        planCommand: 'EXPLAIN <QUERY>;',
        onlineDdl: {
          // Doc: https://questdb.io/docs/reference/sql/alter-table-alter-column-add-index/
          createIndexSql: (idx, tbl, cols) =>
            splitColumns(cols).map(c => 'ALTER TABLE ' + tbl + ' ALTER COLUMN ' + c.split(/\s+/)[0] + ' ADD INDEX;').join('\n'),
          // Doc: https://questdb.io/docs/reference/sql/alter-table-alter-column-add-index/
          dropIndexSql: (idx, tbl = '{table}') => '-- QuestDB symbol indexes are per-column properties dropped via table redefinition;',
          rollbackDropIndexSql: (idx, tbl, cols) =>
            splitColumns(cols).map(c => 'ALTER TABLE ' + tbl + ' ALTER COLUMN ' + c.split(/\s+/)[0] + ' ADD INDEX;').join('\n'),
          supportsConcurrent: false,
          onlineClause: 'NONE',
        },
        backup: {
          tool: 'QuestDB Snapshot Utility / Volume Backup',
          walOrLogName: 'Cairo Append-Only Table WAL',
          // Doc: https://questdb.io/docs/operations/backup/
          commandTemplate: (db, path) => 'SNAPSHOT PREPARE;\n# Copy /var/lib/questdb/db to backup location\nSNAPSHOT COMPLETE;',
        },
      };

    case 'prometheus':
      return {
        connection: {
          scheme: 'http://',
          defaultPort: 9090,
          sampleUri: 'http://localhost:9090',
        },
        memoryParams: {
          sharedBufferParam: '--storage.tsdb.retention.time=15d',
          workMemParam: '--storage.tsdb.max-block-duration=2h',
          cacheParam: 'Head Block Chunk Memory Cache',
          configFile: '/etc/prometheus/prometheus.yml',
        },
        maintenance: {
          // Doc: https://prometheus.io/docs/prometheus/latest/querying/api/#tsdb-stats
          statsCommand: 'GET /api/v1/status/tsdb',
          // Doc: https://prometheus.io/docs/prometheus/latest/querying/api/#clean-tombstones
          spaceReclaimCommand: 'POST /api/v1/admin/tsdb/clean_tombstones',
          spaceReclaimConcept: 'Compactor 2h Block Merging & TSDB Tombstone Garbage Collection',
          tuningDdlTemplate: (table) =>
            '# Clean Prometheus Deleted Metric Tombstones\ncurl -X POST http://localhost:9090/api/v1/admin/tsdb/clean_tombstones',
        },
        // Doc: https://prometheus.io/docs/prometheus/latest/querying/api/
        planCommand: 'GET /api/v1/query?query=<PROMETHEUS_METRIC>',
        onlineDdl: {
          // Doc: https://prometheus.io/docs/prometheus/latest/
          createIndexSql: () => '-- Not applicable: Prometheus automatically indexes all metric labels into its TSDB inverted index;',
          // Doc: https://prometheus.io/docs/prometheus/latest/querying/api/#delete-series
          dropIndexSql: () => '-- Not applicable: Prometheus deletes series via /api/v1/admin/tsdb/delete_series',
          rollbackDropIndexSql: () => '-- Not applicable',
          supportsConcurrent: false,
          onlineClause: 'NONE',
        },
        backup: {
          tool: 'Prometheus TSDB Snapshot API',
          walOrLogName: 'Prometheus Head Block WAL (data/wal/)',
          // Doc: https://prometheus.io/docs/prometheus/latest/querying/api/#snapshot
          commandTemplate: (db, path) => 'curl -X POST http://localhost:9090/api/v1/admin/tsdb/snapshot',
        },
      };

    case 'victoriametrics':
      return {
        connection: {
          scheme: 'http://',
          defaultPort: 8428,
          sampleUri: 'http://localhost:8428',
        },
        memoryParams: {
          sharedBufferParam: '-memory.allowedPercent=60',
          workMemParam: '-search.maxQueryDuration=30s',
          cacheParam: 'FastCache In-Memory Tag & Index Cache',
          configFile: 'Command-line flags / Helm values',
        },
        maintenance: {
          // Doc: https://docs.victoriametrics.com/#tsdb-stats
          statsCommand: 'GET /api/v1/status/tsdb',
          // Doc: https://docs.victoriametrics.com/#forced-merge
          spaceReclaimCommand: 'POST /internal/force_merge',
          spaceReclaimConcept: 'LSM-tree Part Merge Compaction & Automatic Retention Partition Truncation',
          tuningDdlTemplate: (table) =>
            '# Force background parts merge in VictoriaMetrics\ncurl -X POST http://localhost:8428/internal/force_merge',
        },
        // Doc: https://docs.victoriametrics.com/
        planCommand: 'GET /api/v1/query?query=<METRIC>',
        onlineDdl: {
          // Doc: https://docs.victoriametrics.com/
          createIndexSql: () => '-- Not applicable: VictoriaMetrics automatically indexes all timeseries tags into indexdb;',
          // Doc: https://docs.victoriametrics.com/
          dropIndexSql: () => '-- Not applicable: Metric series dropped via /api/v1/admin/tsdb/delete_series',
          rollbackDropIndexSql: () => '-- Not applicable',
          supportsConcurrent: false,
          onlineClause: 'NONE',
        },
        backup: {
          tool: 'vmbackup / vmrestore',
          walOrLogName: 'VictoriaMetrics Small Parts Log & indexdb',
          // Doc: https://docs.victoriametrics.com/vmbackup/
          commandTemplate: (db, path) =>
            'vmbackup -storageDataPath=/var/lib/victoria-metrics-data -snapshot.createURL=http://localhost:8428/snapshot/create -dst="' + (path || 'fs:///backup') + '"',
        },
      };

    case 'apache_hbase':
      return {
        connection: {
          scheme: 'hbase://',
          defaultPort: 16010,
          sampleUri: 'hbase://zookeeper.internal:2181/hbase',
        },
        memoryParams: {
          sharedBufferParam: 'hbase.regionserver.global.memstore.size',
          workMemParam: 'hfile.block.cache.size',
          cacheParam: 'HBase BlockCache (L1/L2 BucketCache)',
          configFile: 'hbase-site.xml',
        },
        maintenance: {
          // Doc: https://hbase.apache.org/book.html#shell_exercises
          statsCommand: "echo \"status 'detailed'\" | hbase shell",
          // Doc: https://hbase.apache.org/book.html#_major_compact
          spaceReclaimCommand: "echo \"major_compact '{table}'\" | hbase shell",
          spaceReclaimConcept: 'HBase LSM StoreFile Minor/Major Compaction',
          tuningDdlTemplate: (table) =>
            '# Trigger Major Compaction in HBase\necho "major_compact \'' + table + '\'" | hbase shell',
        },
        // Doc: https://hbase.apache.org/book.html#shell_exercises
        planCommand: "echo \"scan '{table}', {LIMIT => 10}\" | hbase shell",
        onlineDdl: {
          // Doc: https://phoenix.apache.org/secondary_indexing.html
          createIndexSql: (idx, tbl, cols) =>
            '-- HBase indexes data by RowKey; secondary index via Apache Phoenix:\nCREATE INDEX ' + idx + ' ON ' + tbl + ' (' + splitColumns(cols).join(', ') + ');',
          // Doc: https://phoenix.apache.org/secondary_indexing.html
          dropIndexSql: (idx, tbl = '{table}') => 'DROP INDEX ' + idx + ' ON ' + tbl + ';',
          rollbackDropIndexSql: (idx, tbl = '{table}', cols) =>
            'CREATE INDEX ' + idx + ' ON ' + tbl + ' (' + splitColumns(cols).join(', ') + ');',
          supportsConcurrent: false,
          onlineClause: 'NONE',
        },
        backup: {
          tool: 'HBase Snapshot API / hbase snapshot',
          walOrLogName: 'HBase Write-Ahead Log (HLog / WAL)',
          // Doc: https://hbase.apache.org/book.html#ops.snapshots
          commandTemplate: (tbl, path) =>
            'echo "snapshot \'' + (tbl || 'my_table') + '\', \'snap_' + Date.now() + '\'" | hbase shell',
        },
      };

    case 'amazon_neptune':
      return {
        connection: {
          scheme: 'wss://',
          defaultPort: 8182,
          sampleUri: 'wss://neptunedb-cluster.xyz.us-east-1.neptune.amazonaws.com:8182/gremlin',
        },
        memoryParams: {
          sharedBufferParam: 'neptune_query_timeout',
          workMemParam: 'neptune_enable_audit_log',
          cacheParam: 'Neptune Buffer Pool & Query Cache',
          configFile: 'Neptune DB Cluster Parameter Group',
        },
        maintenance: {
          // Doc: https://docs.aws.amazon.com/neptune/latest/userguide/feature-pg-graph-statistics.html
          statsCommand: 'curl https://{table}:8182/propertygraph/statistics/summary',
          // Doc: https://docs.aws.amazon.com/neptune/latest/userguide/feature-pg-graph-statistics.html
          spaceReclaimCommand: '-- Serverless/Storage volume auto-compacts across 3 Availability Zones;\ncurl -X POST https://{table}:8182/propertygraph/statistics/summary/mode/refresh',
          spaceReclaimConcept: 'Managed Multi-AZ Storage Compaction & Auto-Clustering',
          tuningDdlTemplate: (table) =>
            '# Refresh Neptune Graph Statistics\ncurl -X POST https://' + table + ':8182/propertygraph/statistics/summary/mode/refresh',
        },
        // Doc: https://docs.aws.amazon.com/neptune/latest/userguide/access-graph-opencypher-explain.html
        planCommand: 'curl -X POST https://{table}:8182/openCypher/explain -d "query=<QUERY>"',
        onlineDdl: {
          // Doc: https://docs.aws.amazon.com/neptune/latest/userguide/
          createIndexSql: () => '-- Neptune automatically indexes vertices, edges, and properties across 3 clustered indices;',
          // Doc: https://docs.aws.amazon.com/neptune/latest/userguide/
          dropIndexSql: () => '-- Not applicable: Neptune manages internal indices automatically.',
          rollbackDropIndexSql: () => '-- Not applicable',
          supportsConcurrent: false,
          onlineClause: 'NONE',
        },
        backup: {
          tool: 'Amazon Neptune Automated & Manual Snapshots',
          walOrLogName: 'Neptune Distributed Storage Transaction Journal',
          // Doc: https://docs.aws.amazon.com/neptune/latest/userguide/backup-restore.html
          commandTemplate: (db, path) =>
            'aws neptune create-db-cluster-snapshot --db-cluster-identifier ' + (db || 'neptune-cluster') + ' --db-cluster-snapshot-identifier bkp_' + Date.now(),
        },
      };

    case 'tigergraph':
      return {
        connection: {
          scheme: 'gsql://',
          defaultPort: 14240,
          sampleUri: 'gsql://tigergraph.internal:14240',
        },
        memoryParams: {
          sharedBufferParam: 'GPE.BasicConfig.Env.MaxMemPct',
          workMemParam: 'System.DiskStoragePct',
          cacheParam: 'Graph Processing Engine (GPE) Memory Cache',
          configFile: 'gadmin config',
        },
        maintenance: {
          // Doc: https://docs.tigergraph.com/tigergraph-server/current/reference/gadmin-commands#gadmin-status
          statsCommand: 'gadmin status',
          // Doc: https://docs.tigergraph.com/tigergraph-server/current/
          spaceReclaimCommand: '-- TigerGraph manages graph memory structures in memory-mapped files;\ngadmin restart gpe',
          spaceReclaimConcept: 'Graph Processing Engine Memory Compaction & Inverted Index Maintenance',
          tuningDdlTemplate: (table) => '# Check TigerGraph Component Status\ngadmin status -v',
        },
        // Doc: https://docs.tigergraph.com/gsql-ref/current/querying/interpret-queries
        planCommand: 'INTERPRET QUERY () FOR GRAPH <graph> { ... }',
        onlineDdl: {
          // Doc: https://docs.tigergraph.com/gsql-ref/current/ddl-and-loading/creating-a-loading-job#_secondary_indexes
          createIndexSql: (idx, tbl, cols) =>
            'ALTER VERTEX ' + tbl + ' ADD SECONDARY_INDEX ' + idx + ' (' + splitColumns(cols).join(', ') + ');',
          // Doc: https://docs.tigergraph.com/gsql-ref/current/ddl-and-loading/creating-a-loading-job#_secondary_indexes
          dropIndexSql: (idx, tbl = '{table}') => 'ALTER VERTEX ' + tbl + ' DROP SECONDARY_INDEX ' + idx + ';',
          rollbackDropIndexSql: (idx, tbl = '{table}', cols) =>
            'ALTER VERTEX ' + tbl + ' ADD SECONDARY_INDEX ' + idx + ' (' + splitColumns(cols).join(', ') + ');',
          supportsConcurrent: false,
          onlineClause: 'NONE',
        },
        backup: {
          tool: 'gadmin backup save',
          walOrLogName: 'TigerGraph WAL / Change Data Capture',
          // Doc: https://docs.tigergraph.com/tigergraph-server/current/backup-and-restore/backup-and-restore
          commandTemplate: (db, path) => 'gadmin backup save "' + (path || '/var/log/tigergraph/backups') + '"',
        },
      };

    case 'splunk':
      return {
        connection: {
          scheme: 'splunk://',
          defaultPort: 8089,
          sampleUri: 'splunk://admin:password@splunk-indexer.internal:8089',
        },
        memoryParams: {
          sharedBufferParam: 'max_mem_usage_mb',
          workMemParam: 'max_searches_per_cpu',
          cacheParam: 'Splunk Unified Memory Cache',
          configFile: 'indexes.conf / server.conf',
        },
        maintenance: {
          // Doc: https://docs.splunk.com/Documentation/Splunk/latest/Indexer/Checkstatusandconfigurationofindexes
          statsCommand: 'splunk show index-status',
          // Doc: https://docs.splunk.com/Documentation/Splunk/latest/Indexer/Removedatadiscrete
          spaceReclaimCommand: 'splunk clean eventdata -index {table}',
          spaceReclaimConcept: 'Index Bucket Aging & Rolling (Hot -> Warm -> Cold -> Frozen)',
          tuningDdlTemplate: (table) =>
            '# Check Splunk Index Storage Status\nsplunk list index ' + table,
        },
        // Doc: https://docs.splunk.com/Documentation/Splunk/latest/SearchReference/Explain
        planCommand: '| explain <SEARCH_QUERY>',
        onlineDdl: {
          // Doc: https://docs.splunk.com/Documentation/Splunk/latest/Indexer/Setupmultipleindexes
          createIndexSql: (idx) => 'splunk add index ' + idx,
          // Doc: https://docs.splunk.com/Documentation/Splunk/latest/Indexer/Setupmultipleindexes
          dropIndexSql: (idx) =>
            '// CAUTION: Removing a Splunk index permanently purges all events in that index!\nsplunk remove index ' + idx,
          rollbackDropIndexSql: (idx) => 'splunk add index ' + idx,
          supportsConcurrent: false,
          onlineClause: 'NONE',
        },
        backup: {
          tool: 'Splunk Cold/Frozen Bucket Archival',
          walOrLogName: 'Splunk Journal.gz (Raw Data Journal)',
          // Doc: https://docs.splunk.com/Documentation/Splunk/latest/Indexer/Backupindexeddata
          commandTemplate: (idx, path) =>
            'tar -czf "' + (path || 'splunk_index_backup.tar.gz') + '" /opt/splunk/var/lib/splunk/' + (idx || 'main') + '/db',
        },
      };

    case 'algolia':
      return {
        connection: {
          scheme: 'https://',
          defaultPort: 443,
          sampleUri: 'https://APPLICATION_ID-dsn.algolia.net:443',
        },
        memoryParams: {
          sharedBufferParam: 'Indexing Units / Operations quota',
          workMemParam: 'Record Size Limits (100KB)',
          cacheParam: 'Managed Cloud Memory Cache',
          configFile: 'algolia.com Dashboard / API Client',
        },
        maintenance: {
          // Doc: https://www.algolia.com/doc/api-reference/api-methods/get-settings/
          statsCommand: 'index.get_settings()',
          // Doc: https://www.algolia.com/doc/api-reference/api-methods/clear-objects/
          spaceReclaimCommand: 'index.clear_objects()',
          spaceReclaimConcept: 'Cloud Index Compaction & Replicas Synchronization',
          tuningDdlTemplate: (table) => '// Algolia Index Settings Inspection\nindex.getSettings().then(console.log);',
        },
        // Doc: https://www.algolia.com/doc/api-reference/api-methods/search/
        planCommand: "index.search('<QUERY>', { explain: ['*'] })",
        onlineDdl: {
          // Doc: https://www.algolia.com/doc/api-reference/api-methods/set-settings/
          createIndexSql: (idx, tbl, cols) =>
            'index.setSettings({ searchableAttributes: [' + splitColumns(cols).map(c => '"' + c + '"').join(', ') + '] })',
          // Doc: https://www.algolia.com/doc/api-reference/api-methods/delete-index/
          dropIndexSql: (idx) =>
            '// CAUTION: In Algolia, deleteIndex permanently deletes the index and all records!\nclient.deleteIndex("' + idx + '")',
          rollbackDropIndexSql: (idx) => '// Restore records from backup',
          supportsConcurrent: true,
          onlineClause: 'ASYNC',
        },
        backup: {
          tool: 'Algolia Export API / Backup CLI',
          walOrLogName: 'Algolia Cloud Raft Logs',
          // Doc: https://www.algolia.com/doc/api-reference/api-methods/browse/
          commandTemplate: (idx, path) =>
            'algolia objects browse "' + (idx || 'index') + '" > "' + (path || 'backup.json') + '"',
        },
      };

    case 'comdb2':
      return {
        connection: {
          scheme: 'comdb2://',
          defaultPort: 5105,
          sampleUri: 'comdb2://comdb2-host.internal:5105/production_db',
        },
        memoryParams: {
          sharedBufferParam: 'maxwthreads',
          workMemParam: 'buffer_pool_size',
          cacheParam: 'Berkeley DB Cache',
          configFile: 'db.lrl',
        },
        maintenance: {
          // Doc: https://bloomberg.github.io/comdb2/storedprocedures.html
          statsCommand: 'cdb2sql {table} "EXEC PROCEDURE sys.stat()"',
          // Doc: https://bloomberg.github.io/comdb2/sql.html
          spaceReclaimCommand: 'cdb2sql {table} "TRUNCATE {table}"',
          spaceReclaimConcept: 'Berkeley DB B-Tree Defragmentation',
          tuningDdlTemplate: (table) => 'cdb2sql ' + table + ' "EXEC PROCEDURE sys.stat()"',
        },
        // Doc: https://bloomberg.github.io/comdb2/sql.html
        planCommand: 'cdb2sql {table} "EXPLAIN <QUERY>"',
        onlineDdl: {
          // Doc: https://bloomberg.github.io/comdb2/sql.html
          createIndexSql: (idx, tbl, cols) =>
            'CREATE INDEX ' + idx + ' ON ' + tbl + ' (' + splitColumns(cols).join(', ') + ');',
          // Doc: https://bloomberg.github.io/comdb2/sql.html
          dropIndexSql: (idx) => 'DROP INDEX ' + idx + ';',
          rollbackDropIndexSql: (idx, tbl, cols) =>
            'CREATE INDEX ' + idx + ' ON ' + tbl + ' (' + splitColumns(cols).join(', ') + ');',
          supportsConcurrent: false,
          onlineClause: 'NONE',
        },
        backup: {
          tool: 'comdb2_backup / cdb2sql backup',
          walOrLogName: 'Comdb2 Transaction Log',
          // Doc: https://bloomberg.github.io/comdb2/backup.html
          commandTemplate: (db, path) =>
            'comdb2_backup -d "' + (db || 'mydb') + '" -o "' + (path || '/backups') + '"',
        },
      };

    default:
      return null;
  }
}
