import React, { useState, useEffect } from 'react';
import { adviseQuery } from '../services/api';
import { DatabaseEngine, QueryAdvisorResult, DATABASE_CATALOG } from '../types';
import { UniversalDbSelector } from './UniversalDbSelector';
import { Copy, Check, Zap, AlertTriangle, CheckCircle2, ShieldAlert, Cpu, ArrowRight, Layers, GitCompare } from 'lucide-react';

interface QueryAdvisorTabProps {
  selectedEngine?: DatabaseEngine | string;
  onSelectEngine?: (engine: DatabaseEngine) => void;
}

export const QueryAdvisorTab: React.FC<QueryAdvisorTabProps> = ({
  selectedEngine: propEngine,
  onSelectEngine,
}) => {
  const [selectedEngine, setSelectedEngine] = useState<DatabaseEngine>(
    (propEngine as DatabaseEngine) || 'postgres'
  );

  useEffect(() => {
    if (propEngine && propEngine !== selectedEngine) {
      setSelectedEngine(propEngine as DatabaseEngine);
    }
  }, [propEngine]);
  const [queryText, setQueryText] = useState(
    `SELECT * \nFROM orders o\nJOIN customers c ON o.customer_id = c.id\nWHERE YEAR(o.created_at) = 2024 \n  AND o.status = 'completed'\nORDER BY o.created_at DESC\nOFFSET 15000;`
  );
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<QueryAdvisorResult | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const currentDb = DATABASE_CATALOG.find((d) => d.id === selectedEngine) || DATABASE_CATALOG[0];

  const handleAdvise = async (e?: React.FormEvent, sqlToRun = queryText, eng = selectedEngine) => {
    if (e) e.preventDefault();
    if (!sqlToRun.trim()) return;

    setIsLoading(true);
    try {
      const res = await adviseQuery(sqlToRun, eng);
      setResult(res);
    } catch (err: any) {
      alert(err.message || 'Failed to analyze query');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const norm = selectedEngine.toLowerCase();
    const meta = DATABASE_CATALOG.find((d) => d.id === selectedEngine) || DATABASE_CATALOG[0];
    let sample = queryText;
    if (meta.category === 'document' || norm.includes('mongo')) {
      sample = `// MongoDB: $where executes Javascript engine for every doc, disabling indexes\ndb.users.find({ $where: "this.credits > 100 && this.status == 'active'" }).skip(20000);`;
    } else if (meta.category === 'keyvalue' || norm.includes('redis')) {
      sample = `// Redis: KEYS * blocks single-threaded event loop causing outage\nKEYS session:user:*\nHGETALL large_analytics_hash`;
    } else if (meta.category === 'wide_column' || norm.includes('cassandra')) {
      sample = `-- Cassandra / Scylla: ALLOW FILTERING forces cluster-wide node scan\nSELECT * FROM user_events WHERE status = 'failed' ALLOW FILTERING;`;
    } else if (meta.category === 'graph' || norm.includes('neo4j')) {
      sample = `// Neo4j Cypher: Unbounded variable-length traversal (-[:KNOWS*]->) causes combinatorial blowup\nMATCH (u:User {email: 'alex@example.com'})-[:KNOWS*]->(friend:User)\nRETURN friend;`;
    } else if (meta.category === 'vector' || norm.includes('pinecone') || norm.includes('milvus')) {
      sample = `// Vector AI: Brute-force exact search across 10M embeddings\nclient.query({\n  vector: [0.12, -0.44, 0.89],\n  top_k: 10,\n  exact_search: true\n});`;
    } else if (meta.category === 'olap' || norm.includes('click')) {
      sample = `-- ClickHouse: Wildcard scan without partition pruning\nSELECT * FROM telemetry_events WHERE host_id LIKE '%server%' ORDER BY event_time DESC;`;
    } else {
      sample = `SELECT * \nFROM orders o\nJOIN customers c ON o.customer_id = c.id\nWHERE YEAR(o.created_at) = 2024 \n  AND o.status = 'completed'\nORDER BY o.created_at DESC\nOFFSET 15000;`;
    }
    setQueryText(sample);
    handleAdvise(undefined, sample, selectedEngine);
  }, [selectedEngine]);

  const handleApplyPreset = (preset: typeof presets[0]) => {
    const eng = preset.engine as DatabaseEngine;
    setSelectedEngine(eng);
    onSelectEngine?.(eng);
    setQueryText(preset.sql);
    handleAdvise(undefined, preset.sql, eng);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const presets = [
    {
      label: 'SQL Non-Sargable Date Filter',
      icon: '🐘',
      engine: 'postgres',
      sql: `-- Relational SQL: Non-Sargable function wrapping forces Full Table Scan\nSELECT *\nFROM orders\nWHERE YEAR(created_at) = 2024\n  AND status = 'shipped'\nORDER BY created_at DESC;`,
    },
    {
      label: 'MongoDB Unindexed $where JS',
      icon: '🍃',
      engine: 'mongodb',
      sql: `// MongoDB: $where executes Javascript engine for every doc, disabling indexes\ndb.users.find({ $where: "this.credits > 100 && this.status == 'active'" }).skip(20000);`,
    },
    {
      label: 'Redis O(N) Blocking KEYS *',
      icon: '⚡',
      engine: 'redis',
      sql: `// Redis: KEYS * blocks single-threaded event loop causing outage\nKEYS session:user:*\nHGETALL large_analytics_hash`,
    },
    {
      label: 'Cassandra ALLOW FILTERING',
      icon: '📦',
      engine: 'cassandra',
      sql: `-- Cassandra / Scylla: ALLOW FILTERING forces cluster-wide node scan\nSELECT * FROM user_events WHERE status = 'failed' ALLOW FILTERING;`,
    },
    {
      label: 'Neo4j Unbounded Variable Path',
      icon: '🕸️',
      engine: 'neo4j',
      sql: `// Neo4j Cypher: Unbounded variable-length traversal (-[:KNOWS*]->) causes combinatorial blowup\nMATCH (u:User {email: 'alex@example.com'})-[:KNOWS*]->(friend:User)\nRETURN friend;`,
    },
    {
      label: 'Vector AI Exact Brute-Force KNN',
      icon: '🧠',
      engine: 'pinecone',
      sql: `// Vector AI: Brute-force exact search across 10M embeddings\nclient.query({\n  vector: [0.12, -0.44, 0.89, ...],\n  top_k: 10,\n  exact_search: true\n});`,
    },
    {
      label: 'ClickHouse Unpartitioned Scan',
      icon: '❄️',
      engine: 'clickhouse',
      sql: `-- ClickHouse: Wildcard scan without partition pruning\nSELECT * FROM telemetry_events WHERE host_id LIKE '%server%' ORDER BY event_time DESC;`,
    },
  ];

  return (
    <div className="space-y-6">
      
      <div className="glass-card-light rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-200/60 pb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Zap className="w-4 h-4 text-purple-600 fill-purple-500/20 shrink-0" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Universal AI Query Anti-Pattern Scanner &amp; Index Synthesizer
              </h2>
              <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-900 rounded-full border border-purple-200">
                {DATABASE_CATALOG.length} DB Engines Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Select any database engine to detect syntax anti-patterns, index-sargability killers, deep offsets, and generate instant optimized rewrites.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <UniversalDbSelector
              selectedEngine={selectedEngine}
              onSelectEngine={(eng) => {
                setSelectedEngine(eng);
                onSelectEngine?.(eng);
              }}
              label="Target DB"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-purple-900/70 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            Quick-Load Paradigm Anti-Pattern Presets:
          </span>
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
            {presets.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium shrink-0 transition flex items-center gap-1.5 shadow-sm border ${
                  selectedEngine === preset.engine
                    ? 'bg-purple-100/90 text-purple-950 border-purple-300 font-bold'
                    : 'bg-white/80 hover:bg-purple-50 text-slate-800 border-purple-200/70'
                }`}
              >
                <span>{preset.icon}</span>
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleAdvise} className="space-y-3">
          <textarea
            rows={6}
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder={`-- Paste your ${currentDb.name} query or command script here...`}
            className="w-full rounded-xl px-3.5 py-3 text-xs font-mono placeholder-slate-400 focus:outline-none focus:ring-2 bg-slate-900 border border-slate-800 text-purple-300 focus:ring-purple-400/50 shadow-md transition leading-relaxed"
            required
          />

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span>
                Engine: <span className="font-bold text-slate-700">{currentDb.name}</span> (#{currentDb.rank || 'N/A'}, {currentDb.categoryLabel}).
              </span>
            </div>

            <button
              type="submit"
              disabled={isLoading || !queryText.trim()}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white hover:opacity-95 shadow-lg shadow-purple-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analyzing {currentDb.name}...
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  Analyze Anti-Patterns for {currentDb.name}
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {result ? (
        <div className="space-y-6">
          
          <div className="p-4 sm:p-5 rounded-2xl border bg-white/90 border-purple-200/80 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3 sm:gap-4">
              <div
                className={`p-2.5 sm:p-3 rounded-xl border shrink-0 ${
                  result.performanceScore >= 80
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : result.performanceScore >= 50
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-rose-100 text-rose-800 border-rose-300'
                }`}
              >
                {result.performanceScore >= 80 ? (
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                ) : (
                  <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    {result.performanceScore >= 80
                      ? `Optimal Query Structure for ${currentDb.name}`
                      : `Performance Anti-Patterns in ${currentDb.name}`}
                  </h3>
                  <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {result.estimatedSpeedup}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  {result.findings.length} findings evaluated for {currentDb.name} ({currentDb.categoryLabel}).
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-purple-100 w-full sm:w-auto">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Query Efficiency Score</span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                {result.performanceScore} <span className="text-xs text-slate-400">/ 100</span>
              </div>
            </div>
          </div>

          {result.suggestedCompoundIndex && (
            <div className="glass-card-light rounded-2xl p-5 shadow-lg space-y-4 border border-indigo-200/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    {currentDb.name} Indexing & Partitioning Recommendation
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(result.suggestedCompoundIndex!.indexSql, 'compound_idx')
                  }
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 transition shadow-sm"
                >
                  {copiedId === 'compound_idx' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-indigo-600" />
                      Copy Index Command
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {result.suggestedCompoundIndex.rationale}
              </p>

              {result.suggestedCompoundIndex.equalityColumns.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200">
                    <span className="font-bold text-[10px] uppercase text-emerald-700">1. Equality:</span>
                    <span>{result.suggestedCompoundIndex.equalityColumns.join(', ') || 'None'}</span>
                  </div>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-900 border border-purple-200">
                    <span className="font-bold text-[10px] uppercase text-purple-700">2. Sort:</span>
                    <span>{result.suggestedCompoundIndex.sortColumns.join(', ') || 'None'}</span>
                  </div>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200">
                    <span className="font-bold text-[10px] uppercase text-amber-700">3. Range:</span>
                    <span>{result.suggestedCompoundIndex.rangeColumns.join(', ') || 'None'}</span>
                  </div>
                </div>
              )}

              <pre className="bg-slate-950 text-emerald-400 p-3 rounded-xl text-xs font-mono border border-slate-800 overflow-x-auto shadow-inner">
                {result.suggestedCompoundIndex.indexSql}
              </pre>
            </div>
          )}

          <div className="glass-card-light rounded-2xl p-5 shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-indigo-600" />
              Side-by-Side Optimization Diff ({currentDb.name})
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-rose-700">
                  <span>❌ Original Unoptimized Query</span>
                  <span className="text-[10px] text-slate-400">High Disk/Memory Churn</span>
                </div>
                <pre className="bg-rose-50/70 border border-rose-200/80 p-3.5 rounded-xl text-xs font-mono text-rose-950 overflow-x-auto min-h-[140px] leading-relaxed shadow-sm">
                  {result.originalQuery}
                </pre>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-700">
                  <span>✨ Optimized Rewrite for {currentDb.name}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(result.rewrittenQuery, 'rewritten_sql')}
                    className="flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded transition"
                  >
                    {copiedId === 'rewritten_sql' ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                    Copy
                  </button>
                </div>
                <pre className="bg-emerald-50/80 border border-emerald-200/90 p-3.5 rounded-xl text-xs font-mono text-emerald-950 overflow-x-auto min-h-[140px] leading-relaxed shadow-sm whitespace-pre-wrap">
                  {result.rewrittenQuery}
                </pre>
              </div>
            </div>
          </div>

          <div className="glass-card-light rounded-2xl p-5 shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Detected Anti-Patterns & Remediation ({currentDb.name})
            </h3>

            <div className="space-y-3">
              {result.findings.map((f) => (
                <div
                  key={f.id}
                  className="p-4 rounded-xl border border-purple-200/80 bg-white/90 space-y-2 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          f.severity === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-800 border-rose-200'
                            : f.severity === 'WARNING'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                        }`}
                      >
                        {f.severity}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">{f.title}</h4>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {f.antiPatternType}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">{f.description}</p>

                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[10px] uppercase text-slate-500">Clause:</span>
                      <code className="bg-rose-50 text-rose-800 px-2 py-0.5 rounded font-mono text-[11px] border border-rose-200">
                        {f.detectedCodeSnippet}
                      </code>
                    </div>
                    <div className="text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 text-xs font-semibold">
                      💡 Remedy: {f.recommendation}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-5 rounded-2xl border border-purple-200/70 bg-white/80 space-y-2.5 shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm">
              🎯
            </div>
            <h4 className="text-xs font-bold text-slate-900">Multi-Model Engine Awareness</h4>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Detects SQL sargability, MongoDB `$where` JS bottlenecks, Redis `KEYS *` event loop locks, Vector AI KNN scans, and Cypher cartesian products across 447 engines.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-purple-200/70 bg-white/80 space-y-2.5 shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
              📐
            </div>
            <h4 className="text-xs font-bold text-slate-900">ESR Indexing Geometry</h4>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Synthesizes composite indexes respecting Equality ➔ Sort ➔ Range ordering rules to guarantee single-pass B-Tree range traversals.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-purple-200/70 bg-white/80 space-y-2.5 shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm">
              ⏩
            </div>
            <h4 className="text-xs font-bold text-slate-900">Zero-Overhead Rewrites</h4>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Transforms deep OFFSET pagination into Keyset cursors, replaces leading wildcards with inverted trigrams, and limits memory sort allocations.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
