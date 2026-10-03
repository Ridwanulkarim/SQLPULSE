import React, { useState, useEffect } from 'react';
import {
  GitCompare,
  Copy,
  Check,
  ShieldCheck,
  Layers
} from 'lucide-react';
import { UniversalDbSelector } from './UniversalDbSelector';
import { diffSchema } from '../services/api';
import { SchemaDiffResult, SchemaDiffChange } from '../types';
import { DbBrandLogo } from './DbBrandLogo';

export const SchemaDiffTab: React.FC = () => {
  const [selectedEngine, setSelectedEngine] = useState<string>('postgresql');
  const [sourceEnv, setSourceEnv] = useState<string>('Git Migration Branch (Source)');
  const [targetEnv, setTargetEnv] = useState<string>('Live Production Cluster (Target)');
  const [activeCodeTab, setActiveCodeTab] = useState<'forward' | 'rollback'>('forward');
  const [copied, setCopied] = useState<boolean>(false);
  const [filterImpact, setFilterImpact] = useState<string>('all');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<SchemaDiffResult | null>(null);

  const presets = [
    {
      label: '🛒 E-Commerce Schema Drift',
      source: 'Git Branch feature/2fa-orders',
      target: 'AWS RDS Aurora Production',
      engine: 'postgresql'
    },
    {
      label: '💳 SaaS Billing Precision Drift',
      source: 'Staging Environment v2.4',
      target: 'Google Cloud SQL Main',
      engine: 'mysql'
    },
    {
      label: '🏢 Enterprise ERP Constraint Sync',
      source: 'Dev Migration Release 14',
      target: 'Oracle Exadata Live',
      engine: 'oracle'
    }
  ];

  const handleDiff = async (engine = selectedEngine, src = sourceEnv, tgt = targetEnv) => {
    setIsLoading(true);
    try {
      const data = await diffSchema({
        engine,
        sourceEnv: src,
        targetEnv: tgt,
      });
      setResult(data);
    } catch (err: any) {
      alert(err.message || 'Failed to analyze schema diff.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleDiff(selectedEngine, sourceEnv, targetEnv);
  }, [selectedEngine, sourceEnv, targetEnv]);

  const handleApplyPreset = (p: typeof presets[0]) => {
    setSelectedEngine(p.engine);
    setSourceEnv(p.source);
    setTargetEnv(p.target);
    handleDiff(p.engine, p.source, p.target);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredChanges = result?.changes.filter((c: SchemaDiffChange) => {
    if (filterImpact === 'breaking') return c.impactLevel === 'BREAKING';
    if (filterImpact === 'safe') return c.impactLevel === 'SAFE';
    if (filterImpact === 'warning') return c.impactLevel === 'WARNING';
    return true;
  }) || [];

  return (
    <div className="space-y-6">
      
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 text-white shadow-xl shadow-indigo-950/20 border border-indigo-500/30 backdrop-blur-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 flex items-center gap-1">
              <GitCompare className="w-3 h-3 text-indigo-300" /> Schema Drift &amp; Reversible DDL
            </span>
            <span className="text-xs text-indigo-300 font-medium">
              Zero-Downtime Forward &amp; Rollback Migration Generator
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <GitCompare className="w-6 h-6 text-indigo-400" />
            Schema Diff &amp; Online Drift Studio
          </h2>
          <p className="text-xs sm:text-sm text-indigo-200/90 mt-1 max-w-3xl">
            Compare Dev/Staging vs Live Production schemas. Pinpoint missing tables, altered columns, unindexed foreign keys, and generate 100% reversible online DDLs.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
          <Layers className="w-3.5 h-3.5 text-indigo-600" /> Presets:
        </span>
        {presets.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleApplyPreset(p)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-indigo-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-400 shadow-sm transition active:scale-95"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-5 rounded-2xl bg-white/80 border border-indigo-200/70 shadow-sm backdrop-blur-md space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Target Database Engine
            </label>
            <UniversalDbSelector
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Source Environment / Branch
            </label>
            <input
              type="text"
              value={sourceEnv}
              onChange={(e) => setSourceEnv(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-indigo-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Target Environment / Live DB
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={targetEnv}
                onChange={(e) => setTargetEnv(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-indigo-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
              />
              <button
                type="button"
                onClick={() => handleDiff(selectedEngine, sourceEnv, targetEnv)}
                disabled={isLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition active:scale-95 shrink-0"
              >
                {isLoading ? 'Diffing...' : 'Compare ➔'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {result && (
        <div className="space-y-6">
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-white border border-indigo-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Drifts</span>
              <div className="text-2xl font-black text-indigo-700 font-mono">{result.totalDriftCount} Objects</div>
              <p className="text-[11px] text-slate-500">Mismatches detected</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-rose-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Breaking Changes</span>
              <div className="text-2xl font-black text-rose-600 font-mono">{result.breakingChangesCount} High Risk</div>
              <p className="text-[11px] text-rose-600 font-medium">Requires shadow column</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Online Safe</span>
              <div className="text-2xl font-black text-emerald-600 font-mono">{result.safeChangesCount} Safe</div>
              <p className="text-[11px] text-emerald-600 font-medium">Zero-downtime DDL</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Sync Integrity</span>
              <div className="text-2xl font-black text-purple-700 font-mono">{result.driftScore}%</div>
              <p className="text-[11px] text-purple-600 font-medium">Schema alignment</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-indigo-200/80 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-indigo-50/70 border-b border-indigo-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <DbBrandLogo engineId={selectedEngine} size={18} />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-950">
                  Detected Schema Drifts &amp; Discrepancies ({filteredChanges.length})
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterImpact('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${filterImpact === 'all' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-indigo-100'}`}
                >
                  All ({result.changes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterImpact('breaking')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${filterImpact === 'breaking' ? 'bg-rose-600 text-white' : 'bg-white text-rose-600 hover:bg-rose-50'}`}
                >
                  Breaking ({result.breakingChangesCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterImpact('safe')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${filterImpact === 'safe' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-600 hover:bg-emerald-50'}`}
                >
                  Safe ({result.safeChangesCount})
                </button>
              </div>
            </div>

            <div className="divide-y divide-indigo-100">
              {filteredChanges.map((change) => (
                <div key={change.id} className="p-4 hover:bg-indigo-50/30 transition space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                        change.impactLevel === 'BREAKING'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : change.impactLevel === 'WARNING'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {change.impactLevel}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-900">{change.targetObject}</span>
                      <span className="text-[11px] text-slate-500">({change.type})</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600">{change.description}</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded-xl bg-slate-900 text-purple-200 border border-slate-800">
                      <span className="text-[10px] font-sans font-bold text-slate-400 block mb-1">Source (Dev / Branch):</span>
                      {change.sourceDef}
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900 text-amber-200 border border-slate-800">
                      <span className="text-[10px] font-sans font-bold text-slate-400 block mb-1">Target (Live Prod):</span>
                      {change.targetDef}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-indigo-200/80 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('forward')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${activeCodeTab === 'forward' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Forward Online Migration SQL
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('rollback')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${activeCodeTab === 'rollback' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Reversible Rollback SQL
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleCopy(activeCodeTab === 'forward' ? result.forwardMigrationScript : result.rollbackMigrationScript)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-slate-800 text-indigo-300 hover:bg-slate-700 border border-slate-700 transition active:scale-95"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-indigo-400" />}
                <span>{copied ? 'Copied' : 'Copy Script'}</span>
              </button>
            </div>

            <pre className="p-4 font-mono text-xs sm:text-sm bg-slate-950 text-indigo-200 overflow-x-auto selection:bg-indigo-600 selection:text-white max-h-[450px]">
              {activeCodeTab === 'forward' ? result.forwardMigrationScript : result.rollbackMigrationScript}
            </pre>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/80 border border-indigo-200 shadow-sm space-y-2">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              Senior DBA Online Migration Safety Checklist
            </h4>
            <ul className="space-y-1.5 text-xs text-indigo-900 list-disc list-inside">
              {result.preflightChecks.map((check, idx) => (
                <li key={idx} className="leading-relaxed">{check}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
