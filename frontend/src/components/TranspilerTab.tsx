import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowRightLeft,
  Copy,
  Check,
  AlertTriangle,
  Info,
  ShieldAlert,
  Code2,
  Table2,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { UniversalDbSelector } from './UniversalDbSelector';
import { DbBrandLogo } from './DbBrandLogo';
import { transpileSql } from '../services/api';
import { TranspileResult, DATABASE_CATALOG, DatabaseEngine } from '../types';

interface TranspilerTabProps {
  selectedEngine?: DatabaseEngine | string;
  onSelectEngine?: (engine: DatabaseEngine) => void;
}

export function getDefaultSampleForEngine(engineId: string): string {
  const norm = (engineId || '').toLowerCase().trim();

  if (norm === 'mysql' || norm === 'mariadb' || norm === 'tidb' || norm === 'percona' || norm === 'planetscale') {
    return `-- MySQL DDL & Query Sample
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
LIMIT 10;`;
  }

  if (norm === 'oracle' || norm === 'db2') {
    return `-- Oracle DDL & Query Sample
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
WHERE ROWNUM <= 10;`;
  }

  if (norm === 'microsoft_sql_server' || norm === 'mssql' || norm === 'sqlserver' || norm === 'azure_sql') {
    return `-- Microsoft SQL Server (T-SQL) DDL & Query Sample
CREATE TABLE [dbo].[customer_orders] (
    [order_id] INT IDENTITY(1,1) PRIMARY KEY,
    [customer_name] NVARCHAR(255) NOT NULL,
    [order_total] DECIMAL(12, 2),
    [order_date] DATETIME2 DEFAULT GETDATE(),
    [order_notes] NVARCHAR(MAX)
);

SELECT TOP 10 
    [customer_name], 
    ISNULL([order_total], 0) AS total_amount, 
    GETDATE() AS extracted_at
FROM [dbo].[customer_orders];`;
  }

  if (norm === 'clickhouse') {
    return `-- ClickHouse Columnar DDL & Query Sample
CREATE TABLE customer_orders (
    order_id UInt64,
    customer_name String,
    order_total Decimal(12, 2),
    order_date DateTime DEFAULT now(),
    order_notes String
)
ENGINE = ReplacingMergeTree()
ORDER BY (order_id);

SELECT 
    customer_name, 
    COALESCE(order_total, 0) AS total_amount, 
    now() AS extracted_at
FROM customer_orders
LIMIT 10;`;
  }

  if (norm.includes('hive') || norm.includes('spark') || norm.includes('databricks')) {
    return `-- Apache Hive DDL & Query Sample
CREATE TABLE customer_orders (
    order_id BIGINT,
    customer_name STRING,
    order_total DECIMAL(12, 2),
    order_date TIMESTAMP,
    order_notes STRING
)
STORED AS ORC
TBLPROPERTIES ("transactional"="true");

SELECT 
    customer_name, 
    COALESCE(order_total, 0) AS total_amount, 
    CURRENT_TIMESTAMP() AS extracted_at
FROM customer_orders
LIMIT 10;`;
  }

  if (norm === 'snowflake') {
    return `-- Snowflake Data Warehouse DDL & Query Sample
CREATE TABLE customer_orders (
    order_id NUMBER AUTOINCREMENT START 1 INCREMENT 1 PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    order_total NUMBER(12, 2),
    order_date TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    metadata VARIANT,
    order_notes VARCHAR
);

SELECT 
    customer_name, 
    COALESCE(order_total, 0) AS total_amount, 
    CURRENT_TIMESTAMP() AS extracted_at
FROM customer_orders
LIMIT 10;`;
  }

  if (norm.includes('mongo') || norm.includes('document')) {
    return `// MongoDB MQL Query Sample
db.customer_orders.aggregate([
  {
    $match: {
      status: "active",
      order_total: { $gte: 100 }
    }
  },
  {
    $sort: { order_date: -1 }
  },
  {
    $limit: 10
  },
  {
    $project: {
      _id: 1,
      customer_name: 1,
      order_total: 1,
      order_date: 1
    }
  }
]);`;
  }

  if (norm === 'redis' || norm === 'dragonfly' || norm === 'keydb') {
    return `// RediSearch & RedisJSON Query Sample
FT.SEARCH idx:customer_orders "@status:{active}"
  RETURN 3 customer_name order_total order_date
  SORTBY order_date DESC
  LIMIT 0 10;`;
  }

  if (norm.includes('cassandra') || norm.includes('scylla')) {
    return `-- Cassandra CQL DDL & Query Sample
CREATE KEYSPACE IF NOT EXISTS retail_store
WITH replication = {'class': 'NetworkTopologyStrategy', 'us-east-1': 3};

CREATE TABLE retail_store.customer_orders (
  customer_id uuid,
  order_date timestamp,
  order_id uuid,
  customer_name text,
  order_total decimal,
  PRIMARY KEY ((customer_id), order_date, order_id)
) WITH CLUSTERING ORDER BY (order_date DESC, order_id ASC);

SELECT customer_name, order_total, order_date
FROM retail_store.customer_orders
WHERE customer_id = 550e8400-e29b-41d4-a716-446655440000
LIMIT 10;`;
  }

  if (norm.includes('neo4j') || norm.includes('graph')) {
    return `// Neo4j Cypher Graph Sample
MATCH (u:User)-[r:PLACED]->(o:customer_orders)
WHERE o.status = 'active'
RETURN u.name AS customer_name, count(o) AS order_count, sum(o.order_total) AS total_amount
ORDER BY total_amount DESC
LIMIT 10;`;
  }

  if (norm.includes('influx') || norm.includes('quest')) {
    return `// InfluxDB Flux Time-Series Sample
from(bucket: "customer_orders")
  |> range(start: -7d)
  |> filter(fn: (r) => r._measurement == "orders" and r.status == "active")
  |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)
  |> yield(name: "hourly_order_volume");`;
  }

  if (norm === 'sqlite' || norm === 'turso' || norm === 'cloudflared1') {
    return `-- SQLite DDL & Query Sample
CREATE TABLE customer_orders (
    order_id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    order_total REAL,
    order_date TEXT DEFAULT (datetime('now')),
    order_notes TEXT
);

SELECT 
    customer_name, 
    COALESCE(order_total, 0) AS total_amount, 
    datetime('now') AS extracted_at
FROM customer_orders
LIMIT 10;`;
  }

  if (norm === 'bigquery' || norm === 'google_cloud_bigquery') {
    return `-- Google BigQuery SQL Sample
CREATE TABLE \`my_project.my_dataset.customer_orders\` (
    order_id INT64,
    customer_name STRING NOT NULL,
    order_total NUMERIC,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
    order_notes STRING
);

SELECT 
    customer_name, 
    COALESCE(order_total, 0) AS total_amount, 
    CURRENT_TIMESTAMP() AS extracted_at
FROM \`my_project.my_dataset.customer_orders\`
LIMIT 10;`;
  }

  if (norm.includes('elastic') || norm.includes('opensearch')) {
    return `// Elasticsearch / OpenSearch Search DSL
GET /customer_orders/_search
{
  "query": {
    "match": {
      "status": "active"
    }
  },
  "_source": ["customer_name", "order_total", "order_date"],
  "size": 10,
  "sort": [
    { "order_date": { "order": "desc" } }
  ]
};`;
  }

  // Default: PostgreSQL
  return `-- PostgreSQL DDL & Query Sample
CREATE TABLE customer_orders (
    order_id BIGSERIAL PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    order_total NUMERIC(12, 2),
    order_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB,
    order_notes TEXT
);

SELECT 
    customer_name, 
    COALESCE(order_total, 0) AS total_amount, 
    CURRENT_TIMESTAMP AS extracted_at
FROM customer_orders
LIMIT 10;`;
}

export function detectDialectFromCode(code: string): string | null {
  if (!code || code.length < 10) return null;
  if (/\bVARCHAR2\b|\bNUMBER\s*\(|\bCLOB\b|\bROWNUM\b|\bNVL\s*\(|\bSYSDATE\b|FROM\s+DUAL/i.test(code)) {
    return 'oracle';
  }
  if (/AUTO_INCREMENT|\bTINYINT\s*\(\s*1\s*\)|ENGINE\s*=\s*InnoDB|`[a-zA-Z0-9_]+`/i.test(code)) {
    return 'mysql';
  }
  if (/IDENTITY\s*\(|\bDATETIME2\b|\bUNIQUEIDENTIFIER\b|\[dbo\]|\[[a-zA-Z0-9_]+\]|SELECT\s+TOP\b|\bGETDATE\(\)/i.test(code)) {
    return 'microsoft_sql_server';
  }
  if (/\bBIGSERIAL\b|\bJSONB\b|\bTIMESTAMPTZ\b|::text|::jsonb|\bILIKE\b/i.test(code)) {
    return 'postgresql';
  }
  if (/ReplacingMergeTree|\bUInt32\b|\bUInt64\b|\bDateTime64\b/i.test(code)) {
    return 'clickhouse';
  }
  if (/STORED\s+AS\s+ORC|STORED\s+AS\s+PARQUET|TBLPROPERTIES/i.test(code)) {
    return 'apache_hive';
  }
  if (/\bdb\.[a-zA-Z0-9_]+\.find|\bdb\.[a-zA-Z0-9_]+\.aggregate/i.test(code)) {
    return 'mongodb';
  }
  if (/FT\.CREATE|FT\.SEARCH|\bHGETALL\b/i.test(code)) {
    return 'redis';
  }
  if (/MATCH\s*\(.*-\[.*\]->/i.test(code)) {
    return 'neo4j';
  }
  return null;
}

export const TranspilerTab: React.FC<TranspilerTabProps> = ({
  selectedEngine: propEngine,
  onSelectEngine,
}) => {
  const [sourceEngine, setSourceEngine] = useState<string>('oracle');
  const [targetEngine, setTargetEngine] = useState<string>(
    propEngine && propEngine !== 'oracle' ? propEngine : 'postgresql'
  );

  useEffect(() => {
    if (propEngine && propEngine !== targetEngine && propEngine !== sourceEngine) {
      setTargetEngine(propEngine);
    }
  }, [propEngine]);

  const [sourceCode, setSourceCode] = useState<string>(() => getDefaultSampleForEngine('oracle'));
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TranspileResult | null>(null);
  const [copied, setCopied] = useState(false);

  const presets = [
    {
      label: 'MySQL ➔ Oracle',
      src: 'mysql',
      tgt: 'oracle',
      code: getDefaultSampleForEngine('mysql'),
    },
    {
      label: 'Oracle ➔ MySQL',
      src: 'oracle',
      tgt: 'mysql',
      code: getDefaultSampleForEngine('oracle'),
    },
    {
      label: 'Oracle ➔ Apache Hive',
      src: 'oracle',
      tgt: 'apache_hive',
      code: getDefaultSampleForEngine('oracle'),
    },
    {
      label: 'PostgreSQL ➔ Oracle',
      src: 'postgresql',
      tgt: 'oracle',
      code: getDefaultSampleForEngine('postgresql'),
    },
    {
      label: 'PostgreSQL ➔ SQL Server',
      src: 'postgresql',
      tgt: 'microsoft_sql_server',
      code: getDefaultSampleForEngine('postgresql'),
    },
    {
      label: 'MySQL ➔ PostgreSQL',
      src: 'mysql',
      tgt: 'postgresql',
      code: getDefaultSampleForEngine('mysql'),
    },
    {
      label: 'SQL Server ➔ PostgreSQL',
      src: 'microsoft_sql_server',
      tgt: 'postgresql',
      code: getDefaultSampleForEngine('microsoft_sql_server'),
    },
    {
      label: 'PostgreSQL ➔ ClickHouse (OLAP)',
      src: 'postgresql',
      tgt: 'clickhouse',
      code: `CREATE TABLE web_events (
    id BIGSERIAL,
    event_name VARCHAR(100) NOT NULL,
    payload JSONB,
    event_timestamp TIMESTAMPTZ DEFAULT NOW()
);

SELECT event_name, COUNT(*) AS event_count
FROM web_events
WHERE event_timestamp >= NOW() - INTERVAL '7 days'
GROUP BY event_name
LIMIT 10;`,
    },
    {
      label: 'PostgreSQL ➔ Snowflake',
      src: 'postgres',
      tgt: 'snowflake',
      code: `CREATE TABLE event_store (
    id BIGSERIAL PRIMARY KEY,
    payload JSONB,
    binary_data BYTEA,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

SELECT payload:user_id::STRING, COUNT(*)
FROM event_store
WHERE recorded_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY 1
LIMIT 50;`,
    },
    {
      label: 'Cassandra CQL ➔ PostgreSQL',
      src: 'cassandra',
      tgt: 'postgresql',
      code: getDefaultSampleForEngine('cassandra'),
    },
    {
      label: 'Redis ➔ PostgreSQL',
      src: 'redis',
      tgt: 'postgresql',
      code: getDefaultSampleForEngine('redis'),
    },
    {
      label: 'MongoDB ➔ PostgreSQL JSONB',
      src: 'mongodb',
      tgt: 'postgresql',
      code: getDefaultSampleForEngine('mongodb'),
    },
  ];

  const handleTranspile = async (src = sourceEngine, tgt = targetEngine, code = sourceCode) => {
    if (!code.trim()) return;
    setIsLoading(true);
    try {
      const res = await transpileSql(src, tgt, code);
      setResult(res);
    } catch (err: any) {
      alert(err.message || 'Transpilation failed');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleTranspile(sourceEngine, targetEngine, sourceCode);
  }, [sourceEngine, targetEngine]);

  const handleSourceEngineChange = (newEngine: string) => {
    setSourceEngine(newEngine);
    const newCode = getDefaultSampleForEngine(newEngine);
    setSourceCode(newCode);
    handleTranspile(newEngine, targetEngine, newCode);
  };

  const handleResetSample = () => {
    const freshSample = getDefaultSampleForEngine(sourceEngine);
    setSourceCode(freshSample);
    handleTranspile(sourceEngine, targetEngine, freshSample);
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.transpiledCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const applyPreset = (preset: typeof presets[0]) => {
    setSourceEngine(preset.src);
    setTargetEngine(preset.tgt);
    setSourceCode(preset.code);
    handleTranspile(preset.src, preset.tgt, preset.code);
  };

  const swapEngines = () => {
    const temp = sourceEngine;
    const newTarget = temp;
    const newSource = targetEngine;
    const newCode = result ? result.transpiledCode : sourceCode;
    setSourceEngine(newSource);
    setTargetEngine(newTarget);
    setSourceCode(newCode);
    handleTranspile(newSource, newTarget, newCode);
  };

  const srcMeta = DATABASE_CATALOG.find(db => db.id === sourceEngine) || { id: sourceEngine, name: sourceEngine, icon: '🗄️' };
  const tgtMeta = DATABASE_CATALOG.find(db => db.id === targetEngine) || { id: targetEngine, name: targetEngine, icon: '🐘' };

  // Detect mismatch between selected source dialect and actual code syntax
  const detectedDialect = useMemo(() => detectDialectFromCode(sourceCode), [sourceCode]);
  const detectedMeta = detectedDialect ? (DATABASE_CATALOG.find(db => db.id === detectedDialect) || { id: detectedDialect, name: detectedDialect }) : null;
  const isDialectMismatch = detectedDialect && detectedDialect !== sourceEngine && detectedMeta && !sourceEngine.includes(detectedDialect);

  return (
    <div className="space-y-6">
      
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-purple-900/90 via-indigo-900/90 to-purple-950/90 text-white shadow-xl shadow-purple-950/20 border border-purple-500/30 backdrop-blur-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-purple-500/30 text-purple-200 border border-purple-400/40">
              Polyglot Transpiler Studio
            </span>
            <span className="text-xs text-purple-300 font-medium">
              447 Database Engine Cross-Dialect Migration
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Universal SQL &amp; Schema Transpiler
          </h2>
          <p className="text-xs sm:text-sm text-purple-200/90 mt-1 max-w-3xl">
            Translate DDLs, queries, JSON paths, date math, and datatype dialect specifics between any 2 databases with automatic gotcha detection.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
          <Code2 className="w-3.5 h-3.5 text-purple-600" /> Presets:
        </span>
        {presets.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => applyPreset(p)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-purple-200 text-slate-700 hover:bg-purple-50 hover:border-purple-400 shadow-sm transition active:scale-95"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-5 rounded-2xl bg-white/80 border border-purple-200/70 shadow-sm backdrop-blur-md">
        <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] items-center gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Source Database Dialect ({DATABASE_CATALOG.length} Engines)
            </label>
            <UniversalDbSelector
              selectedEngine={sourceEngine}
              onSelectEngine={handleSourceEngineChange}
            />
          </div>

          <div className="flex justify-center pt-2 md:pt-6">
            <button
              type="button"
              onClick={swapEngines}
              title="Swap Source and Target"
              className="p-2.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-300 shadow-sm transition active:scale-95"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Target Database Dialect ({DATABASE_CATALOG.length} Engines)
            </label>
            <UniversalDbSelector
              selectedEngine={targetEngine}
              onSelectEngine={setTargetEngine}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <div className="flex flex-col rounded-2xl bg-white border border-purple-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-purple-50/70 border-b border-purple-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DbBrandLogo engineId={srcMeta.id} size={18} />
              <span className="text-xs font-bold text-slate-900">
                Source: {srcMeta.name} Code
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetSample}
                title={`Load authentic ${srcMeta.name} sample code`}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-purple-700 bg-white border border-purple-300 hover:bg-purple-100 shadow-sm transition active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>Load {srcMeta.name} Sample</span>
              </button>
              <button
                type="button"
                onClick={() => handleTranspile(sourceEngine, targetEngine, sourceCode)}
                disabled={isLoading}
                className="px-3 py-1 rounded-lg text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 shadow-sm transition disabled:opacity-50"
              >
                {isLoading ? 'Transpiling...' : 'Transpile ➔'}
              </button>
            </div>
          </div>

          {isDialectMismatch && (
            <div className="px-3 py-2 bg-amber-500/10 border-b border-amber-500/30 flex items-center justify-between text-xs text-amber-900 flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  Code appears to be <strong>{detectedMeta?.name}</strong>, but source engine is <strong>{srcMeta.name}</strong>.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSourceEngineChange(detectedDialect!)}
                  className="font-bold underline text-amber-800 hover:text-amber-950 transition"
                >
                  Switch Source to {detectedMeta?.name}
                </button>
                <span className="text-amber-400">|</span>
                <button
                  type="button"
                  onClick={handleResetSample}
                  className="font-bold underline text-purple-800 hover:text-purple-950 transition"
                >
                  Load {srcMeta.name} Code
                </button>
              </div>
            </div>
          )}

          <textarea
            value={sourceCode}
            onChange={(e) => setSourceCode(e.target.value)}
            rows={14}
            placeholder="Paste your source DDL, query, or script here..."
            className="w-full p-4 font-mono text-xs sm:text-sm bg-slate-900 text-purple-100 focus:outline-none resize-y selection:bg-purple-600 selection:text-white"
          />
        </div>

        <div className="flex flex-col rounded-2xl bg-white border border-purple-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-emerald-50/70 border-b border-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DbBrandLogo engineId={tgtMeta.id} size={18} />
              <span className="text-xs font-bold text-slate-900">
                Target: {tgtMeta.name} Dialect
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 shadow-sm transition active:scale-95"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-emerald-600" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>
          <pre className="w-full p-4 font-mono text-xs sm:text-sm bg-slate-950 text-emerald-300 overflow-x-auto h-full min-h-[280px] selection:bg-emerald-600 selection:text-white">
            {result ? result.transpiledCode : '// Transpiled code will appear here...'}
          </pre>
        </div>
      </div>

      {result && (
        <div className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-purple-200 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Table2 className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900">DataType Conversions Applied</h3>
              </div>
              {result.dataTypeMappings.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No complex datatype conversions required.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-purple-100 text-slate-500 font-semibold">
                        <th className="py-2 px-2">Source Type ({result.sourceEngineName})</th>
                        <th className="py-2 px-2">Target Type ({result.targetEngineName})</th>
                        <th className="py-2 px-2">Architectural Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {result.dataTypeMappings.map((m, idx) => (
                        <tr key={idx} className="hover:bg-purple-50/50">
                          <td className="py-2 px-2 text-rose-700 font-medium">{m.sourceType}</td>
                          <td className="py-2 px-2 text-emerald-700 font-medium">{m.targetType}</td>
                          <td className="py-2 px-2 text-slate-600 font-sans">{m.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-purple-200 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Code2 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Function &amp; Clause Mappings</h3>
              </div>
              {result.functionMappings.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Standard syntax preserved without function rewriting.</p>
              ) : (
                <div className="space-y-2">
                  {result.functionMappings.map((f, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-rose-700 line-through">{f.sourceFunc}</span>
                        <span className="text-slate-400">➔</span>
                        <span className="text-emerald-700 font-bold">{f.targetFunc}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">{f.explanation}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {result.caveats.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-amber-200/80 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">Migration Gotchas &amp; Dialect Caveats</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {result.caveats.map((c, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs ${
                      c.severity === 'critical'
                        ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                        : c.severity === 'warning'
                        ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                        : 'bg-purple-50/50 border-purple-200 text-purple-950'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold mb-1">
                      {c.severity === 'critical' ? (
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                      ) : (
                        <Info className="w-3.5 h-3.5 text-purple-600" />
                      )}
                      <span>{c.title}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed opacity-90">{c.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.optimizationsApplied.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-emerald-200/80 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Check className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Optimizations &amp; Dialect Normalizations Applied</h3>
              </div>
              <ul className="space-y-1.5 text-xs text-emerald-900 font-medium">
                {result.optimizationsApplied.map((opt, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span>{opt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
