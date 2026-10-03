import React, { useState, useEffect } from 'react';
import {
  ArrowRightLeft,
  Copy,
  Check,
  AlertTriangle,
  Info,
  ShieldAlert,
  Code2,
  Table2
} from 'lucide-react';
import { UniversalDbSelector } from './UniversalDbSelector';
import { DbBrandLogo } from './DbBrandLogo';
import { transpileSql } from '../services/api';
import { TranspileResult, DATABASE_CATALOG } from '../types';

export const TranspilerTab: React.FC = () => {
  const [sourceEngine, setSourceEngine] = useState<string>('oracle');
  const [targetEngine, setTargetEngine] = useState<string>('postgresql');
  const [sourceCode, setSourceCode] = useState<string>(
    `-- Oracle DDL & Query Sample
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
WHERE ROWNUM <= 10;`
  );

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TranspileResult | null>(null);
  const [copied, setCopied] = useState(false);

  const presets = [
    {
      label: 'Oracle ➔ PostgreSQL',
      src: 'oracle',
      tgt: 'postgresql',
      code: `CREATE TABLE employees (
    emp_id NUMBER(8) PRIMARY KEY,
    full_name VARCHAR2(100) NOT NULL,
    salary NUMBER(10,2),
    hire_date DATE DEFAULT SYSDATE,
    bio CLOB
);

SELECT 
    full_name, 
    NVL(salary, 0) AS gross_salary, 
    SYSDATE AS query_time
FROM employees 
WHERE ROWNUM <= 25;`,
    },
    {
      label: 'MySQL ➔ PostgreSQL',
      src: 'mysql',
      tgt: 'postgresql',
      code: `CREATE TABLE user_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(80) NOT NULL,
    metadata JSON,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

SELECT \`id\`, \`username\`, IFNULL(metadata->>'$.tier', 'free') AS tier
FROM \`user_accounts\`
WHERE \`is_active\` = 1
LIMIT 50;`,
    },
    {
      label: 'SQL Server ➔ PostgreSQL',
      src: 'microsoft_sql_server',
      tgt: 'postgresql',
      code: `CREATE TABLE [dbo].[Subscriptions] (
    [SubId] UNIQUEIDENTIFIER PRIMARY KEY,
    [PlanName] NVARCHAR(100) NOT NULL,
    [MonthlyRate] MONEY,
    [IsActive] BIT DEFAULT 1,
    [RenewalDate] DATETIME2
);

SELECT TOP 10 
    [PlanName], 
    ISNULL([MonthlyRate], 0) AS Price, 
    GETDATE() AS CurrentTs
FROM [dbo].[Subscriptions];`,
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
      label: 'MongoDB ➔ PostgreSQL JSONB',
      src: 'mongodb',
      tgt: 'postgresql',
      code: `db.orders.find({
    status: "completed",
    total_amount: { $gte: 150.00 }
}).sort({ createdAt: -1 }).limit(20);`,
    },
  ];

  const handleTranspile = async () => {
    if (!sourceCode.trim()) return;
    setIsLoading(true);
    try {
      const res = await transpileSql(sourceEngine, targetEngine, sourceCode);
      setResult(res);
    } catch (err: any) {
      alert(err.message || 'Transpilation failed');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleTranspile();
  }, [sourceEngine, targetEngine]);

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
  };

  const swapEngines = () => {
    const temp = sourceEngine;
    setSourceEngine(targetEngine);
    setTargetEngine(temp);
    if (result) {
      setSourceCode(result.transpiledCode);
    }
  };

  const srcMeta = DATABASE_CATALOG.find(db => db.id === sourceEngine) || { id: sourceEngine, name: sourceEngine, icon: '🗄️' };
  const tgtMeta = DATABASE_CATALOG.find(db => db.id === targetEngine) || { id: targetEngine, name: targetEngine, icon: '🐘' };

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
              onSelectEngine={setSourceEngine}
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
            <button
              type="button"
              onClick={handleTranspile}
              disabled={isLoading}
              className="px-3 py-1 rounded-lg text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 shadow-sm transition disabled:opacity-50"
            >
              {isLoading ? 'Transpiling...' : 'Transpile ➔'}
            </button>
          </div>
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
                  <table className="w-full text-xs text-left">
                    <thead className="bg-purple-50 text-slate-700 border-b border-purple-100">
                      <tr>
                        <th className="py-2 px-3">Source Type</th>
                        <th className="py-2 px-3">Target Type</th>
                        <th className="py-2 px-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-100">
                      {result.dataTypeMappings.map((m, idx) => (
                        <tr key={idx} className="hover:bg-purple-50/40">
                          <td className="py-2 px-3 font-mono font-bold text-slate-800">{m.sourceType}</td>
                          <td className="py-2 px-3 font-mono font-bold text-emerald-700">{m.targetType}</td>
                          <td className="py-2 px-3 text-slate-600">{m.notes}</td>
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
                <h3 className="text-sm font-bold text-slate-900">Function &amp; Operator Translations</h3>
              </div>
              {result.functionMappings.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No function replacements were triggered.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-indigo-50 text-slate-700 border-b border-indigo-100">
                      <tr>
                        <th className="py-2 px-3">Source Function</th>
                        <th className="py-2 px-3">Target Function</th>
                        <th className="py-2 px-3">Explanation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-indigo-100">
                      {result.functionMappings.map((f, idx) => (
                        <tr key={idx} className="hover:bg-indigo-50/40">
                          <td className="py-2 px-3 font-mono font-bold text-slate-800">{f.sourceFunc}</td>
                          <td className="py-2 px-3 font-mono font-bold text-indigo-700">{f.targetFunc}</td>
                          <td className="py-2 px-3 text-slate-600">{f.explanation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {result.caveats.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/80 border border-amber-300/80 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4.5 h-4.5 text-amber-600" />
                <h3 className="text-sm font-extrabold text-amber-950">
                  Critical Migration Gotchas &amp; Quirks ({result.sourceEngineName} ➔ {result.targetEngineName})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {result.caveats.map((c, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border ${
                      c.severity === 'critical'
                        ? 'bg-rose-50 border-rose-200 text-rose-950'
                        : c.severity === 'warning'
                        ? 'bg-amber-50/90 border-amber-200 text-amber-950'
                        : 'bg-blue-50 border-blue-200 text-blue-950'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 font-bold text-xs uppercase tracking-wider">
                      {c.severity === 'critical' ? (
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                      ) : (
                        <Info className="w-3.5 h-3.5 text-amber-600" />
                      )}
                      <span>{c.title}</span>
                    </div>
                    <p className="text-xs leading-relaxed opacity-90">{c.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
