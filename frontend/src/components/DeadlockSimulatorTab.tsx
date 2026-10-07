import React, { useState, useEffect } from 'react';
import {
  Flame,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  AlertOctagon,
  Lock,
  GitCommit,
  ShieldCheck,
  Copy,
  Check
} from 'lucide-react';
import { UniversalDbSelector } from './UniversalDbSelector';
import { simulateDeadlockScenario } from '../services/api';
import { DeadlockSimulationResult, DATABASE_CATALOG } from '../types';

import { DatabaseEngine } from '../types';

interface DeadlockSimulatorTabProps {
  selectedEngine?: DatabaseEngine | string;
  onSelectEngine?: (engine: DatabaseEngine) => void;
}

export const DeadlockSimulatorTab: React.FC<DeadlockSimulatorTabProps> = ({
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

  const [activeCategory, setActiveCategory] = useState<string>('top_ranked');
  const [selectedScenario, setSelectedScenario] = useState<string>('circular_row_locks');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [result, setResult] = useState<DeadlockSimulationResult | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Automatically adjust concurrency scenario based on selected engine family
  useEffect(() => {
    const norm = selectedEngine.toLowerCase();
    if (norm.includes('redis') || norm.includes('valkey')) {
      setSelectedScenario('distributed_lock_race');
    } else if (norm.includes('mysql') || norm.includes('maria')) {
      setSelectedScenario('gap_locks_range');
    } else if (norm.includes('postgres') || norm.includes('oracle') || norm.includes('sqlserver')) {
      setSelectedScenario('circular_row_locks');
    }
  }, [selectedEngine]);

  const scenarios = [
    { id: 'circular_row_locks', label: '💥 Circular Row Lock Deadlock', desc: 'Order ➔ Account vs Account ➔ Order' },
    { id: 'inventory_oversell', label: '⚡ Inventory Oversell Race', desc: 'TOCTOU Concurrency Lost Update' },
    { id: 'gap_locks_range', label: '🛑 MySQL Gap Lock Deadlock', desc: 'Phantom Read Range & Insert Intention Lock' },
    { id: 'fk_cascade_escalation', label: '⛓️ FK Cascade Lock Escalation', desc: 'Missing Foreign Key Index Table Lock' },
    { id: 'distributed_lock_race', label: '🌐 Distributed Lock Expiry Race', desc: 'Redis Redlock Lease Expiry Split-Brain' },
  ];

  const handleSimulate = async () => {
    try {
      const res = await simulateDeadlockScenario({
        engine: selectedEngine,
        scenarioId: selectedScenario,
      });
      setResult(res);
      setCurrentStepIndex(res.steps.length - 1); 
    } catch (err: any) {
      alert(err.message || 'Simulation failed');
    }
  };

  useEffect(() => {
    handleSimulate();
  }, [selectedEngine, selectedScenario]);

  useEffect(() => {
    let timer: any;
    if (isPlaying && result) {
      timer = setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev >= result.steps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1800);
    }
    return () => clearInterval(timer);
  }, [isPlaying, result]);

  const handleCopyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const currentStep = result && result.steps[currentStepIndex] ? result.steps[currentStepIndex] : null;

  return (
    <div className="space-y-6">
      
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-rose-950 via-purple-950 to-slate-900 text-white shadow-xl shadow-rose-950/20 border border-rose-500/30 backdrop-blur-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-rose-500/30 text-rose-200 border border-rose-400/40">
              Interactive Concurrency Lab
            </span>
            <span className="text-xs text-rose-300 font-medium">
              Real-time Wait-For Graph Cycle Detection across 447 Database Engines
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Flame className="w-6 h-6 text-rose-500" />
            Deadlock &amp; Race Condition Visual Simulator
          </h2>
          <p className="text-xs sm:text-sm text-rose-200/90 mt-1 max-w-3xl">
            Step through concurrent transactions, inspect lock queues and row acquisitions, watch graph cycles form in real time, and apply 1-click deterministic ordering fixes for <span className="text-rose-300 font-bold">{DATABASE_CATALOG.find(d => d.id === selectedEngine)?.name || selectedEngine}</span>.
          </p>

          {/* Category Filter & Quick Engine Pills */}
          <div className="mt-4 pt-3 border-t border-rose-800/40 space-y-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              <span className="text-[11px] text-rose-300/90 font-bold uppercase tracking-wider shrink-0 mr-1">
                Engine Categories:
              </span>
              {[
                { id: 'top_ranked', label: '🏆 Top Ranked' },
                { id: 'relational', label: '🏛️ Relational (SQL)' },
                { id: 'document', label: '📄 Document NoSQL' },
                { id: 'keyvalue', label: '⚡ Key-Value & Redis' },
                { id: 'graph', label: '🕸️ Graph DBs' },
                { id: 'wide_column', label: '📦 Wide-Column' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition active:scale-95 ${
                    activeCategory === cat.id
                      ? 'bg-rose-400 text-slate-950 shadow-sm'
                      : 'bg-rose-900/50 text-rose-200 hover:bg-rose-800/70 border border-rose-700/40'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-rose-300/70 font-semibold uppercase tracking-wider mr-1">
                Quick Models:
              </span>
              {DATABASE_CATALOG.filter((db) => {
                if (activeCategory === 'top_ranked') return db.rank && db.rank <= 12;
                return db.category === activeCategory;
              }).slice(0, 10).map((eng) => {
                const isSelected = selectedEngine.toLowerCase() === eng.id.toLowerCase();
                return (
                  <button
                    key={eng.id}
                    type="button"
                    onClick={() => {
                      setSelectedEngine(eng.id);
                      onSelectEngine?.(eng.id as DatabaseEngine);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition active:scale-95 flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-rose-400 text-slate-950 shadow-md font-bold'
                        : 'bg-rose-950/70 text-rose-100 hover:bg-rose-900 border border-rose-700/40'
                    }`}
                  >
                    <span>{eng.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 rounded-2xl bg-white/80 border border-purple-200/80 shadow-sm space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Database Engine ({DATABASE_CATALOG.length} Supported)
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
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Select Concurrency Scenario Preset:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {scenarios.map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => {
                  setSelectedScenario(sc.id);
                  setCurrentStepIndex(0);
                  setIsPlaying(false);
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedScenario === sc.id
                    ? 'bg-purple-50 border-purple-500 shadow-sm ring-1 ring-purple-500'
                    : 'bg-white border-slate-200 hover:border-purple-300 hover:bg-purple-50/30'
                }`}
              >
                <div className="text-xs font-extrabold text-slate-900">{sc.label}</div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">{sc.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {result && currentStep && (
        <div className="space-y-6">
          
          <div className="p-4 rounded-2xl bg-slate-900 text-white border border-purple-500/30 shadow-lg flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-md transition active:scale-95 flex items-center gap-1.5 text-xs font-bold px-3"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isPlaying ? 'Pause' : 'Auto Play'}</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentStepIndex(0)}
                title="Restart"
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentStepIndex(prev => Math.min(result.steps.length - 1, prev + 1))}
                disabled={currentStepIndex >= result.steps.length - 1}
                title="Next Step"
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-40"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              {result.steps.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setCurrentStepIndex(idx);
                    setIsPlaying(false);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition whitespace-nowrap ${
                    currentStepIndex === idx
                      ? s.hasCycleDetected
                        ? 'bg-rose-600 text-white ring-2 ring-rose-400'
                        : 'bg-purple-600 text-white ring-2 ring-purple-400'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Step {s.stepIndex} ({s.timeSec.toFixed(1)}s)
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-400 font-mono">
              Step <span className="text-white font-bold">{currentStep.stepIndex}</span> of {result.steps.length}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
              currentStep.txAState.status === 'DEADLOCK_VICTIM'
                ? 'bg-rose-50/90 border-rose-300 shadow-md ring-1 ring-rose-300'
                : currentStep.txAState.status === 'ACQUIRED_LOCK'
                ? 'bg-emerald-50/90 border-emerald-300'
                : 'bg-white border-purple-200 shadow-sm'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-indigo-600 animate-pulse" />
                  <h3 className="text-sm font-black text-slate-900">Transaction A (PID: 80142)</h3>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                  currentStep.txAState.status === 'DEADLOCK_VICTIM'
                    ? 'bg-rose-600 text-white'
                    : currentStep.txAState.status === 'WAITING'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                    : currentStep.txAState.status === 'ACQUIRED_LOCK'
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {currentStep.txAState.status}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 font-mono text-xs text-indigo-300 overflow-x-auto mb-3">
                {currentStep.txAState.statement}
              </div>
              <div className="space-y-1 text-xs">
                {currentStep.txAState.lockHeld && (
                  <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
                    <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Held: <strong>{currentStep.txAState.lockHeld}</strong></span>
                  </div>
                )}
                {currentStep.txAState.lockWaiting && (
                  <div className="flex items-center gap-1.5 text-amber-800 font-medium">
                    <AlertOctagon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Waiting on: <strong>{currentStep.txAState.lockWaiting}</strong></span>
                  </div>
                )}
              </div>
            </div>

            <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
              currentStep.txBState.status === 'DEADLOCK_VICTIM'
                ? 'bg-rose-50/90 border-rose-300 shadow-md ring-1 ring-rose-300'
                : currentStep.txBState.status === 'ACQUIRED_LOCK'
                ? 'bg-emerald-50/90 border-emerald-300'
                : 'bg-white border-purple-200 shadow-sm'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-purple-600 animate-pulse" />
                  <h3 className="text-sm font-black text-slate-900">Transaction B (PID: 80145)</h3>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                  currentStep.txBState.status === 'DEADLOCK_VICTIM'
                    ? 'bg-rose-600 text-white'
                    : currentStep.txBState.status === 'WAITING'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                    : currentStep.txBState.status === 'ACQUIRED_LOCK'
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {currentStep.txBState.status}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 font-mono text-xs text-purple-300 overflow-x-auto mb-3">
                {currentStep.txBState.statement}
              </div>
              <div className="space-y-1 text-xs">
                {currentStep.txBState.lockHeld && (
                  <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
                    <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Held: <strong>{currentStep.txBState.lockHeld}</strong></span>
                  </div>
                )}
                {currentStep.txBState.lockWaiting && (
                  <div className="flex items-center gap-1.5 text-amber-800 font-medium">
                    <AlertOctagon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Waiting on: <strong>{currentStep.txBState.lockWaiting}</strong></span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-purple-200 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 mb-2">
                  <GitCommit className="w-4 h-4 text-purple-600" />
                  Live Wait-For Dependency Graph
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Directed lock dependency edges between active transaction processes.
                </p>
              </div>

              <div className="w-full h-48 rounded-xl bg-slate-950 border border-purple-500/30 flex items-center justify-center relative overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 400 180">
                  <defs>
                    <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#F43F5E" />
                    </marker>
                    <marker id="arrow-blue" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#8B5CF6" />
                    </marker>
                  </defs>

                  <g transform="translate(70, 90)">
                    <circle r="36" fill="#4F46E5" fillOpacity="0.2" stroke="#818CF8" strokeWidth="2" />
                    <text textAnchor="middle" dy="-4" fill="#FFFFFF" fontSize="11" fontWeight="bold">Tx A</text>
                    <text textAnchor="middle" dy="12" fill="#C7D2FE" fontSize="9">PID 80142</text>
                  </g>

                  <g transform="translate(330, 90)">
                    <circle r="36" fill="#7C3AED" fillOpacity="0.2" stroke="#C084FC" strokeWidth="2" />
                    <text textAnchor="middle" dy="-4" fill="#FFFFFF" fontSize="11" fontWeight="bold">Tx B</text>
                    <text textAnchor="middle" dy="12" fill="#E9D5FF" fontSize="9">PID 80145</text>
                  </g>

                  {currentStep.hasCycleDetected ? (
                    <>
                      
                      <path
                        d="M 106 65 Q 200 20 294 65"
                        fill="none"
                        stroke="#F43F5E"
                        strokeWidth="3"
                        strokeDasharray="4 4"
                        className="animate-pulse"
                        markerEnd="url(#arrow)"
                      />
                      <text x="200" y="32" textAnchor="middle" fill="#FDA4AF" fontSize="10" fontWeight="bold">
                        Waits for Tx B (accounts #942)
                      </text>

                      <path
                        d="M 294 115 Q 200 160 106 115"
                        fill="none"
                        stroke="#F43F5E"
                        strokeWidth="3"
                        strokeDasharray="4 4"
                        className="animate-pulse"
                        markerEnd="url(#arrow)"
                      />
                      <text x="200" y="155" textAnchor="middle" fill="#FDA4AF" fontSize="10" fontWeight="bold">
                        Waits for Tx A (orders #101)
                      </text>
                    </>
                  ) : currentStep.txAState.status === 'WAITING' ? (
                    <>
                      <path
                        d="M 106 65 Q 200 20 294 65"
                        fill="none"
                        stroke="#8B5CF6"
                        strokeWidth="2"
                        markerEnd="url(#arrow-blue)"
                      />
                      <text x="200" y="32" textAnchor="middle" fill="#C084FC" fontSize="10">
                        Blocked by Tx B
                      </text>
                    </>
                  ) : (
                    <text x="200" y="95" textAnchor="middle" fill="#64748B" fontSize="11" fontStyle="italic">
                      No Cross-Transaction Blocking Cycle
                    </text>
                  )}
                </svg>
              </div>

              {currentStep.hasCycleDetected && (
                <div className="mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-800 text-xs font-bold flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Cycle Detected in Wait-For Graph: Deadlock Condition Active!</span>
                </div>
              )}
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 mb-1">
                  Timeline Event Analysis (Step {currentStep.stepIndex})
                </h3>
                <p className="text-xs text-slate-700 leading-relaxed bg-purple-50/60 p-3 rounded-xl border border-purple-100">
                  {currentStep.explanation}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Active Lock Table in Memory:
                </h4>
                {currentStep.activeLocks.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No locks currently held.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-2.5">Resource ID</th>
                          <th className="py-2 px-2.5">Lock Mode</th>
                          <th className="py-2 px-2.5">Held By</th>
                          <th className="py-2 px-2.5">Waiting Queue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {currentStep.activeLocks.map((l, idx) => (
                          <tr key={idx}>
                            <td className="py-2 px-2.5 font-bold text-purple-950">{l.resource}</td>
                            <td className="py-2 px-2.5 text-slate-600">{l.lockMode}</td>
                            <td className="py-2 px-2.5 text-emerald-700 font-bold">{l.heldByTx}</td>
                            <td className="py-2 px-2.5 text-rose-600 font-bold">
                              {l.waitingTx.length > 0 ? l.waitingTx.join(', ') : 'None'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-extrabold text-slate-900">
                  Root Cause Diagnosis &amp; Remediation Playbook
                </h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{result.rootCause}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {result.remedies.map((rem, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-purple-200 bg-purple-50/30 flex flex-col justify-between space-y-3">
                  <div>
                    <h4 className="text-xs font-bold text-purple-950 mb-1">{rem.title}</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{rem.explanation}</p>
                  </div>
                  <div className="relative">
                    <pre className="p-3 rounded-lg bg-slate-900 text-purple-200 font-mono text-[11px] overflow-x-auto">
                      {rem.codeSnippet}
                    </pre>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(rem.codeSnippet, idx)}
                      className="absolute top-2 right-2 p-1 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700"
                      title="Copy SQL Fix"
                    >
                      {copiedIndex === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
