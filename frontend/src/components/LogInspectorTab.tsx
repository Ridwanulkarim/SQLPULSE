import React, { useState, useEffect } from 'react';
import {
  FileSearch,
  Zap,
  Activity,
  Copy,
  Check
} from 'lucide-react';
import { UniversalDbSelector } from './UniversalDbSelector';
import { inspectSlowLogs } from '../services/api';
import { LogInspectResult, DATABASE_CATALOG } from '../types';

export const LogInspectorTab: React.FC = () => {
  const [selectedEngine, setSelectedEngine] = useState<string>('postgresql');
  const [logContent, setLogContent] = useState<string>(
    `2026-10-03 08:14:22 UTC [80142]: [3-1] user=app_user,db=prod LOG: duration: 852.410 ms statement: SELECT * FROM orders WHERE customer_id = 94812 AND status = 'completed' ORDER BY created_at DESC LIMIT 20;
2026-10-03 08:14:25 UTC [80145]: [4-1] user=app_user,db=prod LOG: duration: 1420.100 ms statement: SELECT c.id, sum(o.total) FROM customers c JOIN orders o ON c.id = o.customer_id WHERE o.created_at >= NOW() - INTERVAL '30 days' GROUP BY c.id;
2026-10-03 08:14:28 UTC [80148]: [5-1] user=app_user,db=prod LOG: duration: 512.920 ms statement: UPDATE inventory SET stock = stock - 1 WHERE product_id = 1042;`
  );

  const [result, setResult] = useState<LogInspectResult | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const logPresets = [
    {
      label: '🐘 Postgres Slow Duration Log',
      engine: 'postgresql',
      log: `2026-10-03 08:14:22 UTC [80142]: [3-1] user=app_user,db=prod LOG: duration: 852.410 ms statement: SELECT * FROM orders WHERE customer_id = 94812 AND status = 'completed' ORDER BY created_at DESC LIMIT 20;
2026-10-03 08:14:25 UTC [80145]: [4-1] user=app_user,db=prod LOG: duration: 1420.100 ms statement: SELECT c.id, sum(o.total) FROM customers c JOIN orders o ON c.id = o.customer_id WHERE o.created_at >= NOW() - INTERVAL '30 days' GROUP BY c.id;
2026-10-03 08:14:28 UTC [80148]: [5-1] user=app_user,db=prod LOG: duration: 512.920 ms statement: UPDATE inventory SET stock = stock - 1 WHERE product_id = 1042;`
    },
    {
      label: '🐬 MySQL Slow Query Log',
      engine: 'mysql',
      log: `# Time: 2026-10-03T11:22:15.124500Z
# User@Host: app[app] @ [10.0.4.12]  Id: 4892
# Query_time: 2.854120  Lock_time: 0.000140 Rows_sent: 10  Rows_examined: 450000
SELECT * FROM transactions WHERE user_id = 49102 AND status = 'settled' ORDER BY id DESC LIMIT 10;`
    },
    {
      label: '⚡ Redis SLOWLOG Output',
      engine: 'redis',
      log: `1) 1) (integer) 124
   2) (integer) 1696238120
   3) (integer) 85400
   4) 1) "KEYS"
      2) "cache:session:*"`
    }
  ];

  const handleInspect = async (logToInspect = logContent, eng = selectedEngine) => {
    try {
      const res = await inspectSlowLogs({
        engine: eng,
        logContent: logToInspect,
      });
      setResult(res);
    } catch (err: any) {
      alert(err.message || 'Failed to inspect slow query log');
    }
  };

  useEffect(() => {
    handleInspect(logContent, selectedEngine);
  }, [selectedEngine]);

  const handleApplyPreset = (preset: typeof logPresets[0]) => {
    setSelectedEngine(preset.engine);
    setLogContent(preset.log);
    handleInspect(preset.log, preset.engine);
  };

  const handleCopy = (sql: string, idx: number) => {
    navigator.clipboard.writeText(sql);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const engineMeta = DATABASE_CATALOG.find(db => db.id === selectedEngine) || { name: selectedEngine, icon: '🗄️' };

  return (
    <div className="space-y-6 font-sans">
      
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-rose-950 to-purple-950 text-white shadow-xl shadow-rose-950/20 border border-rose-500/30 backdrop-blur-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-rose-500/30 text-rose-200 border border-rose-400/40">
              Telemetry &amp; Log Diagnostic Lab
            </span>
            <span className="text-xs text-rose-300 font-medium">
              447 Database Engine Slow Query Aggregator &amp; Index Recommender
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <FileSearch className="w-6 h-6 text-rose-400" />
            Slow Query Log Diagnostic Inspector
          </h2>
          <p className="text-xs sm:text-sm text-rose-200/90 mt-1 max-w-3xl">
            Paste slow query logs, CSV dumps, or telemetry streams from {engineMeta.name}. SQLPulse groups query fingerprints, computes P95 latency outliers, and generates targeted index fixes.
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-6 rounded-2xl bg-white/80 border border-purple-200/80 shadow-sm backdrop-blur-md space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Database Engine ({DATABASE_CATALOG.length} Supported)
          </label>
          <UniversalDbSelector
            selectedEngine={selectedEngine}
            onSelectEngine={setSelectedEngine}
          />
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-rose-900/70 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-rose-500" />
            Quick-Load Engine Log Samples:
          </span>
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
            {logPresets.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium shrink-0 transition flex items-center gap-1.5 shadow-sm border ${
                  selectedEngine === preset.engine
                    ? 'bg-rose-100/90 text-rose-950 border-rose-300 font-bold'
                    : 'bg-white/80 hover:bg-rose-50 text-slate-800 border-purple-200/70'
                }`}
              >
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Paste Log Output / Execution Trace:
            </label>
            <button
              type="button"
              onClick={() => handleInspect(logContent, selectedEngine)}
              className="px-3.5 py-1 rounded-lg text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 shadow-sm transition active:scale-95"
            >
              Analyze Log ➔
            </button>
          </div>
          <textarea
            value={logContent}
            onChange={(e) => setLogContent(e.target.value)}
            rows={4}
            placeholder="Paste your engine slow query logs here..."
            className="w-full p-3 font-mono text-xs bg-slate-950 text-rose-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 selection:bg-rose-600"
          />
        </div>
      </div>

      {result && (
        <div className="space-y-6">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Queries</span>
              <div className="text-xl font-black text-slate-900">{result.totalQueriesParsed.toLocaleString()}</div>
              <p className="text-[11px] text-slate-500">Events processed</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Unique Fingerprints</span>
              <div className="text-xl font-black text-purple-950">{result.uniqueFingerprints}</div>
              <p className="text-[11px] text-slate-500">Normalized query shapes</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-rose-200 shadow-sm space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Max Single Outlier</span>
              <div className="text-xl font-black text-rose-600 font-mono">{result.slowestQueryMs} ms</div>
              <p className="text-[11px] text-slate-500">Highest recorded latency</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-indigo-200 shadow-sm space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cumulative DB Time</span>
              <div className="text-xl font-black text-indigo-950 font-mono">{result.totalCumulativeDurationSec}s</div>
              <p className="text-[11px] text-slate-500">Total engine execution time</p>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-purple-50/60 border border-purple-200 text-slate-800 text-xs leading-relaxed space-y-1">
            <span className="font-extrabold text-purple-950 uppercase tracking-wider block">
              Automated Forensic Summary:
            </span>
            <p>{result.diagnosticSummary}</p>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-600" />
              Top Slow Query Groups Ranked by Cumulative Latency Impact
            </h3>

            {result.groups.map((g, idx) => (
              <div
                key={idx}
                className="p-4 sm:p-5 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-3 transition-all hover:border-purple-300"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-900">
                      Rank #{idx + 1} • {g.percentOfTotalTime}% of Total Time
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {g.totalCalls.toLocaleString()} calls
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className="text-slate-500">Avg: <strong className="text-slate-900">{g.avgTimeMs}ms</strong></span>
                    <span className="text-purple-700">P95: <strong>{g.p95TimeMs}ms</strong></span>
                    <span className="text-rose-600">Max: <strong>{g.maxTimeMs}ms</strong></span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Query Fingerprint:
                  </span>
                  <div className="p-2.5 rounded-xl bg-slate-950 font-mono text-xs text-purple-200 overflow-x-auto">
                    {g.fingerprint}
                  </div>
                </div>

                {g.recommendedIndex && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-emerald-600" />
                        Target Index Remediation Fix:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(g.recommendedIndex, idx)}
                        className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 shadow-sm transition active:scale-95"
                      >
                        {copiedIndex === idx ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-emerald-600" />}
                        <span>{copiedIndex === idx ? 'Copied' : 'Copy Fix'}</span>
                      </button>
                    </div>
                    <div className="font-mono text-xs text-emerald-900 font-bold overflow-x-auto">
                      {g.recommendedIndex}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
