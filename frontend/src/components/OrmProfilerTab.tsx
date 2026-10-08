import React, { useState, useEffect } from 'react';
import {
  Zap,
  Code2,
  Copy,
  Check,
  Layers,
  ShieldAlert
} from 'lucide-react';
import { profileOrm } from '../services/api';
import { DatabaseEngine, OrmProfilerResult, OrmIssue } from '../types';

interface OrmProfilerTabProps {
  selectedEngine?: DatabaseEngine | string;
  onSelectEngine?: (engine: DatabaseEngine) => void;
}

export const OrmProfilerTab: React.FC<OrmProfilerTabProps> = ({ selectedEngine }) => {
  const engineId = typeof selectedEngine === 'object' ? selectedEngine?.id : selectedEngine || 'postgres';
  const [framework, setFramework] = useState<string>('prisma');
  const [activeTab, setActiveTab] = useState<'orm' | 'sql'>('orm');
  const [copied, setCopied] = useState<boolean>(false);
  const [batchSize, setBatchSize] = useState<number>(1000);
  const [result, setResult] = useState<OrmProfilerResult | null>(null);

  const ormFrameworks = [
    { id: 'prisma', name: 'Prisma ORM', icon: '💎' },
    { id: 'typeorm', name: 'TypeORM', icon: '🟧' },
    { id: 'hibernate', name: 'Hibernate / JPA (Java)', icon: '☕' },
    { id: 'sqlalchemy', name: 'SQLAlchemy (Python)', icon: '🐍' },
    { id: 'django', name: 'Django ORM (Python)', icon: '🎸' },
    { id: 'drizzle', name: 'Drizzle ORM', icon: '💧' },
  ];

  const handleProfile = async () => {
    try {
      const data = await profileOrm({
        engine: engineId,
        framework,
        batchSize,
      });
      setResult(data);
    } catch (err: any) {
      alert(err.message || 'Failed to profile ORM queries.');
    }
  };

  useEffect(() => {
    handleProfile();
  }, [framework, batchSize, engineId]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white shadow-xl shadow-emerald-950/20 border border-emerald-500/30 backdrop-blur-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 flex items-center gap-1">
              <Zap className="w-3 h-3 text-emerald-300" /> ORM Anti-Pattern &amp; N+1 Profiler
            </span>
            <span className="text-xs text-emerald-300 font-medium">
              Eliminate Network Loop Roundtrips &amp; Memory Explosions
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Code2 className="w-6 h-6 text-emerald-400" />
            ORM Query &amp; N+1 Latency Profiler
          </h2>
          <p className="text-xs sm:text-sm text-emerald-200/90 mt-1 max-w-3xl">
            Detect hidden N+1 iteration cascades, Cartesian product explosions, and overfetching in Prisma, TypeORM, Hibernate, SQLAlchemy, and Django ORM.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/80 p-3 rounded-2xl border border-emerald-200/70 shadow-sm backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-emerald-600" /> ORM Dialects:
          </span>
          {ormFrameworks.map((fw) => (
            <button
              key={fw.id}
              type="button"
              onClick={() => setFramework(fw.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 flex items-center gap-1.5 ${
                framework === fw.id
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-bold'
                  : 'bg-white border border-emerald-200 text-slate-700 hover:bg-emerald-50'
              }`}
            >
              <span>{fw.icon}</span>
              <span>{fw.name}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
          <span className="text-slate-500 px-2 text-[11px]">Batch Size:</span>
          {[100, 500, 1000, 5000, 10000].map((sz) => (
            <button
              key={sz}
              type="button"
              onClick={() => setBatchSize(sz)}
              className={`px-2 py-1 rounded-lg transition text-[11px] font-bold ${
                batchSize === sz ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {sz >= 1000 ? `${sz / 1000}K` : sz}
            </button>
          ))}
        </div>
      </div>

      {result && (
        <div className="space-y-6">
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-white border border-rose-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Extra Roundtrips</span>
              <div className="text-2xl font-black text-rose-600 font-mono">+{result.estimatedTotalRoundtrips} Calls</div>
              <p className="text-[11px] text-rose-700">TCP network cascade</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Latency Speedup</span>
              <div className="text-2xl font-black text-emerald-600 font-mono">~{result.estimatedLatencySavingPercent}%</div>
              <p className="text-[11px] text-emerald-700">Estimated query boost</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-blue-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Payload Reduction</span>
              <div className="text-2xl font-black text-blue-700 font-mono">{result.benchmarkSummary.networkPayloadReductionPercent}%</div>
              <p className="text-[11px] text-blue-700">Eliminated column bloat</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Optimized Time</span>
              <div className="text-2xl font-black text-purple-700 font-mono">{result.benchmarkSummary.optimizedLatencyMs}ms</div>
              <p className="text-[11px] text-purple-700">Down from {result.benchmarkSummary.baselineLatencyMs}ms</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-emerald-200/80 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-emerald-50/70 border-b border-emerald-200 flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-emerald-700" />
                Detected ORM Anti-Patterns &amp; Cartesian Traps ({result.detectedIssues.length})
              </h3>
            </div>

            <div className="divide-y divide-emerald-100">
              {result.detectedIssues.map((issue: OrmIssue) => (
                <div key={issue.id} className="p-4 sm:p-5 hover:bg-emerald-50/20 transition space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                        issue.severity === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {issue.severity}
                      </span>
                      <h4 className="text-xs font-bold text-slate-900">{issue.title}</h4>
                    </div>
                    <span className="text-xs font-mono font-bold text-rose-600">
                      +{issue.latencyPenaltyMs}ms delay penalty
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">{issue.description}</p>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-3 rounded-xl bg-slate-950 text-rose-300 border border-slate-800">
                      <span className="text-[10px] font-sans font-bold text-rose-400 block mb-1">❌ Inefficient Anti-Pattern:</span>
                      <pre className="overflow-x-auto whitespace-pre-wrap">{issue.detectedPattern}</pre>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 text-emerald-300 border border-slate-800">
                      <span className="text-[10px] font-sans font-bold text-emerald-400 block mb-1">✓ Optimized {framework.toUpperCase()} Fix:</span>
                      <pre className="overflow-x-auto whitespace-pre-wrap">{issue.ormFixCode}</pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-emerald-200/80 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('orm')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${activeTab === 'orm' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  {framework.toUpperCase()} Eager-Loading Code
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('sql')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${activeTab === 'sql' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Optimized Batched SQL (CTE Aggregation)
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleCopy(activeTab === 'orm' ? result.recommendedOrmCode : result.recommendedSqlCte)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-slate-800 text-emerald-300 hover:bg-slate-700 border border-slate-700 transition active:scale-95"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{copied ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>

            <pre className="p-4 font-mono text-xs sm:text-sm bg-slate-950 text-emerald-200 overflow-x-auto selection:bg-emerald-600 selection:text-white max-h-[450px]">
              {activeTab === 'orm' ? result.recommendedOrmCode : result.recommendedSqlCte}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
