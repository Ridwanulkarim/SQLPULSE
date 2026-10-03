import React, { useState, useEffect } from 'react';
import {
  Zap,
  Check,
  Copy,
  TrendingDown,
  ShieldCheck,
  Code2
} from 'lucide-react';
import { UniversalDbSelector } from './UniversalDbSelector';
import { rewriteQuery } from '../services/api';
import { QueryRewriterResult, DATABASE_CATALOG } from '../types';

interface QueryRewriterTabProps {
  selectedEngine: string;
  onSelectEngine: (engine: string) => void;
}

export const QueryRewriterTab: React.FC<QueryRewriterTabProps> = ({
  selectedEngine,
  onSelectEngine,
}) => {
  const [inputQuery, setInputQuery] = useState<string>(
    `SELECT * \nFROM orders \nWHERE YEAR(created_at) = 2024 \n  AND LOWER(status) = 'completed' \n  AND customer_id IN (SELECT id FROM vip_customers);`
  );

  const [result, setResult] = useState<QueryRewriterResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedOptimized, setCopiedOptimized] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(false);

  const sampleAntiPatterns = [
    {
      label: '📅 Non-Sargable YEAR(date)',
      query: `SELECT * FROM orders WHERE YEAR(created_at) = 2024 AND LOWER(status) = 'completed' AND customer_id IN (SELECT id FROM vip_customers);`,
    },
    {
      label: '🔄 Subquery IN (...) to EXISTS',
      query: `SELECT * FROM orders WHERE customer_id IN (SELECT id FROM high_value_customers WHERE active = true);`,
    },
    {
      label: '🔠 Redundant LOWER() Function',
      query: `SELECT * FROM users WHERE LOWER(email) = 'alex@enterprise.com';`,
    },
    {
      label: '📦 Wildcard SELECT * Narrowing',
      query: `SELECT * FROM transactions WHERE created_at >= '2026-01-01';`,
    },
  ];

  const handleRewrite = async (queryToRun = inputQuery, eng = selectedEngine) => {
    if (!queryToRun.trim()) return;
    setIsLoading(true);
    try {
      const res = await rewriteQuery({
        engine: eng,
        query: queryToRun,
      });
      setResult(res);
    } catch (err: any) {
      alert(err.message || 'Query optimization failed');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleRewrite(inputQuery, selectedEngine);
  }, [selectedEngine]);

  const applySample = (sample: typeof sampleAntiPatterns[0]) => {
    setInputQuery(sample.query);
    handleRewrite(sample.query, selectedEngine);
  };

  const handleCopyQuery = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.optimizedQuery);
    setCopiedOptimized(true);
    setTimeout(() => setCopiedOptimized(false), 2000);
  };

  const handleCopyIndex = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.zeroDowntimeIndexDdl);
    setCopiedIndex(true);
    setTimeout(() => setCopiedIndex(false), 2000);
  };

  const engineMeta = DATABASE_CATALOG.find((db) => db.id === selectedEngine) || {
    name: selectedEngine,
    icon: '🗄️',
  };

  return (
    <div className="space-y-6 font-sans">
      
      <div className="p-4 sm:p-6 rounded-2xl bg-white border border-zinc-200 shadow-xs relative overflow-hidden">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-100 text-zinc-800 border border-zinc-200">
              10x–100x Faster AST Sargability Rewriter
            </span>
            <span className="text-xs text-zinc-500 font-medium">
              Eliminate Full Table Scans • Sargable Date Intervals • Companion Indexes
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-zinc-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-600" />
            SQL AST Query Rewriter &amp; Sargability Optimizer
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 mt-1 max-w-3xl">
            Input anti-pattern SQL with scalar date functions, unindexed subqueries, or wildcard projections for {engineMeta.name}. Automatically rewrite into index-seekable queries with side-by-side AST comparisons and companion zero-downtime DDL.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
          <Zap className="w-3.5 h-3.5 text-amber-600" /> Common Anti-Patterns:
        </span>
        {sampleAntiPatterns.map((s, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => applySample(s)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-purple-200 text-slate-700 hover:bg-amber-50 hover:border-amber-400 shadow-sm transition active:scale-95"
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-6 rounded-2xl bg-white/90 border border-purple-200/80 shadow-sm backdrop-blur-md space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Target Database Engine ({DATABASE_CATALOG.length} Supported)
          </label>
          <UniversalDbSelector
            selectedEngine={selectedEngine}
            onSelectEngine={onSelectEngine}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
            <Code2 className="w-3.5 h-3.5 text-amber-600" />
            Raw Sub-Optimal SQL Query
          </label>
          <textarea
            rows={4}
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            className="w-full p-3.5 rounded-xl font-mono text-xs border border-purple-200 bg-slate-950 text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={() => handleRewrite()}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-md transition active:scale-95 flex items-center gap-2"
          >
            <Zap className="w-4 h-4 text-white" />
            {isLoading ? 'Rewriting Query...' : 'Optimize & Rewrite SQL (AST)'}
          </button>
        </div>
      </div>

      {result && (
        <div className="space-y-6">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white/90 border border-emerald-200/80 shadow-sm backdrop-blur-md">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Estimated Speedup Factor</div>
              <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">
                {result.overallSpeedupFactor}
              </div>
              <div className="text-xs text-emerald-700 font-semibold mt-1">
                Direct B-Tree Index Range Seek
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/90 border border-purple-200/80 shadow-sm backdrop-blur-md">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Disk I/O Reduction</div>
              <div className="text-2xl sm:text-3xl font-black text-purple-700 mt-1 flex items-center gap-1">
                <TrendingDown className="w-5 h-5 text-emerald-600" />
                -{result.astTransformationSummary.iopsReductionPct}%
              </div>
              <div className="text-xs text-purple-700 font-semibold mt-1">
                Bypasses {result.astTransformationSummary.cpuReductionPct}% CPU evaluation
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/90 border border-amber-200/80 shadow-sm backdrop-blur-md">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Optimizations Applied</div>
              <div className="text-2xl sm:text-3xl font-black text-amber-700 mt-1">
                {result.optimizationsApplied.length} AST Rules
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Sargability &amp; Semi-Join rewrite
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            <div className="p-4 sm:p-6 rounded-2xl bg-white/90 border border-rose-200/80 shadow-sm backdrop-blur-md space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  Original Sub-Optimal SQL (Full Table Scan)
                </span>
              </div>
              <div className="bg-slate-950 rounded-xl p-4 font-mono text-xs text-rose-300 overflow-x-auto min-h-[140px]">
                <pre>{result.originalQuery}</pre>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100 text-[11px] font-mono text-rose-800">
                {result.astTransformationSummary.planBefore}
              </div>
            </div>

            <div className="p-4 sm:p-6 rounded-2xl bg-white/90 border border-emerald-200/80 shadow-sm backdrop-blur-md space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Rewritten Sargable SQL (Index Seek)
                </span>
                <button
                  type="button"
                  onClick={handleCopyQuery}
                  className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition flex items-center gap-1"
                >
                  {copiedOptimized ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedOptimized ? 'Copied' : 'Copy Query'}
                </button>
              </div>
              <div className="bg-slate-950 rounded-xl p-4 font-mono text-xs text-emerald-300 overflow-x-auto min-h-[140px]">
                <pre>{result.optimizedQuery}</pre>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-[11px] font-mono text-emerald-800">
                {result.astTransformationSummary.planAfter}
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 rounded-2xl bg-white/90 border border-purple-200/80 shadow-sm backdrop-blur-md space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-600" />
              Detailed AST Rewrite Explanations ({result.optimizationsApplied.length})
            </h3>
            <div className="space-y-3">
              {result.optimizationsApplied.map((opt, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-purple-100 bg-purple-50/20 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-slate-900">{opt.ruleName}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                      {opt.estimatedSpeedup}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 font-medium">
                    {opt.explanation}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 text-[11px] font-mono">
                    <div className="bg-rose-950/20 p-2 rounded border border-rose-200 text-rose-700">
                      <span className="font-bold block text-[10px] uppercase text-rose-500">Before:</span>
                      {opt.beforeSnippet}
                    </div>
                    <div className="bg-emerald-950/20 p-2 rounded border border-emerald-200 text-emerald-700">
                      <span className="font-bold block text-[10px] uppercase text-emerald-500">After:</span>
                      {opt.afterSnippet}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 sm:p-6 rounded-2xl bg-white/90 border border-purple-200/80 shadow-sm backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Companion Zero-Downtime Index DDL
              </h3>
              <button
                type="button"
                onClick={handleCopyIndex}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow transition active:scale-95 flex items-center gap-1.5"
              >
                {copiedIndex ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedIndex ? 'Copied DDL' : 'Copy Index DDL'}
              </button>
            </div>
            <div className="bg-slate-950 rounded-xl p-4 font-mono text-xs text-purple-200 overflow-x-auto">
              <pre>{result.zeroDowntimeIndexDdl}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
