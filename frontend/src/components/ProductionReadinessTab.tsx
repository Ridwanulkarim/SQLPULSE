import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Terminal,
  Activity,
  Sparkles,
  Server,
  Network,
  Gauge,
  Database,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { UniversalDbSelector } from './UniversalDbSelector';
import { auditReadiness } from '../services/api';
import { ProductionReadinessResult, ReadinessCheckItem, DatabaseEngine } from '../types';

interface ProductionReadinessTabProps {
  selectedEngine?: DatabaseEngine | string;
  onSelectEngine?: (engine: DatabaseEngine) => void;
}

const POPULAR_ENGINES = [
  { id: 'postgresql', label: 'PostgreSQL' },
  { id: 'mysql', label: 'MySQL / MariaDB' },
  { id: 'oracle', label: 'Oracle' },
  { id: 'sqlserver', label: 'SQL Server' },
  { id: 'clickhouse', label: 'ClickHouse' },
  { id: 'redis', label: 'Redis' },
  { id: 'mongodb', label: 'MongoDB' },
  { id: 'sqlite', label: 'SQLite' },
];

export const ProductionReadinessTab: React.FC<ProductionReadinessTabProps> = ({
  selectedEngine: propEngine,
  onSelectEngine,
}) => {
  const [selectedEngine, setSelectedEngine] = useState<string>(
    (propEngine as string) || 'postgresql'
  );

  useEffect(() => {
    if (propEngine && propEngine !== selectedEngine) {
      setSelectedEngine(propEngine);
    }
  }, [propEngine]);

  const [estimatedQps, setEstimatedQps] = useState<number>(5000);
  const [applyPatch, setApplyPatch] = useState<boolean>(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'FAILED' | 'WARNING' | 'PASSED'>('all');
  const [copied, setCopied] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ProductionReadinessResult | null>(null);

  const handleAudit = async (forcedPatch?: boolean) => {
    setIsLoading(true);
    try {
      const data = await auditReadiness({
        engine: selectedEngine,
        estimatedQps,
        applyTuningPatch: forcedPatch !== undefined ? forcedPatch : applyPatch,
      });
      setResult(data);
    } catch (err: any) {
      alert(err.message || 'Failed to audit production readiness.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleAudit();
  }, [selectedEngine, estimatedQps, applyPatch]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredChecks = result?.checks.filter((chk) => {
    if (filterStatus === 'all') return true;
    return chk.status === filterStatus;
  }) || [];

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-teal-950 via-slate-900 to-indigo-950 text-white shadow-xl shadow-teal-950/20 border border-teal-500/30 backdrop-blur-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-teal-500/30 text-teal-200 border border-teal-400/40 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-300" /> Pre-Flight Production Launch Auditor
            </span>
            <span className="text-xs text-teal-300 font-medium">
              Real-Time Concurrency Sizing &amp; Engine-Specific Security/SLA Scorecard
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-teal-400" />
            Production Readiness &amp; Health Scorecard
          </h2>
          <p className="text-xs sm:text-sm text-teal-200/90 mt-1 max-w-3xl">
            Evaluate and harden database configuration before peak traffic launch. Computes authentic concurrency metrics, connection pooler thresholds, I/O bandwidth, and deep engine-native parameter configurations.
          </p>

          {/* Quick Engine Pills */}
          <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-3 border-t border-teal-800/40">
            <span className="text-[11px] text-teal-300/80 font-bold uppercase tracking-wider mr-1 flex items-center gap-1">
              <Database className="w-3 h-3 text-teal-400" /> Engine Presets:
            </span>
            {POPULAR_ENGINES.map((eng) => (
              <button
                key={eng.id}
                type="button"
                onClick={() => {
                  setSelectedEngine(eng.id);
                  onSelectEngine?.(eng.id as DatabaseEngine);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition active:scale-95 ${
                  selectedEngine.toLowerCase().includes(eng.id)
                    ? 'bg-teal-400 text-slate-950 shadow-md font-bold'
                    : 'bg-teal-900/60 text-teal-200 hover:bg-teal-800/80 border border-teal-700/50'
                }`}
              >
                {eng.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Control Strip */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white/90 border border-teal-200/80 shadow-xs backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 flex-1 min-w-[280px]">
          <div className="w-64">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-teal-600" /> Target Database Engine
            </label>
            <UniversalDbSelector
              selectedEngine={selectedEngine}
              onSelectEngine={(eng) => {
                setSelectedEngine(eng);
                onSelectEngine?.(eng as DatabaseEngine);
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-indigo-600" /> Estimated Peak Traffic
            </label>
            <select
              value={estimatedQps}
              onChange={(e) => setEstimatedQps(Number(e.target.value))}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-teal-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-800 shadow-2xs"
            >
              <option value={1000}>1,000 QPS (Standard Traffic)</option>
              <option value={5000}>5,000 QPS (High Traffic)</option>
              <option value={25000}>25,000 QPS (Enterprise Burst)</option>
              <option value={100000}>100,000 QPS (Hyper-scale Traffic)</option>
            </select>
          </div>

          <div className="self-end pb-0.5">
            <button
              type="button"
              onClick={() => setApplyPatch(!applyPatch)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border shadow-2xs active:scale-95 ${
                applyPatch
                  ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700 ring-2 ring-emerald-300'
                  : 'bg-gradient-to-r from-amber-50 to-orange-50 text-slate-800 border-amber-300 hover:bg-amber-100'
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${applyPatch ? 'text-amber-200 animate-spin' : 'text-amber-600'}`} />
              <span>{applyPatch ? 'Hardened: Tuning Patch Active (Simulated)' : 'Simulate 1-Click Hardening Patch'}</span>
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleAudit()}
          disabled={isLoading}
          className="px-5 py-2.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition active:scale-95 flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Auditing Engine...' : 'Re-Run Readiness Audit'}</span>
        </button>
      </div>

      {result && (
        <div className="space-y-6">
          {/* Executive Scorecard Banner */}
          <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 text-white border border-teal-500/40 shadow-xl flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div
                className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex flex-col items-center justify-center font-black border-2 shadow-lg transition-transform ${
                  result.letterGrade.startsWith('A')
                    ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500 shadow-emerald-950/50'
                    : result.letterGrade === 'B'
                    ? 'bg-blue-950/90 text-blue-300 border-blue-500 shadow-blue-950/50'
                    : result.letterGrade === 'C'
                    ? 'bg-amber-950/90 text-amber-300 border-amber-500 shadow-amber-950/50'
                    : 'bg-rose-950/90 text-rose-300 border-rose-500 shadow-rose-950/50'
                }`}
              >
                <span className="text-3xl sm:text-4xl">{result.letterGrade}</span>
                <span className="text-[11px] font-mono font-medium opacity-90">{result.overallScore} / 100</span>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-white">
                    {result.engineName} Production Health
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      result.riskLevel === 'LOW'
                        ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/40'
                        : result.riskLevel === 'MODERATE'
                        ? 'bg-amber-500/30 text-amber-300 border border-amber-400/40'
                        : 'bg-rose-500/30 text-rose-300 border border-rose-400/40 animate-pulse'
                    }`}
                  >
                    {result.riskLevel} RISK
                  </span>
                  {result.appliedTuningPatch && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/30 text-teal-300 border border-teal-400/40 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" /> Hardened
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
                  {result.executiveSummary}
                </p>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-teal-300/80 font-mono">
                  <span>Engine: <b>{result.engine}</b></span>
                  <span>•</span>
                  <span>Target Traffic: <b>{result.estimatedQps.toLocaleString()} QPS</b></span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 sm:gap-3 text-xs font-mono">
              <button
                type="button"
                onClick={() => setFilterStatus('PASSED')}
                className={`px-3 py-2 rounded-xl border text-center transition cursor-pointer ${
                  filterStatus === 'PASSED'
                    ? 'bg-emerald-900/60 border-emerald-400 text-emerald-200 ring-2 ring-emerald-500/50'
                    : 'bg-slate-800/80 border-emerald-500/30 text-emerald-300 hover:bg-slate-800'
                }`}
              >
                <span className="block text-xl font-black">{result.passedChecksCount}</span>
                <span className="text-[10px] uppercase text-emerald-400">Passed</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('WARNING')}
                className={`px-3 py-2 rounded-xl border text-center transition cursor-pointer ${
                  filterStatus === 'WARNING'
                    ? 'bg-amber-900/60 border-amber-400 text-amber-200 ring-2 ring-amber-500/50'
                    : 'bg-slate-800/80 border-amber-500/30 text-amber-300 hover:bg-slate-800'
                }`}
              >
                <span className="block text-xl font-black">{result.warningChecksCount}</span>
                <span className="text-[10px] uppercase text-amber-400">Warnings</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('FAILED')}
                className={`px-3 py-2 rounded-xl border text-center transition cursor-pointer ${
                  filterStatus === 'FAILED'
                    ? 'bg-rose-900/60 border-rose-400 text-rose-200 ring-2 ring-rose-500/50'
                    : 'bg-slate-800/80 border-rose-500/30 text-rose-300 hover:bg-slate-800'
                }`}
              >
                <span className="block text-xl font-black">{result.failedChecksCount}</span>
                <span className="text-[10px] uppercase text-rose-400">Critical</span>
              </button>
            </div>
          </div>

          {/* Dynamic Concurrency & Traffic Sizing HUD Cards */}
          {result.concurrencyMetrics && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-white border border-teal-200/80 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-bold text-slate-500 tracking-wider">Peak Active Concurrency</span>
                  <Activity className="w-4 h-4 text-teal-600" />
                </div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {result.concurrencyMetrics.estimatedConcurrentConnections.toLocaleString()}
                  <span className="text-xs font-semibold text-slate-500 ml-1">connections</span>
                </div>
                <p className="text-[11px] text-teal-700 mt-1 font-medium">
                  At {result.estimatedQps.toLocaleString()} QPS, based on ~15-25ms average query latency.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-teal-200/80 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-bold text-slate-500 tracking-wider">Connection Pool Ceiling</span>
                  <Server className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-2xl font-black text-indigo-950 mt-1">
                  {result.concurrencyMetrics.recommendedPoolerConnections}
                  <span className="text-xs font-semibold text-slate-500 ml-1">pool max</span>
                </div>
                <p className="text-[11px] text-indigo-700 mt-1 font-medium">
                  Recommended backend pooler cap (PgBouncer/ProxySQL/DRCP) to prevent CPU thread starvation.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-teal-200/80 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-bold text-slate-500 tracking-wider">Ingress / Egress NIC Bandwidth</span>
                  <Network className="w-4 h-4 text-teal-600" />
                </div>
                <div className="text-2xl font-black text-teal-950 mt-1">
                  {result.concurrencyMetrics.estimatedBandwidthMbSec}
                  <span className="text-xs font-semibold text-slate-500 ml-1">MB/s</span>
                </div>
                <p className="text-[11px] text-teal-700 mt-1 font-medium">
                  Sustained network transport demand across query payloads and result sets.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-teal-200/80 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-bold text-slate-500 tracking-wider">Sustained Disk IOPS Demand</span>
                  <Gauge className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl font-black text-amber-950 mt-1">
                  {result.concurrencyMetrics.estimatedIopsDemand.toLocaleString()}
                  <span className="text-xs font-semibold text-slate-500 ml-1">IOPS</span>
                </div>
                <p className="text-[11px] text-amber-700 mt-1 font-medium">
                  Provisioned storage IOPS required to avoid I/O wait latency spikes.
                </p>
              </div>
            </div>
          )}

          {/* Audit Checks Checklist with Filter Header */}
          <div className="rounded-2xl bg-white border border-teal-200/80 shadow-xs overflow-hidden">
            <div className="px-4 py-3.5 bg-teal-50/70 border-b border-teal-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-700" />
                <h3 className="text-xs font-black uppercase tracking-wider text-teal-950">
                  {result.engineName} 7-Vector Production Audit ({filteredChecks.length} of {result.checks.length} checks)
                </h3>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1 bg-white/80 p-0.5 rounded-xl border border-teal-200 text-xs">
                <button
                  type="button"
                  onClick={() => setFilterStatus('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    filterStatus === 'all'
                      ? 'bg-teal-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({result.checks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('FAILED')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    filterStatus === 'FAILED'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'text-rose-700 hover:text-rose-900'
                  }`}
                >
                  Critical ({result.failedChecksCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('WARNING')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    filterStatus === 'WARNING'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-amber-700 hover:text-amber-900'
                  }`}
                >
                  Warnings ({result.warningChecksCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('PASSED')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    filterStatus === 'PASSED'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-emerald-700 hover:text-emerald-900'
                  }`}
                >
                  Passed ({result.passedChecksCount})
                </button>
              </div>
            </div>

            <div className="divide-y divide-teal-100">
              {filteredChecks.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No checks match the filter "{filterStatus}".
                </div>
              ) : (
                filteredChecks.map((chk: ReadinessCheckItem) => (
                  <div key={chk.id} className="p-4 sm:p-5 hover:bg-teal-50/20 transition space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {chk.status === 'PASSED' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : chk.status === 'WARNING' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <h4 className="text-xs font-bold text-slate-900">{chk.title}</h4>
                        <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          {chk.category}
                        </span>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          chk.status === 'PASSED'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : chk.status === 'WARNING'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {chk.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">{chk.riskDescription}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700">
                        <span className="text-[10px] font-sans font-bold text-slate-500 block mb-0.5">
                          Current Setting:
                        </span>
                        {chk.currentValue}
                      </div>
                      <div className="p-2.5 rounded-xl bg-teal-50 text-teal-900 border border-teal-200">
                        <span className="text-[10px] font-sans font-bold text-teal-700 block mb-0.5">
                          Recommended Production Value:
                        </span>
                        {chk.recommendedValue}
                      </div>
                    </div>

                    {chk.remediationCommand && chk.status !== 'PASSED' && (
                      <div className="p-2.5 rounded-xl bg-slate-900 text-teal-300 font-mono text-xs flex items-center justify-between gap-2 overflow-x-auto">
                        <div className="flex items-center gap-2 truncate">
                          <Terminal className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                          <span className="truncate">{chk.remediationCommand}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(chk.remediationCommand)}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-teal-300 shrink-0 border border-slate-700"
                        >
                          Copy
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Remediation Script Card */}
          <div className="rounded-2xl bg-white border border-teal-200/80 shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-teal-400" />
                <span className="text-xs font-bold text-white">
                  1-Click Production Hardening Script ({result.engineName})
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleCopy(result.remediationScript)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-slate-800 text-teal-300 hover:bg-slate-700 border border-slate-700 transition active:scale-95"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-teal-400" />}
                <span>{copied ? 'Copied' : 'Copy Script'}</span>
              </button>
            </div>

            <pre className="p-4 font-mono text-xs sm:text-sm bg-slate-950 text-teal-200 overflow-x-auto selection:bg-teal-600 selection:text-white max-h-[400px]">
              {result.remediationScript}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
