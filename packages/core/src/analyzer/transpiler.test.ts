import { SqlTranspiler } from './transpiler';

describe('SqlTranspiler Engine & Dialect Conversion Tests', () => {
  const transpiler = new SqlTranspiler();

  describe('1. Oracle to PostgreSQL Dialect Transformations', () => {
    test('transpiles Oracle DDL types to PostgreSQL native equivalents', () => {
      const oracleDdl = `
        CREATE TABLE accounts (
          id NUMBER(12) PRIMARY KEY,
          account_number VARCHAR2(32) NOT NULL,
          balance NUMBER(18, 4) DEFAULT 0,
          description CLOB,
          avatar BLOB,
          created_at DATE DEFAULT SYSDATE
        );
      `;

      const res = transpiler.transpile({
        sourceEngine: 'oracle',
        targetEngine: 'postgres',
        sourceCode: oracleDdl,
      });

      expect(res.transpiledCode).toContain('BIGINT');
      expect(res.transpiledCode).toContain('VARCHAR(32)');
      expect(res.transpiledCode).toContain('NUMERIC(18, 4)');
      expect(res.transpiledCode).toContain('TEXT');
      expect(res.transpiledCode).toContain('BYTEA');
      expect(res.transpiledCode).toContain('TIMESTAMP(0)');
      expect(res.transpiledCode).toContain('CURRENT_TIMESTAMP');
      expect(res.dataTypeMappings.length).toBeGreaterThanOrEqual(5);
    });

    test('replaces Oracle ROWNUM filtering with PostgreSQL LIMIT clause', () => {
      const oracleQuery = `
        SELECT account_number, balance
        FROM accounts
        WHERE status = 'ACTIVE' AND ROWNUM <= 25;
      `;

      const res = transpiler.transpile({
        sourceEngine: 'oracle',
        targetEngine: 'postgres',
        sourceCode: oracleQuery,
      });

      expect(res.transpiledCode).not.toContain('ROWNUM');
      expect(res.transpiledCode).toContain('LIMIT 25');
      expect(res.optimizationsApplied.length).toBeGreaterThan(0);
    });

    test('replaces Oracle NVL and DUAL with standard ANSI COALESCE', () => {
      const oracleSql = 'SELECT NVL(nickname, first_name) FROM DUAL;';

      const res = transpiler.transpile({
        sourceEngine: 'oracle',
        targetEngine: 'postgres',
        sourceCode: oracleSql,
      });

      expect(res.transpiledCode).toContain('COALESCE(');
      expect(res.transpiledCode).not.toContain('FROM DUAL');
    });
  });

  describe('2. Microsoft SQL Server (T-SQL) to PostgreSQL Transformations', () => {
    test('transpiles MSSQL data types and bracket identifiers to PostgreSQL', () => {
      const mssqlDdl = `
        CREATE TABLE [dbo].[transactions] (
          [transaction_id] UNIQUEIDENTIFIER NOT NULL,
          [is_settled] BIT DEFAULT 0,
          [notes] NVARCHAR(MAX),
          [created_at] DATETIME2
        );
      `;

      const res = transpiler.transpile({
        sourceEngine: 'microsoft_sql_server',
        targetEngine: 'postgres',
        sourceCode: mssqlDdl,
      });

      expect(res.transpiledCode).toContain('"transaction_id" UUID');
      expect(res.transpiledCode).toContain('"is_settled" BOOLEAN');
      expect(res.transpiledCode).toContain('"notes" TEXT');
      expect(res.transpiledCode).toContain('"created_at" TIMESTAMPTZ');
    });

    test('converts SELECT TOP N, ISNULL, GETDATE(), and LEN() to PostgreSQL', () => {
      const mssqlQuery = `
        SELECT TOP 50 [user_id], ISNULL([nickname], 'Anonymous'), LEN([user_id])
        FROM [users]
        WHERE [last_login] < GETDATE();
      `;

      const res = transpiler.transpile({
        sourceEngine: 'mssql',
        targetEngine: 'postgres',
        sourceCode: mssqlQuery,
      });

      expect(res.transpiledCode).not.toContain('TOP 50');
      expect(res.transpiledCode).toContain('LIMIT 50');
      expect(res.transpiledCode).toContain('COALESCE(');
      expect(res.transpiledCode).toContain('NOW()');
      expect(res.transpiledCode).toContain('LENGTH(');
    });
  });

  describe('3. MySQL to PostgreSQL & Columnar Transformations', () => {
    test('transpiles MySQL AUTO_INCREMENT, backticks, and JSON to PostgreSQL JSONB', () => {
      const mysqlDdl = `
        CREATE TABLE \`events\` (
          \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
          \`is_active\` TINYINT(1) DEFAULT 1,
          \`metadata\` JSON,
          \`body\` LONGTEXT
        );
      `;

      const res = transpiler.transpile({
        sourceEngine: 'mysql',
        targetEngine: 'postgres',
        sourceCode: mysqlDdl,
      });

      expect(res.transpiledCode).toContain('"id" BIGSERIAL');
      expect(res.transpiledCode).toContain('"is_active" BOOLEAN');
      expect(res.transpiledCode).toContain('"metadata" JSONB');
      expect(res.transpiledCode).toContain('"body" TEXT');
    });

    test('transpiles MySQL to ClickHouse OLAP schema with table engine', () => {
      const mysqlDdl = `
        CREATE TABLE metrics (
          id INT AUTO_INCREMENT PRIMARY KEY,
          event_name VARCHAR(100),
          recorded_at DATETIME
        );
      `;

      const res = transpiler.transpile({
        sourceEngine: 'mysql',
        targetEngine: 'clickhouse',
        sourceCode: mysqlDdl,
      });

      expect(res.transpiledCode).toContain('UInt64');
      expect(res.transpiledCode).toContain('String');
      expect(res.transpiledCode).toContain('DateTime64');
      expect(res.transpiledCode).toContain('ENGINE = ReplacingMergeTree()');
      expect(res.caveats.some((c) => c.category === 'transaction')).toBe(true);
    });
  });

  describe('4. PostgreSQL to Snowflake Cloud Data Warehouse', () => {
    test('transpiles PostgreSQL JSONB and SERIAL to Snowflake VARIANT and AUTOINCREMENT', () => {
      const postgresDdl = `
        CREATE TABLE event_store (
          id BIGSERIAL PRIMARY KEY,
          payload JSONB,
          binary_data BYTEA
        );
      `;

      const res = transpiler.transpile({
        sourceEngine: 'postgres',
        targetEngine: 'snowflake',
        sourceCode: postgresDdl,
      });

      expect(res.transpiledCode).toContain('NUMBER AUTOINCREMENT');
      expect(res.transpiledCode).toContain('VARIANT');
      expect(res.transpiledCode).toContain('BINARY');
    });
  });

  describe('5. Polyglot Document, Vector, and Graph Transpilation', () => {
    test('transpiles MongoDB MQL find query into PostgreSQL SQL query', () => {
      const mql = 'db.customers.find({ status: "active", age: { $gte: 18 } });';

      const res = transpiler.transpile({
        sourceEngine: 'mongodb',
        targetEngine: 'postgres',
        sourceCode: mql,
      });

      expect(res.transpiledCode).toContain('SELECT *');
      expect(res.transpiledCode).toContain('FROM customers');
      expect(res.dataTypeMappings.length).toBeGreaterThanOrEqual(2);
    });

    test('transpiles Relational SQL into MongoDB Aggregation Pipeline', () => {
      const sql = 'SELECT * FROM orders WHERE status = "completed" ORDER BY createdAt DESC LIMIT 50;';

      const res = transpiler.transpile({
        sourceEngine: 'postgres',
        targetEngine: 'mongodb',
        sourceCode: sql,
      });

      expect(res.transpiledCode).toContain('db.orders.aggregate');
      expect(res.transpiledCode).toContain('$match');
      expect(res.transpiledCode).toContain('$sort');
      expect(res.transpiledCode).toContain('$limit');
    });

    test('generates Milvus / Pinecone Python & JS SDK requests for vector search targets', () => {
      const sql = 'SELECT id, embedding FROM articles;';

      const milvusRes = transpiler.transpile({
        sourceEngine: 'postgres',
        targetEngine: 'milvus',
        sourceCode: sql,
      });

      expect(milvusRes.transpiledCode).toContain('from pymilvus import Collection');
      expect(milvusRes.transpiledCode).toContain('search_params');

      const pineconeRes = transpiler.transpile({
        sourceEngine: 'postgres',
        targetEngine: 'pinecone',
        sourceCode: sql,
      });

      expect(pineconeRes.transpiledCode).toContain('@pinecone-database/pinecone');
      expect(pineconeRes.transpiledCode).toContain('index.query');
    });

    test('transpiles relational hierarchy into Neo4j Cypher graph traversal', () => {
      const sql = 'SELECT * FROM users JOIN orders ON users.id = orders.user_id;';

      const cypherRes = transpiler.transpile({
        sourceEngine: 'postgres',
        targetEngine: 'neo4j',
        sourceCode: sql,
      });

      expect(cypherRes.transpiledCode).toContain('MATCH (u:User)-[r:PLACED]->(o:users)');
      expect(cypherRes.transpiledCode).toContain('RETURN');
    });
  });

  describe('6. Oracle to Apache Hive & Analytics Warehouse Transformations', () => {
    test('transpiles Oracle DDL and query with ROWNUM and SYSDATE to Apache Hive', () => {
      const oracleCode = `
        -- Oracle DDL & Query Sample
        CREATE TABLE customer_orders (
          order_id NUMBER(10) PRIMARY KEY,
          customer_name VARCHAR2(255) NOT NULL,
          order_total NUMBER(12, 2),
          order_date DATE DEFAULT SYSDATE,
          order_notes CLOB
        );

        SELECT 
          customer_name, 
          NVL(order_total, 0) AS total_amount,
          SYSDATE AS extracted_at
        FROM customer_orders
        WHERE ROWNUM <= 10;
      `;

      const res = transpiler.transpile({
        sourceEngine: 'mysql', // Even if user accidentally selected MySQL as source
        targetEngine: 'apache_hive',
        sourceCode: oracleCode,
      });

      expect(res.transpiledCode).toContain('order_id BIGINT');
      expect(res.transpiledCode).toContain('customer_name STRING');
      expect(res.transpiledCode).toContain('order_total DECIMAL(12, 2)');
      expect(res.transpiledCode).toContain('order_date TIMESTAMP');
      expect(res.transpiledCode).toContain('order_notes STRING');
      expect(res.transpiledCode).toContain('STORED AS ORC');
      expect(res.transpiledCode).toContain('COALESCE(');
      expect(res.transpiledCode).toContain('CURRENT_TIMESTAMP()');
      expect(res.transpiledCode).toContain('LIMIT 10');
      expect(res.transpiledCode).not.toContain('ROWNUM');
    });
  });

  describe('7. Polyglot Category Transpilation (Key-Value, Wide-Column, Time-Series, Search, Streaming)', () => {
    test('transpiles SQL to RedisJSON & RediSearch secondary index query', () => {
      const sql = 'SELECT id, name, status FROM users WHERE status = "active" LIMIT 20;';
      const res = transpiler.transpile({
        sourceEngine: 'postgres',
        targetEngine: 'redis',
        sourceCode: sql,
      });

      expect(res.transpiledCode).toContain('FT.SEARCH');
      expect(res.transpiledCode).toContain('@status:{active}');
    });

    test('transpiles SQL to AWS DynamoDB ExecuteStatement & Table definition', () => {
      const sql = 'SELECT id, status FROM customer_orders WHERE status = "active" LIMIT 25;';
      const res = transpiler.transpile({
        sourceEngine: 'mysql',
        targetEngine: 'amazon_dynamodb',
        sourceCode: sql,
      });

      expect(res.transpiledCode).toContain('ExecuteStatementCommand');
      expect(res.transpiledCode).toContain('customer_orders');
    });

    test('transpiles SQL to Cassandra CQL with Partition and Clustering keys', () => {
      const sql = 'CREATE TABLE orders ( id UUID PRIMARY KEY, customer_id UUID, status VARCHAR(20), created_at TIMESTAMP );';
      const res = transpiler.transpile({
        sourceEngine: 'postgres',
        targetEngine: 'cassandra',
        sourceCode: sql,
      });

      expect(res.transpiledCode).toContain('CREATE KEYSPACE');
      expect(res.transpiledCode).toContain('PRIMARY KEY ((partition_id), created_at)');
    });

    test('transpiles SQL to InfluxDB Flux time-series window query', () => {
      const sql = 'SELECT date_trunc(\'hour\', created_at), AVG(val) FROM metrics WHERE status = "active" GROUP BY 1;';
      const res = transpiler.transpile({
        sourceEngine: 'postgres',
        targetEngine: 'influxdb',
        sourceCode: sql,
      });

      expect(res.transpiledCode).toContain('from(bucket: "metrics")');
      expect(res.transpiledCode).toContain('aggregateWindow');
    });

    test('transpiles SQL to Elasticsearch Query DSL with bool filter and sort', () => {
      const sql = 'SELECT id, name, status FROM products WHERE status = "active" ORDER BY created_at DESC LIMIT 10;';
      const res = transpiler.transpile({
        sourceEngine: 'mysql',
        targetEngine: 'elasticsearch',
        sourceCode: sql,
      });

      expect(res.transpiledCode).toContain('POST /products/_search');
      expect(res.transpiledCode).toContain('"bool"');
      expect(res.transpiledCode).toContain('"filter"');
    });

    test('transpiles SQL to Apache Kafka ksqlDB tumbling window stream', () => {
      const sql = 'SELECT user_id, count(*) FROM click_events GROUP BY user_id;';
      const res = transpiler.transpile({
        sourceEngine: 'postgres',
        targetEngine: 'apache_kafka',
        sourceCode: sql,
      });

      expect(res.transpiledCode).toContain('CREATE STREAM');
      expect(res.transpiledCode).toContain('WINDOW TUMBLING');
      expect(res.transpiledCode).toContain('EMIT CHANGES');
    });
  });

  describe('8. Bidirectional Multi-Dialect Reverse Transformations', () => {
    test('transpiles MySQL DDL & Query to Oracle with IDENTITY, VARCHAR2, CLOB, NVL, and FETCH FIRST', () => {
      const mysqlCode = `
        CREATE TABLE \`customer_orders\` (
          \`order_id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`customer_name\` VARCHAR(255) NOT NULL,
          \`order_total\` DECIMAL(12, 2),
          \`order_date\` DATETIME DEFAULT CURRENT_TIMESTAMP,
          \`order_notes\` LONGTEXT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        SELECT 
          \`customer_name\`, 
          IFNULL(\`order_total\`, 0) AS total_amount,
          NOW() AS extracted_at
        FROM \`customer_orders\`
        LIMIT 10;
      `;

      const res = transpiler.transpile({
        sourceEngine: 'mysql',
        targetEngine: 'oracle',
        sourceCode: mysqlCode,
      });

      expect(res.transpiledCode).toContain('NUMBER(10) GENERATED ALWAYS AS IDENTITY');
      expect(res.transpiledCode).toContain('VARCHAR2(255)');
      expect(res.transpiledCode).toContain('NUMBER(12, 2)');
      expect(res.transpiledCode).toContain('TIMESTAMP(0)');
      expect(res.transpiledCode).toContain('CLOB');
      expect(res.transpiledCode).not.toContain('ENGINE=InnoDB');
      expect(res.transpiledCode).toContain('NVL(');
      expect(res.transpiledCode).toContain('SYSDATE');
      expect(res.transpiledCode).toContain('FETCH FIRST 10 ROWS ONLY;');
      expect(res.transpiledCode).not.toContain('LIMIT 10');
    });

    test('transpiles PostgreSQL to Oracle with NUMBER(19) IDENTITY, TIMESTAMP WITH TIME ZONE, and CLOB', () => {
      const pgCode = `
        CREATE TABLE customer_orders (
          order_id BIGSERIAL PRIMARY KEY,
          customer_name VARCHAR(255) NOT NULL,
          order_notes TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        SELECT customer_name FROM customer_orders LIMIT 20;
      `;

      const res = transpiler.transpile({
        sourceEngine: 'postgres',
        targetEngine: 'oracle',
        sourceCode: pgCode,
      });

      expect(res.transpiledCode).toContain('NUMBER(19) GENERATED ALWAYS AS IDENTITY');
      expect(res.transpiledCode).toContain('VARCHAR2(255)');
      expect(res.transpiledCode).toContain('CLOB');
      expect(res.transpiledCode).toContain('TIMESTAMP WITH TIME ZONE');
      expect(res.transpiledCode).toContain('FETCH FIRST 20 ROWS ONLY;');
    });

    test('transpiles PostgreSQL to Microsoft SQL Server with TOP, IDENTITY, and NVARCHAR(MAX)', () => {
      const pgCode = `
        CREATE TABLE customer_orders (
          order_id BIGSERIAL PRIMARY KEY,
          customer_name VARCHAR(255) NOT NULL,
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        SELECT customer_name, CURRENT_TIMESTAMP FROM customer_orders LIMIT 15;
      `;

      const res = transpiler.transpile({
        sourceEngine: 'postgres',
        targetEngine: 'microsoft_sql_server',
        sourceCode: pgCode,
      });

      expect(res.transpiledCode).toContain('BIGINT IDENTITY(1,1)');
      expect(res.transpiledCode).toContain('NVARCHAR(255)');
      expect(res.transpiledCode).toContain('NVARCHAR(MAX)');
      expect(res.transpiledCode).toContain('DATETIMEOFFSET DEFAULT GETDATE()');
      expect(res.transpiledCode).toContain('SELECT TOP 15');
      expect(res.transpiledCode).not.toContain('LIMIT 15');
    });

    test('transpiles SQL Server to PostgreSQL stripping dbo and converting brackets and types', () => {
      const mssqlCode = `
        CREATE TABLE [dbo].[customer_orders] (
          [order_id] INT IDENTITY(1,1) PRIMARY KEY,
          [customer_name] NVARCHAR(255) NOT NULL,
          [order_notes] NVARCHAR(MAX)
        );

        SELECT TOP 10 [customer_name], GETDATE() AS now_time
        FROM [dbo].[customer_orders];
      `;

      const res = transpiler.transpile({
        sourceEngine: 'microsoft_sql_server',
        targetEngine: 'postgres',
        sourceCode: mssqlCode,
      });

      expect(res.transpiledCode).toContain('"customer_orders"');
      expect(res.transpiledCode).not.toContain('"dbo"');
      expect(res.transpiledCode).toContain('"order_id" SERIAL PRIMARY KEY');
      expect(res.transpiledCode).toContain('"customer_name" VARCHAR(255)');
      expect(res.transpiledCode).toContain('"order_notes" TEXT');
      expect(res.transpiledCode).toContain('NOW()');
      expect(res.transpiledCode).toContain('LIMIT 10');
      expect(res.transpiledCode).not.toContain('TOP 10');
    });

    test('transpiles Cassandra wide-column CQL into Relational SQL', () => {
      const cql = `
        CREATE TABLE store.customer_orders (
          order_id uuid,
          customer_name text,
          order_total decimal,
          PRIMARY KEY (order_id)
        );
      `;

      const res = transpiler.transpile({
        sourceEngine: 'cassandra',
        targetEngine: 'postgres',
        sourceCode: cql,
      });

      expect(res.transpiledCode).toContain('CREATE TABLE customer_orders');
      expect(res.transpiledCode).toContain('PRIMARY KEY');
      expect(res.dataTypeMappings.length).toBeGreaterThan(0);
    });

    test('transpiles Redis key-value FT.SEARCH into Relational SQL', () => {
      const redisCmd = 'FT.SEARCH idx:customer_orders "@status:{active}" RETURN 2 customer_name order_total LIMIT 0 10;';

      const res = transpiler.transpile({
        sourceEngine: 'redis',
        targetEngine: 'postgres',
        sourceCode: redisCmd,
      });

      expect(res.transpiledCode).toContain('SELECT customer_name, order_total');
      expect(res.transpiledCode).toContain('FROM customer_orders');
      expect(res.transpiledCode).toContain("status = 'active'");
    });
  });
});
