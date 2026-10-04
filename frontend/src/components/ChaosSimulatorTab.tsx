import React, { useState, useEffect } from 'react';
import {
  Flame,
  Copy,
  Check,
  Activity,
  ShieldCheck,
  Server,
  AlertTriangle,
  Terminal,
  Zap,
  RefreshCw,
  Network,
  Database,
  Cpu,
  Radio,
} from 'lucide-react';
import { UniversalDbSelector } from './UniversalDbSelector';
import { simulateChaos } from '../services/api';
import { ChaosSimulationResult, ChaosStep, DatabaseEngine, DATABASE_CATALOG } from '../types';

interface ChaosSimulatorTabProps {
  selectedEngine?: DatabaseEngine | string;
  onSelectEngine?: (engine: DatabaseEngine) => void;
}

const POPULAR_ENGINES = [
  { id: 'postgresql', label: 'PostgreSQL' },
  { id: 'mysql', label: 'MySQL' },
  { id: 'oracle', label: 'Oracle' },
  { id: 'sqlserver', label: 'SQL Server' },
  { id: 'mongodb', label: 'MongoDB' },
  { id: 'redis', label: 'Redis' },
  { id: 'clickhouse', label: 'ClickHouse' },
  { id: 'cassandra', label: 'Cassandra' },
  { id: 'sqlite', label: 'SQLite' },
];

export const ChaosSimulatorTab: React.FC<ChaosSimulatorTabProps> = ({
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

  const [scenarioId, setScenarioId] = useState<string>('primary_crash');
  const [clusterSize, setClusterSize] = useState<number>(3);
  const [syncMode, setSyncMode] = useState<'sync' | 'async'>('sync');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ChaosSimulationResult | null>(null);

  const scenarios = [
    {
      id: 'primary_crash',
      label: '💥 Sudden Primary Crash & Quorum Failover',
      desc: 'Hardware kernel panic or OOM kill on leader node; automated election & promotion',
      category: 'Leader Election',
    },
    {
      id: 'network_split',
      label: '🌐 Split-Brain & Multi-AZ Network Partition',
      desc: 'Inter-AZ network severed; majority consensus quorum evaluation & node STONITH fencing',
      category: 'Consensus & Fencing',
    },
    {
      id: 'connection_starvation',
      label: '⚡ Thundering Herd & Connection Storm',
      desc: 'Lock cascading stall, worker thread saturation & pooler circuit breaker tripping',
      category: 'Concurrency & Locking',
    },
    {
      id: 'replica_lag_spike',
      label: '⏳ Replication Lag Avalanche & Read Hazard',
      desc: 'Bulk write ingestion delays replica apply stream; automated read pool ejection',
      category: 'Replication SLA',
    },
    {
      id: 'disk_out_of_space',
      label: '💾 WAL / Transaction Log Disk Exhaustion',
      desc: 'Unchecked log retention reaches 95% capacity; emergency read-only panic guard',
      category: 'Storage Capacity',
    },
  ];

  const handleSimulate = async () => {
    setIsLoading(true);
    try {
      const data = await simulateChaos({
        engine: selectedEngine,
        scenarioId,
        clusterSize,
        syncMode,
      });
      setResult(data);
    } catch (err: any) {
      alert(err.message || 'Failed to simulate chaos scenario.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleSimulate();
  }, [selectedEngine, scenarioId, clusterSize, syncMode]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const engineMeta = DATABASE_CATALOG.find(db => db.id === selectedEngine) || { name: selectedEngine, icon: '🗄️' };

  return (
    <div className="space-y-6 font-sans">
      {/* Hero Header */}
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-rose-950 via-slate-900 to-red-950 text-white shadow-xl shadow-rose-950/20 border border-rose-500/30 backdrop-blur-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-rose-500/30 text-rose-200 border border-rose-400/40 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-rose-300" /> Distributed Chaos &amp; Fault Injection Simulator
            </span>
            <span className="text-xs text-rose-300 font-medium">
              Leader Election • Quorum Consensus • Split-Brain Fencing • Circuit Breakers
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Flame className="w-6 h-6 text-rose-400" />
            High-Availability Chaos &amp; Disaster Simulator
          </h2>
          <p className="text-xs sm:text-sm text-rose-200/90 mt-1 max-w-3xl">
            Inject catastrophic production failures into a {engineMeta.name} cluster: sudden primary crashes, split-brain network blackholes, connection floods, and storage stalls. Verify automated failover timelines and zero-data-loss SLAs.
          </p>

          {/* Quick Engine Pills */}
          <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-3 border-t border-rose-800/40">
            <span className="text-[11px] text-rose-300/80 font-bold uppercase tracking-wider mr-1 flex items-center gap-1">
              <Database className="w-3 h-3 text-rose-400" /> Cluster Engine Presets:
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
                    ? 'bg-rose-400 text-slate-950 shadow-md font-bold'
                    : 'bg-rose-900/60 text-rose-200 hover:bg-rose-800/80 border border-rose-700/50'
                }`}
              >
                {eng.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cluster Configuration Strip */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white/95 border border-rose-200/80 shadow-xs backdrop-blur-md space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-rose-600" /> Target Database Engine
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
              <Server className="w-3.5 h-3.5 text-indigo-600" /> Cluster Node Topology
            </label>
            <select
              value={clusterSize}
              onChange={(e) => setClusterSize(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-rose-200 bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-400 shadow-2xs"
            >
              <option value={3}>3 Nodes (Standard HA Quorum: 2/3 votes)</option>
              <option value={5}>5 Nodes (Multi-AZ Resilient Quorum: 3/5 votes)</option>
              <option value={7}>7 Nodes (Global Geo-Distributed: 4/7 votes)</option>
              <option value={2}>2 Nodes + Witness (Edge Active/Standby)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Radio className="w-3.5 h-3.5 text-teal-600" /> Replication Commit Mode
            </label>
            <div className="flex rounded-xl border border-rose-200 p-0.5 bg-slate-50 text-xs">
              <button
                type="button"
                onClick={() => setSyncMode('sync')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition ${
                  syncMode === 'sync'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sync (Zero RPO)
              </button>
              <button
                type="button"
                onClick={() => setSyncMode('async')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition ${
                  syncMode === 'async'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Async (Lowest Latency)
              </button>
            </div>
          </div>
        </div>

        {/* Chaos Scenario Selector Grid */}
        <div className="pt-3 border-t border-rose-100">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-rose-600" /> Select Production Chaos Failure Scenario
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {scenarios.map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => setScenarioId(sc.id)}
                className={`p-3 rounded-2xl border text-left transition active:scale-95 space-y-1 flex flex-col justify-between ${
                  scenarioId === sc.id
                    ? 'bg-white border-rose-500 ring-2 ring-rose-500/20 shadow-md'
                    : 'bg-white/80 border-rose-200 hover:border-rose-400 hover:bg-rose-50/50'
                }`}
              >
                <div>
                  <span className="text-[9px] uppercase font-extrabold tracking-wider px-1.5 py-0.2 rounded bg-rose-100 text-rose-800">
                    {sc.category}
                  </span>
                  <h4 className="text-xs font-bold text-slate-900 mt-1">{sc.label}</h4>
                  <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{sc.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => handleSimulate()}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white shadow-md shadow-rose-500/20 transition flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Injecting Chaos Fault...' : 'Re-Run Chaos Simulation ➔'}</span>
          </button>
        </div>
      </div>

      {result && (
        <div className="space-y-6">
          {/* Executive Chaos Metrics HUD */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-white border border-rose-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Est. Failover Time
              </span>
              <div className="text-2xl sm:text-3xl font-black text-rose-600 font-mono">
                {result.totalDowntimeEstimatedSec}s
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                RTO to full service restoration
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">
                Data Loss Risk (RPO)
              </span>
              <div className="text-xl font-black text-emerald-600 font-mono">
                {result.dataLossRisk === 'ZERO_DATA_LOSS_SYNC' ? '0 Data Loss' : '< 1s Async Lag'}
              </div>
              <p className="text-[11px] text-emerald-700 truncate">
                {result.clusterTopologySummary?.syncMode === 'sync' ? 'Synchronous replication quorum' : 'Asynchronous LSN stream'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-indigo-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block">
                Resilience Rating
              </span>
              <div className="text-2xl sm:text-3xl font-black text-indigo-700 font-mono">
                {result.resilienceScore} / 100
              </div>
              <p className="text-[11px] text-indigo-700 truncate">
                Fault tolerance index
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-purple-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider block">
                Quorum Requirement
              </span>
              <div className="text-lg font-black text-purple-700 font-mono">
                {result.clusterTopologySummary?.quorumRequirement || `${Math.floor(clusterSize / 2) + 1}/${clusterSize} Nodes`}
              </div>
              <p className="text-[11px] text-purple-700 truncate">
                {result.clusterTopologySummary?.failoverManager || 'Automated Failover Manager'}
              </p>
            </div>
          </div>

          {/* Execution Timeline & State Machine Card */}
          <div className="rounded-2xl bg-white border border-rose-200/80 shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-rose-50/70 border-b border-rose-200 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-rose-950 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-rose-700" />
                {result.scenarioTitle} • Timeline &amp; State Machine
              </h3>
              <span className="text-[10px] font-mono text-rose-700 font-bold bg-white px-2 py-0.5 rounded border border-rose-200">
                Engine: {result.engineName}
              </span>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              <div className="relative border-l-2 border-rose-200 ml-4 space-y-6">
                {result.timeline.map((step: ChaosStep, idx: number) => (
                  <div key={idx} className="relative pl-6 space-y-1.5">
                    <div
                      className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 bg-white ${
                        step.clusterState === 'HEALTHY'
                          ? 'border-emerald-500 bg-emerald-50'
                          : step.clusterState === 'RECOVERED'
                          ? 'border-blue-500 bg-blue-50'
                          : step.clusterState === 'SPLIT_BRAIN'
                          ? 'border-rose-600 bg-rose-600'
                          : 'border-amber-500 bg-amber-50'
                      }`}
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-500">T+{step.timeOffsetSec}s:</span>
                        <h4 className="text-xs font-bold text-slate-900">{step.phase}</h4>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            step.clusterState === 'HEALTHY' || step.clusterState === 'RECOVERED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : step.clusterState === 'SPLIT_BRAIN'
                              ? 'bg-rose-600 text-white'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {step.clusterState}
                        </span>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          step.circuitBreakerStatus === 'CLOSED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : step.circuitBreakerStatus === 'HALF_OPEN'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        Circuit Breaker: {step.circuitBreakerStatus}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">{step.description}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono pt-1">
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
                        <span className="text-[10px] font-sans font-bold text-slate-400 block">Active Primary:</span>
                        {step.activePrimary}
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
                        <span className="text-[10px] font-sans font-bold text-slate-400 block">Client Impact:</span>
                        {step.clientImpact}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Actionable SRE Runbooks, Config Patches & Chaos Injection Script */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Runbook */}
            <div className="rounded-2xl bg-white border border-rose-200/80 shadow-xs overflow-hidden flex flex-col justify-between">
              <div>
                <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> SRE Recovery Runbook
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(result.mitigationRunbook, 'runbook')}
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-rose-300 hover:bg-slate-700 transition"
                  >
                    {copiedKey === 'runbook' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-rose-400" />}
                    <span>{copiedKey === 'runbook' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-4 font-mono text-xs bg-slate-950 text-rose-200 overflow-x-auto max-h-[300px] leading-relaxed">
                  {result.mitigationRunbook}
                </pre>
              </div>
            </div>

            {/* Config Patch */}
            <div className="rounded-2xl bg-white border border-rose-200/80 shadow-xs overflow-hidden flex flex-col justify-between">
              <div>
                <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-amber-400" /> Quorum HA Config Patch
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(result.recommendedConfigPatch, 'config')}
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-amber-300 hover:bg-slate-700 transition"
                  >
                    {copiedKey === 'config' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-amber-400" />}
                    <span>{copiedKey === 'config' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-4 font-mono text-xs bg-slate-950 text-amber-200 overflow-x-auto max-h-[300px] leading-relaxed">
                  {result.recommendedConfigPatch}
                </pre>
              </div>
            </div>

            {/* Executable Chaos Injection Script */}
            <div className="rounded-2xl bg-white border border-rose-200/80 shadow-xs overflow-hidden flex flex-col justify-between">
              <div>
                <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-cyan-400" /> Chaos Injection Script
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(result.chaosInjectionScript, 'script')}
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-cyan-300 hover:bg-slate-700 transition"
                  >
                    {copiedKey === 'script' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-cyan-400" />}
                    <span>{copiedKey === 'script' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-4 font-mono text-xs bg-slate-950 text-cyan-300 overflow-x-auto max-h-[300px] leading-relaxed">
                  {result.chaosInjectionScript}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
