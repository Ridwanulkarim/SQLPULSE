import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Terminal,
  Activity
} from 'lucide-react';
import { UniversalDbSelector } from './UniversalDbSelector';
import { auditReadiness } from '../services/api';
import { ProductionReadinessResult, ReadinessCheckItem } from '../types';

export const ProductionReadinessTab: React.FC = () => {
  const [selectedEngine, setSelectedEngine] = useState<string>('postgresql');
  const [estimatedQps, setEstimatedQps] = useState<number>(5000);
  const [copied, setCopied] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ProductionReadinessResult | null>(null);

  const handleAudit = async () => {
    setIsLoading(true);
    try {
      const data = await auditReadiness({
        engine: selectedEngine,
        estimatedQps,
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
  }, [selectedEngine]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-teal-950 via-slate-900 to-indigo-950 text-white shadow-xl shadow-teal-950/20 border border-teal-500/30 backdrop-blur-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-teal-500/30 text-teal-200 border border-teal-400/40 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-teal-300" /> Pre-Flight Production Launch Auditor
            </span>
            <span className="text-xs text-teal-300 font-medium">
              SLA, SLO &amp; High-Availability Readiness Scorecard
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-teal-400" />
            Production Readiness &amp; Health Scorecard
          </h2>
          <p className="text-xs sm:text-sm text-teal-200/90 mt-1 max-w-3xl">
            Evaluate database configuration before high-traffic launch. Audits statement timeouts, autovacuum maintenance limits, connection ceiling, WAL continuous archiving, and encryption.
          </p>
        </div>
      </div>

      {/* Control Strip */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white/80 border border-teal-200/70 shadow-sm backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-[280px]">
          <div className="w-64">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Target Database
            </label>
            <UniversalDbSelector
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Estimated Peak QPS
            </label>
            <select
              value={estimatedQps}
              onChange={(e) => setEstimatedQps(Number(e.target.value))}
              className="px-3 py-2 text-xs font-medium rounded-xl border border-teal-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-800"
            >
              <option value={1000}>1,000 QPS (Standard)</option>
              <option value={5000}>5,000 QPS (High Traffic)</option>
              <option value={25000}>25,000 QPS (Enterprise Burst)</option>
              <option value={100000}>100,000 QPS (Hyper-scale)</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAudit}
          disabled={isLoading}
          className="px-5 py-2.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition active:scale-95 flex items-center gap-2"
        >
          <Activity className="w-4 h-4" />
          <span>{isLoading ? 'Auditing...' : 'Re-Run Readiness Audit ➔'}</span>
        </button>
      </div>

      {result && (
        <div className="space-y-6">
          {/* Executive Readiness Scorecard Banner */}
          <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-900 to-slate-950 text-white border border-teal-500/40 shadow-xl flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex flex-col items-center justify-center font-black text-2xl sm:text-3xl border-2 ${
                result.letterGrade.startsWith('A')
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500'
                  : result.letterGrade === 'B'
                  ? 'bg-blue-950 text-blue-300 border-blue-500'
                  : 'bg-rose-950 text-rose-300 border-rose-500'
              }`}>
                <span>{result.letterGrade}</span>
                <span className="text-[10px] font-mono font-normal">{result.overallScore}/100</span>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Executive Production Health Grade
                  </h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                    result.riskLevel === 'LOW' ? 'bg-emerald-500/30 text-emerald-300' : 'bg-rose-500/30 text-rose-300'
                  }`}>
                    {result.riskLevel} RISK
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                  {result.executiveSummary}
                </p>
              </div>
            </div>

            <div className="flex gap-3 text-xs font-mono">
              <div className="px-3 py-2 rounded-xl bg-slate-800/80 border border-emerald-500/30 text-emerald-300 text-center">
                <span className="block text-lg font-black">{result.passedChecksCount}</span>
                <span className="text-[10px] uppercase text-emerald-400">Passed</span>
              </div>
              <div className="px-3 py-2 rounded-xl bg-slate-800/80 border border-amber-500/30 text-amber-300 text-center">
                <span className="block text-lg font-black">{result.warningChecksCount}</span>
                <span className="text-[10px] uppercase text-amber-400">Warnings</span>
              </div>
              <div className="px-3 py-2 rounded-xl bg-slate-800/80 border border-rose-500/30 text-rose-300 text-center">
                <span className="block text-lg font-black">{result.failedChecksCount}</span>
                <span className="text-[10px] uppercase text-rose-400">Critical</span>
              </div>
            </div>
          </div>

          {/* Audit Checks Checklist */}
          <div className="rounded-2xl bg-white border border-teal-200/80 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-teal-50/70 border-b border-teal-200 flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-teal-950 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-teal-700" />
                Comprehensive 7-Vector Production Audit Checklist
              </h3>
            </div>

            <div className="divide-y divide-teal-100">
              {result.checks.map((chk: ReadinessCheckItem) => (
                <div key={chk.id} className="p-4 sm:p-5 hover:bg-teal-50/20 transition space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {chk.status === 'PASSED' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : chk.status === 'WARNING' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600" />
                      )}
                      <h4 className="text-xs font-bold text-slate-900">{chk.title}</h4>
                      <span className="text-[10px] uppercase font-bold text-slate-400">({chk.category})</span>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                      chk.status === 'PASSED'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : chk.status === 'WARNING'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}>
                      {chk.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">{chk.riskDescription}</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700">
                      <span className="text-[10px] font-sans font-bold text-slate-500 block mb-0.5">Current Setting:</span>
                      {chk.currentValue}
                    </div>
                    <div className="p-2.5 rounded-xl bg-teal-50 text-teal-900 border border-teal-200">
                      <span className="text-[10px] font-sans font-bold text-teal-700 block mb-0.5">Recommended Production Value:</span>
                      {chk.recommendedValue}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 1-Click Hardening Remediation Bash Script */}
          <div className="rounded-2xl bg-white border border-teal-200/80 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-teal-400" />
                <span className="text-xs font-bold text-white">
                  1-Click Production Hardening Remediation Script
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
