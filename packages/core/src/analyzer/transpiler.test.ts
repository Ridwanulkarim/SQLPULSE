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

      expect(cypherRes.transpiledCode).toContain('MATCH (u:User)-[r:PURCHASED]->(p:Product)');
      expect(cypherRes.transpiledCode).toContain('RETURN');
    });
  });
});
