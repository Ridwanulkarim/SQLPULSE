import React, { useState, useEffect } from 'react';
import { DatabaseEngine, DATABASE_CATALOG, BloatAnalyzeResult } from '../types';
import { UniversalDbSelector } from './UniversalDbSelector';
import { analyzeTableBloat } from '../services/api';
import { Trash2, Copy, Check, RefreshCw, AlertTriangle, ShieldCheck, Database, HardDrive, Cpu, Activity } from 'lucide-react';

interface BloatAnalyzerTabProps {
  selectedEngine: DatabaseEngine;
  onSelectEngine: (engine: DatabaseEngine) => void;
}

export const BloatAnalyzerTab: React.FC<BloatAnalyzerTabProps> = ({
  selectedEngine,
  onSelectEngine,
}) => {
  const [tableName, setTableName] = useState('orders');
  const [totalTableSizeGb, setTotalTableSizeGb] = useState<number>(120);
  const [deadTuplePercentage, setDeadTuplePercentage] = useState<number>(38);
  const [avgDailyUpdates, setAvgDailyUpdates] = useState<number>(500000);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BloatAnalyzeResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await analyzeTableBloat({
        engine: selectedEngine,
        tableName,
        totalTableSizeGb,
        deadTuplePercentage,
        avgDailyUpdates,
      });
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze table bloat');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleAnalyze();
  }, [selectedEngine]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const engineMeta = DATABASE_CATALOG.find(db => db.id === selectedEngine) || { name: selectedEngine, icon: '🗄️' };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-amber-950 to-orange-950 text-white shadow-xl shadow-amber-950/20 border border-amber-500/30 backdrop-blur-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-amber-500/30 text-amber-200 border border-amber-400/40">
              Storage Hygiene &amp; Zero-Downtime Repack
            </span>
            <span className="text-xs text-amber-300 font-medium">
              447 Database Engines • MVCC Dead Tuple &amp; B-Tree Page Split Analyzer
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Trash2 className="w-6 h-6 text-amber-400" />
            Index Bloat, Vacuum &amp; Table Defragmentation Studio
          </h2>
          <p className="text-xs sm:text-sm text-amber-100/90 mt-1 max-w-3xl">
            Diagnose dead MVCC tuples, unmerged page splits, and wasted disk storage for {engineMeta.name}. Generate zero-downtime online repack scripts (`REINDEX CONCURRENTLY`, `OPTIMIZE TABLE`, `pg_repack`) and autovacuum tuning DDL.
          </p>
        </div>
      </div>

      {/* Controls Form */}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-purple-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-amber-600" />
              Target Table / Collection
            </label>
            <input
              type="text"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="orders"
              className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border border-purple-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
              Total Table Size (GB)
            </label>
            <input
              type="number"
              value={totalTableSizeGb}
              onChange={(e) => setTotalTableSizeGb(Number(e.target.value))}
              min={1}
              max={10000}
              className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border border-purple-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                Dead Tuple / Bloat %
              </span>
              <span className="font-mono font-black text-rose-600">{deadTuplePercentage}%</span>
            </label>
            <input
              type="range"
              min={5}
              max={85}
              value={deadTuplePercentage}
              onChange={(e) => setDeadTuplePercentage(Number(e.target.value))}
              className="w-full accent-amber-600 cursor-pointer mt-2"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-purple-600" />
              Avg Daily Updates / Deletes
            </label>
            <input
              type="number"
              value={avgDailyUpdates}
              onChange={(e) => setAvgDailyUpdates(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border border-purple-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleAnalyze}
            disabled={isLoading}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-md shadow-amber-500/20 transition flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
            <span>Analyze Storage Bloat ➔</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Total Physical Footprint
              </span>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                {result.totalTableSizeFormatted}
              </div>
              <p className="text-[11px] text-slate-500">
                Target table: <strong className="text-slate-800 font-mono">{result.tableName}</strong>
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-rose-200 shadow-sm space-y-1">
              <span className="text-xs font-bold text-rose-600 uppercase tracking-wider block">
                Wasted Dead Storage
              </span>
              <div className="text-2xl sm:text-3xl font-black text-rose-600 font-mono">
                {result.totalWastedStorageFormatted}
              </div>
              <p className="text-[11px] text-rose-700 font-semibold">
                {result.averageBloatPercentage}% Dead MVCC row space
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-amber-200 shadow-sm space-y-1">
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block">
                Disk I/O Read Penalty
              </span>
              <div className="text-2xl sm:text-3xl font-black text-amber-600 font-mono">
                2.4x - 3.8x
              </div>
              <p className="text-[11px] text-amber-800 font-semibold">
                Higher scan buffer page faults
              </p>
            </div>
          </div>

          {/* Bloat Breakdown Table */}
          <div className="rounded-2xl bg-white border border-purple-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 bg-amber-50/70 border-b border-amber-100 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-amber-700" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-950">
                Fragmented Storage Object Breakdown
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-purple-100 text-slate-700 font-bold font-mono">
                    <th className="py-3 px-4">Database Object</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Wasted Space</th>
                    <th className="py-3 px-4">Bloat %</th>
                    <th className="py-3 px-4">Seek Penalty</th>
                    <th className="py-3 px-4">Remedy Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-50 font-mono text-xs">
                  {result.findings.map((item, idx) => (
                    <tr key={idx} className="hover:bg-purple-50/40 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">{item.objectName}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                          item.objectType === 'table'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-purple-100 text-purple-800 border border-purple-200'
                        }`}>
                          {item.objectType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-black text-rose-600">{item.wastedStorageFormatted}</td>
                      <td className="py-3 px-4 font-bold text-amber-700">{item.bloatPercentage}%</td>
                      <td className="py-3 px-4 font-sans text-slate-600">{item.diskRandomSeekPenalty}</td>
                      <td className="py-3 px-4 font-sans font-bold text-emerald-800">{item.remedyAction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Scripts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Zero-Downtime Repack Script */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                      Zero-Downtime Online Repack Script
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(result.repackScript, 'repack')}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100 shadow-xs transition active:scale-95"
                  >
                    {copiedKey === 'repack' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-purple-600" />}
                    <span>{copiedKey === 'repack' ? 'Copied' : 'Copy Script'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Execute background online rebuild without blocking concurrent client reads or writes.
                </p>
                <pre className="mt-3 p-4 rounded-xl bg-slate-950 text-emerald-300 font-mono text-xs overflow-x-auto leading-relaxed max-h-[300px] selection:bg-emerald-600 selection:text-white">
                  {result.repackScript}
                </pre>
              </div>
            </div>

            {/* Background Autovacuum Tuning */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-amber-600" />
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                      Continuous Background Autovacuum Tuning
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(result.autovacuumTuningDdl, 'autovacuum')}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100 shadow-xs transition active:scale-95"
                  >
                    {copiedKey === 'autovacuum' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-purple-600" />}
                    <span>{copiedKey === 'autovacuum' ? 'Copied' : 'Copy DDL'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Prevents recurring bloat by adjusting table-level vacuum scale factors.
                </p>
                <pre className="mt-3 p-4 rounded-xl bg-slate-950 text-amber-200 font-mono text-xs overflow-x-auto leading-relaxed max-h-[300px] selection:bg-amber-600 selection:text-white">
                  {result.autovacuumTuningDdl}
                </pre>
              </div>
            </div>
          </div>

          {/* Diagnostic Inspection Query */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                  Live Engine Bloat Diagnostic Query ({engineMeta.name})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(result.hygieneCheckQuery, 'hygiene')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100 shadow-xs transition active:scale-95"
              >
                {copiedKey === 'hygiene' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-purple-600" />}
                <span>{copiedKey === 'hygiene' ? 'Copied' : 'Copy Query'}</span>
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-slate-950 text-cyan-300 font-mono text-xs overflow-x-auto leading-relaxed selection:bg-cyan-600 selection:text-white">
              {result.hygieneCheckQuery}
            </pre>
          </div>

          {/* Expert Recommendations */}
          <div className="p-4 sm:p-5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 space-y-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-purple-950 dark:text-purple-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Production Storage Hygiene Guidelines:
            </h3>
            <ul className="space-y-1.5">
              {result.expertRecommendations.map((rec, i) => (
                <li key={i} className="text-xs text-slate-700 dark:text-slate-200 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-600 dark:bg-purple-400 mt-1.5 flex-shrink-0" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
