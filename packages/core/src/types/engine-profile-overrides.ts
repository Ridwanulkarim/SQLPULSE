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
          // UNVERIFIED: Apache Hive 3.0+ removed CREATE INDEX syntax; use ORC Bloom Filters or Materialized Views
          createIndexSql: (idx, tbl, cols) =>
            '-- Note: Hive 3.0+ removed CREATE INDEX syntax; use ORC bloom filters instead:\n' +
            'ALTER TABLE ' + tbl + ' SET TBLPROPERTIES ("orc.bloom.filter.columns"="' + splitColumns(cols).join(',') + '");',
          // Doc: https://cwiki.apache.org/confluence/display/Hive/LanguageManual+Indexing
          dropIndexSql: (idx, tbl = '{table}') =>
            'ALTER TABLE ' + tbl + ' UNSET TBLPROPERTIES IF EXISTS ("orc.bloom.filter.columns");',
          rollbackDropIndexSql: (idx, tbl = '{table}', cols) =>
            'ALTER TABLE ' + tbl + ' SET TBLPROPERTIES ("orc.bloom.filter.columns"="' + splitColumns(cols).join(',') + '");',
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
          // Doc: https://github.com/memcached/memcached/wiki/Commands#slabs-reassign
          spaceReclaimCommand: '-- Not applicable: Memcached reclaims memory automatically via LRU slab eviction;\necho "stats slabs" | nc 127.0.0.1 11211',
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
          spaceReclaimCommand: '-- Not applicable: Pinecone serverless storage is reclaimed automatically upon vector deletion;\nindex.describe_index_stats()',
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
          // UNVERIFIED: Qdrant automatic vector segment vacuum optimizer (background maintenance)
          spaceReclaimCommand: '-- Qdrant reclaims space automatically through background segment vacuum optimizer;\nGET /collections/{table}',
          spaceReclaimConcept: 'HNSW Graph Segment Optimization & Deleted Vector Vacuuming',
          tuningDdlTemplate: (table) =>
            '# Check Qdrant Collection Status & Optimization Info\ncurl -X GET "http://localhost:6333/collections/' + table + '"',
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
          // UNVERIFIED: TigerGraph secondary index syntax
          createIndexSql: (idx, tbl, cols) =>
            'ALTER VERTEX ' + tbl + ' ADD SECONDARY_INDEX ' + idx + ' (' + splitColumns(cols).join(', ') + ');',
          // Doc: https://docs.tigergraph.com/gsql-ref/current/ddl-and-loading/creating-a-loading-job#_secondary_indexes
          // UNVERIFIED: TigerGraph drop secondary index syntax
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
          // Doc: https://docs.splunk.com/Documentation/Splunk/latest/Indexer/HowSplunkstoresindexes
          spaceReclaimCommand: '-- Splunk manages storage automatically through bucket aging (hot -> warm -> cold -> frozen);\nsplunk list index {table}',
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
          // Doc: https://www.algolia.com/doc/api-reference/api-methods/get-settings/
          spaceReclaimCommand: '-- Not applicable: Algolia automatically compacts memory and storage upon record deletions;\nindex.get_settings()',
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
          // Doc: https://bloomberg.github.io/comdb2/storedprocedures.html
          spaceReclaimCommand: 'cdb2sql {table} "EXEC PROCEDURE sys.cmd.send(\'reorder {table}\')"',
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

    case 'teradata':
      return {
        connection: {
          scheme: 'teradata://',
          defaultPort: 1025,
          sampleUri: 'teradata://dbc:password@td-host.internal:1025/MY_DB',
        },
        memoryParams: {
          sharedBufferParam: 'AMP Worker Tasks (AWT) & FSG Cache',
          workMemParam: 'MaxParseTreeSegs & DBS Control MaxLoadAWT',
          cacheParam: 'FSG (File Segment) Data Cache',
          configFile: 'DBS Control Utility (dbscontrol)',
        },
        maintenance: {
          // Doc: https://docs.teradata.com/r/Teradata-Database-SQL-Request-and-Transaction-Processing/March-2016/SQL-Statements/COLLECT-STATISTICS
          statsCommand: 'COLLECT STATISTICS ON {table};',
          // Doc: https://docs.teradata.com/r/Teradata-VantageTM-Database-Utilities/March-2019/Ferret-Utility
          spaceReclaimCommand: '-- Teradata reclaims deleted rows automatically during cylinder defragmentation (Ferret utility);\nSHOW TABLE {table};',
          spaceReclaimConcept: 'Cylinder Defragmentation & Ferret Reconfig / Packdisk',
          tuningDdlTemplate: (table) => '-- Collect Teradata Column & Index Statistics\nCOLLECT STATISTICS ON ' + table + ';\n',
        },
        // Doc: https://docs.teradata.com/r/Teradata-Database-SQL-Request-and-Transaction-Processing/March-2016/SQL-Statements/EXPLAIN
        planCommand: 'EXPLAIN <QUERY>;',
        onlineDdl: {
          // Doc: https://docs.teradata.com/r/Teradata-Database-SQL-Data-Definition-Language-Syntax-and-Examples/March-2016/Index-Statements/CREATE-INDEX
          createIndexSql: (idx, tbl, cols) => 'CREATE INDEX ' + idx + ' (' + splitColumns(cols).join(', ') + ') ON ' + tbl + ';',
          // Doc: https://docs.teradata.com/r/Teradata-Database-SQL-Data-Definition-Language-Syntax-and-Examples/March-2016/Index-Statements/DROP-INDEX
          dropIndexSql: (idx, tbl = '{table}') => 'DROP INDEX ' + idx + ' ON ' + tbl + ';',
          rollbackDropIndexSql: (idx, tbl = '{table}', cols) => 'CREATE INDEX ' + idx + ' (' + splitColumns(cols).join(', ') + ') ON ' + tbl + ';',
          supportsConcurrent: true,
          onlineClause: 'ONLINE',
        },
        backup: {
          tool: 'Teradata DSA (Data Stream Architecture) / ARCMAIN',
          walOrLogName: 'Teradata Transient Journal & Permanent Journal',
          // Doc: https://docs.teradata.com/r/Enterprise_Data_Protection/Data-Stream-Architecture-User-Guide/DSA-Overview
          commandTemplate: (db) => 'dsc run_job -n ' + db + '_backup_job',
        },
      };

    case 'vertica':
      return {
        connection: {
          scheme: 'vertica://',
          defaultPort: 5433,
          sampleUri: 'vertica://dbadmin:password@vertica-host.internal:5433/vmart',
        },
        memoryParams: {
          sharedBufferParam: 'GENERAL Resource Pool (MEMORYSIZE)',
          workMemParam: 'MAXQUERYMEMORY',
          cacheParam: 'Execution Parallelism & Data Depot Cache',
          configFile: '/opt/vertica/config/vertica.conf',
        },
        maintenance: {
          // Doc: https://docs.vertica.com/latest/en/sql-reference/functions/database-management-functions/analyze-statistics/
          statsCommand: "SELECT ANALYZE_STATISTICS('{table}');",
          // Doc: https://docs.vertica.com/latest/en/sql-reference/functions/database-management-functions/do-tm-task/
          spaceReclaimCommand: "SELECT DO_TM_TASK('mergeout', '{table}');",
          spaceReclaimConcept: 'Tuple Mover (TM) Mergeout & Purge WOS/ROS',
          tuningDdlTemplate: (table) => "-- Vertica Statistics Collection & Projection Refresh\nSELECT ANALYZE_STATISTICS('" + table + "');\n",
        },
        // Doc: https://docs.vertica.com/latest/en/sql-reference/statements/explain/
        planCommand: 'EXPLAIN <QUERY>;',
        onlineDdl: {
          // Doc: https://docs.vertica.com/latest/en/sql-reference/statements/create-projection/
          createIndexSql: (idx, tbl, cols) =>
            'CREATE PROJECTION ' + idx + ' AS SELECT ' + splitColumns(cols).join(', ') + ' FROM ' + tbl + ' ORDER BY ' + splitColumns(cols).join(', ') + ' UNSEGMENTED ALL NODES;',
          // Doc: https://docs.vertica.com/latest/en/sql-reference/statements/drop-projection/
          dropIndexSql: (idx) => 'DROP PROJECTION IF EXISTS ' + idx + ';',
          rollbackDropIndexSql: (idx, tbl = '{table}', cols) =>
            'CREATE PROJECTION ' + idx + ' AS SELECT ' + splitColumns(cols).join(', ') + ' FROM ' + tbl + ' ORDER BY ' + splitColumns(cols).join(', ') + ' UNSEGMENTED ALL NODES;',
          supportsConcurrent: true,
          onlineClause: 'ONLINE',
        },
        backup: {
          tool: 'Vertica vbr (Vertica Backup and Restore)',
          walOrLogName: 'Vertica Write-Ahead Log (WOS / ROS Transaction Logs)',
          // Doc: https://docs.vertica.com/latest/en/admin/backup-and-restore/vbr-overview/
          commandTemplate: (db) => 'vbr --task=backup --config-file=/etc/vertica/' + db + '_backup.ini',
        },
      };

    case 'apache_impala':
      return {
        connection: {
          scheme: 'impala://',
          defaultPort: 21050,
          sampleUri: 'impala://impala-daemon.internal:21050/default',
        },
        memoryParams: {
          sharedBufferParam: 'MEM_LIMIT',
          workMemParam: 'BUFFER_POOL_LIMIT',
          cacheParam: 'HDFS Caching / S3 Read Cache',
          configFile: '/etc/impala/conf/impalad_flags',
        },
        maintenance: {
          // Doc: https://impala.apache.org/docs/build/html/topics/impala_compute_stats.html
          statsCommand: 'COMPUTE STATS {table};',
          // Doc: https://impala.apache.org/docs/build/html/topics/impala_refresh.html
          spaceReclaimCommand: '-- Impala reads immutable Parquet/ORC data on HDFS/S3; compaction is managed at storage layer;\nREFRESH {table};',
          spaceReclaimConcept: 'Parquet/ORC File Compaction & Metastore Catalog Refresh',
          tuningDdlTemplate: (table) => '-- Impala Compute Statistics & Invalidate Metadata\nCOMPUTE STATS ' + table + ';\nREFRESH ' + table + ';\n',
        },
        // Doc: https://impala.apache.org/docs/build/html/topics/impala_explain_plan.html
        planCommand: 'EXPLAIN <QUERY>;',
        onlineDdl: {
          // Doc: https://impala.apache.org/docs/build/html/topics/impala_partitioning.html
          createIndexSql: (idx, tbl) => '-- Impala does not support traditional secondary indexes; use partition pruning or Parquet sorting:\nALTER TABLE ' + tbl + ' RECOVER PARTITIONS;',
          // Doc: https://impala.apache.org/docs/build/html/topics/impala_partitioning.html
          dropIndexSql: (idx, tbl = '{table}') => '-- No secondary index to drop in Impala (' + idx + ' on ' + tbl + ')',
          rollbackDropIndexSql: () => '-- Impala relies on columnar storage layout',
          supportsConcurrent: false,
          onlineClause: 'NONE',
        },
        backup: {
          tool: 'HDFS / S3 DistCp & Hive Metastore Backup',
          walOrLogName: 'Statestore / Catalogd Metadata Catalog',
          // Doc: https://impala.apache.org/docs/build/html/topics/impala_metadata.html
          commandTemplate: (db) => 'hdfs distcp /user/hive/warehouse/' + db + '.db /backups/' + db + '/',
        },
      };

    case 'apache_druid':
      return {
        connection: {
          scheme: 'druid://',
          defaultPort: 8888,
          sampleUri: 'druid://router.internal:8888/druid/v2/sql',
        },
        memoryParams: {
          sharedBufferParam: 'druid.processing.buffer.sizeBytes',
          workMemParam: 'druid.processing.numThreads',
          cacheParam: 'druid.historical.cache.useCache',
          configFile: '_common/common.runtime.properties',
        },
        maintenance: {
          // Doc: https://druid.apache.org/docs/latest/querying/sql-metadata-tables#segments-table
          statsCommand: "SELECT segment_id, num_rows, size FROM sys.segments WHERE datasource = '{table}';",
          // Doc: https://druid.apache.org/docs/latest/data-management/compaction
          spaceReclaimCommand: '-- Trigger Druid Auto-Compaction Task to merge small segments and prune tombstone records;\nPOST /druid/indexer/v1/task (CompactionTask)',
          spaceReclaimConcept: 'Segment Auto-Compaction & Tombstone Purging',
          tuningDdlTemplate: (table) => "-- Inspect Apache Druid Segment Footprint for " + table + "\nSELECT datasource, count(*) as num_segments, sum(size) as total_bytes FROM sys.segments WHERE datasource = '" + table + "' GROUP BY 1;\n",
        },
        // Doc: https://druid.apache.org/docs/latest/querying/sql-query-execution#explain-plan
        planCommand: 'EXPLAIN PLAN FOR <QUERY>;',
        onlineDdl: {
          // Doc: https://druid.apache.org/docs/latest/design/segments#indexing-bitmap
          createIndexSql: (idx, tbl, cols) => '-- Apache Druid creates Roaring bitmap indexes automatically for string dimensions during ingestion;\n-- Dimension: ' + splitColumns(cols).join(', ') + ' in datasource ' + tbl,
          // Doc: https://druid.apache.org/docs/latest/design/segments
          dropIndexSql: () => '-- Bitmap indexes in Druid are managed by segment ingestion spec',
          rollbackDropIndexSql: () => '-- Define dimension in ingestion spec to re-enable indexing',
          supportsConcurrent: true,
          onlineClause: 'ONLINE',
        },
        backup: {
          tool: 'Druid Deep Storage Snapshot (S3 / HDFS / GCS) & Metadata Store Dump',
          walOrLogName: 'Druid Segment Deep Storage & ZooKeeper Coordinators',
          // Doc: https://druid.apache.org/docs/latest/design/deep-storage
          commandTemplate: (db) => 'aws s3 sync s3://druid-deep-storage/' + db + '/ /backups/' + db + '/',
        },
      };

    case 'starrocks':
      return {
        connection: {
          scheme: 'mysql://',
          defaultPort: 9030,
          sampleUri: 'mysql://root:password@starrocks-fe.internal:9030/starrocks_db',
        },
        memoryParams: {
          sharedBufferParam: 'query_mem_limit',
          workMemParam: 'load_mem_limit',
          cacheParam: 'page_cache_mem_limit',
          configFile: 'fe/conf/fe.conf, be/conf/be.conf',
        },
        maintenance: {
          // Doc: https://docs.starrocks.io/docs/sql-reference/sql-statements/cbo/ANALYZE_TABLE/
          statsCommand: 'ANALYZE TABLE {table};',
          // Doc: https://docs.starrocks.io/docs/administration/management/resource_management/
          spaceReclaimCommand: '-- StarRocks merges historical tablet versions automatically via compaction engine;\nADMIN SHOW REPLICA STATUS FROM {table};',
          spaceReclaimConcept: 'Cumulative & Base Compaction of Tablet Segments',
          tuningDdlTemplate: (table) => '-- StarRocks Statistics Collection\nANALYZE TABLE ' + table + ';\n',
        },
        // Doc: https://docs.starrocks.io/docs/sql-reference/sql-statements/cbo/EXPLAIN/
        planCommand: 'EXPLAIN <QUERY>;',
        onlineDdl: {
          // Doc: https://docs.starrocks.io/docs/sql-reference/sql-statements/table_bucket_part_index/CREATE_INDEX/
          createIndexSql: (idx, tbl, cols) => 'CREATE INDEX ' + idx + ' ON ' + tbl + ' (' + splitColumns(cols).join(', ') + ') USING BITMAP;',
          // Doc: https://docs.starrocks.io/docs/sql-reference/sql-statements/table_bucket_part_index/DROP_INDEX/
          dropIndexSql: (idx, tbl = '{table}') => 'DROP INDEX ' + idx + ' ON ' + tbl + ';',
          rollbackDropIndexSql: (idx, tbl = '{table}', cols) => 'CREATE INDEX ' + idx + ' ON ' + tbl + ' (' + splitColumns(cols).join(', ') + ') USING BITMAP;',
          supportsConcurrent: true,
          onlineClause: 'ONLINE',
        },
        backup: {
          tool: 'StarRocks BACKUP SNAPSHOT',
          walOrLogName: 'StarRocks Tablet Segment Write-Ahead Log (WAL)',
          // Doc: https://docs.starrocks.io/docs/sql-reference/sql-statements/cluster-management/BACKUP/
          commandTemplate: (db) => 'BACKUP SNAPSHOT ' + db + '.backup_label TO my_repository;',
        },
      };

    case 'apache_pinot':
      return {
        connection: {
          scheme: 'pinot://',
          defaultPort: 8099,
          sampleUri: 'pinot://pinot-broker.internal:8099/query/sql',
        },
        memoryParams: {
          sharedBufferParam: 'pinot.server.instance.realtime.alloc.offheap',
          workMemParam: 'pinot.query.server.port',
          cacheParam: 'pinot.server.instance.segment.format.v3',
          configFile: 'conf/pinot-server.conf',
        },
        maintenance: {
          // Doc: https://docs.pinot.apache.org/developers/advanced/troubleshooting#check-table-size
          statsCommand: 'GET /tables/{table}/size',
          // Doc: https://docs.pinot.apache.org/operators/operating-pinot/rebalance
          spaceReclaimCommand: '-- Apache Pinot reloads segments to apply modified index configurations;\nPOST /tables/{table}/rebuildBrokerResourceFromHelix',
          spaceReclaimConcept: 'Pinot Immutable Segment Compaction & Segment Reload',
          tuningDdlTemplate: (table) => '-- Inspect Apache Pinot Segment Sizing for ' + table + '\ncurl -X GET "http://localhost:8099/tables/' + table + '/size"\n',
        },
        // Doc: https://docs.pinot.apache.org/users/user-guide-query/query-options#explain-plan
        planCommand: 'EXPLAIN PLAN FOR <QUERY>;',
        onlineDdl: {
          // Doc: https://docs.pinot.apache.org/basics/indexing
          createIndexSql: (idx, tbl, cols) => '-- Apache Pinot indexes are defined via table configuration (tableConfig.json):\n-- Add ' + splitColumns(cols).join(', ') + ' to tableIndexConfig.invertedIndexColumns or rangeIndexColumns',
          // Doc: https://docs.pinot.apache.org/basics/indexing
          dropIndexSql: (idx, tbl = '{table}') => '-- Remove index configuration from tableConfig.json and trigger segment reload for ' + tbl,
          rollbackDropIndexSql: () => '-- Add column back to tableConfig.json and reload segments',
          supportsConcurrent: true,
          onlineClause: 'ONLINE',
        },
        backup: {
          tool: 'Pinot Deep Storage Backup (S3 / GCS / HDFS) & Zookeeper Helix Metadata',
          walOrLogName: 'Apache Helix State & Deep Storage Tarballs',
          // Doc: https://docs.pinot.apache.org/operators/operating-pinot/segment-lifecycle
          commandTemplate: (db) => 'aws s3 sync s3://pinot-deep-storage/' + db + '/ s3://pinot-backups/' + db + '/',
        },
      };

    case 'apache_doris':
      return {
        connection: {
          scheme: 'mysql://',
          defaultPort: 9030,
          sampleUri: 'mysql://root:password@doris-fe.internal:9030/doris_db',
        },
        memoryParams: {
          sharedBufferParam: 'exec_mem_limit',
          workMemParam: 'load_process_max_memory_limit_percent',
          cacheParam: 'storage_page_cache_limit',
          configFile: 'fe/conf/fe.conf, be/conf/be.conf',
        },
        maintenance: {
          // Doc: https://doris.apache.org/docs/query-acceleration/statistics/
          statsCommand: 'ANALYZE TABLE {table};',
          // Doc: https://doris.apache.org/docs/admin-manual/maint-monitor/compaction/
          spaceReclaimCommand: '-- Apache Doris performs rowset compaction automatically in Backend (BE) nodes;\nSHOW TABLETS FROM {table};',
          spaceReclaimConcept: 'Rowset Base & Cumulative Compaction',
          tuningDdlTemplate: (table) => '-- Collect Doris Statistics for CBO Optimizer\nANALYZE TABLE ' + table + ';\n',
        },
        // Doc: https://doris.apache.org/docs/sql-manual/sql-statements/utility/EXPLAIN/
        planCommand: 'EXPLAIN <QUERY>;',
        onlineDdl: {
          // Doc: https://doris.apache.org/docs/sql-manual/sql-statements/table-bucket-part-index/CREATE-INDEX/
          createIndexSql: (idx, tbl, cols) => 'CREATE INDEX ' + idx + ' ON ' + tbl + ' (' + splitColumns(cols).join(', ') + ') USING BITMAP;',
          // Doc: https://doris.apache.org/docs/sql-manual/sql-statements/table-bucket-part-index/DROP-INDEX/
          dropIndexSql: (idx, tbl = '{table}') => 'DROP INDEX ' + idx + ' ON ' + tbl + ';',
          rollbackDropIndexSql: (idx, tbl = '{table}', cols) => 'CREATE INDEX ' + idx + ' ON ' + tbl + ' (' + splitColumns(cols).join(', ') + ') USING BITMAP;',
          supportsConcurrent: true,
          onlineClause: 'ONLINE',
        },
        backup: {
          tool: 'Apache Doris BACKUP SNAPSHOT',
          walOrLogName: 'Doris Rowset Write-Ahead Log (WAL)',
          // Doc: https://doris.apache.org/docs/sql-manual/sql-statements/cluster-management/BACKUP/
          commandTemplate: (db) => 'BACKUP SNAPSHOT ' + db + '.snapshot_label TO my_repo;',
        },
      };

    case 'aerospike':
      return {
        connection: {
          scheme: 'aerospike://',
          defaultPort: 3000,
          sampleUri: 'aerospike://user:password@aerospike-host.internal:3000/test',
        },
        memoryParams: {
          sharedBufferParam: 'memory-size',
          workMemParam: 'write-block-size',
          cacheParam: 'post-write-queue',
          configFile: '/etc/aerospike/aerospike.conf',
        },
        maintenance: {
          // Doc: https://docs.aerospike.com/tools/asadm/commands#show-statistics
          statsCommand: 'asadm -e "show statistics namespace {table}"',
          // Doc: https://docs.aerospike.com/server/architecture/storage/defragmentation
          spaceReclaimCommand: '-- Aerospike reclaims deleted records automatically via background tombstone defragmentation;\nasadm -e "info namespace"',
          spaceReclaimConcept: 'Storage Defragmentation & Tombstone Purging',
          tuningDdlTemplate: (table) => '-- Aerospike Namespace Statistics Inspection\nasadm -e "show statistics namespace ' + table + '"\n',
        },
        // Doc: https://docs.aerospike.com/tools/asadm/
        planCommand: 'asadm -e "asinfo -v \'hist-dump:ns={table};hist=ttl\'"',
        onlineDdl: {
          // Doc: https://docs.aerospike.com/server/guide/indexes#creating-a-secondary-index
          createIndexSql: (idx, tbl, cols) => 'CREATE INDEX ' + idx + ' ON ' + tbl + ' (' + splitColumns(cols)[0] + ') NUMERIC;',
          // Doc: https://docs.aerospike.com/server/guide/indexes#dropping-a-secondary-index
          dropIndexSql: (idx, tbl = '{table}') => 'DROP INDEX ' + idx + ' ON ' + tbl + ';',
          rollbackDropIndexSql: (idx, tbl = '{table}', cols) => 'CREATE INDEX ' + idx + ' ON ' + tbl + ' (' + splitColumns(cols)[0] + ') NUMERIC;',
          supportsConcurrent: true,
          onlineClause: 'ONLINE',
        },
        backup: {
          tool: 'asbackup (Aerospike Backup Tool)',
          walOrLogName: 'Aerospike Commit Log / Enterprise In-Memory Buffer',
          // Doc: https://docs.aerospike.com/tools/asbackup
          commandTemplate: (db, path) => 'asbackup --namespace ' + db + ' --directory ' + path,
        },
      };

    case 'hazelcast':
      return {
        connection: {
          scheme: 'hazelcast://',
          defaultPort: 5701,
          sampleUri: 'hazelcast://hazelcast-cluster.internal:5701/dev',
        },
        memoryParams: {
          sharedBufferParam: 'hazelcast.memory.heap.size',
          workMemParam: 'hazelcast.query.result.size.limit',
          cacheParam: 'High-Density Memory Store (HDMS)',
          configFile: 'hazelcast.yaml / hazelcast.xml',
        },
        maintenance: {
          // Doc: https://docs.hazelcast.com/hazelcast/latest/management/cluster-utilities#map-get-stats
          statsCommand: 'hz-cli map get-stats --name={table}',
          // Doc: https://docs.hazelcast.com/hazelcast/latest/data-structures/eviction
          spaceReclaimCommand: '-- Hazelcast reclaims memory automatically via eviction policies (LRU/LFU) and max-idle expirations;\nhz-cli cluster health',
          spaceReclaimConcept: 'In-Memory Partition Eviction (LRU/LFU) & High-Density Memory Store',
          tuningDdlTemplate: (table) => '-- Check Hazelcast Map Statistics for ' + table + '\nhz-cli map get-stats --name=' + table + '\n',
        },
        // Doc: https://docs.hazelcast.com/hazelcast/latest/sql/explain-statement
        planCommand: 'EXPLAIN <QUERY>;',
        onlineDdl: {
          // Doc: https://docs.hazelcast.com/hazelcast/latest/sql/create-index
          createIndexSql: (idx, tbl, cols) => 'CREATE INDEX ' + idx + ' ON ' + tbl + ' (' + splitColumns(cols).join(', ') + ');',
          // Doc: https://docs.hazelcast.com/hazelcast/latest/sql/drop-index
          dropIndexSql: (idx, tbl = '{table}') => 'DROP INDEX IF EXISTS ' + idx + ' ON ' + tbl + ';',
          rollbackDropIndexSql: (idx, tbl = '{table}', cols) => 'CREATE INDEX ' + idx + ' ON ' + tbl + ' (' + splitColumns(cols).join(', ') + ');',
          supportsConcurrent: true,
          onlineClause: 'ONLINE',
        },
        backup: {
          tool: 'Hazelcast Hot Restart Store Backup',
          walOrLogName: 'Hot Restart Append-Only Journal & Partition State',
          // Doc: https://docs.hazelcast.com/hazelcast/latest/storage/hot-restart-backup
          commandTemplate: () => 'hz-cli hot-restart backup',
        },
      };

    case 'rocksdb':
      return {
        connection: {
          scheme: 'rocksdb://',
          defaultPort: 0,
          sampleUri: 'rocksdb:///var/data/rocksdb/storage',
        },
        memoryParams: {
          sharedBufferParam: 'write_buffer_size (MemTable)',
          workMemParam: 'max_write_buffer_number',
          cacheParam: 'block_cache (LRUCache)',
          configFile: 'OPTIONS-xxxx file in DB directory',
        },
        maintenance: {
          // Doc: https://github.com/facebook/rocksdb/wiki/RocksDB-Basics
          statsCommand: '// RocksDB DB statistics API:\ndb->GetProperty("rocksdb.stats", &stats);',
          // Doc: https://github.com/facebook/rocksdb/wiki/Compaction
          spaceReclaimCommand: '// RocksDB range compaction:\ndb->CompactRange(rocksdb::CompactRangeOptions(), nullptr, nullptr);',
          spaceReclaimConcept: 'LSM-Tree Leveled / Universal Compaction',
          tuningDdlTemplate: () => '// RocksDB Compaction & Memory Inspection\ndb->CompactRange(rocksdb::CompactRangeOptions(), nullptr, nullptr);\n',
        },
        // Doc: https://github.com/facebook/rocksdb/wiki/RocksDB-Basics
        planCommand: '// RocksDB point Get() or Iterator SeekToKey();\n// Inspect bloom-filter hit ratio: db->GetProperty("rocksdb.bloom-filter-useful", &val);',
        onlineDdl: {
          // Doc: https://github.com/facebook/rocksdb/wiki/Column-Families
          createIndexSql: (idx) => '// RocksDB Column Family for secondary indexing:\ndb->CreateColumnFamily(rocksdb::ColumnFamilyOptions(), "' + idx + '", &cf_handle);',
          // Doc: https://github.com/facebook/rocksdb/wiki/Column-Families
          dropIndexSql: () => 'db->DropColumnFamily(cf_handle);',
          rollbackDropIndexSql: (idx) => 'db->CreateColumnFamily(rocksdb::ColumnFamilyOptions(), "' + idx + '", &cf_handle);',
          supportsConcurrent: true,
          onlineClause: 'ONLINE',
        },
        backup: {
          tool: 'RocksDB BackupEngine / Checkpoint',
          walOrLogName: 'RocksDB Write-Ahead Log (.log files in db directory)',
          // Doc: https://github.com/facebook/rocksdb/wiki/How-to-backup-RocksDB
          commandTemplate: (db, path) => '// RocksDB Checkpoint API:\nrocksdb::Checkpoint::Create(db, &checkpoint); checkpoint->CreateCheckpoint("' + (path || '/backups') + '/' + (db || 'mydb') + '");',
        },
      };

    case 'leveldb':
      return {
        connection: {
          scheme: 'leveldb://',
          defaultPort: 0,
          sampleUri: 'leveldb:///var/data/leveldb/storage',
        },
        memoryParams: {
          sharedBufferParam: 'write_buffer_size (4MB default MemTable)',
          workMemParam: 'max_open_files',
          cacheParam: 'block_cache (8MB default)',
          configFile: 'LevelDB in-process Options struct',
        },
        maintenance: {
          // Doc: https://github.com/google/leveldb/blob/main/doc/index.md
          statsCommand: '// LevelDB stats property query:\nstd::string stats;\ndb->GetProperty("leveldb.stats", &stats);',
          // Doc: https://github.com/google/leveldb/blob/main/doc/index.md
          spaceReclaimCommand: '// LevelDB manual range compaction:\ndb->CompactRange(nullptr, nullptr);',
          spaceReclaimConcept: 'LSM-Tree Multi-Level File Compaction',
          tuningDdlTemplate: () => '// LevelDB Compact Range\ndb->CompactRange(nullptr, nullptr);\n',
        },
        // Doc: https://github.com/google/leveldb/blob/main/doc/index.md
        planCommand: '// LevelDB ordered key-value access via Get(Slice) or Iterator Seek()',
        onlineDdl: {
          // Doc: https://github.com/google/leveldb/blob/main/doc/index.md
          createIndexSql: () => '-- LevelDB does not support secondary indexes; keys are sorted lexicographically by Slice comparator.',
          // Doc: https://github.com/google/leveldb/blob/main/doc/index.md
          dropIndexSql: () => '-- LevelDB does not support secondary indexes',
          rollbackDropIndexSql: () => '-- No index restoration needed',
          supportsConcurrent: false,
          onlineClause: 'NONE',
        },
        backup: {
          tool: 'LevelDB File Copy / Read-Only Snapshot',
          walOrLogName: 'LevelDB Write-Ahead Log (MANIFEST and .log files)',
          // Doc: https://github.com/google/leveldb/blob/main/doc/index.md
          commandTemplate: (db, path) => 'cp -r /data/' + (db || 'mydb') + ' ' + (path || '/backups') + '/' + (db || 'mydb'),
        },
      };

    case 'riak_kv':
      return {
        connection: {
          scheme: 'riak://',
          defaultPort: 8087,
          sampleUri: 'riak://riak-node.internal:8087/buckets/users',
        },
        memoryParams: {
          sharedBufferParam: 'bitcask.max_file_size',
          workMemParam: 'erlang.max_processes',
          cacheParam: 'leveldb.block_cache_size',
          configFile: '/etc/riak/riak.conf',
        },
        maintenance: {
          // Doc: https://docs.riak.com/riak/kv/latest/using/reference/riak-admin/index.html
          statsCommand: 'riak-admin status',
          // Doc: https://docs.riak.com/riak/kv/latest/setup/planning/backend/bitcask/index.html
          spaceReclaimCommand: '-- Riak Bitcask or LevelDB backends reclaim space via automated background file merging/compaction;\nriak-admin member-status',
          spaceReclaimConcept: 'Bitcask Data File Merge & LevelDB Compaction',
          tuningDdlTemplate: () => '-- Riak KV Cluster Status Inspection\nriak-admin status\nriak-admin ring-status\n',
        },
        // Doc: https://docs.riak.com/riak/kv/latest/learn/concepts/index.html
        planCommand: '-- Riak KV lookups execute via key hashing (Dynamo consistent hash ring)',
        onlineDdl: {
          // Doc: https://docs.riak.com/riak/kv/latest/developing/usage/secondary-indexes/index.html
          createIndexSql: (idx, tbl, cols) => '-- Riak 2i uses index fields stored directly as metadata during object PUT:\n-- curl -X PUT ... -H "x-riak-index-' + cols + '_bin: value"',
          // Doc: https://docs.riak.com/riak/kv/latest/developing/usage/secondary-indexes/index.html
          dropIndexSql: () => '-- Riak 2i indexes are removed by modifying object index metadata',
          rollbackDropIndexSql: () => '-- Restore index metadata on object PUT',
          supportsConcurrent: true,
          onlineClause: 'ONLINE',
        },
        backup: {
          tool: 'riak-admin backup',
          walOrLogName: 'Bitcask Append-Only Logs & Riak AAE (Active Anti-Entropy) Trees',
          // Doc: https://docs.riak.com/riak/kv/latest/using/reference/riak-admin/index.html
          commandTemplate: (db, path) => 'riak-admin backup riak@127.0.0.1 riak_cookie ' + (path || '/backups') + '/' + (db || 'mydb') + '.bak node',
        },
      };

    case 'janusgraph':
      return {
        connection: {
          scheme: 'gremlin://',
          defaultPort: 8182,
          sampleUri: 'gremlin://janusgraph.internal:8182/gremlin',
        },
        memoryParams: {
          sharedBufferParam: 'cache.db-cache-size',
          workMemParam: 'cache.tx-cache-size',
          cacheParam: 'cache.db-cache-clean-wait',
          configFile: 'conf/janusgraph-cql.properties',
        },
        maintenance: {
          // Doc: https://docs.janusgraph.org/advanced-topics/management-system/
          statsCommand: 'mgmt = graph.openManagement(); mgmt.printIndexes(); mgmt.commit();',
          // Doc: https://docs.janusgraph.org/storage-backend/
          spaceReclaimCommand: '-- JanusGraph delegates storage compaction to underlying backend (Cassandra/HBase/BerkeleyDB);\n// Cassandra: nodetool compact, HBase: major_compact',
          spaceReclaimConcept: 'Underlying Pluggable Storage Backend Compaction',
          tuningDdlTemplate: () => '// Print JanusGraph Schema & Index Status\nmgmt = graph.openManagement();\nmgmt.printIndexes();\nmgmt.commit();\n',
        },
        // Doc: https://tinkerpop.apache.org/docs/current/reference/#profile-step
        planCommand: "g.V().has('name', 'val').profile()",
        onlineDdl: {
          // Doc: https://docs.janusgraph.org/index-management/index-lifecycle/
          createIndexSql: (idx, tbl, cols) => "mgmt = graph.openManagement(); prop = mgmt.getPropertyKey('" + splitColumns(cols)[0] + "'); mgmt.buildIndex('" + idx + "', Vertex.class).addKey(prop).buildCompositeIndex(); mgmt.commit();",
          // Doc: https://docs.janusgraph.org/index-management/index-lifecycle/
          dropIndexSql: (idx) => "mgmt = graph.openManagement(); idx = mgmt.getGraphIndex('" + idx + "'); mgmt.updateIndex(idx, SchemaAction.DISABLE_INDEX); mgmt.commit();",
          rollbackDropIndexSql: (idx) => "mgmt = graph.openManagement(); idx = mgmt.getGraphIndex('" + idx + "'); mgmt.updateIndex(idx, SchemaAction.ENABLE_INDEX); mgmt.commit();",
          supportsConcurrent: true,
          onlineClause: 'ONLINE',
        },
        backup: {
          tool: 'JanusGraph Storage Backend Snapshot (Cassandra / HBase Snapshot)',
          walOrLogName: 'Backend Transaction Log & Lucene/Elasticsearch Index State',
          // Doc: https://docs.janusgraph.org/storage-backend/
          commandTemplate: (db) => 'snapshot_tool create -name ' + (db || 'mydb') + '_snapshot',
        },
      };

    case 'orientdb':
      return {
        connection: {
          scheme: 'orientdb://',
          defaultPort: 2424,
          sampleUri: 'orientdb://root:password@orientdb.internal:2424/GratefulDeadConcerts',
        },
        memoryParams: {
          sharedBufferParam: 'storage.diskCache.bufferSize',
          workMemParam: 'cache.level1.enabled',
          cacheParam: 'storage.diskCache.pageMax',
          configFile: 'config/orientdb-server-config.xml',
        },
        maintenance: {
          // Doc: https://orientdb.com/docs/3.0.x/sql/SQL-Query.html
          statsCommand: 'SELECT count(*) FROM metadata:classes;',
          // Doc: https://orientdb.com/docs/3.0.x/sql/SQL-Alter-Class.html
          spaceReclaimCommand: 'ALTER CLASS {table} COMPACT;',
          spaceReclaimConcept: 'OrientDB Paginated Cluster Compaction & Data Defragmentation',
          tuningDdlTemplate: (table) => '-- OrientDB Class Compaction & Optimization\nALTER CLASS ' + table + ' COMPACT;\n',
        },
        // Doc: https://orientdb.com/docs/3.0.x/sql/SQL-Explain.html
        planCommand: 'EXPLAIN SELECT FROM {table};',
        onlineDdl: {
          // Doc: https://orientdb.com/docs/3.0.x/sql/SQL-Create-Index.html
          createIndexSql: (idx, tbl, cols) => 'CREATE INDEX ' + idx + ' ON ' + tbl + ' (' + splitColumns(cols).join(', ') + ') NOTUNIQUE;',
          // Doc: https://orientdb.com/docs/3.0.x/sql/SQL-Drop-Index.html
          dropIndexSql: (idx) => 'DROP INDEX ' + idx + ';',
          rollbackDropIndexSql: (idx, tbl = '{table}', cols) => 'CREATE INDEX ' + idx + ' ON ' + tbl + ' (' + splitColumns(cols).join(', ') + ') NOTUNIQUE;',
          supportsConcurrent: true,
          onlineClause: 'ONLINE',
        },
        backup: {
          tool: 'OrientDB Console BACKUP DATABASE',
          walOrLogName: 'OrientDB Write-Ahead Log (WAL / OStorage)',
          // Doc: https://orientdb.com/docs/3.0.x/console/Console-Commands.html
          commandTemplate: (db, path) => 'backup database ' + (path || '/backups') + '/' + (db || 'mydb') + '.zip',
        },
      };

    case 'memgraph':
      return {
        connection: {
          scheme: 'bolt://',
          defaultPort: 7687,
          sampleUri: 'bolt://memgraph.internal:7687',
        },
        memoryParams: {
          sharedBufferParam: '--memory-limit',
          workMemParam: '--query-execution-timeout-sec',
          cacheParam: '--storage-snapshot-interval-sec',
          configFile: '/etc/memgraph/memgraph.conf',
        },
        maintenance: {
          // Doc: https://memgraph.com/docs/querying/system-queries#show-storage-info
          statsCommand: 'SHOW STORAGE INFO;',
          // Doc: https://memgraph.com/docs/database-management/memory-control
          spaceReclaimCommand: '-- Memgraph stores data in-memory with periodic snapshotting; obsolete transactions are freed by GC;\nFREE MEMORY;',
          spaceReclaimConcept: 'In-Memory Transaction Garbage Collection',
          tuningDdlTemplate: () => '-- Inspect Memgraph In-Memory Storage Info\nSHOW STORAGE INFO;\n',
        },
        // Doc: https://memgraph.com/docs/querying/inspecting-queries
        planCommand: 'EXPLAIN <QUERY>;',
        onlineDdl: {
          // Doc: https://memgraph.com/docs/querying/indexes
          createIndexSql: (idx, tbl, cols) => 'CREATE INDEX ON :' + tbl + '(' + splitColumns(cols).join(', ') + ');',
          // Doc: https://memgraph.com/docs/querying/indexes
          dropIndexSql: (idx, tbl = '{table}', cols = '{col}') => 'DROP INDEX ON :' + tbl + '(' + splitColumns(cols).join(', ') + ');',
          rollbackDropIndexSql: (idx, tbl = '{table}', cols = '{col}') => 'CREATE INDEX ON :' + tbl + '(' + splitColumns(cols).join(', ') + ');',
          supportsConcurrent: true,
          onlineClause: 'ONLINE',
        },
        backup: {
          tool: 'Memgraph CREATE SNAPSHOT',
          walOrLogName: 'Memgraph Write-Ahead Log (WAL) & Snapshot Files',
          // Doc: https://memgraph.com/docs/database-management/backup-and-restore
          commandTemplate: () => 'CREATE SNAPSHOT;',
        },
      };

    case 'apache_jena_tdb':
      return {
        connection: {
          scheme: 'fuseki://',
          defaultPort: 3030,
          sampleUri: 'fuseki://jena-fuseki.internal:3030/ds',
        },
        memoryParams: {
          sharedBufferParam: 'tdb:cacheBlockSize',
          workMemParam: 'tdb:cacheNode2NodeIdSize',
          cacheParam: 'tdb:cacheNodeId2NodeSize',
          configFile: 'fuseki/configuration/dataset.ttl',
        },
        maintenance: {
          // Doc: https://jena.apache.org/documentation/tdb2/tdb2_admin.html
          statsCommand: 'tdb2.tdbstats --loc=/data/{table}',
          // Doc: https://jena.apache.org/documentation/tdb2/tdb2_admin.html
          spaceReclaimCommand: 'tdb2.tdbcompact --loc=/data/{table}',
          spaceReclaimConcept: 'TDB2 Online Dataset Compaction & Node Table Compaction',
          tuningDdlTemplate: (table) => '# Apache Jena TDB2 Compaction & Stats\ntdb2.tdbcompact --loc=/data/' + table + '\ntdb2.tdbstats --loc=/data/' + table + '\n',
        },
        // Doc: https://jena.apache.org/documentation/query/explain.html
        planCommand: 'qparse --explain <QUERY>',
        onlineDdl: {
          // Doc: https://jena.apache.org/documentation/tdb/architecture.html#triple-and-quad-indexes
          createIndexSql: () => '-- Apache Jena TDB maintains triple/quad B+Tree indexes (SPO, POS, OSP) automatically;\n-- No custom secondary indexes required.',
          // Doc: https://jena.apache.org/documentation/tdb/architecture.html#triple-and-quad-indexes
          dropIndexSql: () => '-- Triple indexes are system-managed in Jena TDB',
          rollbackDropIndexSql: () => '-- System indexes restored automatically',
          supportsConcurrent: false,
          onlineClause: 'NONE',
        },
        backup: {
          tool: 'tdb2.tdbbackup',
          walOrLogName: 'TDB2 Transaction Journal (.jrnl files)',
          // Doc: https://jena.apache.org/documentation/tdb2/tdb2_admin.html
          commandTemplate: (db, path) => 'tdb2.tdbbackup --loc=/data/' + (db || 'mydb') + ' --dir=' + (path || '/backups'),
        },
      };

    case 'tdengine':
      return {
        connection: {
          scheme: 'taos://',
          defaultPort: 6030,
          sampleUri: 'taos://root:taosdata@tdengine-host.internal:6030/power',
        },
        memoryParams: {
          sharedBufferParam: 'buffer',
          workMemParam: 'numOfBlocks',
          cacheParam: 'pagesCacheSize',
          configFile: '/etc/taos/taos.cfg',
        },
        maintenance: {
          // Doc: https://docs.tdengine.com/reference/taos-sql/table/
          statsCommand: 'SHOW TABLE {table};',
          // Doc: https://docs.tdengine.com/reference/taos-sql/database/
          spaceReclaimCommand: 'ALTER DATABASE {table} COMPACT;',
          spaceReclaimConcept: 'TDengine Data File Compaction & Out-of-Order Data Merging',
          tuningDdlTemplate: (table) => '-- TDengine Database Compaction\nALTER DATABASE ' + table + ' COMPACT;\n',
        },
        // Doc: https://docs.tdengine.com/reference/taos-sql/explain/
        planCommand: 'EXPLAIN <QUERY>;',
        onlineDdl: {
          // Doc: https://docs.tdengine.com/reference/taos-sql/index/
          createIndexSql: (idx, tbl, cols) => 'CREATE INDEX ' + idx + ' ON ' + tbl + ' (' + splitColumns(cols).join(', ') + ');',
          // Doc: https://docs.tdengine.com/reference/taos-sql/index/
          dropIndexSql: (idx, tbl = '{table}') => 'DROP INDEX ' + idx + ' ON ' + tbl + ';',
          rollbackDropIndexSql: (idx, tbl = '{table}', cols) => 'CREATE INDEX ' + idx + ' ON ' + tbl + ' (' + splitColumns(cols).join(', ') + ');',
          supportsConcurrent: true,
          onlineClause: 'ONLINE',
        },
        backup: {
          tool: 'taosdump (TDengine Backup and Restore Tool)',
          walOrLogName: 'TDengine Write-Ahead Log (WAL) & Data Files (.data, .head)',
          // Doc: https://docs.tdengine.com/tools/taosdump/
          commandTemplate: (db, path) => 'taosdump -D ' + (db || 'mydb') + ' -o ' + (path || '/backups'),
        },
      };

    case 'opentsdb':
      return {
        connection: {
          scheme: 'opentsdb://',
          defaultPort: 4242,
          sampleUri: 'opentsdb://opentsdb-tsd.internal:4242',
        },
        memoryParams: {
          sharedBufferParam: 'tsd.storage.hbase.data_table',
          workMemParam: 'tsd.query.filter.expansion_limit',
          cacheParam: 'tsd.core.uid.cache.tagk.size',
          configFile: '/etc/opentsdb/opentsdb.conf',
        },
        maintenance: {
          // Doc: https://opentsdb.net/docs/build/html/api_http/stats.html
          statsCommand: 'GET /api/stats',
          // Doc: https://opentsdb.net/docs/build/html/user_guide/backends/hbase.html
          spaceReclaimCommand: '-- OpenTSDB delegates storage to HBase / Bigtable; HBase major compaction handles space reclamation:\n// hbase shell: major_compact \'tsdb\'',
          spaceReclaimConcept: 'Underlying HBase Region Compaction & UID Compaction',
          tuningDdlTemplate: () => '# Query OpenTSDB Daemon Stats\ncurl -s "http://localhost:4242/api/stats"\n',
        },
        // Doc: https://opentsdb.net/docs/build/html/api_http/query/index.html
        planCommand: 'POST /api/query?summary=true',
        onlineDdl: {
          // Doc: https://opentsdb.net/docs/build/html/user_guide/backends/hbase.html
          createIndexSql: () => '-- OpenTSDB rows are indexed by metric UID and timestamp salt in HBase; no secondary index DDL.',
          // Doc: https://opentsdb.net/docs/build/html/user_guide/backends/hbase.html
          dropIndexSql: () => '-- OpenTSDB row schema is managed by HBase row key design',
          rollbackDropIndexSql: () => '-- No index restoration needed',
          supportsConcurrent: false,
          onlineClause: 'NONE',
        },
        backup: {
          tool: 'HBase Snapshot (OpenTSDB tsdb, tsdb-uid, tsdb-tree tables)',
          walOrLogName: 'HBase Write-Ahead Log (HLog / WAL)',
          // Doc: https://opentsdb.net/docs/build/html/user_guide/backends/hbase.html
          commandTemplate: (db) => "hbase shell -c \"snapshot 'tsdb', '" + (db || 'mydb') + "_backup'\"",
        },
      };

    case 'rrdtool':
      return {
        connection: {
          scheme: 'rrdtool://',
          defaultPort: 0,
          sampleUri: 'rrdtool:///var/lib/rrd/metrics.rrd',
        },
        memoryParams: {
          sharedBufferParam: 'rrdcached -w timeout',
          workMemParam: 'rrdcached -z delay',
          cacheParam: 'rrdcached -f flushtime',
          configFile: 'rrdcached configuration / command line args',
        },
        maintenance: {
          // Doc: https://oss.oetiker.ch/rrdtool/doc/rrdinfo.en.html
          statsCommand: 'rrdtool info /data/{table}.rrd',
          // Doc: https://oss.oetiker.ch/rrdtool/doc/rrdtool.en.html
          spaceReclaimCommand: '-- RRDtool databases use fixed-size circular ring buffers (Round Robin Archives);\n-- Storage never expands beyond initial allocation, no manual reclamation needed.',
          spaceReclaimConcept: 'Fixed-Size Ring Buffer Overwriting (No Compaction Needed)',
          tuningDdlTemplate: (table) => '# Inspect RRDtool Database Header & Consolidation Info\nrrdtool info /data/' + table + '.rrd\n',
        },
        // Doc: https://oss.oetiker.ch/rrdtool/doc/rrdfetch.en.html
        planCommand: 'rrdtool fetch /data/{table}.rrd AVERAGE',
        onlineDdl: {
          // Doc: https://oss.oetiker.ch/rrdtool/doc/rrdcreate.en.html
          createIndexSql: () => '-- RRDtool stores time-series in pre-allocated Round Robin Archives (RRAs); no index DDL.',
          // Doc: https://oss.oetiker.ch/rrdtool/doc/rrdcreate.en.html
          dropIndexSql: () => '-- RRDtool does not support secondary indexes',
          rollbackDropIndexSql: () => '-- No index restoration needed',
          supportsConcurrent: false,
          onlineClause: 'NONE',
        },
        backup: {
          tool: 'rrdtool dump (XML Export)',
          walOrLogName: 'RRD Round Robin Archive (Fixed Size .rrd file)',
          // Doc: https://oss.oetiker.ch/rrdtool/doc/rrddump.en.html
          commandTemplate: (db, path) => 'rrdtool dump /data/' + (db || 'mydb') + '.rrd ' + (path || '/backups') + '/' + (db || 'mydb') + '.xml',
        },
      };

    case 'dolphindb':
      return {
        connection: {
          scheme: 'dolphindb://',
          defaultPort: 8848,
          sampleUri: 'dolphindb://admin:123456@dolphindb.internal:8848',
        },
        memoryParams: {
          sharedBufferParam: 'maxMemSize',
          workMemParam: 'workerNum',
          cacheParam: 'chunkCacheEngineMemSize',
          configFile: 'dolphindb.cfg / cluster.cfg',
        },
        maintenance: {
          // Doc: https://docs.dolphindb.com/en/help/FunctionsandCommands/FunctionReferences/g/getTableStatus.html
          statsCommand: 'getTableStatus("{table}")',
          // Doc: https://docs.dolphindb.com/en/help/FunctionsandCommands/FunctionReferences/c/clearAllCache.html
          spaceReclaimCommand: '-- DolphinDB DFS space is reclaimed by partition chunk management and cache clearing;\npnodeRun(clearAllCache);',
          spaceReclaimConcept: 'DolphinDB DFS Partition Chunk Reclamation & Cache Clearing',
          tuningDdlTemplate: (table) => '// Inspect DolphinDB DFS Table Status\ngetTableStatus("' + table + '");\n',
        },
        // Doc: https://docs.dolphindb.com/en/help/
        planCommand: '// DolphinDB vector query execution inspection;\n// DolphinDB scripts compile directly to vectorized operators',
        onlineDdl: {
          // Doc: https://docs.dolphindb.com/en/help/FunctionsandCommands/FunctionReferences/c/createPartitionedTable.html
          createIndexSql: (idx, tbl, cols) => '-- DolphinDB DFS tables use sorting keys and partition columns rather than traditional B-Tree indexes;\n// Defined via createPartitionedTable(..., sortColumns=[' + splitColumns(cols).map(c => '"' + c + '"').join(', ') + '])',
          // Doc: https://docs.dolphindb.com/en/help/FunctionsandCommands/FunctionReferences/c/createPartitionedTable.html
          dropIndexSql: () => '-- Partitioning and sorting keys are immutable per table definition in DolphinDB',
          rollbackDropIndexSql: () => '-- Recreate table definition with desired sort columns',
          supportsConcurrent: false,
          onlineClause: 'NONE',
        },
        backup: {
          tool: 'DolphinDB backup() / backupDB() Function',
          walOrLogName: 'DolphinDB Redo Log & Raft Transaction Log',
          // Doc: https://docs.dolphindb.com/en/help/FunctionsandCommands/FunctionReferences/b/backup.html
          commandTemplate: (db, path) => 'backup("' + (path || '/backups') + '/' + (db || 'mydb') + '", "dfs://' + (db || 'mydb') + '", true);',
        },
      };

    case 'vespa':
      return {
        connection: {
          scheme: 'vespa://',
          defaultPort: 8080,
          sampleUri: 'vespa://vespa-container.internal:8080/search/',
        },
        memoryParams: {
          sharedBufferParam: 'proton.memory.max_jvm_heap',
          workMemParam: 'vespa.search.num_threads',
          cacheParam: 'attribute.fast-search.cache',
          configFile: 'services.xml / hosts.xml',
        },
        maintenance: {
          // Doc: https://docs.vespa.ai/en/reference/state-v1-api.html
          statsCommand: 'GET /state/v1/metrics',
          // Doc: https://docs.vespa.ai/en/proton.html
          spaceReclaimCommand: '-- Vespa content nodes merge memory and disk indexes automatically;\nvespa-proton-status',
          spaceReclaimConcept: 'Proton Content Node Memory Flush & Disk Compaction',
          tuningDdlTemplate: () => '# Query Vespa State Metrics\ncurl -s "http://localhost:8080/state/v1/metrics"\n',
        },
        // Doc: https://docs.vespa.ai/en/reference/query-api-reference.html#tracelevel
        planCommand: 'POST /search/?yql=select+*+from+{table}+where+true&tracelevel=5',
        onlineDdl: {
          // Doc: https://docs.vespa.ai/en/approximate-nn-hnsw.html
          createIndexSql: (idx, tbl, cols) => '-- Vespa schema defines vector index via HNSW indexing inside schema definition:\n// field ' + splitColumns(cols)[0] + ' type tensor<float>(x[128]) { indexing: attribute | index; index { distance-metric: euclidean; } }',
          // Doc: https://docs.vespa.ai/en/schemas.html
          dropIndexSql: (idx, tbl = '{table}') => '-- Modify schema file (.sd) to remove indexing attributes and redeploy application package for ' + tbl,
          rollbackDropIndexSql: () => '-- Add indexing attributes back to schema file and redeploy application',
          supportsConcurrent: true,
          onlineClause: 'ONLINE',
        },
        backup: {
          tool: 'vespa-visit / Content Node Volume Snapshot',
          walOrLogName: 'Proton Transaction Log (TLS)',
          // Doc: https://docs.vespa.ai/en/operations/backup-restore.html
          commandTemplate: (db, path) => 'vespa-visit --data-destination ' + (path || '/backups') + '/' + (db || 'mydb') + '.json',
        },
      };

    case 'vald':
      return {
        connection: {
          scheme: 'vald://',
          defaultPort: 8080,
          sampleUri: 'vald://vald-lb-gateway.internal:8080',
        },
        memoryParams: {
          sharedBufferParam: 'agent.ngt.auto_index_length',
          workMemParam: 'agent.ngt.creation_edge_size',
          cacheParam: 'agent.ngt.search_edge_size',
          configFile: 'vald-agent-values.yaml / values.yaml',
        },
        maintenance: {
          // Doc: https://vald.vdaas.org/docs/api/index/
          statsCommand: 'GET /index/info',
          // Doc: https://vald.vdaas.org/docs/tutorial/
          spaceReclaimCommand: '-- Vald Agent garbage collects deleted vector indexes via background GC;\nPOST /index/save',
          spaceReclaimConcept: 'NGT Graph Garbage Collection & In-Memory Compaction',
          tuningDdlTemplate: () => '# Check Vald Agent Vector Index Status\ncurl -s "http://localhost:8080/index/info"\n',
        },
        // Doc: https://vald.vdaas.org/docs/api/search/
        planCommand: 'POST /search { "vector": [...], "config": { "num": 10 } }',
        onlineDdl: {
          // Doc: https://vald.vdaas.org/docs/concepts/architecture/
          createIndexSql: () => '-- Vald creates NGT (Neighborhood Graph and Tree) vector indexes dynamically upon Insert/Upsert.',
          // Doc: https://vald.vdaas.org/docs/concepts/architecture/
          dropIndexSql: () => '-- Vector indexes are managed automatically by Vald Agent graph nodes',
          rollbackDropIndexSql: () => '-- Re-insert vectors to populate NGT graph',
          supportsConcurrent: true,
          onlineClause: 'ONLINE',
        },
        backup: {
          tool: 'Vald Agent PVC Snapshot / Object Storage Backup',
          walOrLogName: 'Vald Agent Memory / NGT Persistent Volume',
          // Doc: https://vald.vdaas.org/docs/tutorial/
          commandTemplate: (db) => '# Snapshot Kubernetes PersistentVolumeClaim attached to vald-agent:\nkubectl create volume-snapshot vald-agent-pvc-snap-' + (db || 'mydb'),
        },
      };

    case 'apache_solr':
      return {
        connection: {
          scheme: 'solr://',
          defaultPort: 8983,
          sampleUri: 'solr://solr-node.internal:8983/solr/gettingstarted',
        },
        memoryParams: {
          sharedBufferParam: 'solr.filterCache.size',
          workMemParam: 'solr.queryResultCache.size',
          cacheParam: 'solr.documentCache.size',
          configFile: 'solrconfig.xml / managed-schema.xml',
        },
        maintenance: {
          // Doc: https://solr.apache.org/guide/solr/latest/indexing-guide/mbeans-reporting.html
          statsCommand: 'GET /solr/{table}/admin/mbeans?stats=true',
          // Doc: https://solr.apache.org/guide/solr/latest/indexing-guide/update-request-processors.html
          spaceReclaimCommand: 'POST /solr/{table}/update?optimize=true&waitSearcher=true',
          spaceReclaimConcept: 'Lucene Segment ForceMerge & Tombstone Expunging',
          tuningDdlTemplate: (table) => '# Apache Solr Segment ForceMerge & Sizing\ncurl -X POST "http://localhost:8983/solr/' + table + '/update?optimize=true"\n',
        },
        // Doc: https://solr.apache.org/guide/solr/latest/query-guide/common-query-parameters.html#debug-parameter
        planCommand: 'GET /solr/{table}/select?q=*:*&debug=query',
        onlineDdl: {
          // Doc: https://solr.apache.org/guide/solr/latest/indexing-guide/schema-api.html
          createIndexSql: (idx, tbl, cols) => 'POST /solr/' + tbl + '/schema { "add-field": { "name": "' + splitColumns(cols)[0] + '", "type": "text_general", "stored": true, "indexed": true } }',
          // Doc: https://solr.apache.org/guide/solr/latest/indexing-guide/schema-api.html
          dropIndexSql: (idx, tbl = '{table}', cols = '{col}') => 'POST /solr/' + tbl + '/schema { "delete-field": { "name": "' + splitColumns(cols)[0] + '" } }',
          rollbackDropIndexSql: (idx, tbl = '{table}', cols = '{col}') => 'POST /solr/' + tbl + '/schema { "add-field": { "name": "' + splitColumns(cols)[0] + '", "type": "text_general", "stored": true, "indexed": true } }',
          supportsConcurrent: true,
          onlineClause: 'ONLINE',
        },
        backup: {
          tool: 'Solr Collections API BACKUP / Replication Backup',
          walOrLogName: 'Solr Update Log (uLog) & Lucene Segments',
          // Doc: https://solr.apache.org/guide/solr/latest/deployment-guide/backup-restore.html
          commandTemplate: (db, path) => 'curl "http://localhost:8983/solr/admin/collections?action=BACKUP&name=' + (db || 'mydb') + '_backup&collection=' + (db || 'mydb') + '&location=' + (path || '/backups') + '"',
        },
      };

    case 'meilisearch':
      return {
        connection: {
          scheme: 'meilisearch://',
          defaultPort: 7700,
          sampleUri: 'meilisearch://masterKey@meili-host.internal:7700/indexes/movies',
        },
        memoryParams: {
          sharedBufferParam: '--max-indexing-memory',
          workMemParam: '--max-indexing-threads',
          cacheParam: 'LMDB Map Size & OS Page Cache',
          configFile: '/etc/meilisearch/meilisearch.toml',
        },
        maintenance: {
          // Doc: https://www.meilisearch.com/docs/reference/api/stats
          statsCommand: 'GET /indexes/{table}/stats',
          // Doc: https://www.meilisearch.com/docs/learn/advanced/inner_workings
          spaceReclaimCommand: '-- Meilisearch compacts LMDB environment automatically upon document deletions;\nGET /tasks',
          spaceReclaimConcept: 'LMDB Key-Value Page Compaction',
          tuningDdlTemplate: (table) => '# Query Meilisearch Index Stats for ' + table + '\ncurl -s -H "Authorization: Bearer $KEY" "http://localhost:7700/indexes/' + table + '/stats"\n',
        },
        // Doc: https://www.meilisearch.com/docs/reference/api/search
        planCommand: 'POST /indexes/{table}/search { "q": "<QUERY>", "showRankingScoreDetails": true }',
        onlineDdl: {
          // Doc: https://www.meilisearch.com/docs/reference/api/settings#filterable-attributes
          createIndexSql: (idx, tbl, cols) => 'PUT /indexes/' + tbl + '/settings/filterable-attributes [' + splitColumns(cols).map(c => '"' + c + '"').join(', ') + ']',
          // Doc: https://www.meilisearch.com/docs/reference/api/settings#reset-filterable-attributes
          dropIndexSql: (idx, tbl = '{table}') => 'PUT /indexes/' + tbl + '/settings/filterable-attributes []',
          rollbackDropIndexSql: (idx, tbl = '{table}', cols) => 'PUT /indexes/' + tbl + '/settings/filterable-attributes [' + splitColumns(cols).map(c => '"' + c + '"').join(', ') + ']',
          supportsConcurrent: true,
          onlineClause: 'ONLINE',
        },
        backup: {
          tool: 'Meilisearch Dump API / Snapshot',
          walOrLogName: 'LMDB Environment & Update Queue',
          // Doc: https://www.meilisearch.com/docs/reference/api/dumps
          commandTemplate: () => 'curl -X POST "http://localhost:7700/dumps"',
        },
      };

    case 'typesense':
      return {
        connection: {
          scheme: 'typesense://',
          defaultPort: 8108,
          sampleUri: 'typesense://xyz:password@typesense.internal:8108',
        },
        memoryParams: {
          sharedBufferParam: 'typesense-server --cache-memory-mb',
          workMemParam: 'typesense-server --num-threads',
          cacheParam: 'typesense-server --memory-limit-mb',
          configFile: '/etc/typesense/typesense-server.ini',
        },
        maintenance: {
          // Doc: https://typesense.org/docs/latest/api/cluster-operations.html#stats
          statsCommand: 'GET /stats.json',
          // Doc: https://typesense.org/docs/guide/system-architecture.html
          spaceReclaimCommand: '-- Typesense reclaims memory automatically during segment indexing and garbage collection;\nGET /health',
          spaceReclaimConcept: 'In-Memory Index Compaction & Raft Log Pruning',
          tuningDdlTemplate: () => '# Query Typesense Cluster Stats & Sizing\ncurl -s -H "X-TYPESENSE-API-KEY: $KEY" "http://localhost:8108/stats.json"\n',
        },
        // Doc: https://typesense.org/docs/latest/api/search.html
        planCommand: 'GET /collections/{table}/documents/search?q=<QUERY>&explain=true',
        onlineDdl: {
          // Doc: https://typesense.org/docs/latest/api/collections.html#update-a-collection
          createIndexSql: (idx, tbl, cols) => 'PATCH /collections/' + tbl + ' { "fields": [' + splitColumns(cols).map(c => '{"name": "' + c + '", "type": "string", "facet": true}').join(', ') + '] }',
          // Doc: https://typesense.org/docs/latest/api/collections.html#update-a-collection
          dropIndexSql: (idx, tbl = '{table}', cols = '{col}') => 'PATCH /collections/' + tbl + ' { "fields": [' + splitColumns(cols).map(c => '{"name": "' + c + '", "drop": true}').join(', ') + '] }',
          rollbackDropIndexSql: (idx, tbl = '{table}', cols = '{col}') => 'PATCH /collections/' + tbl + ' { "fields": [' + splitColumns(cols).map(c => '{"name": "' + c + '", "type": "string", "facet": true}').join(', ') + '] }',
          supportsConcurrent: true,
          onlineClause: 'ONLINE',
        },
        backup: {
          tool: 'Typesense Snapshot API',
          walOrLogName: 'Typesense Raft Log & RocksDB Storage',
          // Doc: https://typesense.org/docs/latest/api/cluster-operations.html#take-a-db-snapshot
          commandTemplate: (db, path) => 'curl -X POST "http://localhost:8108/operations/snapshot?snapshot_path=' + (path || '/backups') + '/' + (db || 'mydb') + '_snapshot"',
        },
      };

    case 'couchdb':
      return {
        connection: {
          scheme: 'couchdb://',
          defaultPort: 5984,
          sampleUri: 'couchdb://admin:password@couchdb.internal:5984/mydb',
        },
        memoryParams: {
          sharedBufferParam: 'couchdb.database_dir',
          workMemParam: 'couchdb.max_dbs_open',
          cacheParam: 'couchdb.os_process_timeout',
          configFile: '/opt/couchdb/etc/local.ini',
        },
        maintenance: {
          // Doc: https://docs.couchdb.org/en/stable/api/database/common.html#get--db
          statsCommand: 'GET /{table}',
          // Doc: https://docs.couchdb.org/en/stable/api/database/compact.html
          spaceReclaimCommand: 'POST /{table}/_compact',
          spaceReclaimConcept: 'Append-Only B-Tree File Compaction',
          tuningDdlTemplate: (table) => '# Trigger CouchDB Database Compaction\ncurl -X POST -H "Content-Type: application/json" "http://localhost:5984/' + table + '/_compact"\n',
        },
        // Doc: https://docs.couchdb.org/en/stable/api/database/find.html#db-explain
        planCommand: 'POST /{table}/_explain { "selector": { "_id": { "$gt": null } } }',
        onlineDdl: {
          // Doc: https://docs.couchdb.org/en/stable/api/database/find.html#db-index
          createIndexSql: (idx, tbl, cols) => 'POST /' + tbl + '/_index { "index": { "fields": [' + splitColumns(cols).map(c => '"' + c + '"').join(', ') + '] }, "name": "' + idx + '" }',
          // Doc: https://docs.couchdb.org/en/stable/api/database/find.html#delete-an-index
          dropIndexSql: (idx, tbl = '{table}') => 'DELETE /' + tbl + '/_index/_design/idx_' + idx + '/json/' + idx,
          rollbackDropIndexSql: (idx, tbl = '{table}', cols) => 'POST /' + tbl + '/_index { "index": { "fields": [' + splitColumns(cols).map(c => '"' + c + '"').join(', ') + '] }, "name": "' + idx + '" }',
          supportsConcurrent: true,
          onlineClause: 'ONLINE',
        },
        backup: {
          tool: 'CouchDB Continuous Replication / File Snapshot',
          walOrLogName: 'Append-Only Document File (.couch files)',
          // Doc: https://docs.couchdb.org/en/stable/maintenance/backups.html
          commandTemplate: (db) => 'curl -X POST http://localhost:5984/_replicate -H "Content-Type: application/json" -d \'{"source":"' + (db || 'mydb') + '","target":"' + (db || 'mydb') + '_backup","create_target":true}\'',
        },
      };

    case 'rethinkdb':
      return {
        connection: {
          scheme: 'rethinkdb://',
          defaultPort: 28015,
          sampleUri: 'rethinkdb://admin:password@rethinkdb.internal:28015/mydb',
        },
        memoryParams: {
          sharedBufferParam: 'rethinkdb --cache-size',
          workMemParam: 'rethinkdb --io-threads',
          cacheParam: 'B-Tree Page Cache',
          configFile: '/etc/rethinkdb/instances.d/default.conf',
        },
        maintenance: {
          // Doc: https://rethinkdb.com/api/javascript/status/
          statsCommand: "r.table('{table}').status()",
          // Doc: https://rethinkdb.com/docs/architecture/
          spaceReclaimCommand: "-- RethinkDB uses a custom B-Tree storage engine that automatically recycles deleted block pages;\nr.table('{table}').reconfigure({shards: 1, replicas: 1})",
          spaceReclaimConcept: 'Log-Structured B-Tree Block Recycling',
          tuningDdlTemplate: (table) => '// RethinkDB Table Status & Sizing\nr.table("' + table + '").status();\n',
        },
        // Doc: https://rethinkdb.com/api/javascript/run/
        planCommand: "r.table('{table}').filter({}).run(conn, {profile: true})",
        onlineDdl: {
          // Doc: https://rethinkdb.com/api/javascript/index_create/
          createIndexSql: (idx, tbl, cols) => "r.table('" + tbl + "').indexCreate('" + idx + "', [" + splitColumns(cols).map(c => "r.row('" + c + "')").join(', ') + "])",
          // Doc: https://rethinkdb.com/api/javascript/index_drop/
          dropIndexSql: (idx, tbl = '{table}') => "r.table('" + tbl + "').indexDrop('" + idx + "')",
          rollbackDropIndexSql: (idx, tbl = '{table}', cols) => "r.table('" + tbl + "').indexCreate('" + idx + "', [" + splitColumns(cols).map(c => "r.row('" + c + "')").join(', ') + "])",
          supportsConcurrent: true,
          onlineClause: 'ONLINE',
        },
        backup: {
          tool: 'rethinkdb dump',
          walOrLogName: 'RethinkDB Log-Structured Storage Files',
          // Doc: https://rethinkdb.com/docs/backup/
          commandTemplate: (db, path) => 'rethinkdb dump -c localhost:28015 -f ' + (path || '/backups') + '/' + (db || 'mydb') + '_backup.tar.gz',
        },
      };

    case 'ravendb':
      return {
        connection: {
          scheme: 'ravendb://',
          defaultPort: 8080,
          sampleUri: 'ravendb://ravendb-server.internal:8080/databases/Northwind',
        },
        memoryParams: {
          sharedBufferParam: 'Storage.MaxMemoryMappedWorkingSetMB',
          workMemParam: 'Indexing.MaxTimeForDocumentTransactionToRemainOpenInSec',
          cacheParam: 'Memory.LowMemoryCommitLimitInMb',
          configFile: 'settings.json',
        },
        maintenance: {
          // Doc: https://ravendb.net/docs/article-page/6.0/csharp/client-api/operations/maintenance/database-stats
          statsCommand: 'GET /databases/{table}/stats',
          // Doc: https://ravendb.net/docs/article-page/6.0/csharp/server/storage/compaction
          spaceReclaimCommand: 'POST /databases/{table}/compact',
          spaceReclaimConcept: 'Voron Storage Engine Data & Tree Compaction',
          tuningDdlTemplate: (table) => '# Query RavenDB Database Stats\ncurl -s "http://localhost:8080/databases/' + table + '/stats"\n',
        },
        // Doc: https://ravendb.net/docs/article-page/6.0/csharp/indexes/querying/explain-scores
        planCommand: 'GET /databases/{table}/queries?query=from+{table}&explain=true',
        onlineDdl: {
          // Doc: https://ravendb.net/docs/article-page/6.0/csharp/indexes/creating-and-deploying
          createIndexSql: (idx, tbl, cols) => 'PUT /databases/' + tbl + '/indexes/' + idx + ' { "Maps": ["from doc in docs.' + tbl + ' select new { ' + splitColumns(cols).map(c => 'doc.' + c).join(', ') + ' }"] }',
          // Doc: https://ravendb.net/docs/article-page/6.0/csharp/indexes/creating-and-deploying
          dropIndexSql: (idx, tbl = '{table}') => 'DELETE /databases/' + tbl + '/indexes/' + idx,
          rollbackDropIndexSql: (idx, tbl = '{table}', cols) => 'PUT /databases/' + tbl + '/indexes/' + idx + ' { "Maps": ["from doc in docs.' + tbl + ' select new { ' + splitColumns(cols).map(c => 'doc.' + c).join(', ') + ' }"] }',
          supportsConcurrent: true,
          onlineClause: 'ONLINE',
        },
        backup: {
          tool: 'RavenDB Periodic Backup API / ravendb-backup',
          walOrLogName: 'Voron Journal (Journal.voron files)',
          // Doc: https://ravendb.net/docs/article-page/6.0/csharp/server/backup/periodic-backup
          commandTemplate: (db, path) => 'curl -X POST "http://localhost:8080/databases/' + (db || 'mydb') + '/admin/backup/database" -H "Content-Type: application/json" -d \'{"BackupType":"Full","OutputDir":"' + (path || '/backups') + '"}\'',
        },
      };

    case 'apache_accumulo':
      return {
        connection: {
          scheme: 'accumulo://',
          defaultPort: 9995,
          sampleUri: 'accumulo://instance_name@zookeeper.internal:2181/mytable',
        },
        memoryParams: {
          sharedBufferParam: 'tserver.memory.maps.max',
          workMemParam: 'tserver.scan.max.wait',
          cacheParam: 'tserver.cache.data.size',
          configFile: 'accumulo.properties',
        },
        maintenance: {
          // Doc: https://accumulo.apache.org/docs/2.x/administration/monitoring-metrics
          statsCommand: 'accumulo shell -u root -e "table {table}; getauths"',
          // Doc: https://accumulo.apache.org/docs/2.x/getting-started/table_configuration#compaction
          spaceReclaimCommand: 'accumulo shell -u root -e "compact -t {table}"',
          spaceReclaimConcept: 'Accumulo Major Compaction of Tablet Files',
          tuningDdlTemplate: (table) => '# Accumulo Shell Tablet Major Compaction\naccumulo shell -u root -e "compact -t ' + table + '"\n',
        },
        // Doc: https://accumulo.apache.org/docs/2.x/getting-started/clients#scanning-data
        planCommand: 'accumulo shell -u root -e "table {table}; scan"',
        onlineDdl: {
          // Doc: https://accumulo.apache.org/docs/2.x/development/iterators
          createIndexSql: () => '-- Accumulo organizes data into Key-Value tuples with Column Family/Column Qualifier/Column Visibility;\n-- Secondary indexing is achieved using indexing iterators or sharded index tables.',
          // Doc: https://accumulo.apache.org/docs/2.x/development/iterators
          dropIndexSql: (idx, tbl = '{table}') => '-- Secondary index iterators are detached via table config: config -t ' + tbl + ' -d table.iterator.scan.' + idx,
          rollbackDropIndexSql: () => '-- Re-attach index iterator via table configuration',
          supportsConcurrent: true,
          onlineClause: 'ONLINE',
        },
        backup: {
          tool: 'Accumulo Table Clone / Export & HDFS DistCp',
          walOrLogName: 'Accumulo TabletServer Write-Ahead Log (WAL)',
          // Doc: https://accumulo.apache.org/docs/2.x/administration/table-management#cloning-tables
          commandTemplate: (db) => 'accumulo shell -u root -e "clonetable ' + (db || 'mydb') + ' ' + (db || 'mydb') + '_backup"',
        },
      };

    default:
      return null;
  }
}

