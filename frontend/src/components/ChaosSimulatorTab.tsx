import React, { useState, useEffect } from 'react';
import {
  Flame,
  Copy,
  Check,
  Activity
} from 'lucide-react';
import { UniversalDbSelector } from './UniversalDbSelector';
import { simulateChaos } from '../services/api';
import { ChaosSimulationResult, ChaosStep } from '../types';

export const ChaosSimulatorTab: React.FC = () => {
  const [selectedEngine, setSelectedEngine] = useState<string>('postgresql');
  const [scenarioId, setScenarioId] = useState<string>('primary_crash');
  const [copied, setCopied] = useState<boolean>(false);
  const [result, setResult] = useState<ChaosSimulationResult | null>(null);

  const scenarios = [
    {
      id: 'primary_crash',
      label: '💥 Sudden Primary Crash & VIP Switch',
      desc: 'Hardware kernel panic on leader node & automated Raft/Patroni election'
    },
    {
      id: 'network_split',
      label: '🌐 Split-Brain & Multi-AZ Partition',
      desc: 'Network partition between data centers & quorum majority consensus'
    },
    {
      id: 'connection_starvation',
      label: '⚡ Thundering Herd & Pool Starvation',
      desc: 'Connection pooler saturation and unindexed lock cascading stall'
    }
  ];

  const handleSimulate = async () => {
    try {
      const data = await simulateChaos({
        engine: selectedEngine,
        scenarioId,
      });
      setResult(data);
    } catch (err: any) {
      alert(err.message || 'Failed to simulate chaos scenario.');
    }
  };

  useEffect(() => {
    handleSimulate();
  }, [selectedEngine, scenarioId]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-rose-950 via-slate-900 to-red-950 text-white shadow-xl shadow-rose-950/20 border border-rose-500/30 backdrop-blur-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-rose-500/30 text-rose-200 border border-rose-400/40 flex items-center gap-1">
              <Flame className="w-3 h-3 text-rose-300" /> Distributed Chaos &amp; Fault Injection
            </span>
            <span className="text-xs text-rose-300 font-medium">
              Crash Simulation, Split-Brain Quorum &amp; Automated Recovery
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Flame className="w-6 h-6 text-rose-400" />
            Chaos &amp; Fault Injection Simulator
          </h2>
          <p className="text-xs sm:text-sm text-rose-200/90 mt-1 max-w-3xl">
            Simulate catastrophic production failures: sudden primary crashes, split-brain network partitions, and connection storms. Verify circuit breakers and failover times.
          </p>
        </div>
      </div>

      {/* Engine Selector */}
      <div className="p-4 rounded-2xl bg-white/80 border border-rose-200 shadow-sm flex items-center justify-between gap-4">
        <div className="w-72">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Target Cluster Engine
          </label>
          <UniversalDbSelector
            selectedEngine={selectedEngine}
            onSelectEngine={setSelectedEngine}
          />
        </div>
        <p className="text-xs text-slate-500 hidden sm:block">
          Select target cluster dialect to test leader election, fencing, and quorum consensus.
        </p>
      </div>

      {/* Scenario Selector Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {scenarios.map((sc) => (
          <button
            key={sc.id}
            type="button"
            onClick={() => setScenarioId(sc.id)}
            className={`p-4 rounded-2xl border text-left transition active:scale-95 space-y-1 ${
              scenarioId === sc.id
                ? 'bg-white border-rose-500 ring-2 ring-rose-500/20 shadow-md'
                : 'bg-white/80 border-rose-200 hover:border-rose-400 hover:bg-rose-50/50'
            }`}
          >
            <h4 className="text-xs font-bold text-slate-900">{sc.label}</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">{sc.desc}</p>
          </button>
        ))}
      </div>

      {result && (
        <div className="space-y-6">
          {/* Key Metric Indicators */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-white border border-rose-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Est. Failover Time</span>
              <div className="text-2xl font-black text-rose-600 font-mono">{result.totalDowntimeEstimatedSec}s</div>
              <p className="text-[11px] text-slate-500">To full recovery</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Data Loss Risk</span>
              <div className="text-xl font-black text-emerald-600 font-mono">0 Data Loss</div>
              <p className="text-[11px] text-emerald-700">Sync replication quorum</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-indigo-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Resilience Score</span>
              <div className="text-2xl font-black text-indigo-700 font-mono">{result.resilienceScore}/100</div>
              <p className="text-[11px] text-indigo-700">Fault tolerance rating</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-purple-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Consensus Mode</span>
              <div className="text-lg font-black text-purple-700 font-mono">Raft Quorum (2/3)</div>
              <p className="text-[11px] text-purple-700">Fencing active</p>
            </div>
          </div>

          {/* Interactive Timeline Player & State Machine */}
          <div className="rounded-2xl bg-white border border-rose-200/80 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-rose-50/70 border-b border-rose-200 flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-rose-950 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-rose-700" />
                Chaos Event Execution Timeline &amp; State Machine
              </h3>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              <div className="relative border-l-2 border-rose-200 ml-4 space-y-6">
                {result.timeline.map((step: ChaosStep, idx: number) => (
                  <div key={idx} className="relative pl-6 space-y-1.5">
                    {/* Circle Node */}
                    <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 bg-white ${
                      step.clusterState === 'HEALTHY'
                        ? 'border-emerald-500 bg-emerald-50'
                        : step.clusterState === 'RECOVERED'
                        ? 'border-blue-500 bg-blue-50'
                        : step.clusterState === 'SPLIT_BRAIN'
                        ? 'border-rose-600 bg-rose-600'
                        : 'border-amber-500 bg-amber-50'
                    }`} />

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-500">T+{step.timeOffsetSec}s:</span>
                        <h4 className="text-xs font-bold text-slate-900">{step.phase}</h4>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          step.clusterState === 'HEALTHY' || step.clusterState === 'RECOVERED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {step.clusterState}
                        </span>
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        step.circuitBreakerStatus === 'CLOSED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        Circuit: {step.circuitBreakerStatus}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600">{step.description}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono pt-1">
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                        <span className="text-[10px] font-sans font-bold text-slate-400 block">Active Primary:</span>
                        {step.activePrimary}
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                        <span className="text-[10px] font-sans font-bold text-slate-400 block">Client Impact:</span>
                        {step.clientImpact}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mitigation Runbook & Configuration Patch */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-white border border-rose-200/80 shadow-sm overflow-hidden flex flex-col justify-between">
              <div>
                <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-white">SRE Mitigation Runbook</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(result.mitigationRunbook)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-slate-800 text-rose-300 hover:bg-slate-700 transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-rose-400" />}
                    <span>Copy</span>
                  </button>
                </div>
                <pre className="p-4 font-mono text-xs bg-slate-950 text-rose-200 overflow-x-auto max-h-[300px]">
                  {result.mitigationRunbook}
                </pre>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-rose-200/80 shadow-sm overflow-hidden flex flex-col justify-between">
              <div>
                <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Quorum / HA Config Patch</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(result.recommendedConfigPatch)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-slate-800 text-amber-300 hover:bg-slate-700 transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
                    <span>Copy</span>
                  </button>
                </div>
                <pre className="p-4 font-mono text-xs bg-slate-950 text-amber-200 overflow-x-auto max-h-[300px]">
                  {result.recommendedConfigPatch}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
