import { DATABASE_CATALOG } from '../types/db-catalog.data';
import { getEngineProfile } from '../types/engine-profiles';

export interface ConnectHubRequest {
  engine: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  sslMode?: 'require' | 'disable' | 'verify-full' | 'prefer';
  poolSize?: number;
}

export interface CodeSnippet {
  language: 'typescript' | 'python' | 'go' | 'java' | 'rust' | 'php';
  label: string;
  code: string;
}

export interface OrmSnippet {
  orm: 'prisma' | 'drizzle' | 'sqlalchemy' | 'gorm' | 'typeorm';
  label: string;
  filename: string;
  code: string;
}

export interface ConnectHubResult {
  engine: string;
  engineName: string;
  categoryLabel: string;
  connectionUri: string;
  maskedUri: string;
  jdbcUrl: string;
  environmentVariableSnippet: string;
  codeSnippets: CodeSnippet[];
  ormSnippets: OrmSnippet[];
  driverPackage: string;
  securityRecommendations: string[];
}

function getEngineMeta(engineId: string) {
  const found = DATABASE_CATALOG.find(db => db.id === engineId.toLowerCase());
  if (found) return found;
  return {
    id: engineId,
    name: engineId.charAt(0).toUpperCase() + engineId.slice(1),
    category: 'relational',
    categoryLabel: 'Relational (SQL)',
    icon: '🗄️',
    rank: 999,
    popularityScore: 10,
    commandHint: 'EXPLAIN <query>',
    description: 'Database Engine'
  };
}

export class ConnectHubGenerator {
  public generate(req: ConnectHubRequest): ConnectHubResult {
    const meta = getEngineMeta(req.engine);
    const profile = getEngineProfile(req.engine);
    const host = req.host || '127.0.0.1';
    const db = req.database || 'production_db';
    const user = req.username || 'db_user';
    const pass = req.password || 'Secr3tP@ssw0rd!';
    const ssl = req.sslMode || 'require';
    const pool = req.poolSize || 20;

    const defaultPort = profile.connection.defaultPort || 5432;
    const rawScheme = (profile.connection.scheme || 'db').replace(/:\/\/$/, '').toLowerCase();
    const normalized = req.engine.toLowerCase();

    let driverPkg = 'pg';
    if (profile.isPostgresFamily) {
      driverPkg = 'pg';
    } else if (profile.dialect === 'mysql') {
      driverPkg = 'mysql2';
    } else if (profile.dialect === 'oracle') {
      driverPkg = 'oracledb';
    } else if (profile.dialect === 'sqlserver') {
      driverPkg = 'mssql';
    } else if (profile.dialect === 'db2') {
      driverPkg = 'ibm_db';
    } else if (profile.dialect === 'hana') {
      driverPkg = '@sap/hana-client';
    } else if (profile.dialect === 'sqlite') {
      driverPkg = normalized.includes('duck') ? 'duckdb' : 'better-sqlite3';
    } else if (profile.family === 'columnar_olap') {
      if (normalized === 'clickhouse') driverPkg = '@clickhouse/client';
      else if (normalized === 'snowflake') driverPkg = 'snowflake-sdk';
      else if (normalized === 'bigquery') driverPkg = '@google-cloud/bigquery';
      else driverPkg = 'database-driver';
    } else if (profile.family === 'document') {
      driverPkg = 'mongodb';
    } else if (profile.family === 'keyvalue') {
      driverPkg = 'ioredis';
    } else if (profile.family === 'wide_column') {
      driverPkg = 'cassandra-driver';
    } else if (profile.family === 'graph') {
      driverPkg = 'neo4j-driver';
    } else if (profile.family === 'search') {
      driverPkg = '@elastic/elasticsearch';
    } else if (profile.family === 'vector') {
      driverPkg = normalized.includes('pinecone') ? '@pinecone-database/pinecone' : '@zilliz/milvus2-sdk-node';
    } else {
      driverPkg = 'database-driver';
    }

    const port = req.port || defaultPort;

    let connectionUri = '';
    let maskedUri = '';
    let jdbcUrl = '';

    if (rawScheme === 'redis') {
      connectionUri = `redis://default:${pass}@${host}:${port}/0`;
      maskedUri = `redis://default:••••••••@${host}:${port}/0`;
      jdbcUrl = `jdbc:redis://${host}:${port}/0`;
    } else if (rawScheme === 'mongodb') {
      connectionUri = `mongodb://${user}:${pass}@${host}:${port}/${db}?authSource=admin&ssl=${ssl === 'require' ? 'true' : 'false'}`;
      maskedUri = `mongodb://${user}:••••••••@${host}:${port}/${db}?authSource=admin&ssl=${ssl === 'require' ? 'true' : 'false'}`;
      jdbcUrl = `jdbc:mongodb://${host}:${port}/${db}`;
    } else if (rawScheme === 'bolt' || rawScheme === 'neo4j') {
      connectionUri = `bolt://${user}:${pass}@${host}:${port}`;
      maskedUri = `bolt://${user}:••••••••@${host}:${port}`;
      jdbcUrl = `jdbc:neo4j:bolt://${host}:${port}`;
    } else if (profile.dialect === 'oracle') {
      connectionUri = `oracle://${user}:${pass}@${host}:${port}/${db}`;
      maskedUri = `oracle://${user}:••••••••@${host}:${port}/${db}`;
      jdbcUrl = `jdbc:oracle:thin:@${host}:${port}/${db}`;
    } else if (profile.dialect === 'sqlserver') {
      connectionUri = `sqlserver://${user}:${pass}@${host}:${port};database=${db};encrypt=${ssl === 'require' ? 'true' : 'false'};trustServerCertificate=true;`;
      maskedUri = `sqlserver://${user}:••••••••@${host}:${port};database=${db};encrypt=${ssl === 'require' ? 'true' : 'false'};trustServerCertificate=true;`;
      jdbcUrl = `jdbc:sqlserver://${host}:${port};databaseName=${db};`;
    } else if (profile.dialect === 'hana') {
      connectionUri = `hana://${user}:${pass}@${host}:${port}/?databaseName=${db}`;
      maskedUri = `hana://${user}:••••••••@${host}:${port}/?databaseName=${db}`;
      jdbcUrl = `jdbc:sap://${host}:${port}/?databaseName=${db}`;
    } else if (profile.dialect === 'sqlite') {
      connectionUri = `${rawScheme}:///${db}.db`;
      maskedUri = `${rawScheme}:///${db}.db`;
      jdbcUrl = `jdbc:${rawScheme}:${db}.db`;
    } else if (normalized === 'snowflake') {
      connectionUri = `snowflake://${user}:${pass}@${host}/${db}?warehouse=COMPUTE_WH&role=PUBLIC`;
      maskedUri = `snowflake://${user}:••••••••@${host}/${db}?warehouse=COMPUTE_WH&role=PUBLIC`;
      jdbcUrl = `jdbc:snowflake://${host}/?db=${db}&warehouse=COMPUTE_WH`;
    } else if (profile.family === 'wide_column') {
      connectionUri = `cassandra://${user}:${pass}@${host}:${port}/${db}`;
      maskedUri = `cassandra://${user}:••••••••@${host}:${port}/${db}`;
      jdbcUrl = `jdbc:cassandra://${host}:${port}/${db}`;
    } else if (profile.family === 'vector') {
      connectionUri = `https://${host}:${port}/${db}`;
      maskedUri = `https://${host}:${port}/${db}`;
      jdbcUrl = `jdbc:vector://${host}:${port}/${db}`;
    } else if (profile.isPostgresFamily) {
      connectionUri = `postgresql://${user}:${pass}@${host}:${port}/${db}?sslmode=${ssl}`;
      maskedUri = `postgresql://${user}:••••••••@${host}:${port}/${db}?sslmode=${ssl}`;
      jdbcUrl = `jdbc:postgresql://${host}:${port}/${db}?sslmode=${ssl}`;
    } else if (profile.dialect === 'mysql') {
      connectionUri = `mysql://${user}:${pass}@${host}:${port}/${db}?ssl-mode=${ssl === 'require' ? 'REQUIRED' : 'DISABLED'}`;
      maskedUri = `mysql://${user}:••••••••@${host}:${port}/${db}?ssl-mode=${ssl === 'require' ? 'REQUIRED' : 'DISABLED'}`;
      jdbcUrl = `jdbc:mysql://${host}:${port}/${db}`;
    } else {
      connectionUri = `${rawScheme}://${user}:${pass}@${host}:${port}/${db}`;
      maskedUri = `${rawScheme}://${user}:••••••••@${host}:${port}/${db}`;
      jdbcUrl = `jdbc:${rawScheme}://${host}:${port}/${db}`;
    }

    const envSnippet = `# .env Configuration
DATABASE_URL="${connectionUri}"
DATABASE_HOST="${host}"
DATABASE_PORT="${port}"
DATABASE_NAME="${db}"
DATABASE_USER="${user}"
DATABASE_PASSWORD="${pass}"
DATABASE_SSL="${ssl}"
DATABASE_POOL_SIZE="${pool}"
`;

    const codeSnippets: CodeSnippet[] = [
      {
        language: 'typescript',
        label: 'Node.js / TypeScript',
        code: this.generateTypeScriptSnippet(profile, rawScheme, connectionUri, host, port, user, pass, db, pool),
      },
      {
        language: 'python',
        label: 'Python (Async / Sync)',
        code: this.generatePythonSnippet(profile, rawScheme, connectionUri, host, port, user, pass, db, pool),
      },
      {
        language: 'go',
        label: 'Go (Golang)',
        code: this.generateGoSnippet(profile, rawScheme, connectionUri, host, port, user, pass, db, pool),
      },
      {
        language: 'rust',
        label: 'Rust (SQLx)',
        code: this.generateRustSnippet(profile, rawScheme, connectionUri, driverPkg),
      },
      {
        language: 'java',
        label: 'Java (Spring Boot / HikariCP)',
        code: this.generateJavaSnippet(rawScheme, jdbcUrl, user, pass, pool),
      },
    ];

    const prismaProvider = profile.isPostgresFamily
      ? 'postgresql'
      : profile.dialect === 'mysql'
      ? 'mysql'
      : profile.dialect === 'sqlserver'
      ? 'sqlserver'
      : profile.dialect === 'sqlite'
      ? 'sqlite'
      : profile.family === 'document'
      ? 'mongodb'
      : 'postgresql';

    const drizzleDialect = profile.dialect === 'mysql'
      ? 'mysql'
      : profile.dialect === 'sqlite'
      ? 'sqlite'
      : 'postgresql';

    const ormSnippets: OrmSnippet[] = [
      {
        orm: 'prisma',
        label: 'Prisma ORM',
        filename: 'prisma/schema.prisma',
        code: `datasource db {\n  provider = "${prismaProvider}"\n  url      = env("DATABASE_URL")\n}\n\ngenerator client {\n  provider = "prisma-client-js"\n}`,
      },
      {
        orm: 'drizzle',
        label: 'Drizzle ORM',
        filename: 'drizzle.config.ts',
        code: `import { defineConfig } from "drizzle-kit";\n\nexport default defineConfig({\n  schema: "./src/schema.ts",\n  out: "./drizzle",\n  dialect: "${drizzleDialect}",\n  dbCredentials: {\n    url: process.env.DATABASE_URL!,\n  },\n});`,
      },
      {
        orm: 'sqlalchemy',
        label: 'SQLAlchemy (Python)',
        filename: 'database.py',
        code: `from sqlalchemy import create_engine\nfrom sqlalchemy.orm import sessionmaker\n\nDATABASE_URL = "${connectionUri}"\n\nengine = create_engine(DATABASE_URL, pool_size=${pool}, max_overflow=10, pool_pre_ping=True)\nSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)`,
      },
    ];

    const securityRecs = [
      'Always use SSL mode "verify-full" in cloud production environments to eliminate man-in-the-middle risks.',
      'Never commit plain-text credentials to Git; store in AWS Secrets Manager, HashiCorp Vault, or encrypted environment variables.',
      `Configure connection pool min-idle to 2 and max-active to ${pool} to prevent database thread starvation.`,
    ];

    return {
      engine: meta.id,
      engineName: meta.name,
      categoryLabel: meta.categoryLabel,
      connectionUri,
      maskedUri,
      jdbcUrl,
      environmentVariableSnippet: envSnippet,
      codeSnippets,
      ormSnippets,
      driverPackage: driverPkg,
      securityRecommendations: securityRecs,
    };
  }

  private generateTypeScriptSnippet(profile: any, scheme: string, uri: string, host: string, port: number, user: string, pass: string, db: string, pool: number): string {
    if (scheme === 'redis') {
      return `import Redis from 'ioredis';\n\nconst redis = new Redis(process.env.DATABASE_URL || "${uri}", {\n  maxRetriesPerRequest: 3,\n  enableReadyCheck: true,\n});\n\nexport default redis;`;
    }
    if (scheme === 'mongodb') {
      return `import { MongoClient } from 'mongodb';\n\nconst client = new MongoClient(process.env.DATABASE_URL || "${uri}", {\n  maxPoolSize: ${pool},\n  minPoolSize: 2,\n});\n\nawait client.connect();\nexport const db = client.db("${db}");`;
    }
    if (profile.dialect === 'mysql') {
      return `import mysql from 'mysql2/promise';\n\nexport const pool = mysql.createPool({\n  uri: process.env.DATABASE_URL || "${uri}",\n  waitForConnections: true,\n  connectionLimit: ${pool},\n  queueLimit: 0,\n});\n\nexport const query = (sql: string, params?: any[]) => pool.execute(sql, params);`;
    }
    if (profile.dialect === 'oracle') {
      return `import oracledb from 'oracledb';\n\nexport async function initPool() {\n  return await oracledb.createPool({\n    connectString: process.env.DATABASE_URL || "${uri}",\n    poolMax: ${pool},\n    poolMin: 2,\n  });\n}`;
    }
    if (profile.dialect === 'sqlserver') {
      return `import sql from 'mssql';\n\nexport const poolPromise = new sql.ConnectionPool(process.env.DATABASE_URL || "${uri}")\n  .connect()\n  .then(pool => { console.log('Connected to SQL Server'); return pool; });`;
    }
    if (profile.isPostgresFamily) {
      return `import { Pool } from 'pg';\n\nexport const pool = new Pool({\n  connectionString: process.env.DATABASE_URL,\n  max: ${pool},\n  idleTimeoutMillis: 30000,\n  connectionTimeoutMillis: 3000,\n  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,\n});\n\nexport const query = (text: string, params?: any[]) => pool.query(text, params);`;
    }
    return `// Database client pool for ${profile.name}\n// Connect via endpoint: process.env.DATABASE_URL || "${uri}"`;
  }

  private generatePythonSnippet(profile: any, scheme: string, uri: string, host: string, port: number, user: string, pass: string, db: string, pool: number): string {
    if (scheme === 'redis') {
      return `import redis\n\nr = redis.from_url("${uri}", decode_responses=True)\n# Example: r.set("key", "value")`;
    }
    if (scheme === 'mongodb') {
      return `from pymongo import MongoClient\n\nclient = MongoClient("${uri}", maxPoolSize=${pool})\ndb = client["${db}"]`;
    }
    if (profile.dialect === 'mysql') {
      return `import pymysql\nfrom dbutils.pooled_db import PooledDB\n\npool = PooledDB(creator=pymysql, maxconnections=${pool}, host="${host}", port=${port}, user="${user}", password="${pass}", database="${db}")`;
    }
    if (profile.dialect === 'oracle') {
      return `import oracledb\n\npool = oracledb.create_pool(user="${user}", password="${pass}", dsn="${host}:${port}/${db}", min=2, max=${pool})`;
    }
    if (profile.dialect === 'sqlserver') {
      return `import pyodbc\n\nconn = pyodbc.connect('DRIVER={ODBC Driver 18 for SQL Server};SERVER=${host},${port};DATABASE=${db};UID=${user};PWD=${pass}')`;
    }
    if (profile.isPostgresFamily) {
      return `import psycopg2\nfrom psycopg2 import pool\n\nconnection_pool = psycopg2.pool.SimpleConnectionPool(\n    minconn=1,\n    maxconn=${pool},\n    dsn="${uri}"\n)\n\n# Get connection from pool:\nconn = connection_pool.getconn()`;
    }
    return `# Database client connection for ${profile.name}\n# Connect using URL: "${uri}"`;
  }

  private generateGoSnippet(profile: any, scheme: string, uri: string, host: string, port: number, user: string, pass: string, db: string, pool: number): string {
    if (profile.dialect === 'mysql') {
      return `package main\n\nimport (\n    "database/sql"\n    "log"\n    _ "github.com/go-sql-driver/mysql"\n)\n\nfunc InitDB() *sql.DB {\n    db, err := sql.Open("mysql", "${user}:${pass}@tcp(${host}:${port})/${db}")\n    if err != nil {\n        log.Fatalf("Failed to open DB: %v", err)\n    }\n    db.SetMaxOpenConns(${pool})\n    return db\n}`;
    }
    if (profile.dialect === 'oracle') {
      return `package main\n\nimport (\n    "database/sql"\n    "log"\n    _ "github.com/sijms/go-ora/v2"\n)\n\nfunc InitDB() *sql.DB {\n    db, err := sql.Open("oracle", "${uri}")\n    if err != nil {\n        log.Fatalf("Failed to open DB: %v", err)\n    }\n    db.SetMaxOpenConns(${pool})\n    return db\n}`;
    }
    if (profile.dialect === 'sqlserver') {
      return `package main\n\nimport (\n    "database/sql"\n    "log"\n    _ "github.com/microsoft/go-mssqldb"\n)\n\nfunc InitDB() *sql.DB {\n    db, err := sql.Open("sqlserver", "${uri}")\n    if err != nil {\n        log.Fatalf("Failed to open DB: %v", err)\n    }\n    db.SetMaxOpenConns(${pool})\n    return db\n}`;
    }
    if (profile.isPostgresFamily) {
      return `package main\n\nimport (\n    "database/sql"\n    "log"\n    _ "github.com/lib/pq"\n)\n\nfunc InitDB() *sql.DB {\n    db, err := sql.Open("postgres", "${uri}")\n    if err != nil {\n        log.Fatalf("Failed to open DB: %v", err)\n    }\n    db.SetMaxOpenConns(${pool})\n    db.SetMaxIdleConns(5)\n    return db\n}`;
    }
    return `package main\n\nimport (\n    "database/sql"\n    "log"\n)\n\nfunc InitDB() *sql.DB {\n    db, err := sql.Open("${scheme}", "${uri}")\n    if err != nil {\n        log.Fatalf("Failed to open DB: %v", err)\n    }\n    db.SetMaxOpenConns(${pool})\n    return db\n}`;
  }

  private generateRustSnippet(profile: any, scheme: string, uri: string, driverPkg: string): string {
    if (profile.isPostgresFamily) {
      return `use sqlx::postgres::PgPoolOptions;\n\n#[tokio::main]\nasync fn main() -> Result<(), sqlx::Error> {\n    let pool = PgPoolOptions::new()\n        .max_connections(20)\n        .connect("${uri}")\n        .await?;\n\n    let row: (i64,) = sqlx::query_as("SELECT count(*) FROM users")\n        .fetch_one(&pool)\n        .await?;\n\n    println!("Total users: {}", row.0);\n    Ok(())\n}`;
    }
    if (profile.dialect === 'mysql') {
      return `use sqlx::mysql::MySqlPoolOptions;\n\n#[tokio::main]\nasync fn main() -> Result<(), sqlx::Error> {\n    let pool = MySqlPoolOptions::new()\n        .max_connections(20)\n        .connect("${uri}")\n        .await?;\n\n    let row: (i64,) = sqlx::query_as("SELECT count(*) FROM users")\n        .fetch_one(&pool)\n        .await?;\n\n    println!("Total users: {}", row.0);\n    Ok(())\n}`;
    }
    if (profile.dialect === 'sqlite') {
      return `use sqlx::sqlite::SqlitePoolOptions;\n\n#[tokio::main]\nasync fn main() -> Result<(), sqlx::Error> {\n    let pool = SqlitePoolOptions::new()\n        .max_connections(5)\n        .connect("${uri}")\n        .await?;\n\n    let row: (i64,) = sqlx::query_as("SELECT count(*) FROM users")\n        .fetch_one(&pool)\n        .await?;\n\n    println!("Total users: {}", row.0);\n    Ok(())\n}`;
    }
    return `// Rust connection pool for ${profile.name}\n// Driver/crate: ${driverPkg}\n// Endpoint: ${uri}`;
  }

  private generateJavaSnippet(scheme: string, jdbcUrl: string, user: string, pass: string, pool: number): string {
    return `# application.properties (Spring Boot & HikariCP)
spring.datasource.url=${jdbcUrl}
spring.datasource.username=${user}
spring.datasource.password=${pass}
spring.datasource.hikari.maximum-pool-size=${pool}
spring.datasource.hikari.minimum-idle=5
spring.datasource.hikari.connection-timeout=20000
spring.datasource.hikari.idle-timeout=300000
spring.datasource.hikari.max-lifetime=1800000
`;
  }
}
