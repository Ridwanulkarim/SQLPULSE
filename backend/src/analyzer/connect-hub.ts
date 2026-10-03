import { DATABASE_CATALOG } from '../types/db-catalog.data';

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
    const host = req.host || '127.0.0.1';
    const db = req.database || 'production_db';
    const user = req.username || 'db_user';
    const pass = req.password || 'Secr3tP@ssw0rd!';
    const ssl = req.sslMode || 'require';
    const pool = req.poolSize || 20;

    let defaultPort = 5432;
    let scheme = 'postgresql';
    let driverPkg = 'pg';

    const normalized = req.engine.toLowerCase();

    if (normalized === 'mysql' || normalized === 'mariadb') {
      defaultPort = 3306;
      scheme = 'mysql';
      driverPkg = 'mysql2';
    } else if (normalized === 'clickhouse') {
      defaultPort = 8123;
      scheme = 'clickhouse';
      driverPkg = '@clickhouse/client';
    } else if (normalized === 'redis' || normalized === 'keydb') {
      defaultPort = 6379;
      scheme = 'redis';
      driverPkg = 'ioredis';
    } else if (normalized === 'mongodb') {
      defaultPort = 27017;
      scheme = 'mongodb';
      driverPkg = 'mongodb';
    } else if (normalized === 'cassandra' || normalized === 'scylladb') {
      defaultPort = 9042;
      scheme = 'cql';
      driverPkg = 'cassandra-driver';
    } else if (normalized === 'neo4j') {
      defaultPort = 7687;
      scheme = 'bolt';
      driverPkg = 'neo4j-driver';
    } else if (normalized === 'elasticsearch' || normalized === 'opensearch') {
      defaultPort = 9200;
      scheme = 'https';
      driverPkg = '@elastic/elasticsearch';
    }

    const port = req.port || defaultPort;

    // Generate URI
    let connectionUri = '';
    let maskedUri = '';
    let jdbcUrl = '';

    if (scheme === 'redis') {
      connectionUri = `redis://default:${pass}@${host}:${port}/0`;
      maskedUri = `redis://default:••••••••@${host}:${port}/0`;
      jdbcUrl = `jdbc:redis://${host}:${port}/0`;
    } else if (scheme === 'mongodb') {
      connectionUri = `mongodb://${user}:${pass}@${host}:${port}/${db}?authSource=admin&ssl=${ssl === 'require' ? 'true' : 'false'}`;
      maskedUri = `mongodb://${user}:••••••••@${host}:${port}/${db}?authSource=admin&ssl=${ssl === 'require' ? 'true' : 'false'}`;
      jdbcUrl = `jdbc:mongodb://${host}:${port}/${db}`;
    } else if (scheme === 'bolt') {
      connectionUri = `bolt://${user}:${pass}@${host}:${port}`;
      maskedUri = `bolt://${user}:••••••••@${host}:${port}`;
      jdbcUrl = `jdbc:neo4j:bolt://${host}:${port}`;
    } else {
      connectionUri = `${scheme}://${user}:${pass}@${host}:${port}/${db}?sslmode=${ssl}`;
      maskedUri = `${scheme}://${user}:••••••••@${host}:${port}/${db}?sslmode=${ssl}`;
      jdbcUrl = `jdbc:${scheme}://${host}:${port}/${db}?sslmode=${ssl}`;
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

    // Code Snippets
    const codeSnippets: CodeSnippet[] = [
      {
        language: 'typescript',
        label: 'Node.js / TypeScript',
        code: this.generateTypeScriptSnippet(scheme, connectionUri, host, port, user, pass, db, pool),
      },
      {
        language: 'python',
        label: 'Python (Async / Sync)',
        code: this.generatePythonSnippet(scheme, connectionUri, host, port, user, pass, db, pool),
      },
      {
        language: 'go',
        label: 'Go (Golang)',
        code: this.generateGoSnippet(scheme, connectionUri, host, port, user, pass, db, pool),
      },
      {
        language: 'rust',
        label: 'Rust (SQLx)',
        code: this.generateRustSnippet(scheme, connectionUri),
      },
      {
        language: 'java',
        label: 'Java (Spring Boot / HikariCP)',
        code: this.generateJavaSnippet(scheme, jdbcUrl, user, pass, pool),
      },
    ];

    // ORM Snippets
    const ormSnippets: OrmSnippet[] = [
      {
        orm: 'prisma',
        label: 'Prisma ORM',
        filename: 'prisma/schema.prisma',
        code: `datasource db {\n  provider = "${scheme === 'postgres' || scheme === 'postgresql' ? 'postgresql' : scheme === 'mysql' ? 'mysql' : scheme === 'mongodb' ? 'mongodb' : 'postgresql'}"\n  url      = env("DATABASE_URL")\n}\n\ngenerator client {\n  provider = "prisma-client-js"\n}`,
      },
      {
        orm: 'drizzle',
        label: 'Drizzle ORM',
        filename: 'drizzle.config.ts',
        code: `import { defineConfig } from "drizzle-kit";\n\nexport default defineConfig({\n  schema: "./src/schema.ts",\n  out: "./drizzle",\n  dialect: "${scheme === 'mysql' ? 'mysql' : 'postgresql'}",\n  dbCredentials: {\n    url: process.env.DATABASE_URL!,\n  },\n});`,
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

  private generateTypeScriptSnippet(scheme: string, uri: string, host: string, port: number, user: string, pass: string, db: string, pool: number): string {
    if (scheme === 'redis') {
      return `import Redis from 'ioredis';\n\nconst redis = new Redis(process.env.DATABASE_URL || "${uri}", {\n  maxRetriesPerRequest: 3,\n  enableReadyCheck: true,\n});\n\nexport default redis;`;
    }
    if (scheme === 'mongodb') {
      return `import { MongoClient } from 'mongodb';\n\nconst client = new MongoClient(process.env.DATABASE_URL || "${uri}", {\n  maxPoolSize: ${pool},\n  minPoolSize: 2,\n});\n\nawait client.connect();\nexport const db = client.db("${db}");`;
    }
    return `import { Pool } from 'pg';\n\nexport const pool = new Pool({\n  connectionString: process.env.DATABASE_URL,\n  max: ${pool},\n  idleTimeoutMillis: 30000,\n  connectionTimeoutMillis: 3000,\n  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,\n});\n\nexport const query = (text: string, params?: any[]) => pool.query(text, params);`;
  }

  private generatePythonSnippet(scheme: string, uri: string, host: string, port: number, user: string, pass: string, db: string, pool: number): string {
    if (scheme === 'redis') {
      return `import redis\n\nr = redis.from_url("${uri}", decode_responses=True)\n# Example: r.set("key", "value")`;
    }
    if (scheme === 'mongodb') {
      return `from pymongo import MongoClient\n\nclient = MongoClient("${uri}", maxPoolSize=${pool})\ndb = client["${db}"]`;
    }
    return `import psycopg2\nfrom psycopg2 import pool\n\nconnection_pool = psycopg2.pool.SimpleConnectionPool(\n    minconn=1,\n    maxconn=${pool},\n    dsn="${uri}"\n)\n\n# Get connection from pool:\nconn = connection_pool.getconn()`;
  }

  private generateGoSnippet(scheme: string, uri: string, host: string, port: number, user: string, pass: string, db: string, pool: number): string {
    return `package main\n\nimport (\n    "database/sql"\n    "log"\n    _ "github.com/lib/pq"\n)\n\nfunc InitDB() *sql.DB {\n    db, err := sql.Open("postgres", "${uri}")\n    if err != nil {\n        log.Fatalf("Failed to open DB: %v", err)\n    }\n    db.SetMaxOpenConns(${pool})\n    db.SetMaxIdleConns(5)\n    return db\n}`;
  }

  private generateRustSnippet(scheme: string, uri: string): string {
    return `use sqlx::postgres::PgPoolOptions;\n\n#[tokio::main]\nasync fn main() -> Result<(), sqlx::Error> {\n    let pool = PgPoolOptions::new()\n        .max_connections(20)\n        .connect("${uri}")\n        .await?;\n\n    let row: (i64,) = sqlx::query_as("SELECT count(*) FROM users")\n        .fetch_one(&pool)\n        .await?;\n\n    println!("Total users: {}", row.0);\n    Ok(())\n}`;
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
