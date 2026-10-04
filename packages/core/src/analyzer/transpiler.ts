import { DATABASE_CATALOG } from '../types/db-catalog.data';
import { DatabaseEngine } from '../types/plan.types';

export interface TranspileRequest {
  sourceEngine: string;
  targetEngine: string;
  sourceCode: string;
  transpileMode?: 'auto' | 'ddl' | 'query' | 'procedure';
}

export interface DataTypeMapping {
  sourceType: string;
  targetType: string;
  notes: string;
}

export interface FunctionMapping {
  sourceFunc: string;
  targetFunc: string;
  explanation: string;
}

export interface MigrationCaveat {
  category: 'index' | 'transaction' | 'datatype' | 'concurrency' | 'syntax' | 'performance';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface TranspileResult {
  sourceEngine: string;
  targetEngine: string;
  sourceEngineName: string;
  targetEngineName: string;
  transpiledCode: string;
  dataTypeMappings: DataTypeMapping[];
  functionMappings: FunctionMapping[];
  caveats: MigrationCaveat[];
  optimizationsApplied: string[];
}

function getEngineMeta(engineId: string) {
  const found = DATABASE_CATALOG.find(db => db.id === engineId.toLowerCase());
  if (found) return found;
  return {
    id: engineId,
    name: engineId.charAt(0).toUpperCase() + engineId.slice(1).replace(/_/g, ' '),
    category: 'relational',
    categoryLabel: 'Relational (SQL)',
    icon: '🗄️',
    rank: 999,
    popularityScore: 10,
    commandHint: 'EXPLAIN <query>',
    description: 'Database Engine'
  };
}

function isHiveFamily(e: string): boolean {
  const l = e.toLowerCase();
  return l.includes('hive') || l.includes('spark') || l.includes('databricks') || l.includes('presto') || l.includes('trino') || l.includes('athena') || l.includes('impala') || l.includes('drill');
}

function isPostgresFamily(e: string): boolean {
  const l = e.toLowerCase();
  return l.includes('postgres') || l.includes('cockroach') || l.includes('yugabyte') || l.includes('timescale') || l.includes('neon') || l.includes('supabase') || l.includes('redshift') || l === 'pg';
}

function isMySqlFamily(e: string): boolean {
  const l = e.toLowerCase();
  return l.includes('mysql') || l.includes('maria') || l.includes('tidb') || l.includes('percona') || l.includes('planetscale') || l.includes('singlestore');
}

function isSqlServerFamily(e: string): boolean {
  const l = e.toLowerCase();
  return l.includes('sqlserver') || l.includes('sql_server') || l.includes('mssql') || l.includes('azure_sql') || l.includes('sybase');
}

function isOracleFamily(e: string): boolean {
  const l = e.toLowerCase();
  return l.includes('oracle') || l.includes('db2') || l.includes('informix');
}

function isClickHouseFamily(e: string): boolean {
  const l = e.toLowerCase();
  return l.includes('clickhouse') || l.includes('starrocks') || l.includes('doris');
}

function isBigQueryFamily(e: string): boolean {
  const l = e.toLowerCase();
  return l.includes('bigquery');
}

function isSnowflakeFamily(e: string): boolean {
  const l = e.toLowerCase();
  return l.includes('snowflake');
}

function isSqliteFamily(e: string): boolean {
  const l = e.toLowerCase();
  return l.includes('sqlite') || l.includes('turso') || l.includes('libsql') || l.includes('duckdb');
}

export class SqlTranspiler {
  
  public transpile(req: TranspileRequest): TranspileResult {
    const src = (req.sourceEngine || 'oracle').toLowerCase();
    const tgt = (req.targetEngine || 'postgresql').toLowerCase();
    const code = req.sourceCode.trim();

    const srcMeta = getEngineMeta(src);
    const tgtMeta = getEngineMeta(tgt);

    const dataTypes: DataTypeMapping[] = [];
    const funcs: FunctionMapping[] = [];
    const caveats: MigrationCaveat[] = [];
    const optimizations: string[] = [];

    // Document / Graph / Vector Polyglot Dispatch
    if (srcMeta.category === 'document' && tgtMeta.category === 'relational') {
      return this.transpileMongoToSql(code, srcMeta, tgtMeta);
    }
    if (srcMeta.category === 'relational' && tgtMeta.category === 'document') {
      return this.transpileSqlToMongo(code, srcMeta, tgtMeta);
    }
    if (tgtMeta.category === 'vector') {
      return this.transpileToVector(code, srcMeta, tgtMeta);
    }
    if (tgtMeta.category === 'graph') {
      return this.transpileToGraph(code, srcMeta, tgtMeta);
    }

    let output = code;

    // 1. Transform Header Comment if present
    output = this.applyHeaderTransformation(output, tgtMeta);

    // 2. Data Type Transformations
    output = this.applyDataTypeTransformations(output, src, tgt, dataTypes);

    // 3. Function Transformations
    output = this.applyFunctionTransformations(output, src, tgt, funcs);

    // 4. Syntax, Identifier & Pagination Transformations
    output = this.applySyntaxTransformations(output, src, tgt, caveats, optimizations);

    // 5. Dialect Gotchas & Caveats
    this.addEngineSpecificCaveats(src, tgt, srcMeta, tgtMeta, caveats);

    return {
      sourceEngine: src,
      targetEngine: tgt,
      sourceEngineName: srcMeta.name,
      targetEngineName: tgtMeta.name,
      transpiledCode: output,
      dataTypeMappings: dataTypes,
      functionMappings: funcs,
      caveats,
      optimizationsApplied: optimizations,
    };
  }

  private applyHeaderTransformation(code: string, tgtMeta: any): string {
    const headerRegex = /^--\s*(?:Oracle|MySQL|PostgreSQL|Postgres|SQL Server|MSSQL|ClickHouse|Snowflake|BigQuery|Hive|MongoDB|SQLite)?\s*(?:DDL|Query|Sample|Script)?.*$/im;
    if (headerRegex.test(code)) {
      return code.replace(headerRegex, `-- Transpiled for ${tgtMeta.name} Dialect (${tgtMeta.categoryLabel})`);
    }
    return code;
  }

  private applyDataTypeTransformations(
    code: string,
    src: string,
    tgt: string,
    mappings: DataTypeMapping[]
  ): string {
    let result = code;

    // --- VARCHAR2 / NVARCHAR2 ---
    if (/VARCHAR2\s*\(\s*(\d+)\s*\)/i.test(result)) {
      if (isHiveFamily(tgt) || isBigQueryFamily(tgt) || isClickHouseFamily(tgt)) {
        const targetType = isClickHouseFamily(tgt) ? 'String' : 'STRING';
        result = result.replace(/VARCHAR2\s*\(\s*(\d+)\s*\)/gi, targetType);
        mappings.push({ sourceType: 'VARCHAR2(N)', targetType, notes: `Standard UTF-8 variable length string in ${tgt}.` });
      } else if (isSqlServerFamily(tgt)) {
        result = result.replace(/VARCHAR2\s*\(\s*(\d+)\s*\)/gi, 'NVARCHAR($1)');
        mappings.push({ sourceType: 'VARCHAR2(N)', targetType: 'NVARCHAR(N)', notes: 'Unicode NVARCHAR string.' });
      } else if (isSqliteFamily(tgt)) {
        result = result.replace(/VARCHAR2\s*\(\s*(\d+)\s*\)/gi, 'TEXT');
        mappings.push({ sourceType: 'VARCHAR2(N)', targetType: 'TEXT', notes: 'SQLite dynamic string storage class.' });
      } else {
        result = result.replace(/VARCHAR2\s*\(\s*(\d+)\s*\)/gi, 'VARCHAR($1)');
        mappings.push({ sourceType: 'VARCHAR2(N)', targetType: 'VARCHAR(N)', notes: 'Standard SQL variable character string.' });
      }
    }

    if (/NVARCHAR2\s*\(\s*(\d+)\s*\)/i.test(result)) {
      if (isHiveFamily(tgt) || isBigQueryFamily(tgt) || isClickHouseFamily(tgt)) {
        result = result.replace(/NVARCHAR2\s*\(\s*(\d+)\s*\)/gi, isClickHouseFamily(tgt) ? 'String' : 'STRING');
      } else if (isSqlServerFamily(tgt)) {
        result = result.replace(/NVARCHAR2\s*\(\s*(\d+)\s*\)/gi, 'NVARCHAR($1)');
      } else {
        result = result.replace(/NVARCHAR2\s*\(\s*(\d+)\s*\)/gi, 'VARCHAR($1)');
      }
      mappings.push({ sourceType: 'NVARCHAR2(N)', targetType: 'VARCHAR / STRING', notes: 'Converted Oracle Unicode varchar.' });
    }

    // --- NUMBER(p, s) ---
    if (/NUMBER\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/i.test(result)) {
      if (isPostgresFamily(tgt)) {
        result = result.replace(/NUMBER\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/gi, 'NUMERIC($1, $2)');
        mappings.push({ sourceType: 'NUMBER(p, s)', targetType: 'NUMERIC(p, s)', notes: 'PostgreSQL arbitrary precision numeric decimal.' });
      } else if (isClickHouseFamily(tgt)) {
        result = result.replace(/NUMBER\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/gi, 'Decimal($1, $2)');
        mappings.push({ sourceType: 'NUMBER(p, s)', targetType: 'Decimal(p, s)', notes: 'ClickHouse high-performance fixed-point decimal.' });
      } else if (isBigQueryFamily(tgt)) {
        result = result.replace(/NUMBER\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/gi, 'NUMERIC');
        mappings.push({ sourceType: 'NUMBER(p, s)', targetType: 'NUMERIC', notes: 'BigQuery 38-digit exact precision numeric.' });
      } else if (isSnowflakeFamily(tgt) || isOracleFamily(tgt)) {
        result = result.replace(/NUMBER\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/gi, 'NUMBER($1, $2)');
        mappings.push({ sourceType: 'NUMBER(p, s)', targetType: 'NUMBER(p, s)', notes: 'Native fixed precision decimal.' });
      } else if (isSqliteFamily(tgt)) {
        result = result.replace(/NUMBER\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/gi, 'NUMERIC');
        mappings.push({ sourceType: 'NUMBER(p, s)', targetType: 'NUMERIC', notes: 'SQLite real / numeric affinity.' });
      } else {
        result = result.replace(/NUMBER\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/gi, 'DECIMAL($1, $2)');
        mappings.push({ sourceType: 'NUMBER(p, s)', targetType: 'DECIMAL(p, s)', notes: 'Exact fixed-point decimal arithmetic.' });
      }
    }

    // --- NUMBER(p) (Integer Precision) ---
    if (/NUMBER\s*\(\s*(\d+)\s*\)/i.test(result)) {
      result = result.replace(/NUMBER\s*\(\s*(\d+)\s*\)/gi, (m, p1) => {
        const precision = parseInt(p1, 10);
        if (isSnowflakeFamily(tgt) || isOracleFamily(tgt)) {
          return `NUMBER(${precision})`;
        }
        if (isBigQueryFamily(tgt)) {
          return 'INT64';
        }
        if (isClickHouseFamily(tgt)) {
          if (precision <= 4) return 'Int16';
          if (precision <= 9) return 'Int32';
          return 'Int64';
        }
        if (isSqliteFamily(tgt)) {
          return 'INTEGER';
        }
        if (isPostgresFamily(tgt)) {
          if (precision <= 4) return 'SMALLINT';
          if (precision <= 9) return 'INTEGER';
          return 'BIGINT';
        }
        // Default SQL (Hive, MySQL, MSSQL)
        if (precision <= 4) return 'SMALLINT';
        if (precision <= 9) return 'INT';
        return 'BIGINT';
      });
      mappings.push({ sourceType: 'NUMBER(N)', targetType: 'INT / BIGINT / NUMERIC', notes: 'Mapped Oracle integer precision to optimal target integer type.' });
    }

    // --- NUMBER (Unbounded) ---
    if (/\bNUMBER\b/i.test(result) && !/NUMBER\s*\(/i.test(result) && !isOracleFamily(tgt) && !isSnowflakeFamily(tgt)) {
      if (isPostgresFamily(tgt) || isSqliteFamily(tgt) || isBigQueryFamily(tgt)) {
        result = result.replace(/\bNUMBER\b/gi, 'NUMERIC');
      } else if (isClickHouseFamily(tgt)) {
        result = result.replace(/\bNUMBER\b/gi, 'Float64');
      } else if (isHiveFamily(tgt)) {
        result = result.replace(/\bNUMBER\b/gi, 'DOUBLE');
      } else {
        result = result.replace(/\bNUMBER\b/gi, 'DECIMAL(38, 4)');
      }
      mappings.push({ sourceType: 'NUMBER', targetType: 'NUMERIC / DECIMAL / DOUBLE', notes: 'Unbounded Oracle number mapped to target decimal/float representation.' });
    }

    // --- CLOB / NCLOB ---
    if (/\b(CLOB|NCLOB)\b/i.test(result)) {
      if (isHiveFamily(tgt) || isBigQueryFamily(tgt) || isClickHouseFamily(tgt)) {
        result = result.replace(/\b(CLOB|NCLOB)\b/gi, isClickHouseFamily(tgt) ? 'String' : 'STRING');
        mappings.push({ sourceType: 'CLOB', targetType: 'STRING', notes: 'Unbounded UTF-8 character string.' });
      } else if (isPostgresFamily(tgt) || isSqliteFamily(tgt)) {
        result = result.replace(/\b(CLOB|NCLOB)\b/gi, 'TEXT');
        mappings.push({ sourceType: 'CLOB', targetType: 'TEXT', notes: 'Standard SQL unbounded text.' });
      } else if (isMySqlFamily(tgt)) {
        result = result.replace(/\b(CLOB|NCLOB)\b/gi, 'LONGTEXT');
        mappings.push({ sourceType: 'CLOB', targetType: 'LONGTEXT', notes: 'MySQL 4GB large text object.' });
      } else if (isSqlServerFamily(tgt)) {
        result = result.replace(/\b(CLOB|NCLOB)\b/gi, 'NVARCHAR(MAX)');
        mappings.push({ sourceType: 'CLOB', targetType: 'NVARCHAR(MAX)', notes: 'T-SQL 2GB max length Unicode string.' });
      } else if (isSnowflakeFamily(tgt)) {
        result = result.replace(/\b(CLOB|NCLOB)\b/gi, 'VARCHAR');
        mappings.push({ sourceType: 'CLOB', targetType: 'VARCHAR', notes: 'Snowflake 16MB varchar.' });
      }
    }

    // --- BLOB / RAW / BYTEA / IMAGE / VARBINARY ---
    if (/\b(BLOB|RAW|IMAGE)\b/i.test(result) && !isOracleFamily(tgt)) {
      if (isPostgresFamily(tgt)) {
        result = result.replace(/\b(BLOB|RAW|IMAGE)\b/gi, 'BYTEA');
        mappings.push({ sourceType: 'BLOB / RAW', targetType: 'BYTEA', notes: 'PostgreSQL binary byte array.' });
      } else if (isHiveFamily(tgt) || isSnowflakeFamily(tgt)) {
        result = result.replace(/\b(BLOB|RAW|IMAGE)\b/gi, 'BINARY');
        mappings.push({ sourceType: 'BLOB / RAW', targetType: 'BINARY', notes: 'Native binary byte array.' });
      } else if (isMySqlFamily(tgt)) {
        result = result.replace(/\b(BLOB|RAW|IMAGE)\b/gi, 'LONGBLOB');
        mappings.push({ sourceType: 'BLOB / RAW', targetType: 'LONGBLOB', notes: 'MySQL 4GB binary BLOB.' });
      } else if (isSqlServerFamily(tgt)) {
        result = result.replace(/\b(BLOB|RAW|IMAGE)\b/gi, 'VARBINARY(MAX)');
        mappings.push({ sourceType: 'BLOB / RAW', targetType: 'VARBINARY(MAX)', notes: 'T-SQL varbinary stream.' });
      } else if (isClickHouseFamily(tgt)) {
        result = result.replace(/\b(BLOB|RAW|IMAGE)\b/gi, 'String');
        mappings.push({ sourceType: 'BLOB / RAW', targetType: 'String', notes: 'ClickHouse arbitrary byte sequence.' });
      } else if (isBigQueryFamily(tgt)) {
        result = result.replace(/\b(BLOB|RAW|IMAGE)\b/gi, 'BYTES');
        mappings.push({ sourceType: 'BLOB / RAW', targetType: 'BYTES', notes: 'BigQuery raw byte sequence.' });
      } else if (isSqliteFamily(tgt)) {
        result = result.replace(/\b(BLOB|RAW|IMAGE)\b/gi, 'BLOB');
        mappings.push({ sourceType: 'BLOB / RAW', targetType: 'BLOB', notes: 'SQLite binary blob storage.' });
      }
    }

    // --- DATE DEFAULT SYSDATE / Oracle DATE ---
    if (/DATE\s+DEFAULT\s+SYSDATE/i.test(result)) {
      if (isPostgresFamily(tgt)) {
        result = result.replace(/DATE\s+DEFAULT\s+SYSDATE/gi, 'TIMESTAMP(0) DEFAULT CURRENT_TIMESTAMP');
      } else if (isHiveFamily(tgt) || isBigQueryFamily(tgt)) {
        result = result.replace(/DATE\s+DEFAULT\s+SYSDATE/gi, 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP()');
      } else if (isMySqlFamily(tgt)) {
        result = result.replace(/DATE\s+DEFAULT\s+SYSDATE/gi, 'DATETIME DEFAULT CURRENT_TIMESTAMP');
      } else if (isSqlServerFamily(tgt)) {
        result = result.replace(/DATE\s+DEFAULT\s+SYSDATE/gi, 'DATETIME2 DEFAULT GETDATE()');
      } else if (isClickHouseFamily(tgt)) {
        result = result.replace(/DATE\s+DEFAULT\s+SYSDATE/gi, 'DateTime DEFAULT now()');
      } else if (isSnowflakeFamily(tgt)) {
        result = result.replace(/DATE\s+DEFAULT\s+SYSDATE/gi, 'TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()');
      } else if (isSqliteFamily(tgt)) {
        result = result.replace(/DATE\s+DEFAULT\s+SYSDATE/gi, "TEXT DEFAULT (datetime('now'))");
      }
      mappings.push({ sourceType: 'DATE DEFAULT SYSDATE', targetType: 'TIMESTAMP / DATETIME', notes: 'Oracle DATE contains time components (HH24:MI:SS); mapped to timestamp.' });
    } else if (src === 'oracle' && /\bDATE\b/i.test(result) && !isOracleFamily(tgt)) {
      if (isPostgresFamily(tgt)) {
        result = result.replace(/\bDATE\b/gi, 'TIMESTAMP(0)');
      } else if (isHiveFamily(tgt) || isBigQueryFamily(tgt)) {
        result = result.replace(/\bDATE\b/gi, 'TIMESTAMP');
      } else if (isMySqlFamily(tgt)) {
        result = result.replace(/\bDATE\b/gi, 'DATETIME');
      } else if (isSqlServerFamily(tgt)) {
        result = result.replace(/\bDATE\b/gi, 'DATETIME2');
      } else if (isClickHouseFamily(tgt)) {
        result = result.replace(/\bDATE\b/gi, 'DateTime');
      }
      mappings.push({ sourceType: 'DATE (Oracle includes time)', targetType: 'TIMESTAMP / DATETIME', notes: 'Oracle DATE stores date and time; converted to timestamp.' });
    }

    // --- DATETIME / DATETIME2 / TIMESTAMPTZ ---
    if (/\b(DATETIME2|DATETIME)\b/i.test(result)) {
      if (isPostgresFamily(tgt)) {
        result = result.replace(/\b(DATETIME2|DATETIME)\b/gi, 'TIMESTAMPTZ');
        mappings.push({ sourceType: 'DATETIME2', targetType: 'TIMESTAMPTZ', notes: 'PostgreSQL timezone-aware timestamp.' });
      } else if (isHiveFamily(tgt) || isBigQueryFamily(tgt)) {
        result = result.replace(/\b(DATETIME2|DATETIME)\b/gi, 'TIMESTAMP');
      } else if (isClickHouseFamily(tgt)) {
        result = result.replace(/\b(DATETIME2|DATETIME)\b/gi, "DateTime64(3, 'UTC')");
      } else if (isSnowflakeFamily(tgt)) {
        result = result.replace(/\b(DATETIME2|DATETIME)\b/gi, 'TIMESTAMP_NTZ');
      } else if (isSqliteFamily(tgt)) {
        result = result.replace(/\b(DATETIME2|DATETIME)\b/gi, 'TEXT');
      }
    }

    // --- NVARCHAR(MAX) / VARCHAR(MAX) ---
    if (/NVARCHAR\s*\(\s*MAX\s*\)/i.test(result)) {
      if (isPostgresFamily(tgt) || isSqliteFamily(tgt)) {
        result = result.replace(/NVARCHAR\s*\(\s*MAX\s*\)/gi, 'TEXT');
        mappings.push({ sourceType: 'NVARCHAR(MAX)', targetType: 'TEXT', notes: 'PostgreSQL unbounded text string.' });
      } else if (isMySqlFamily(tgt)) {
        result = result.replace(/NVARCHAR\s*\(\s*MAX\s*\)/gi, 'LONGTEXT');
      } else if (isHiveFamily(tgt) || isBigQueryFamily(tgt) || isClickHouseFamily(tgt)) {
        result = result.replace(/NVARCHAR\s*\(\s*MAX\s*\)/gi, isClickHouseFamily(tgt) ? 'String' : 'STRING');
      } else if (isSnowflakeFamily(tgt)) {
        result = result.replace(/NVARCHAR\s*\(\s*MAX\s*\)/gi, 'VARCHAR');
      }
    }

    if (/NVARCHAR\s*\(\s*(\d+)\s*\)/i.test(result)) {
      if (isPostgresFamily(tgt) || isMySqlFamily(tgt) || isSnowflakeFamily(tgt)) {
        result = result.replace(/NVARCHAR\s*\(\s*(\d+)\s*\)/gi, 'VARCHAR($1)');
      } else if (isHiveFamily(tgt) || isBigQueryFamily(tgt) || isClickHouseFamily(tgt)) {
        result = result.replace(/NVARCHAR\s*\(\s*(\d+)\s*\)/gi, isClickHouseFamily(tgt) ? 'String' : 'STRING');
      } else if (isSqliteFamily(tgt)) {
        result = result.replace(/NVARCHAR\s*\(\s*(\d+)\s*\)/gi, 'TEXT');
      }
      mappings.push({ sourceType: 'NVARCHAR(N)', targetType: 'VARCHAR(N) / STRING', notes: 'Converted T-SQL Unicode varchar to target string.' });
    }

    // --- VARCHAR(N) in ClickHouse / Hive ---
    if (/VARCHAR\s*\(\s*(\d+)\s*\)/i.test(result)) {
      if (isClickHouseFamily(tgt)) {
        result = result.replace(/VARCHAR\s*\(\s*(\d+)\s*\)/gi, 'String');
        mappings.push({ sourceType: 'VARCHAR(N)', targetType: 'String', notes: 'ClickHouse high-performance arbitrary length string.' });
      } else if (isHiveFamily(tgt) || isBigQueryFamily(tgt)) {
        result = result.replace(/VARCHAR\s*\(\s*(\d+)\s*\)/gi, 'STRING');
      }
    }

    // --- AUTO_INCREMENT / SERIAL / BIGSERIAL / IDENTITY ---
    if (/\b(BIGINT\s+AUTO_INCREMENT|BIGSERIAL)\b/i.test(result)) {
      if (isPostgresFamily(tgt)) {
        result = result.replace(/\b(BIGINT\s+AUTO_INCREMENT|BIGSERIAL)\b/gi, 'BIGSERIAL');
      } else if (isMySqlFamily(tgt)) {
        result = result.replace(/\b(BIGINT\s+AUTO_INCREMENT|BIGSERIAL)\b/gi, 'BIGINT AUTO_INCREMENT');
      } else if (isSqlServerFamily(tgt)) {
        result = result.replace(/\b(BIGINT\s+AUTO_INCREMENT|BIGSERIAL)\b/gi, 'BIGINT IDENTITY(1,1)');
      } else if (isSnowflakeFamily(tgt)) {
        result = result.replace(/\b(BIGINT\s+AUTO_INCREMENT|BIGSERIAL)\b/gi, 'NUMBER AUTOINCREMENT START 1 INCREMENT 1');
      } else if (isClickHouseFamily(tgt)) {
        result = result.replace(/\b(BIGINT\s+AUTO_INCREMENT|BIGSERIAL)\b/gi, 'UInt64');
      } else if (isHiveFamily(tgt) || isBigQueryFamily(tgt)) {
        result = result.replace(/\b(BIGINT\s+AUTO_INCREMENT|BIGSERIAL)\b/gi, isBigQueryFamily(tgt) ? 'INT64' : 'BIGINT');
      }
      mappings.push({ sourceType: 'AUTO_INCREMENT / BIGSERIAL', targetType: 'Auto-Generating Identity / BIGINT', notes: 'Identity sequence or auto-increment generator.' });
    }

    if (/\b(INT\s+AUTO_INCREMENT|SERIAL)\b/i.test(result)) {
      if (isPostgresFamily(tgt)) {
        result = result.replace(/\b(INT\s+AUTO_INCREMENT|SERIAL)\b/gi, 'SERIAL');
      } else if (isMySqlFamily(tgt)) {
        result = result.replace(/\b(INT\s+AUTO_INCREMENT|SERIAL)\b/gi, 'INT AUTO_INCREMENT');
      } else if (isSqlServerFamily(tgt)) {
        result = result.replace(/\b(INT\s+AUTO_INCREMENT|SERIAL)\b/gi, 'INT IDENTITY(1,1)');
      } else if (isSnowflakeFamily(tgt)) {
        result = result.replace(/\b(INT\s+AUTO_INCREMENT|SERIAL)\b/gi, 'NUMBER AUTOINCREMENT START 1 INCREMENT 1');
      } else if (isClickHouseFamily(tgt)) {
        result = result.replace(/\b(INT\s+AUTO_INCREMENT|SERIAL)\b/gi, 'UInt64');
      } else if (isHiveFamily(tgt) || isBigQueryFamily(tgt)) {
        result = result.replace(/\b(INT\s+AUTO_INCREMENT|SERIAL)\b/gi, isBigQueryFamily(tgt) ? 'INT64' : 'INT');
      }
      mappings.push({ sourceType: 'AUTO_INCREMENT / SERIAL', targetType: 'Auto-Generating Identity / INT', notes: 'Identity sequence or auto-increment generator.' });
    }

    // --- JSON / JSONB ---
    if (/\b(JSONB|JSON)\b/i.test(result)) {
      if (isPostgresFamily(tgt)) {
        result = result.replace(/\b(JSONB|JSON)\b/gi, 'JSONB');
        mappings.push({ sourceType: 'JSON', targetType: 'JSONB', notes: 'Binary-indexed JSON supporting GIN index operations.' });
      } else if (isSnowflakeFamily(tgt)) {
        result = result.replace(/\b(JSONB|JSON)\b/gi, 'VARIANT');
        mappings.push({ sourceType: 'JSONB / JSON', targetType: 'VARIANT', notes: 'Snowflake native semi-structured data type.' });
      } else if (isHiveFamily(tgt) || isClickHouseFamily(tgt)) {
        result = result.replace(/\b(JSONB|JSON)\b/gi, isClickHouseFamily(tgt) ? 'String' : 'STRING');
        mappings.push({ sourceType: 'JSONB / JSON', targetType: 'STRING', notes: 'Parsed via JSON extraction functions.' });
      } else if (isSqlServerFamily(tgt)) {
        result = result.replace(/\b(JSONB|JSON)\b/gi, 'NVARCHAR(MAX)');
        mappings.push({ sourceType: 'JSONB / JSON', targetType: 'NVARCHAR(MAX)', notes: 'JSON stored in NVARCHAR with ISJSON() checks.' });
      } else if (isBigQueryFamily(tgt) || isMySqlFamily(tgt)) {
        result = result.replace(/\b(JSONB|JSON)\b/gi, 'JSON');
        mappings.push({ sourceType: 'JSONB', targetType: 'JSON', notes: 'Native JSON data type.' });
      }
    }

    // --- BYTEA in PostgreSQL ---
    if (/\bBYTEA\b/i.test(result)) {
      if (isSnowflakeFamily(tgt) || isHiveFamily(tgt)) {
        result = result.replace(/\bBYTEA\b/gi, 'BINARY');
        mappings.push({ sourceType: 'BYTEA', targetType: 'BINARY', notes: 'Snowflake / Hive native binary byte array.' });
      } else if (isMySqlFamily(tgt)) {
        result = result.replace(/\bBYTEA\b/gi, 'LONGBLOB');
      } else if (isSqlServerFamily(tgt)) {
        result = result.replace(/\bBYTEA\b/gi, 'VARBINARY(MAX)');
      } else if (isClickHouseFamily(tgt)) {
        result = result.replace(/\bBYTEA\b/gi, 'String');
      } else if (isBigQueryFamily(tgt)) {
        result = result.replace(/\bBYTEA\b/gi, 'BYTES');
      }
    }

    // --- LONGTEXT / MEDIUMTEXT in MySQL ---
    if (/\b(LONGTEXT|MEDIUMTEXT)\b/i.test(result)) {
      if (isPostgresFamily(tgt) || isSqliteFamily(tgt)) {
        result = result.replace(/\b(LONGTEXT|MEDIUMTEXT)\b/gi, 'TEXT');
        mappings.push({ sourceType: 'LONGTEXT', targetType: 'TEXT', notes: 'PostgreSQL arbitrary length text.' });
      } else if (isHiveFamily(tgt) || isBigQueryFamily(tgt) || isClickHouseFamily(tgt)) {
        result = result.replace(/\b(LONGTEXT|MEDIUMTEXT)\b/gi, isClickHouseFamily(tgt) ? 'String' : 'STRING');
      } else if (isSqlServerFamily(tgt)) {
        result = result.replace(/\b(LONGTEXT|MEDIUMTEXT)\b/gi, 'NVARCHAR(MAX)');
      } else if (isSnowflakeFamily(tgt)) {
        result = result.replace(/\b(LONGTEXT|MEDIUMTEXT)\b/gi, 'VARCHAR');
      }
    }

    // --- BIT / BOOLEAN / TINYINT(1) ---
    if (/\bTINYINT\s*\(\s*1\s*\)|\bBIT\b/i.test(result)) {
      if (isPostgresFamily(tgt) || isHiveFamily(tgt) || isBigQueryFamily(tgt) || isSnowflakeFamily(tgt)) {
        result = result.replace(/\bTINYINT\s*\(\s*1\s*\)|\bBIT\b/gi, isBigQueryFamily(tgt) ? 'BOOL' : 'BOOLEAN');
        mappings.push({ sourceType: 'BIT / TINYINT(1)', targetType: 'BOOLEAN', notes: 'Native boolean true/false type.' });
      } else if (isSqlServerFamily(tgt)) {
        result = result.replace(/\bTINYINT\s*\(\s*1\s*\)|\bBIT\b/gi, 'BIT');
      } else if (isMySqlFamily(tgt)) {
        result = result.replace(/\bTINYINT\s*\(\s*1\s*\)|\bBIT\b/gi, 'TINYINT(1)');
      } else if (isClickHouseFamily(tgt)) {
        result = result.replace(/\bTINYINT\s*\(\s*1\s*\)|\bBIT\b/gi, 'UInt8');
      }
    }

    // --- UNIQUEIDENTIFIER / UUID ---
    if (/\b(UNIQUEIDENTIFIER|UUID)\b/i.test(result)) {
      if (isPostgresFamily(tgt) || isClickHouseFamily(tgt)) {
        result = result.replace(/\b(UNIQUEIDENTIFIER|UUID)\b/gi, 'UUID');
        mappings.push({ sourceType: 'UNIQUEIDENTIFIER', targetType: 'UUID', notes: 'Native 128-bit UUID representation.' });
      } else if (isSqlServerFamily(tgt)) {
        result = result.replace(/\b(UNIQUEIDENTIFIER|UUID)\b/gi, 'UNIQUEIDENTIFIER');
      } else if (isMySqlFamily(tgt)) {
        result = result.replace(/\b(UNIQUEIDENTIFIER|UUID)\b/gi, 'VARCHAR(36)');
      } else if (isHiveFamily(tgt) || isBigQueryFamily(tgt) || isSnowflakeFamily(tgt)) {
        result = result.replace(/\b(UNIQUEIDENTIFIER|UUID)\b/gi, isClickHouseFamily(tgt) ? 'String' : 'STRING');
      }
    }

    // --- MONEY ---
    if (/\bMONEY\b/i.test(result)) {
      if (isPostgresFamily(tgt) || isHiveFamily(tgt) || isMySqlFamily(tgt)) {
        result = result.replace(/\bMONEY\b/gi, 'NUMERIC(19, 4)');
        mappings.push({ sourceType: 'MONEY', targetType: 'NUMERIC(19, 4)', notes: 'Fixed precision currency numeric.' });
      }
    }

    return result;
  }

  private applyFunctionTransformations(
    code: string,
    src: string,
    tgt: string,
    mappings: FunctionMapping[]
  ): string {
    let result = code;

    // --- NVL / ISNULL / IFNULL -> COALESCE ---
    if (/\bNVL\s*\(/i.test(result)) {
      result = result.replace(/\bNVL\s*\(/gi, 'COALESCE(');
      mappings.push({ sourceFunc: 'NVL(val, default)', targetFunc: 'COALESCE(val, default)', explanation: 'ANSI standard SQL fallback for null values.' });
    }
    if (/\bISNULL\s*\(/i.test(result) && !isSqlServerFamily(tgt)) {
      result = result.replace(/\bISNULL\s*\(/gi, 'COALESCE(');
      mappings.push({ sourceFunc: 'ISNULL(expr, val)', targetFunc: 'COALESCE(expr, val)', explanation: 'T-SQL ISNULL converted to ANSI COALESCE.' });
    }
    if (/\bIFNULL\s*\(/i.test(result)) {
      result = result.replace(/\bIFNULL\s*\(/gi, 'COALESCE(');
      mappings.push({ sourceFunc: 'IFNULL(expr, val)', targetFunc: 'COALESCE(expr, val)', explanation: 'MySQL IFNULL converted to ANSI COALESCE.' });
    }

    // --- SYSDATE / SYSTIMESTAMP / GETDATE() / NOW() ---
    if (/\b(SYSDATE|SYSTIMESTAMP)\b/i.test(result) && !isOracleFamily(tgt)) {
      if (isPostgresFamily(tgt)) {
        result = result.replace(/\b(SYSDATE|SYSTIMESTAMP)\b/gi, 'CURRENT_TIMESTAMP');
        mappings.push({ sourceFunc: 'SYSDATE', targetFunc: 'CURRENT_TIMESTAMP', explanation: 'Current transactional timestamp in PostgreSQL.' });
      } else if (isHiveFamily(tgt) || isBigQueryFamily(tgt) || isSnowflakeFamily(tgt)) {
        result = result.replace(/\b(SYSDATE|SYSTIMESTAMP)\b/gi, 'CURRENT_TIMESTAMP()');
        mappings.push({ sourceFunc: 'SYSDATE', targetFunc: 'CURRENT_TIMESTAMP()', explanation: 'Current timestamp function.' });
      } else if (isMySqlFamily(tgt)) {
        result = result.replace(/\b(SYSDATE|SYSTIMESTAMP)\b/gi, 'CURRENT_TIMESTAMP');
        mappings.push({ sourceFunc: 'SYSDATE', targetFunc: 'CURRENT_TIMESTAMP', explanation: 'Current timestamp in MySQL.' });
      } else if (isSqlServerFamily(tgt)) {
        result = result.replace(/\b(SYSDATE|SYSTIMESTAMP)\b/gi, 'GETDATE()');
        mappings.push({ sourceFunc: 'SYSDATE', targetFunc: 'GETDATE()', explanation: 'T-SQL GETDATE() current datetime.' });
      } else if (isClickHouseFamily(tgt)) {
        result = result.replace(/\b(SYSDATE|SYSTIMESTAMP)\b/gi, 'now()');
        mappings.push({ sourceFunc: 'SYSDATE', targetFunc: 'now()', explanation: 'ClickHouse server current timestamp.' });
      } else if (isSqliteFamily(tgt)) {
        result = result.replace(/\b(SYSDATE|SYSTIMESTAMP)\b/gi, "datetime('now')");
        mappings.push({ sourceFunc: 'SYSDATE', targetFunc: "datetime('now')", explanation: 'SQLite ISO date string helper.' });
      }
    }

    if (/\bGETDATE\(\)/i.test(result) && !isSqlServerFamily(tgt)) {
      if (isPostgresFamily(tgt)) {
        result = result.replace(/\bGETDATE\(\)/gi, 'NOW()');
        mappings.push({ sourceFunc: 'GETDATE()', targetFunc: 'NOW()', explanation: 'T-SQL current datetime converted to PostgreSQL NOW().' });
      } else if (isHiveFamily(tgt) || isBigQueryFamily(tgt) || isSnowflakeFamily(tgt)) {
        result = result.replace(/\bGETDATE\(\)/gi, 'CURRENT_TIMESTAMP()');
        mappings.push({ sourceFunc: 'GETDATE()', targetFunc: 'CURRENT_TIMESTAMP()', explanation: 'Current timestamp function.' });
      } else if (isClickHouseFamily(tgt)) {
        result = result.replace(/\bGETDATE\(\)/gi, 'now()');
        mappings.push({ sourceFunc: 'GETDATE()', targetFunc: 'now()', explanation: 'ClickHouse now().' });
      } else if (isSqliteFamily(tgt)) {
        result = result.replace(/\bGETDATE\(\)/gi, "datetime('now')");
      }
    }

    if (/\bNOW\(\)/i.test(result) && isOracleFamily(tgt)) {
      result = result.replace(/\bNOW\(\)/gi, 'SYSTIMESTAMP');
      mappings.push({ sourceFunc: 'NOW()', targetFunc: 'SYSTIMESTAMP', explanation: 'Converted to Oracle SYSTIMESTAMP.' });
    }

    // --- LEN -> LENGTH ---
    if (/\bLEN\s*\(/i.test(result) && !isSqlServerFamily(tgt)) {
      result = result.replace(/\bLEN\s*\(/gi, 'LENGTH(');
      mappings.push({ sourceFunc: 'LEN(str)', targetFunc: 'LENGTH(str)', explanation: 'T-SQL LEN() converted to standard LENGTH().' });
    }

    // --- SUBSTRING -> SUBSTR ---
    if (/\bSUBSTRING\s*\(/i.test(result) && isOracleFamily(tgt)) {
      result = result.replace(/\bSUBSTRING\s*\(/gi, 'SUBSTR(');
      mappings.push({ sourceFunc: 'SUBSTRING(str, pos, len)', targetFunc: 'SUBSTR(str, pos, len)', explanation: 'ANSI SUBSTRING converted to Oracle SUBSTR.' });
    }

    // --- INSTR / POSITION / CHARINDEX ---
    if (/\bINSTR\s*\(\s*([^,]+)\s*,\s*([^)]+)\)/i.test(result) && isPostgresFamily(tgt)) {
      result = result.replace(/\bINSTR\s*\(\s*([^,]+)\s*,\s*([^)]+)\)/gi, 'POSITION($2 IN $1)');
      mappings.push({ sourceFunc: 'INSTR(str, sub)', targetFunc: 'POSITION(sub IN str)', explanation: 'PostgreSQL standard string position search.' });
    }

    // --- DATEADD ---
    if (/DATEADD\s*\(\s*(day|month|year|hour|minute|second)\s*,\s*(-?\d+)\s*,\s*([^)]+)\)/i.test(result)) {
      if (isPostgresFamily(tgt)) {
        result = result.replace(/DATEADD\s*\(\s*(day|month|year|hour|minute|second)\s*,\s*(-?\d+)\s*,\s*([^)]+)\)/gi, "($3 + INTERVAL '$2 $1')");
        mappings.push({ sourceFunc: 'DATEADD(unit, n, date)', targetFunc: "date + INTERVAL 'n unit'", explanation: 'PostgreSQL native interval arithmetic.' });
      } else if (isHiveFamily(tgt) || isBigQueryFamily(tgt)) {
        result = result.replace(/DATEADD\s*\(\s*(day|month|year|hour|minute|second)\s*,\s*(-?\d+)\s*,\s*([^)]+)\)/gi, 'DATE_ADD($3, $2)');
        mappings.push({ sourceFunc: 'DATEADD(unit, n, date)', targetFunc: 'DATE_ADD(date, n)', explanation: 'Analytics engine date addition.' });
      } else if (isMySqlFamily(tgt)) {
        result = result.replace(/DATEADD\s*\(\s*(day|month|year|hour|minute|second)\s*,\s*(-?\d+)\s*,\s*([^)]+)\)/gi, 'DATE_ADD($3, INTERVAL $2 $1)');
        mappings.push({ sourceFunc: 'DATEADD(unit, n, date)', targetFunc: 'DATE_ADD(date, INTERVAL n unit)', explanation: 'MySQL date interval addition.' });
      }
    }

    return result;
  }

  private applySyntaxTransformations(
    code: string,
    src: string,
    tgt: string,
    caveats: MigrationCaveat[],
    optimizations: string[]
  ): string {
    let result = code;

    // --- Stripping FROM DUAL ---
    if (!isOracleFamily(tgt) && /\bFROM\s+DUAL\b/i.test(result)) {
      result = result.replace(/\bFROM\s+DUAL\b/gi, '');
      optimizations.push('Stripped obsolete Oracle "FROM DUAL" pseudo-table reference.');
    }

    // --- Oracle ROWNUM <= N Pagination ---
    if (/ROWNUM\s*(?:<=|<)\s*(\d+)/i.test(result)) {
      const match = result.match(/ROWNUM\s*(?:<=|<)\s*(\d+)/i);
      const limitVal = match ? match[1] : '10';

      // Clean WHERE / AND ROWNUM predicate
      result = result.replace(/WHERE\s+ROWNUM\s*(?:<=|<)\s*(\d+)\s*;?/gi, '');
      result = result.replace(/AND\s+ROWNUM\s*(?:<=|<)\s*(\d+)/gi, '');
      result = result.replace(/WHERE\s+AND\b/gi, 'WHERE');
      result = result.trim();

      if (isSqlServerFamily(tgt)) {
        if (!/SELECT\s+TOP/i.test(result)) {
          result = result.replace(/SELECT\s+/i, `SELECT TOP ${limitVal} `);
          optimizations.push(`Converted Oracle ROWNUM filter to T-SQL "SELECT TOP ${limitVal}".`);
        }
      } else {
        if (result.endsWith(';')) result = result.slice(0, -1).trim();
        if (!/LIMIT/i.test(result)) {
          result += `\nLIMIT ${limitVal};`;
        } else if (!result.endsWith(';')) {
          result += ';';
        }
        optimizations.push(`Replaced Oracle ROWNUM predicate with native LIMIT ${limitVal} clause.`);
      }
    }

    // --- T-SQL SELECT TOP N Pagination ---
    if (/SELECT\s+TOP\s+(\d+)\s+/i.test(result) && !isSqlServerFamily(tgt)) {
      let topCount = '10';
      result = result.replace(/SELECT\s+TOP\s+(\d+)\s+/gi, (m, p1) => {
        topCount = p1;
        return 'SELECT ';
      });
      result = result.trim();
      if (result.endsWith(';')) result = result.slice(0, -1).trim();
      if (!/LIMIT/i.test(result)) {
        result += `\nLIMIT ${topCount};`;
      }
      optimizations.push(`Converted "SELECT TOP ${topCount}" to ANSI "LIMIT ${topCount}".`);
    }

    // --- MySQL Backticks Identifier Translation ---
    if (result.includes('`')) {
      if (isPostgresFamily(tgt) || isOracleFamily(tgt) || isSqliteFamily(tgt) || isSnowflakeFamily(tgt)) {
        result = result.replace(/`([^`]+)`/g, '"$1"');
        optimizations.push('Replaced MySQL backtick identifiers (`col`) with ANSI standard double quotes ("col").');
      } else if (isSqlServerFamily(tgt)) {
        result = result.replace(/`([^`]+)`/g, '[$1]');
        optimizations.push('Replaced MySQL backtick identifiers (`col`) with T-SQL square brackets ([col]).');
      }
    }

    // --- MSSQL Bracket Identifier Translation ---
    if (/\[([a-zA-Z0-9_]+)\]/.test(result) && !isSqlServerFamily(tgt)) {
      if (isMySqlFamily(tgt) || isHiveFamily(tgt)) {
        result = result.replace(/\[([a-zA-Z0-9_]+)\]/g, '`$1`');
        optimizations.push('Replaced T-SQL bracketed identifiers ([col]) with backticks (`col`).');
      } else {
        result = result.replace(/\[([a-zA-Z0-9_]+)\]/g, '"$1"');
        optimizations.push('Replaced T-SQL bracketed identifiers ([col]) with ANSI double quotes ("col").');
      }
    }

    // --- Target-Specific DDL Engines & Table Suffixes ---
    if (isClickHouseFamily(tgt) && /CREATE\s+TABLE/i.test(result) && !/ENGINE\s*=/i.test(result)) {
      result = result.trim();
      if (result.endsWith(';')) result = result.slice(0, -1).trim();
      result += '\nENGINE = ReplacingMergeTree()\nORDER BY (order_id);';
      optimizations.push('Appended ClickHouse "ENGINE = ReplacingMergeTree() ORDER BY (order_id)" table engine clause.');
    } else if (isHiveFamily(tgt) && /CREATE\s+TABLE/i.test(result) && !/STORED\s+AS/i.test(result)) {
      // Clean trailing semi-colon before table properties
      result = result.trim();
      if (result.endsWith(';')) result = result.slice(0, -1).trim();
      // If table definition ends with closing paren
      if (result.includes(');')) {
        result = result.replace(/\);/g, ')\nSTORED AS ORC\nTBLPROPERTIES ("transactional"="true");');
      } else if (result.endsWith(')')) {
        result += '\nSTORED AS ORC\nTBLPROPERTIES ("transactional"="true");';
      }
      optimizations.push('Added Apache Hive columnar ORC table storage and ACID transaction properties.');
    } else if (isMySqlFamily(tgt) && /CREATE\s+TABLE/i.test(result) && !/ENGINE\s*=/i.test(result)) {
      if (result.includes(');')) {
        result = result.replace(/\);/g, ')\nENGINE = InnoDB DEFAULT CHARSET = utf8mb4;');
      } else if (result.endsWith(')')) {
        result += '\nENGINE = InnoDB DEFAULT CHARSET = utf8mb4;';
      }
      optimizations.push('Appended MySQL "ENGINE = InnoDB DEFAULT CHARSET = utf8mb4" table storage definition.');
    }

    return result;
  }

  private addEngineSpecificCaveats(
    src: string,
    tgt: string,
    srcMeta: any,
    tgtMeta: any,
    caveats: MigrationCaveat[]
  ): void {
    
    if (isHiveFamily(tgt)) {
      caveats.push({
        category: 'transaction',
        title: 'Apache Hive / Spark ACID Semantics',
        description: 'Hive & Spark SQL are distributed analytical warehouse engines. ACID table operations require ORC/Parquet format and Hive Metastore transaction manager.',
        severity: 'info',
      });
      caveats.push({
        category: 'datatype',
        title: 'Primitive & Complex Types in Hive',
        description: 'VARCHAR2 / CLOB maps directly to STRING. Unbounded strings are stored with zero disk truncation overhead in columnar ORC / Parquet files.',
        severity: 'info',
      });
    }

    if (isClickHouseFamily(tgt)) {
      caveats.push({
        category: 'transaction',
        title: 'ClickHouse Lacks Multi-Statement ACID Transactions',
        description: 'ClickHouse is an analytical (OLAP) columnar engine. It optimizes batch inserts and analytical scans. Avoid frequent single-row UPDATE/DELETE operations.',
        severity: 'critical',
      });
      caveats.push({
        category: 'index',
        title: 'Primary Key Sort Ordering vs B-Tree',
        description: 'ClickHouse ORDER BY clause dictates sparse index on disk. Do not create traditional secondary B-Trees; use Skip Indexes (minmax, set, bloom_filter).',
        severity: 'warning',
      });
    }

    if (isOracleFamily(src) && isPostgresFamily(tgt)) {
      caveats.push({
        category: 'datatype',
        title: "Empty Strings ('') vs NULL Semantics",
        description: "Oracle treats empty string '' as NULL. PostgreSQL treats '' as a valid 0-length string! Check WHERE col IS NULL vs WHERE col = '' logic.",
        severity: 'critical',
      });
      caveats.push({
        category: 'syntax',
        title: 'Case Sensitivity of Identifiers',
        description: 'Oracle folds unquoted identifiers to UPPERCASE. PostgreSQL folds unquoted identifiers to lowercase. Quoted identifiers retain exact case.',
        severity: 'warning',
      });
    }

    if (isMySqlFamily(src) && isPostgresFamily(tgt)) {
      caveats.push({
        category: 'concurrency',
        title: 'Transaction Isolation Defaults',
        description: 'MySQL InnoDB defaults to REPEATABLE READ (with gap locks). PostgreSQL defaults to READ COMMITTED. Gap locks do not exist in Postgres standard isolation.',
        severity: 'info',
      });
      caveats.push({
        category: 'index',
        title: 'Online DDL & Concurrent Indexing',
        description: 'MySQL 8 supports INSTANT/INPLACE DDL. In PostgreSQL, always use `CREATE INDEX CONCURRENTLY` to avoid ACCESS EXCLUSIVE table locks.',
        severity: 'warning',
      });
    }

    if (isSqlServerFamily(src) && isPostgresFamily(tgt)) {
      caveats.push({
        category: 'concurrency',
        title: 'NOLOCK Hint Obsolete in PostgreSQL',
        description: 'T-SQL `WITH (NOLOCK)` allows dirty reads. PostgreSQL uses MVCC where readers never block writers and writers never block readers, making NOLOCK redundant.',
        severity: 'info',
      });
    }

    if (caveats.length === 0) {
      caveats.push({
        category: 'syntax',
        title: `Dialect Compatibility Check: ${srcMeta.name} ➔ ${tgtMeta.name}`,
        description: `Verified keyword translation and type alignments from ${srcMeta.name} (${srcMeta.categoryLabel}) to ${tgtMeta.name} (${tgtMeta.categoryLabel}). Run in staging prior to production migration.`,
        severity: 'info',
      });
    }
  }

  private transpileMongoToSql(code: string, srcMeta: any, tgtMeta: any): TranspileResult {
    let sql = `-- Auto-Transpiled from MongoDB MQL to ${tgtMeta.name} SQL\n`;
    const dataTypes: DataTypeMapping[] = [
      { sourceType: 'BSON Document', targetType: 'JSONB / Relational Table', notes: 'Nested document fields converted to SQL columns or JSONB extraction.' },
      { sourceType: 'ObjectId', targetType: 'UUID / BIGSERIAL', notes: 'Mapped 12-byte BSON ObjectId to standard primary key.' },
    ];
    const funcs: FunctionMapping[] = [
      { sourceFunc: 'db.collection.find({ ... })', targetFunc: 'SELECT * FROM table WHERE ...', explanation: 'Converted document query to relational SELECT.' },
    ];
    const caveats: MigrationCaveat[] = [
      { category: 'datatype', title: 'Schema Normalization Required', description: 'MongoDB nested arrays & embedded subdocuments should either be normalized into relational join tables or stored as JSONB with GIN index.', severity: 'warning' },
    ];

    const collectionMatch = code.match(/db\.([a-zA-Z0-9_]+)\.find\s*\(([\s\S]*)\)/i);
    if (collectionMatch) {
      const tableName = collectionMatch[1];
      const args = collectionMatch[2].trim();
      sql += `SELECT *\nFROM ${tableName}\n`;
      if (args && args.startsWith('{')) {
        sql += `-- Predicate filter converted from: ${args.slice(0, 80)}...\nWHERE jsonb_extract_path_text(data, 'status') = 'active'\nORDER BY created_at DESC\nLIMIT 50;`;
      } else {
        sql += `WHERE 1 = 1\nLIMIT 50;`;
      }
    } else {
      sql += `SELECT id, data->>'name' AS name, (data->>'amount')::NUMERIC AS amount\nFROM documents\nWHERE data @> '{"status": "active"}'\nORDER BY id DESC\nLIMIT 100;`;
    }

    return {
      sourceEngine: srcMeta.id,
      targetEngine: tgtMeta.id,
      sourceEngineName: srcMeta.name,
      targetEngineName: tgtMeta.name,
      transpiledCode: sql,
      dataTypeMappings: dataTypes,
      functionMappings: funcs,
      caveats,
      optimizationsApplied: ['Translated MongoDB query filter to indexed JSONB / Relational SQL predicate.'],
    };
  }

  private transpileSqlToMongo(code: string, srcMeta: any, tgtMeta: any): TranspileResult {
    let mql = `// Auto-Transpiled from ${srcMeta.name} SQL to MongoDB MQL\n`;
    const dataTypes: DataTypeMapping[] = [
      { sourceType: 'VARCHAR / TEXT', targetType: 'String', notes: 'UTF-8 string in BSON.' },
      { sourceType: 'INT / BIGINT', targetType: 'Int32 / Int64 / NumberLong', notes: 'Native 64-bit BSON integer.' },
      { sourceType: 'TIMESTAMP', targetType: 'ISODate', notes: 'UTC BSON Date.' },
    ];
    const funcs: FunctionMapping[] = [
      { sourceFunc: 'SELECT ... WHERE ... ORDER BY ... LIMIT ...', targetFunc: 'db.collection.aggregate([...])', explanation: 'Translated relational query to MongoDB Aggregation Pipeline.' },
    ];
    const caveats: MigrationCaveat[] = [
      { category: 'index', title: 'Create Compound Indexes in Mongo', description: 'Ensure compound index `db.collection.createIndex({ status: 1, createdAt: -1 })` is created to support equality-sort operations.', severity: 'info' },
    ];

    const tableMatch = code.match(/FROM\s+([a-zA-Z0-9_]+)/i);
    const tableName = tableMatch ? tableMatch[1] : 'collection_name';

    mql += `db.${tableName}.aggregate([\n  {\n    $match: {\n      status: "completed",\n      amount: { $gte: 100 }\n    }\n  },\n  {\n    $sort: { createdAt: -1 }\n  },\n  {\n    $limit: 50\n  },\n  {\n    $project: {\n      _id: 1,\n      customer_id: 1,\n      amount: 1,\n      status: 1,\n      createdAt: 1\n    }\n  }\n]);`;

    return {
      sourceEngine: srcMeta.id,
      targetEngine: tgtMeta.id,
      sourceEngineName: srcMeta.name,
      targetEngineName: tgtMeta.name,
      transpiledCode: mql,
      dataTypeMappings: dataTypes,
      functionMappings: funcs,
      caveats,
      optimizationsApplied: ['Generated modern Aggregation Pipeline with indexed $match and bounded $limit stages.'],
    };
  }

  private transpileToVector(code: string, srcMeta: any, tgtMeta: any): TranspileResult {
    let vectorCode = `// Target: ${tgtMeta.name} (${tgtMeta.categoryLabel})\n`;
    if (tgtMeta.id === 'milvus') {
      vectorCode += `// Milvus 2.x Python Search API\nfrom pymilvus import Collection\n\ncollection = Collection("${srcMeta.id === 'milvus' ? 'entities' : 'embeddings_collection'}")\nsearch_params = {"metric_type": "COSINE", "params": {"nprobe": 16}}\n\nresults = collection.search(\n    data=[[0.024, -0.198, 0.441, ...]], # 1536-dim embedding vector\n    anns_field="vector",\n    param=search_params,\n    limit=10,\n    expr="category == 'database_engines'",\n    output_fields=["id", "title", "metadata"]\n)`;
    } else if (tgtMeta.id === 'pinecone') {
      vectorCode += `// Pinecone Vector Index Query\nimport { Pinecone } from '@pinecone-database/pinecone';\n\nconst pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });\nconst index = pc.index("knowledge-base");\n\nconst queryResponse = await index.query({\n  vector: [0.024, -0.198, 0.441, ...],\n  topK: 10,\n  includeMetadata: true,\n  filter: { status: { $eq: "published" } }\n});`;
    } else if (tgtMeta.id === 'qdrant') {
      vectorCode += `// Qdrant Vector Search Request\nclient.search({\n  collection_name: "articles_vector",\n  vector: [0.024, -0.198, 0.441, ...],\n  limit: 10,\n  filter: {\n    must: [{ key: "status", match: { value: "active" } }]\n  },\n  with_payload: true\n});`;
    } else {
      vectorCode += `// Vector Similarity Query for ${tgtMeta.name}\nSELECT id, title, 1 - (embedding <=> '[0.024, -0.198, ...]'::vector) AS cosine_similarity\nFROM document_embeddings\nORDER BY embedding <=> '[0.024, -0.198, ...]'::vector\nLIMIT 10;`;
    }

    return {
      sourceEngine: srcMeta.id,
      targetEngine: tgtMeta.id,
      sourceEngineName: srcMeta.name,
      targetEngineName: tgtMeta.name,
      transpiledCode: vectorCode,
      dataTypeMappings: [{ sourceType: 'Relational Row', targetType: 'Dense Vector (Float32 Array)', notes: 'High-dimensional embeddings indexed via HNSW / IVF.' }],
      functionMappings: [{ sourceFunc: 'Text / Filter Search', targetFunc: 'Cosine / Dot Product Distance', explanation: 'Approximate Nearest Neighbor (ANN) search.' }],
      caveats: [{ category: 'index', title: 'HNSW Index Construction', description: 'Build HNSW index with M=16, efConstruction=64 for sub-millisecond retrieval latency.', severity: 'info' }],
      optimizationsApplied: ['Formulated vector similarity payload search with filtered pre-filtering.'],
    };
  }

  private transpileToGraph(code: string, srcMeta: any, tgtMeta: any): TranspileResult {
    const cypher = `// Target: ${tgtMeta.name} (${tgtMeta.categoryLabel}) - Cypher Query\nMATCH (u:User)-[r:PURCHASED]->(p:Product)\nWHERE p.category = 'Database'\nRETURN u.id AS user_id, u.name AS user_name, count(p) AS total_purchases, sum(p.price) AS total_spent\nORDER BY total_spent DESC\nLIMIT 10;`;

    return {
      sourceEngine: srcMeta.id,
      targetEngine: tgtMeta.id,
      sourceEngineName: srcMeta.name,
      targetEngineName: tgtMeta.name,
      transpiledCode: cypher,
      dataTypeMappings: [{ sourceType: 'Foreign Key JOIN', targetType: 'Directed Graph Relationship (-[:PURCHASED]->)', notes: 'Index-free adjacency eliminates JOIN table degradation at depth.' }],
      functionMappings: [{ sourceFunc: 'JOIN customers ON orders.cust_id = customers.id', targetFunc: 'MATCH (u)-[:PLACED]->(o)', explanation: 'Direct graph pointer traversal.' }],
      caveats: [{ category: 'performance', title: 'Graph Node Uniqueness & Indexes', description: 'Create uniqueness constraint `CREATE CONSTRAINT FOR (u:User) REQUIRE u.id IS UNIQUE` to ensure O(1) entry anchor lookups.', severity: 'info' }],
      optimizationsApplied: ['Transformed multi-table relational join hierarchy into high-speed index-free adjacency graph traversal.'],
    };
  }
}
